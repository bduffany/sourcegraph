import React, { useCallback, useMemo, useState } from 'react'
import { Route, RouteComponentProps, Switch } from 'react-router'
import { Link } from 'react-router-dom'
import { ButtonLink } from '../../../../shared/src/components/LinkOrButton'
import { SettingsCascadeProps } from '../../../../shared/src/settings/settings'
import { BreadcrumbSetters } from '../../components/Breadcrumbs'
import { RepoHeaderContributionsLifecycleProps } from '../../repo/RepoHeader'
import { RepoHeaderContributionPortal } from '../../repo/RepoHeaderContributionPortal'
import { RepoRevisionContainerContext } from '../../repo/RepoRevisionContainer'
import { SymbolPage, SymbolRouteProps } from './SymbolPage'
import { SymbolsPage } from './SymbolsPage'
import { SymbolsSidebar, SymbolsSidebarOptions } from './SymbolsSidebar'
import { SymbolsExternalsViewOptionToggle, SymbolsInternalsViewOptionToggle } from './SymbolsViewOptionsButtons'
import { useSymbolsViewOptions } from './useSymbolsViewOptions'

interface Props
    extends Pick<RepoRevisionContainerContext, 'repo' | 'revision' | 'resolvedRev'>,
        RouteComponentProps<{}>,
        RepoHeaderContributionsLifecycleProps,
        SettingsCascadeProps,
        BreadcrumbSetters {}

export interface SymbolsSidebarOptionsSetterProps {
    setSidebarOptions: (options: SymbolsSidebarOptions | null) => void
}

export const SymbolsArea: React.FunctionComponent<Props> = ({
    match,
    useBreadcrumb,
    repoHeaderContributionsLifecycleProps,
    history,
    ...props
}) => {
    const [sidebarOptions, rawSetSidebarOptions] = useState<SymbolsSidebarOptions | null>(null)
    const setSidebarOptions = useCallback<SymbolsSidebarOptionsSetterProps['setSidebarOptions']>(options => {
        rawSetSidebarOptions(options)
        return () => rawSetSidebarOptions(null)
    }, [])

    useBreadcrumb(useMemo(() => ({ key: 'symbols', element: <Link to={match.url}>Symbols</Link> }), [match.url]))

    const { viewOptions, toggleURLs } = useSymbolsViewOptions(props)

    return (
        <>
            {sidebarOptions && (
                <div
                    style={{ overflow: 'auto', flex: '0 0 auto', maxWidth: '16rem' }}
                    className="d-flex align-items-stretch"
                >
                    <SymbolsSidebar {...sidebarOptions} className="border-right" />
                </div>
            )}
            <div style={{ overflow: 'auto' }} className="w-100">
                <Switch>
                    {/* eslint-disable react/jsx-no-bind */}
                    <Route
                        path={match.url}
                        exact={true}
                        render={(routeProps: RouteComponentProps<SymbolRouteProps>) => (
                            <SymbolsPage
                                {...props}
                                {...routeProps}
                                viewOptions={viewOptions}
                                setSidebarOptions={setSidebarOptions}
                            />
                        )}
                    />
                    <Route
                        path={`${match.url}/:scheme/:identifier+`}
                        sensitive={true}
                        render={(routeProps: RouteComponentProps<SymbolRouteProps>) => (
                            <SymbolPage
                                {...props}
                                {...routeProps}
                                useBreadcrumb={useBreadcrumb}
                                viewOptions={viewOptions}
                                setSidebarOptions={setSidebarOptions}
                            />
                        )}
                    />
                    {/* eslint-enable react/jsx-no-bind */}
                </Switch>
            </div>
            <RepoHeaderContributionPortal
                position="right"
                priority={20}
                element={
                    <SymbolsInternalsViewOptionToggle
                        key="SymbolsArea/internals"
                        viewOptions={viewOptions}
                        toggleURLs={toggleURLs}
                        history={history}
                    />
                }
                repoHeaderContributionsLifecycleProps={repoHeaderContributionsLifecycleProps}
            />
            <RepoHeaderContributionPortal
                position="right"
                priority={20}
                element={
                    <SymbolsExternalsViewOptionToggle
                        key="SymbolsArea/externals"
                        viewOptions={viewOptions}
                        toggleURLs={toggleURLs}
                        history={history}
                    />
                }
                repoHeaderContributionsLifecycleProps={repoHeaderContributionsLifecycleProps}
            />
        </>
    )
}
