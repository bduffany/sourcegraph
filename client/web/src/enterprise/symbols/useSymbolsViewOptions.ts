import H from 'history'
import { useMemo } from 'react'
import * as GQL from '../../../../shared/src/graphql/schema'

export interface SymbolsViewOptionsProps {
    viewOptions: SymbolsViewOptions
}

export interface SymbolsViewOptions extends GQL.ISymbolFilters {}

interface ToggleURLs {
    externals: H.LocationDescriptorObject
    internals: H.LocationDescriptorObject
}

interface Props {
    location: H.Location
}

const locationWithViewOptions = (
    base: H.LocationDescriptorObject,
    viewOptions: SymbolsViewOptions
): H.LocationDescriptorObject => {
    const parameters = new URLSearchParams(base.search)

    if (viewOptions.externals) {
        parameters.set('externals', '1')
    } else {
        parameters.delete('externals')
    }

    if (viewOptions.internals) {
        parameters.set('internals', '1')
    } else {
        parameters.delete('internals')
    }

    return { ...base, search: parameters.toString() }
}

export const useSymbolsViewOptions = ({
    location,
}: Props): { viewOptions: SymbolsViewOptions; toggleURLs: ToggleURLs } => {
    const viewOptions = useMemo<SymbolsViewOptions>(() => {
        const parameters = new URLSearchParams(location.search)
        return {
            externals: parameters.get('externals') !== null,
            internals: parameters.get('internals') !== null,
        }
    }, [location.search])

    const toggleURLs = useMemo<ToggleURLs>(
        () => ({
            externals: locationWithViewOptions(location, { ...viewOptions, externals: !viewOptions.externals }),
            internals: locationWithViewOptions(location, { ...viewOptions, internals: !viewOptions.internals }),
        }),
        [location, viewOptions]
    )

    return { viewOptions, toggleURLs }
}
