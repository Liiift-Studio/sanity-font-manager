// Step 2 — Processing & Review with FontReviewCard, BulkActions, and SubfamilyOrganizer

import React, { useMemo, useState, useCallback } from 'react';
import { Box, Stack, Flex, Text, Button, Card, Spinner, Badge } from '@sanity/ui';
import { PLAN_PHASE, FONT_STATUS, RECOMMENDATION } from '../utils/planTypes';
import FontReviewCard from './FontReviewCard';
import BulkActions from './BulkActions';

/**
 * Step 2 — displays processing progress and font review cards with full editing.
 */
export default function UploadStep2Review({
	plan,
	dispatch,
	onCancelProcessing,
	onReadyToUpload,
	onStartExecution,
	processingCancelled,
}) {
	const isProcessing = plan.phase === PLAN_PHASE.PROCESSING;
	const isReviewing = plan.phase === PLAN_PHASE.REVIEWING || plan.phase === PLAN_PHASE.READY;

	// Search and filter state
	const [searchQuery, setSearchQuery] = useState('');
	const [filterBy, setFilterBy] = useState('all');
	const [allExpanded, setAllExpanded] = useState(false);

	const fontEntries = useMemo(() => Object.values(plan.fonts), [plan.fonts]);
	const processedCount = fontEntries.filter(f => f.status === FONT_STATUS.PROCESSED).length;
	const errorCount = fontEntries.filter(f => f.status === FONT_STATUS.ERROR).length;
	const totalCount = plan.processingProgress.total;

	// Filter and search
	const visibleEntries = useMemo(() => {
		let entries = fontEntries;

		// Apply filter
		if (filterBy === 'create') {
			entries = entries.filter(f => {
				const d = f.decisions?.existingDocument;
				const choice = d?.userChoice;
				const rec = d?.recommendation;
				return choice === 'create' || (!choice && (rec === RECOMMENDATION.CREATE || rec === RECOMMENDATION.AMBIGUOUS));
			});
		} else if (filterBy === 'update') {
			entries = entries.filter(f => {
				const d = f.decisions?.existingDocument;
				const choice = d?.userChoice;
				const rec = d?.recommendation;
				return choice === 'update' || (!choice && (rec === RECOMMENDATION.USE_EXACT || rec === RECOMMENDATION.USE_CANDIDATE));
			});
		} else if (filterBy === 'error') {
			entries = entries.filter(f => f.status === FONT_STATUS.ERROR);
		} else if (filterBy === 'conflict') {
			entries = entries.filter(f => f._idConflict);
		} else if (filterBy.startsWith('sf:')) {
			const sf = filterBy.slice(3);
			entries = entries.filter(f => f.subfamily === sf);
		}

		// Apply search
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase().trim();
			entries = entries.filter(f =>
				f.title?.toLowerCase().includes(q) ||
				f.documentId?.toLowerCase().includes(q) ||
				f.sourceFileName?.toLowerCase().includes(q) ||
				f.weightName?.toLowerCase().includes(q)
			);
		}

		return entries;
	}, [fontEntries, filterBy, searchQuery]);

	const visibleTempIds = useMemo(() => visibleEntries.map(e => e.tempId), [visibleEntries]);
	const hasConflicts = fontEntries.some(f => f._idConflict);
	const canUpload = isReviewing && processedCount > 0 && !hasConflicts;

	// Group by subfamily for display
	const groupedEntries = useMemo(() => {
		const groups = {};
		for (const entry of visibleEntries) {
			const sf = entry.subfamily || 'Ungrouped';
			if (!groups[sf]) groups[sf] = [];
			groups[sf].push(entry);
		}
		return groups;
	}, [visibleEntries]);

	// Validation
	const validationErrors = useMemo(() => {
		const errors = [];
		const uploadable = fontEntries.filter(f => f.status !== FONT_STATUS.ERROR);
		// Missing titles
		const missingTitles = uploadable.filter(f => !f.title || f.title.trim() === '');
		if (missingTitles.length > 0) {
			errors.push(`${missingTitles.length} font${missingTitles.length === 1 ? '' : 's'} missing a title`);
		}
		// Missing document IDs
		const missingIds = uploadable.filter(f => !f.documentId || f.documentId.trim() === '');
		if (missingIds.length > 0) {
			errors.push(`${missingIds.length} font${missingIds.length === 1 ? '' : 's'} missing a document ID`);
		}
		// ID conflicts
		if (hasConflicts) {
			const conflictCount = uploadable.filter(f => f._idConflict).length;
			errors.push(`${conflictCount} font${conflictCount === 1 ? '' : 's'} with duplicate document IDs`);
		}
		return errors;
	}, [fontEntries, hasConflicts]);

	const canUploadValidation = isReviewing && processedCount > 0 && validationErrors.length === 0;

	const handleUpload = useCallback(() => {
		if (validationErrors.length > 0) {
			window.alert('Please fix the following before uploading:\n\n• ' + validationErrors.join('\n• '));
			return;
		}
		const createCount = fontEntries.filter(f => {
			if (f.status === FONT_STATUS.ERROR) return false;
			const d = f.decisions?.existingDocument;
			const choice = d?.userChoice;
			const rec = d?.recommendation;
			return choice === 'create' || (!choice && (rec === RECOMMENDATION.CREATE || rec === RECOMMENDATION.AMBIGUOUS));
		}).length;
		const updateCount = processedCount - createCount;

		if (!window.confirm(`Upload ${processedCount} fonts?\n\n• ${createCount} new document${createCount === 1 ? '' : 's'}\n• ${updateCount} update${updateCount === 1 ? '' : 's'}\n\nThis cannot be undone.`)) return;

		onStartExecution();
	}, [fontEntries, processedCount, validationErrors, onStartExecution]);

	const handleToggleExpandAll = useCallback(() => {
		setAllExpanded(v => !v);
	}, []);

	return (
		<Stack space={3}>
			{/* Processing progress */}
			{isProcessing && (
				<Card border padding={3} radius={2}>
					<Stack space={3}>
						<Flex align="center" gap={3}>
							<Spinner />
							<Text size={1}>
								Processing {plan.processingProgress.completed} of {totalCount} files...
							</Text>
						</Flex>
						<Box style={{ height: 4, background: 'var(--card-border-color)', borderRadius: 2, overflow: 'hidden' }}>
							<Box
								style={{
									height: '100%',
									width: '100%',
									transformOrigin: 'left',
									transform: `scaleX(${totalCount > 0 ? plan.processingProgress.completed / totalCount : 0})`,
									background: 'var(--card-badge-positive-bg-color)',
									transition: 'transform 0.3s ease-out',
									borderRadius: 2,
								}}
							/>
						</Box>
						{plan.processingProgress.currentFile && (
							<Text size={0} muted style={{ fontFamily: 'monospace' }}>
								{plan.processingProgress.currentFile}
							</Text>
						)}
						<Flex justify="flex-end">
							<Button
								mode="ghost"
								tone="caution"
								text="Cancel Processing"
								fontSize={1}
								padding={2}
								onClick={onCancelProcessing}
							/>
						</Flex>
					</Stack>
				</Card>
			)}

			{/* Processing complete summary */}
			{isReviewing && (
				<Card tone={errorCount > 0 ? 'caution' : 'positive'} border padding={3} radius={2}>
					<Flex align="center" gap={2}>
						<Text size={1} weight="semibold">
							{processedCount} font{processedCount === 1 ? '' : 's'} processed
						</Text>
						{errorCount > 0 && (
							<Badge tone="critical" fontSize={0}>{errorCount} error{errorCount === 1 ? '' : 's'}</Badge>
						)}
					</Flex>
				</Card>
			)}

			{/* Bulk actions bar */}
			{fontEntries.length > 0 && (
				<BulkActions
					fonts={plan.fonts}
					dispatch={dispatch}
					searchQuery={searchQuery}
					onSearchChange={setSearchQuery}
					filterBy={filterBy}
					onFilterChange={setFilterBy}
					allExpanded={allExpanded}
					onToggleExpandAll={handleToggleExpandAll}
					visibleTempIds={visibleTempIds}
				/>
			)}

			{/* Font cards grouped by subfamily */}
			{Object.entries(groupedEntries).map(([subfamily, entries]) => (
				<Stack key={subfamily} space={2}>
					{Object.keys(groupedEntries).length > 1 && (
						<Text size={0} weight="semibold" muted style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
							{subfamily} ({entries.length})
						</Text>
					)}
					<Stack space={1}>
						{entries.map(entry => (
							<FontReviewCard
								key={entry.tempId}
								entry={entry}
								dispatch={dispatch}
								allExpanded={allExpanded}
							/>
						))}
					</Stack>
				</Stack>
			))}

			{/* Empty state */}
			{visibleEntries.length === 0 && fontEntries.length > 0 && (
				<Card border padding={4} radius={2}>
					<Text size={1} muted align="center">No fonts match the current filter</Text>
				</Card>
			)}

			{/* Validation errors */}
			{isReviewing && validationErrors.length > 0 && (
				<Card tone="caution" border padding={2} radius={2}>
					<Stack space={1}>
						{validationErrors.map((err, i) => (
							<Text key={i} size={0} tone="caution">• {err}</Text>
						))}
					</Stack>
				</Card>
			)}

			{/* Upload button */}
			{isReviewing && processedCount > 0 && (
				<Flex justify="flex-end" gap={2} style={{ position: 'sticky', bottom: 0, background: 'var(--card-bg-color)', paddingTop: 8, paddingBottom: 4 }}>
					<Button
						mode="default"
						tone="primary"
						text={`Upload ${processedCount} Font${processedCount === 1 ? '' : 's'} to Sanity`}
						disabled={!canUploadValidation}
						onClick={handleUpload}
					/>
				</Flex>
			)}
		</Stack>
	);
}
