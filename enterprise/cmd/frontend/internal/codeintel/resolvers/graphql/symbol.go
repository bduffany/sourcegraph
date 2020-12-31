package graphql

import (
	"context"
	"path"

	gql "github.com/sourcegraph/sourcegraph/cmd/frontend/graphqlbackend"
	"github.com/sourcegraph/sourcegraph/enterprise/cmd/frontend/internal/codeintel/resolvers"
	"github.com/sourcegraph/sourcegraph/enterprise/internal/codeintel/stores/lsifstore"
)

type newQueryResolver func(ctx context.Context, path string) (*QueryResolver, error)

type SymbolResolver struct {
	symbol resolvers.AdjustedSymbol

	locationResolver *CachedLocationResolver
	newQueryResolver newQueryResolver
}

func NewSymbolResolver(symbol resolvers.AdjustedSymbol, locationResolver *CachedLocationResolver, newQueryResolver newQueryResolver) gql.SymbolResolver {
	return &SymbolResolver{
		symbol:           symbol,
		locationResolver: locationResolver,
		newQueryResolver: newQueryResolver,
	}
}

func (r *SymbolResolver) Text() string {
	return r.symbol.Text
}

func (r *SymbolResolver) Monikers() []gql.MonikerResolver {
	var monikers []gql.MonikerResolver
	for _, m := range r.symbol.Monikers {
		monikers = append(monikers, NewMonikerResolver(m))
	}
	return monikers
}

func (r *SymbolResolver) Definitions(ctx context.Context) (gql.LocationConnectionResolver, error) {
	var adjustedLocations []resolvers.AdjustedLocation
	for _, loc := range r.symbol.Locations {
		adjustedLocations = append(adjustedLocations, resolvers.AdjustedLocation{
			Dump:           r.symbol.Dump,
			Path:           path.Clean(loc.URI),
			AdjustedCommit: r.symbol.Dump.Commit,
			AdjustedRange: lsifstore.Range{
				Start: lsifstore.Position{Line: loc.Range.Start.Line, Character: loc.Range.Start.Character},
				End:   lsifstore.Position{Line: loc.Range.End.Line, Character: loc.Range.End.Character},
			},
		})
	}
	return NewLocationConnectionResolver(adjustedLocations, nil, r.locationResolver), nil
}

func (r *SymbolResolver) References(ctx context.Context) (gql.LocationConnectionResolver, error) {
	if len(r.symbol.Locations) == 0 {
		// TODO(sqs): instead, look up by moniker
		return NewLocationConnectionResolver(nil, nil, nil), nil
	}
	queryResolver, err := r.newQueryResolver(ctx, path.Clean(r.symbol.Locations[0].URI))
	if err != nil {
		return nil, err
	}
	return queryResolver.References(ctx, &gql.LSIFPagedQueryPositionArgs{
		LSIFQueryPositionArgs: gql.LSIFQueryPositionArgs{
			Line:      int32(r.symbol.Locations[0].Range.Start.Line),
			Character: int32(r.symbol.Locations[0].Range.Start.Character),
		},
	})
}

func (r *SymbolResolver) Hover(ctx context.Context) (gql.HoverResolver, error) {
	if len(r.symbol.Locations) == 0 {
		return nil, nil
	}
	queryResolver, err := r.newQueryResolver(ctx, path.Clean(r.symbol.Locations[0].URI))
	if err != nil {
		return nil, err
	}
	return queryResolver.Hover(ctx, &gql.LSIFQueryPositionArgs{
		Line:      int32(r.symbol.Locations[0].Range.Start.Line),
		Character: int32(r.symbol.Locations[0].Range.Start.Character),
	})
}

func (r *SymbolResolver) Children() []gql.SymbolResolver {
	children := make([]gql.SymbolResolver, len(r.symbol.Children))
	for i, childSymbol := range r.symbol.Children {
		children[i] = &SymbolResolver{
			symbol:           resolvers.AdjustedSymbol{Symbol: childSymbol},
			locationResolver: r.locationResolver,
			newQueryResolver: r.newQueryResolver,
		}
	}
	return children
}

func (r *SymbolResolver) Location() (path string, line, end int) {
	if len(r.symbol.Locations) == 0 {
		return "", 0, 0
	}
	return r.symbol.Locations[0].URI, r.symbol.Locations[0].FullRange.Start.Line, r.symbol.Locations[0].FullRange.End.Line
}
