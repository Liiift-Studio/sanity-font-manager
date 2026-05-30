// Bulk actions bar — expand/collapse all, accept suggestions, search/filter

import React, { useState, useCallback, useMemo } from 'react';
import { Flex, Box, Button, TextInput, Select, Text } from '@sanity/ui';
import { SearchIcon } from '@sanity/icons';

/**
 * Sticky bulk actions bar for the review step.
 *
 * @param {object} props
 * @param {object} props.fonts - Map of tempId → FontPlanEntry
 * @param {function} props.dispatch - Plan reducer dispatch
 * @param {string} props.searchQuery - Current search text
 * @param {function} props.onSearchChange - Called with new search text
 * @param {string} props.filterBy - Current filter value
 * @param {function} props.onFilterChange - Called with new filter value
 * @param {boolean} props.allExpanded - Whether all cards are expanded
 * @param {function} props.onToggleExpandAll - Toggle expand/collapse all
 * @param {string[]} props.visibleTempIds - Currently visible font tempIds (after search/filter)
 */
export default function BulkActions({
	fonts,
	dispatch,
	searchQuery,
	onSearchChange,
	filterBy,
	onFilterChange,
	allExpanded,
	onToggleExpandAll,
	visibleTempIds,
}) {
	const fontCount = Object.keys(fonts).length;
	const visibleCount = visibleTempIds.length;

	const handleAcceptSuggestions = useCallback(() => {
		dispatch({ type: 'ACCEPT_ALL_SUGGESTIONS', scope: visibleTempIds });
	}, [dispatch, visibleTempIds]);

	// Collect unique subfamilies for filter dropdown
	const subfamilies = useMemo(() => {
		const subs = new Set();
		for (const font of Object.values(fonts)) {
			if (font.subfamily) subs.add(font.subfamily);
		}
		return [...subs].sort();
	}, [fonts]);

	return (
		<Flex gap={2} align="center" wrap="wrap" style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--card-bg-color)', paddingBottom: 8, paddingTop: 4 }}>
			{/* Search */}
			<Box style={{ flex: 1, minWidth: 150 }}>
				<TextInput
					icon={SearchIcon}
					placeholder="Search fonts..."
					value={searchQuery}
					onChange={(e) => onSearchChange(e.target.value)}
					fontSize={1}
				/>
			</Box>

			{/* Filter by action type */}
			<Select value={filterBy} onChange={(e) => onFilterChange(e.target.value)} fontSize={1} style={{ width: 130 }}>
				<option value="all">All ({fontCount})</option>
				<option value="create">Create</option>
				<option value="update">Update</option>
				<option value="error">Errors</option>
				<option value="conflict">Conflicts</option>
				{subfamilies.map(sf => (
					<option key={sf} value={`sf:${sf}`}>{sf}</option>
				))}
			</Select>

			{/* Visible count */}
			{visibleCount !== fontCount && (
				<Text size={0} muted>{visibleCount} of {fontCount}</Text>
			)}

			{/* Expand / Collapse */}
			<Button
				mode="ghost"
				fontSize={0}
				padding={2}
				text={allExpanded ? 'Collapse All' : 'Expand All'}
				onClick={onToggleExpandAll}
			/>

			{/* Accept suggestions for visible */}
			<Button
				mode="ghost"
				tone="positive"
				fontSize={0}
				padding={2}
				text={`Accept Suggestions (${visibleCount})`}
				onClick={handleAcceptSuggestions}
			/>
		</Flex>
	);
}
