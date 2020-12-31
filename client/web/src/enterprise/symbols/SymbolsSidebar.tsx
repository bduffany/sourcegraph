import React from 'react'
import { Link } from 'react-router-dom'
import { RepositoryExpSymbolsFields } from '../../graphql-operations'

interface Props {
    data: RepositoryExpSymbolsFields[]
}

export const SymbolsSidebar: React.FunctionComponent<Props> = ({ data }) => (
    <ul
        className="sticky-top flex-column list-unstyled px-3 pt-3 pb-0 m-0"
        style={{ flex: '0 0 auto', overflow: 'auto' }}
    >
        {data
            .filter(symbol => symbol.text !== 'main')
            .map(symbol => (
                <li key={symbol.url} className="pb-1">
                    <Link to={symbol.url}>{symbol.text}</Link>
                    {symbol.children.length > 0 && (
                        <ul className="list-unstyled pl-3">
                            {symbol.children.map(childSymbol => (
                                <li key={childSymbol.url}>
                                    <Link to={childSymbol.url}>{childSymbol.text}</Link>
                                    {childSymbol.children.length > 0 && (
                                        <ul className="list-unstyled pl-3">
                                            {childSymbol.children.map(childChildSymbol => (
                                                <li key={childChildSymbol.url}>
                                                    <Link to={childChildSymbol.url}>{childChildSymbol.text}</Link>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </li>
            ))}
    </ul>
)
