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
import { SymbolsAreaSidebarVisibilitySetterProps } from './SymbolsArea'
import { SymbolsViewOptionsProps } from './useSymbolsViewOptions'
import { LoadingSpinner } from '@sourcegraph/react-loading-spinner'
import { ContainerSymbolsList } from './ContainerSymbolsList'

const queryRepositorySymbol = (
    vars: RepositoryExpSymbolVariables & { scheme: string; identifier: string }
): Observable<(ExpSymbolDetailFields & { children?: ExpSymbolDetailFields[] }) | null> =>
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
                    return node
                }
                for (const child of node.children) {
                    if (match(child)) {
                        return child
                    }
                    for (const childChild of child.children) {
                        if (match(childChild)) {
                            return childChild
                        }
                    }
                }
            }
            return null
        })
    )

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
        SymbolsAreaSidebarVisibilitySetterProps,
        SymbolsViewOptionsProps {}

export const SymbolPage: React.FunctionComponent<Props> = ({
    repo,
    revision,
    resolvedRev,
    viewOptions,
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

    useBreadcrumb(useMemo(() => ({ key: 'symbol', element: data?.text || '??' }), [data?.text]))

    return data === null ? (
        <p className="p-3 text-muted h3">Not found</p>
    ) : data === undefined ? (
        <LoadingSpinner className="m-3" />
    ) : (
        <>
            <SymbolDetail {...props} symbol={data} history={history} />
            {data.children && (
                <ContainerSymbolsList
                    symbols={data.children.sort((a, b) => (a.kind < b.kind ? -1 : 1))}
                    history={history}
                />
            )}
        </>
    )
}
