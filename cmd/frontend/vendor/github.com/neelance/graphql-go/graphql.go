package graphql

import (
	"context"
	"fmt"
	stdlog "log"
	"strconv"

	"sourcegraph.com/sourcegraph/sourcegraph/pkg/env"

	"encoding/json"

	"github.com/neelance/graphql-go/errors"
	"github.com/neelance/graphql-go/internal/common"
	"github.com/neelance/graphql-go/internal/exec"
	"github.com/neelance/graphql-go/internal/exec/resolvable"
	"github.com/neelance/graphql-go/internal/exec/selected"
	"github.com/neelance/graphql-go/internal/query"
	"github.com/neelance/graphql-go/internal/schema"
	"github.com/neelance/graphql-go/internal/validation"
	"github.com/neelance/graphql-go/introspection"
	"github.com/neelance/graphql-go/log"
	"github.com/neelance/graphql-go/trace"
	"github.com/prometheus/client_golang/prometheus"
)

// ParseSchema parses a GraphQL schema and attaches the given root resolver. It returns an error if
// the Go type signature of the resolvers does not match the schema. If nil is passed as the
// resolver, then the schema can not be executed, but it may be inspected (e.g. with ToJSON).
func ParseSchema(schemaString string, resolver interface{}, opts ...SchemaOpt) (*Schema, error) {
	s := &Schema{
		schema:         schema.New(),
		maxParallelism: 10,
		tracer:         trace.OpenTracingTracer{},
		logger:         &log.DefaultLogger{},
	}
	for _, opt := range opts {
		opt(s)
	}

	if err := s.schema.Parse(schemaString); err != nil {
		return nil, err
	}

	if resolver != nil {
		r, err := resolvable.ApplyResolver(s.schema, resolver)
		if err != nil {
			return nil, err
		}
		s.res = r
	}

	return s, nil
}

// MustParseSchema calls ParseSchema and panics on error.
func MustParseSchema(schemaString string, resolver interface{}, opts ...SchemaOpt) *Schema {
	s, err := ParseSchema(schemaString, resolver, opts...)
	if err != nil {
		panic(err)
	}
	return s
}

// Schema represents a GraphQL schema with an optional resolver.
type Schema struct {
	schema *schema.Schema
	res    *resolvable.Schema

	maxParallelism int
	tracer         trace.Tracer
	logger         log.Logger
}

// SchemaOpt is an option to pass to ParseSchema or MustParseSchema.
type SchemaOpt func(*Schema)

// MaxParallelism specifies the maximum number of resolvers per request allowed to run in parallel. The default is 10.
func MaxParallelism(n int) SchemaOpt {
	return func(s *Schema) {
		s.maxParallelism = n
	}
}

// Tracer is used to trace queries and fields. It defaults to trace.OpenTracingTracer.
func Tracer(tracer trace.Tracer) SchemaOpt {
	return func(s *Schema) {
		s.tracer = tracer
	}
}

// Logger is used to log panics durring query execution. It defaults to exec.DefaultLogger.
func Logger(logger log.Logger) SchemaOpt {
	return func(s *Schema) {
		s.logger = logger
	}
}

// Response represents a typical response of a GraphQL server. It may be encoded to JSON directly or
// it may be further processed to a custom response type, for example to include custom error data.
type Response struct {
	Data       json.RawMessage        `json:"data,omitempty"`
	Errors     []*errors.QueryError   `json:"errors,omitempty"`
	Extensions map[string]interface{} `json:"extensions,omitempty"`
}

// Validate validates the given query with the schema.
func (s *Schema) Validate(queryString string) []*errors.QueryError {
	doc, qErr := query.Parse(queryString)
	if qErr != nil {
		return []*errors.QueryError{qErr}
	}

	return validation.Validate(s.schema, doc)
}

