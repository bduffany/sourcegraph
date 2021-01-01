import React from 'react'
import { Link, NavLink } from 'react-router-dom'
import { SymbolIcon } from '../../../../shared/src/symbols/SymbolIcon'
import { ExpSymbolDetailFields } from '../../graphql-operations'

export interface SymbolsSidebarOptions {
    containerSymbol: ExpSymbolDetailFields & {
        children: (ExpSymbolDetailFields & { children: ExpSymbolDetailFields[] })[]
    }
}

const commonNavLinkProps: Pick<
    React.ComponentProps<NavLink>,
    'className' | 'style' | 'activeClassName' | 'activeStyle'
> = {
    style: { borderLeft: 'solid 3px transparent', borderLeftColor: 'transparent' },
    activeClassName: 'text-body',
    activeStyle: { borderLeftColor: 'var(--primary)' },
}

const Item: React.FunctionComponent<{
    symbol: ExpSymbolDetailFields & { children: ExpSymbolDetailFields[] }
    level: number
    tag?: 'li'
    className?: string
}> = ({ symbol, level, tag: Tag = 'li', className = '' }) => (
    <Tag>
        <NavLink to={symbol.url} className={`d-flex align-items-center w-100 ${className}`} {...commonNavLinkProps}>
            <SymbolIcon kind={symbol.kind} className="mr-1" />
            {symbol.text}
        </NavLink>
        {symbol.children?.length > 0 && (
            <ItemList symbols={symbol.children} level={level + 1} itemClassName="pl-2 pr-3 py-1" />
        )}
    </Tag>
)

const ItemList: React.FunctionComponent<{
    symbols: (ExpSymbolDetailFields & { children: ExpSymbolDetailFields[] })[]
    level: number
    itemClassName?: string
}> = ({ symbols, level, itemClassName = '' }) => (
    <ul className="list-unstyled mb-2" style={{ marginLeft: `${level * 0.5}rem` }}>
        {symbols
            .sort((a, b) => (a.kind < b.kind ? -1 : 1))
            .map(symbol => (
                <Item key={symbol.url} symbol={symbol} className={itemClassName} level={level} />
            ))}
    </ul>
)

interface Props extends SymbolsSidebarOptions {
    allSymbolsURL: string
    className?: string
}

export const SymbolsSidebar: React.FunctionComponent<Props> = ({ containerSymbol, allSymbolsURL, className = '' }) => (
    <nav className={className}>
        <header className="mb-2">
            <Link to={allSymbolsURL} className="d-block small p-2 pb-1 pl-3">
                &laquo; All symbols
            </Link>
            <h2 className="mb-0">
                <NavLink to={containerSymbol.url} className="d-flex align-items-center p-2" {...commonNavLinkProps}>
                    <SymbolIcon kind={containerSymbol.kind} className="mr-1" />
                    {containerSymbol.text}
                </NavLink>
            </h2>
        </header>

        {containerSymbol.children.length > 0 ? (
            <ItemList symbols={containerSymbol.children} itemClassName="pl-2 pr-3 py-1" level={0} />
        ) : (
            <p className="text-muted">No child symbols</p>
        )}
    </nav>
)
