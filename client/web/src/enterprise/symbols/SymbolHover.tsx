import React from 'react'
import H from 'history'
import { gql } from '../../../../shared/src/graphql/graphql'
import { SymbolHoverFields } from '../../graphql-operations'
import { Markdown } from '../../../../shared/src/components/Markdown'
import { renderMarkdown } from '../../../../shared/src/util/markdown'
import { Link } from 'react-router-dom'

export const SymbolHoverGQLFragment = gql`
    fragment SymbolHoverFields on ExpSymbol {
        hover {
            markdown {
                text
            }
        }
        definitions {
            nodes {
                url
            }
        }
    }
`

interface Props {
    symbol: SymbolHoverFields

    history: H.History
    location: H.Location
}

export const SymbolHover: React.FunctionComponent<Props> = ({ symbol, history }) => {
    const hoverParts = symbol.hover?.markdown.text.split('---', 2)
    const hoverSig = hoverParts?.[0]
    const hoverDocumentation = hoverParts?.[1]

    return (
        <>
            <style>
                {
                    '.markdown pre code { font-size: 18px; line-height: 26px; } .markdown pre { margin-bottom: 0; white-space: pre-wrap; }'
                }
            </style>
            <section id="doc">
                {hoverSig && (
                    <Markdown dangerousInnerHTML={renderMarkdown(hoverSig)} history={history} className="mt-3 mx-3" />
                )}

                {symbol.definitions.nodes.length > 0 && (
                    <ul
                        className="list-unstyled nav nav-pills d-flex flex-wrap justify-content-end"
                        style={{ position: 'relative', marginTop: '-2.31rem', marginRight: '1.09rem' }}
                    >
                        <li className="nav-item">
                            <Link to={symbol.definitions.nodes[0].url} className="nav-link btn btn-secondary">
                                Go to definition
                            </Link>
                        </li>
                    </ul>
                )}

                {hoverDocumentation && (
                    <Markdown
                        dangerousInnerHTML={renderMarkdown(hoverDocumentation)}
                        history={history}
                        className="m-3 pt-3"
                    />
                )}
            </section>
        </>
    )
}
