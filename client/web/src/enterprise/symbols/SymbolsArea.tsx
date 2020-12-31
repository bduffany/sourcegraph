import React, { useMemo, useState } from 'react'
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
import { SymbolsExternalsViewOptionToggle, SymbolsInternalsViewOptionToggle } from './SymbolsViewOptionsButtons'
import { useSymbolsViewOptions } from './useSymbolsViewOptions'

interface Props
    extends Pick<RepoRevisionContainerContext, 'repo' | 'revision' | 'resolvedRev'>,
        RouteComponentProps<{}>,
        RepoHeaderContributionsLifecycleProps,
        SettingsCascadeProps,
        BreadcrumbSetters {}

export interface SymbolsAreaSidebarVisibilitySetterProps {
    setIsSidebarVisible: (isVisible: boolean) => void
}

export const SymbolsArea: React.FunctionComponent<Props> = ({
    match,
    useBreadcrumb,
    repoHeaderContributionsLifecycleProps,
    history,
    ...props
}) => {
    const [isSidebarVisible, setIsSidebarVisible] = useState(false)

    useBreadcrumb(useMemo(() => ({ key: 'symbols', element: <Link to={match.url}>Symbols</Link> }), [match.url]))

    const { viewOptions, toggleURLs } = useSymbolsViewOptions(props)

    return (
        <>
            {isSidebarVisible && <div>Sidebar</div>}
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
                                setIsSidebarVisible={setIsSidebarVisible}
                            />
                        )}
                    />
                    <Route
                        path={`${match.url}/:scheme/:identifier+`}
                        render={(routeProps: RouteComponentProps<SymbolRouteProps>) => (
                            <SymbolPage
                                {...props}
                                {...routeProps}
                                useBreadcrumb={useBreadcrumb}
                                viewOptions={viewOptions}
                                setIsSidebarVisible={setIsSidebarVisible}
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
