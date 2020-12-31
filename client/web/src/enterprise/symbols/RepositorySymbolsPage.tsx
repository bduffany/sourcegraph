import React, { useEffect, useMemo } from 'react'
import H from 'history'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'
import { dataOrThrowErrors, gql } from '../../../../shared/src/graphql/graphql'
import { useObservable } from '../../../../shared/src/util/useObservable'
import { requestGraphQL } from '../../backend/graphql'
import { BreadcrumbSetters } from '../../components/Breadcrumbs'
import { RepoHeaderContributionsLifecycleProps } from '../../repo/RepoHeader'
import { eventLogger } from '../../tracking/eventLogger'
import {
    RepositoryExpSymbolsFields,
    RepositoryExpSymbolsVariables,
    RepositoryExpSymbolsResult,
} from '../../graphql-operations'
import { RepoRevisionContainerContext } from '../../repo/RepoRevisionContainer'
import { ExpSymbolDetailGQLFragment, SymbolDetail } from './SymbolDetail'
import { SettingsCascadeProps } from '../../../../shared/src/settings/settings'
import { SymbolsSidebar } from './SymbolsSidebar'
import { SymbolsContainerList } from './SymbolsContainerList'

const RepositoryExpSymbolsGQLFragment = gql`
    fragment RepositoryExpSymbolsFields on ExpSymbol {
        text
        detail
        monikers {
            identifier
        }
        url
        children {
            ...ExpSymbolDetailFields
            children {
                ...ExpSymbolDetailFields
            }
        }
        ...ExpSymbolDetailFields
    }
    ${ExpSymbolDetailGQLFragment}
`

const queryRepositorySymbols = (vars: RepositoryExpSymbolsVariables): Observable<RepositoryExpSymbolsFields[] | null> =>
    requestGraphQL<RepositoryExpSymbolsResult, RepositoryExpSymbolsVariables>(
        gql`
            query RepositoryExpSymbols($repo: ID!, $commitID: String!, $path: String!) {
                node(id: $repo) {
                    ... on Repository {
                        commit(rev: $commitID) {
                            tree(path: $path) {
                                expSymbols {
                                    nodes {
                                        ...RepositoryExpSymbolsFields
                                    }
                                }
                            }
                        }
                    }
                }
            }
            ${RepositoryExpSymbolsGQLFragment}
        `,
        vars
    ).pipe(
        map(dataOrThrowErrors),
        map(data => data.node?.commit?.tree?.expSymbols?.nodes || null)
    )

interface Props
    extends Pick<RepoRevisionContainerContext, 'repo' | 'resolvedRev'>,
        RepoHeaderContributionsLifecycleProps,
        BreadcrumbSetters,
        SettingsCascadeProps {
    history: H.History
    location: H.Location
}

export const RepositorySymbolsPage: React.FunctionComponent<Props> = ({
    repo,
    resolvedRev,
    useBreadcrumb,
    ...props
}) => {
    useEffect(() => {
        eventLogger.logViewEvent('RepositorySymbols')
    }, [])

    useBreadcrumb(useMemo(() => ({ key: 'symbols', element: <>Symbols</> }), []))

    const data = useObservable(
        useMemo(() => queryRepositorySymbols({ repo: repo.id, commitID: resolvedRev.commitID, path: '.' }), [
            repo.id,
            resolvedRev.commitID,
        ])
    )

    return data ? (
        <>
            <SymbolsSidebar data={data} />
            <div style={{ overflow: 'auto' }} className="p-3">
                <SymbolsContainerList symbols={data} />
            </div>
        </>
    ) : (
        <p>Loading...</p>
    )
}