// Exec executes the given query with the schema's resolver. It panics if the schema was created
// without a resolver. If the context get cancelled, no further resolvers will be called and a
// the context error will be returned as soon as possible (not immediately).
func (s *Schema) Exec(ctx context.Context, queryString string, operationName string, variables map[string]interface{}) *Response {
	if s.res == nil {
		panic("schema created without resolver, can not exec")
	}
	return s.exec(ctx, queryString, operationName, variables, s.res)
}

// HACK
var (
	strictValidationFails = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace: "frontend",
		Subsystem: "graphql",
		Name:      "strict_validation_fails",
		Help:      "Total number of times a request fails only in the new validation.",
	})
	validationFails = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace: "frontend",
		Subsystem: "graphql",
		Name:      "validation_fails",
		Help:      "Total number of times a request fails validation.",
	})
	parseFails = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace: "frontend",
		Subsystem: "graphql",
		Name:      "parse_fails",
		Help:      "Total number of times a request fails query parsing.",
	})
	logBadRequests bool
)

func init() {
	prometheus.MustRegister(strictValidationFails)
	prometheus.MustRegister(validationFails)
	prometheus.MustRegister(parseFails)
	logBadRequests, _ = strconv.ParseBool(env.Get("GRAPHQL_LOG_BAD_REQUESTS", "false", ""))
}

func (s *Schema) exec(ctx context.Context, queryString string, operationName string, variables map[string]interface{}, res *resolvable.Schema) *Response {
	doc, qErr := query.Parse(queryString)
	if qErr != nil {
		parseFails.Inc()
		if logBadRequests {
			stdlog.Printf("graphql parse fails for %s %q: %v", operationName, queryString, qErr)
		}
		return &Response{Errors: []*errors.QueryError{qErr}}
	}

	errs := validation.Validate(s.schema, doc)
	if len(errs) != 0 {
		// HACK ignore the nullable error for now. If all we have is nullable,
		// log it and continue. Once prod never receives a bad request, we can
		// remove this fork and always do the stricter validation.
		allNullable := true
		for _, err := range errs {
			if err.Rule != "VariablesInAllowedPositionNullable" {
				allNullable = false
			}
		}
		if !allNullable {
			validationFails.Inc()
			if logBadRequests {
				stdlog.Printf("graphql validation fails for %s %q: %v", operationName, queryString, errs[0])
			}
			return &Response{Errors: errs}
		}
		strictValidationFails.Inc()
		if logBadRequests {
			stdlog.Printf("graphql strict validation fails for %s %q: %v", operationName, queryString, errs[0])
		}
	}

	op, err := getOperation(doc, operationName)
	if err != nil {
		return &Response{Errors: []*errors.QueryError{errors.Errorf("%s", err)}}
	}

	r := &exec.Request{
		Request: selected.Request{
			Doc:    doc,
			Vars:   variables,
			Schema: s.schema,
		},
		Limiter: make(chan struct{}, s.maxParallelism),
		Tracer:  s.tracer,
		Logger:  s.logger,
	}
	varTypes := make(map[string]*introspection.Type)
	for _, v := range op.Vars {
		t, err := common.ResolveType(v.Type, s.schema.Resolve)
		if err != nil {
			return &Response{Errors: []*errors.QueryError{err}}
		}
		varTypes[v.Name.Name] = introspection.WrapType(t)
	}
	traceCtx, finish := s.tracer.TraceQuery(ctx, queryString, operationName, variables, varTypes)
	data, errs := r.Execute(traceCtx, res, op)
	finish(errs)

	return &Response{
		Data:   data,
		Errors: errs,
	}
}

func getOperation(document *query.Document, operationName string) (*query.Operation, error) {
	if len(document.Operations) == 0 {
		return nil, fmt.Errorf("no operations in query document")
	}

	if operationName == "" {
		if len(document.Operations) > 1 {
			return nil, fmt.Errorf("more than one operation in query document and no operation name given")
		}
		for _, op := range document.Operations {
			return op, nil // return the one and only operation
		}
	}

	op := document.Operations.Get(operationName)
	if op == nil {
		return nil, fmt.Errorf("no operation with name %q", operationName)
	}
	return op, nil
}
