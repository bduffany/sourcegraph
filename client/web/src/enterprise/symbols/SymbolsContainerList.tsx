import React from 'react'
import { Link } from 'react-router-dom'
import { RepositoryExpSymbolsFields } from '../../graphql-operations'

interface Props {
    symbols: RepositoryExpSymbolsFields[]
}

export const SymbolsContainerList: React.FunctionComponent<Props> = ({ symbols }) => (
    <div>
        <ul className="list-unstyled">
            {symbols
                .sort((a, b) => (a.detail || '').localeCompare(b.detail || ''))
                .map(symbol => (
                    <li key={symbol.url}>
                        <Link to={symbol.url}>{symbol.detail}</Link>
                    </li>
                ))}
        </ul>
    </div>
)
