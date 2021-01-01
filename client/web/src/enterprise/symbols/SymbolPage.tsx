import React, { useEffect, useMemo } from 'react'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'
import { dataOrThrowErrors, gql } from '../../../../shared/src/graphql/graphql'
import { useObservable } from '../../../../shared/src/util/useObservable'
import { requestGraphQL } from '../../backend/graphql'
import { BreadcrumbSetters } from '../../components/Breadcrumbs'
import { RepoHeaderContributionsLifecycleProps } from '../../repo/RepoHeader'
import { eventLogger } from '../../tracking/eventLogger'
import {
    ExpSymbolDetailFields,
    RepositoryExpSymbolResult,
    RepositoryExpSymbolVariables,
} from '../../graphql-operations'
import { RepoRevisionContainerContext } from '../../repo/RepoRevisionContainer'
import { RouteComponentProps } from 'react-router'
import { SettingsCascadeProps } from '../../../../shared/src/settings/settings'
import { ExpSymbolDetailGQLFragment, SymbolDetail } from './SymbolDetail'
import { SymbolsSidebarOptionsSetterProps } from './SymbolsArea'
import { SymbolsViewOptionsProps } from './useSymbolsViewOptions'
import { LoadingSpinner } from '@sourcegraph/react-loading-spinner'
import { ContainerSymbolsList } from './ContainerSymbolsList'
import { Link } from 'react-router-dom'
import { memoizeObservable } from '../../../../shared/src/util/memoizeObservable'

const queryRepositorySymbolUncached = (
    vars: RepositoryExpSymbolVariables & { scheme: string; identifier: string }
): Observable<{
    symbol: ExpSymbolDetailFields & { children: (ExpSymbolDetailFields & { children: ExpSymbolDetailFields[] })[] }

    containerSymbol: ExpSymbolDetailFields & {
        children: (ExpSymbolDetailFields & { children: ExpSymbolDetailFields[] })[]
    }
} | null> =>
    requestGraphQL<RepositoryExpSymbolResult, RepositoryExpSymbolVariables>(
        gql`
            query RepositoryExpSymbol($repo: ID!, $revision: String!, $filters: SymbolFilters!) {
                node(id: $repo) {
                    ... on Repository {
                        commit(rev: $revision) {
                            tree(path: "") {
                                expSymbols(filters: $filters) {
                                    nodes {
                                        ...ExpSymbolDetailFields
                                        children {
                                            ...ExpSymbolDetailFields
                                            children {
                                                ...ExpSymbolDetailFields
                                            }
                                        }
                                        ...ExpSymbolDetailFields
                                    }
                                }
                            }
                        }
                    }
                }
            }
            ${ExpSymbolDetailGQLFragment}
        `,
        vars
    ).pipe(
        map(dataOrThrowErrors),
        map(data => {
            // eslint-disable-next-line unicorn/consistent-function-scoping
            const match = (sym: ExpSymbolDetailFields): boolean =>
                sym.monikers.some(moniker => moniker.scheme === vars.scheme && moniker.identifier === vars.identifier)
            for (const node of data.node?.commit?.tree?.expSymbols?.nodes || []) {
                if (match(node)) {
                    return { symbol: node, containerSymbol: node }
                }
                for (const child of node.children) {
                    if (match(child)) {
                        return { symbol: child, containerSymbol: node }
                    }
                    for (const childChild of child.children) {
                        if (match(childChild)) {
                            return { symbol: childChild, containerSymbol: node }
                        }
                    }
                }
            }
            return null
        })
    )

const queryRepositorySymbol = memoizeObservable(queryRepositorySymbolUncached, parameters => JSON.stringify(parameters))

export interface SymbolRouteProps {
    scheme: string
    identifier: string
}

interface Props
    extends Pick<RepoRevisionContainerContext, 'repo' | 'resolvedRev' | 'revision'>,
        RouteComponentProps<SymbolRouteProps>,
        RepoHeaderContributionsLifecycleProps,
        BreadcrumbSetters,
        SettingsCascadeProps,
        SymbolsSidebarOptionsSetterProps,
        SymbolsViewOptionsProps {}

export const SymbolPage: React.FunctionComponent<Props> = ({
    repo,
    revision,
    resolvedRev,
    viewOptions,
    setSidebarOptions,
    match: {
        params: { scheme, identifier },
    },
    useBreadcrumb,
    history,
    ...props
}) => {
    useEffect(() => {
        eventLogger.logViewEvent('Symbol')
    }, [])

    const data = useObservable(
        useMemo(() => queryRepositorySymbol({ repo: repo.id, revision, scheme, identifier, filters: viewOptions }), [
            identifier,
            repo.id,
            revision,
            scheme,
            viewOptions,
        ])
    )
    useEffect(() => {
        if (data) {
            console.log(data)
        }
    }, [data])

    useBreadcrumb(
        useMemo(
            () =>
                data && data.containerSymbol !== data.symbol
                    ? {
                          key: 'symbol/container',
                          element: <Link to={data.containerSymbol.url}>{data.containerSymbol.text}</Link>,
                      }
                    : null,
            [data]
        )
    )
    useBreadcrumb(
        useMemo(
            () =>
                data === null
                    ? null
                    : {
                          key: 'symbol/current',
                          element: data ? (
                              data.containerSymbol === data.symbol ? (
                                  <Link to={data.symbol.url}>{data.symbol.text}</Link>
                              ) : null
                          ) : (
                              <LoadingSpinner className="icon-inline" />
                          ),
                      },
            [data]
        )
    )

    useEffect(() => setSidebarOptions(data?.containerSymbol ? { containerSymbol: data.containerSymbol } : null), [
        data,
        setSidebarOptions,
    ])

    return data === null ? (
        <p className="p-3 text-muted h3">Not found</p>
    ) : data === undefined ? (
        <LoadingSpinner className="m-3" />
    ) : (
        <>
            <SymbolDetail {...props} symbol={data.symbol} history={history} />
            {data.symbol.children && (
                <ContainerSymbolsList
                    symbols={data.symbol.children.sort((a, b) => (a.kind < b.kind ? -1 : 1))}
                    history={history}
                />
            )}
        </>
    )
}
