package graphqlbackend

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"strings"

	"github.com/sourcegraph/sourcegraph/cmd/frontend/graphqlbackend/graphqlutil"
)

type ExpSymbolsArgs struct {
	Filters *SymbolFilters
}

func (r *GitTreeEntryResolver) ExpSymbols(ctx context.Context, args *ExpSymbolsArgs) (*ExpSymbolConnection, error) {
	lsifResolver, err := r.LSIF(ctx, &struct{ ToolName *string }{})
	if err != nil {
		return nil, err
	}
	if lsifResolver == nil {
		return nil, errors.New("LSIF data is not available")
	}

	symbolConnection, err := lsifResolver.Symbols(ctx, &LSIFSymbolsArgs{Filters: args.Filters})
	if err != nil {
		return nil, err
	}
	symbols, err := symbolConnection.Nodes(ctx)
	if err != nil {
		return nil, err
	}

	expSymbols := make([]*ExpSymbol, len(symbols))
	for i, symbol := range symbols {
		expSymbols[i] = &ExpSymbol{sym: symbol, tree: r}
	}
	return (*ExpSymbolConnection)(&expSymbols), nil
}

type ExpSymbolConnection []*ExpSymbol

func (c ExpSymbolConnection) Nodes() []*ExpSymbol             { return c }
func (c ExpSymbolConnection) TotalCount() int32               { return int32(len(c)) }
func (c ExpSymbolConnection) PageInfo() *graphqlutil.PageInfo { return graphqlutil.HasNextPage(false) }

type ExpSymbol struct {
	sym  SymbolResolver
	tree *GitTreeEntryResolver
}

func (r *ExpSymbol) Text() string { return r.sym.Text() }

func (r *ExpSymbol) Detail() *string { return r.sym.Detail() }

func (r *ExpSymbol) Kind() string/* enum SymbolKind */ { return r.sym.Kind() }

func (r *ExpSymbol) Monikers() []MonikerResolver { return r.sym.Monikers() }

func (r *ExpSymbol) Definitions(ctx context.Context) (LocationConnectionResolver, error) {
	return r.sym.Definitions(ctx)
}

func (r *ExpSymbol) References(ctx context.Context) (LocationConnectionResolver, error) {
	return r.sym.References(ctx)
}

func (r *ExpSymbol) Hover(ctx context.Context) (HoverResolver, error) {
	return r.sym.Hover(ctx)
}

func (r *ExpSymbol) url(prefix string) string {
	if len(r.sym.Monikers()) > 0 {
		moniker := r.sym.Monikers()[0]
		return prefix + "/-/symbols/" + url.PathEscape(moniker.Scheme()) + "/" + strings.Replace(url.PathEscape(moniker.Identifier()), "%2F", "/", -1)
	}

	path, line, end := r.sym.Location()
	tree := *r.tree
	tree.stat = fileInfo{path: path}
	u, _ := tree.urlPath(prefix)
	return u + fmt.Sprintf("#L%d-%d", line+1, end+1)
}

func (r *ExpSymbol) URL(ctx context.Context) (string, error) {
	prefix, err := r.tree.commit.repoRevURL()
	if err != nil {
		return "", err
	}
	return r.url(prefix), nil
}

func (r *ExpSymbol) CanonicalURL() (string, error) {
	prefix, err := r.tree.commit.canonicalRepoRevURL()
	if err != nil {
		return "", err
	}
	return r.url(prefix), nil
}

func (r *ExpSymbol) Children() []*ExpSymbol {
	children := make([]*ExpSymbol, len(r.sym.Children()))
	for i, childSymbol := range r.sym.Children() {
		children[i] = &ExpSymbol{
			sym:  childSymbol,
			tree: r.tree,
		}
	}
	return children
}
