import * as H from 'history'
import MagnifyIcon from 'mdi-react/MagnifyIcon'
import React, { useCallback, useState, useContext } from 'react'
import { tap } from 'rxjs/operators'

import { ThemeProps } from '@sourcegraph/shared/src/theme'
import { Container } from '@sourcegraph/wildcard'

import { FilteredConnection, FilteredConnectionQueryArguments } from '../../../../components/FilteredConnection'
import { ChangesetApplyPreviewFields, Scalars } from '../../../../graphql-operations'
import { MultiSelectContext } from '../../MultiSelectContext'
import { PreviewPageAuthenticatedUser } from '../BatchChangePreviewPage'

import { queryChangesetApplyPreview as _queryChangesetApplyPreview, queryChangesetSpecFileDiffs } from './backend'
import { ChangesetApplyPreviewNode, ChangesetApplyPreviewNodeProps } from './ChangesetApplyPreviewNode'
import { EmptyPreviewListElement } from './EmptyPreviewListElement'
import { PreviewFilterRow, PreviewFilters } from './PreviewFilterRow'
import styles from './PreviewList.module.scss'
import { PreviewListHeader } from './PreviewListHeader'

interface Props extends ThemeProps {
    batchSpecID: Scalars['ID']
    history: H.History
    location: H.Location
    authenticatedUser: PreviewPageAuthenticatedUser

    selectionEnabled: boolean

    /** For testing only. */
    queryChangesetApplyPreview?: typeof _queryChangesetApplyPreview
    /** For testing only. */
    queryChangesetSpecFileDiffs?: typeof queryChangesetSpecFileDiffs
    /** Expand changeset descriptions, for testing only. */
    expandChangesetDescriptions?: boolean
}

/**
 * A list of a batch spec's preview nodes.
 */
export const PreviewList: React.FunctionComponent<Props> = ({
    batchSpecID,
    history,
    location,
    authenticatedUser,
    isLightTheme,

    selectionEnabled,

    queryChangesetApplyPreview = _queryChangesetApplyPreview,
    queryChangesetSpecFileDiffs,
    expandChangesetDescriptions,
}) => {
    const [filters, setFilters] = useState<PreviewFilters>({
        search: null,
        currentState: null,
        action: null,
    })

    const { onLoad } = useContext(MultiSelectContext)

    const queryChangesetApplyPreviewConnection = useCallback(
        (args: FilteredConnectionQueryArguments) =>
            queryChangesetApplyPreview({
                first: args.first ?? null,
                after: args.after ?? null,
                batchSpec: batchSpecID,
                search: filters.search,
                currentState: filters.currentState,
                action: filters.action,
            }).pipe(
                tap(connection => {
                    onLoad(
                        connection.nodes
                            .map(node => {
                                if (node.__typename === 'HiddenChangesetApplyPreview') {
                                    return undefined
                                }
                                if (node.targets.__typename === 'VisibleApplyPreviewTargetsDetach') {
                                    return undefined
                                }
                                return node.targets.changesetSpec.id
                            })
                            .filter((id): id is string => id !== undefined)
                    )
                })
            ),
        [batchSpecID, filters.search, filters.currentState, filters.action, onLoad, queryChangesetApplyPreview]
    )

    return (
        <Container>
            <PreviewFilterRow history={history} location={location} onFiltersChange={setFilters} />
            <FilteredConnection<ChangesetApplyPreviewFields, Omit<ChangesetApplyPreviewNodeProps, 'node'>>
                className="mt-2"
                nodeComponent={ChangesetApplyPreviewNode}
                nodeComponentProps={{
                    isLightTheme,
                    history,
                    location,
                    authenticatedUser,
                    queryChangesetSpecFileDiffs,
                    expandChangesetDescriptions,
                    selectionEnabled,
                }}
                queryConnection={queryChangesetApplyPreviewConnection}
                hideSearch={true}
                defaultFirst={15}
                noun="changeset"
                pluralNoun="changesets"
                history={history}
                location={location}
                useURLQuery={true}
                listComponent="div"
                listClassName={styles.previewListGrid}
                headComponent={PreviewListHeader}
                headComponentProps={{
                    selectionEnabled,
                }}
                cursorPaging={true}
                noSummaryIfAllNodesVisible={true}
                emptyElement={
                    filters.search || filters.currentState || filters.action ? (
                        <EmptyPreviewSearchElement />
                    ) : (
                        <EmptyPreviewListElement />
                    )
                }
            />
        </Container>
    )
}

const EmptyPreviewSearchElement: React.FunctionComponent<{}> = () => (
    <div className="text-muted row w-100">
        <div className="col-12 text-center">
            <MagnifyIcon className="icon" />
            <div className="pt-2">No changesets matched the search.</div>
        </div>
    </div>
)
