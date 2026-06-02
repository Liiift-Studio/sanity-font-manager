// Step 2 — Processing & Review with FontReviewCard, BulkActions, and subfamily grouping

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { Box, Stack, Flex, Text, Button, Card, Spinner, Badge } from '@sanity/ui';
import { PLAN_PHASE, FONT_STATUS, RECOMMENDATION } from '../utils/planTypes';
import FontReviewCard from './FontReviewCard';
import BulkActions from './BulkActions';

/** Determines whether a font entry will create or update a document */
function isUpdateEntry(entry) {
	const d = entry.decisions?.existingDocument;
	const choice = d?.userChoice;
	const rec = d?.recommendation;
	return choice === 'update' || (!choice && (rec === RECOMMENDATION.USE_EXACT || rec === RECOMMENDATION.USE_CANDIDATE));
}

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

	// Debug: log all fonts with their subfamily assignment for investigation
	useEffect(() => {
		if (!isReviewing) return;
		const processed = fontEntries.filter(f => f.status !== FONT_STATUS.ERROR);
		if (processed.length === 0) return;

		// Group by subfamily for clear logging
		const bySubfamily = {};
		processed.forEach(f => {
			const sf = f.subfamily || '(none)';
			if (!bySubfamily[sf]) bySubfamily[sf] = [];
			bySubfamily[sf].push(f);
		});

		console.group('[UploadStep2Review] Subfamily assignments');
		Object.entries(bySubfamily).forEach(([sf, fonts]) => {
			console.group(`Subfamily: "${sf}" (${fonts.length} font${fonts.length === 1 ? '' : 's'})`);
			fonts.forEach(f => {
				console.log(`  "${f.title}" (id: ${f.documentId})`, {
					sourceFile: f.sourceFileName,
					weightName: f.weightName,
					style: f.style,
					subfamily: f.subfamily,
					subfamilyDecision: f.decisions?.subfamily,
					parsedMetadata: {
						familyName: f.parsedMetadata?.familyName,
						fullName: f.parsedMetadata?.fullName,
						preferredFamily: f.parsedMetadata?.preferredFamily,
						preferredSubfamily: f.parsedMetadata?.preferredSubfamily,
					},
				});
			});
			console.groupEnd();
		});
		console.groupEnd();
	}, [isReviewing, fontEntries]);

	// Count creates vs updates
	const createCount = useMemo(() =>
		fontEntries.filter(f => f.status !== FONT_STATUS.ERROR && !isUpdateEntry(f)).length,
		[fontEntries]
	);
	const updateCount = useMemo(() =>
		fontEntries.filter(f => f.status !== FONT_STATUS.ERROR && isUpdateEntry(f)).length,
		[fontEntries]
	);

	// Filter and search
	const visibleEntries = useMemo(() => {
		let entries = fontEntries;

		// Apply filter
		if (filterBy === 'create') {
			entries = entries.filter(f => !isUpdateEntry(f) && f.status !== FONT_STATUS.ERROR);
		} else if (filterBy === 'update') {
			entries = entries.filter(f => isUpdateEntry(f));
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

	// Group by subfamily for display — always show headers
	const groupedEntries = useMemo(() => {
		const groups = {};
		for (const entry of visibleEntries) {
			const sf = entry.subfamily || 'No Subfamilies';
			if (!groups[sf]) groups[sf] = [];
			groups[sf].push(entry);
		}
		// Sort: named subfamilies first alphabetically, No Subfamilies last
		const sorted = {};
		const keys = Object.keys(groups).sort((a, b) => {
			if (a === 'No Subfamilies') return 1;
			if (b === 'No Subfamilies') return -1;
			return a.localeCompare(b);
		});
		keys.forEach(k => { sorted[k] = groups[k]; });
		return sorted;
	}, [visibleEntries]);

	// Validation
	const validationErrors = useMemo(() => {
		const errors = [];
		const uploadable = fontEntries.filter(f => f.status !== FONT_STATUS.ERROR);
		const missingTitles = uploadable.filter(f => !f.title || f.title.trim() === '');
		if (missingTitles.length > 0) {
			errors.push(`${missingTitles.length} font${missingTitles.length === 1 ? '' : 's'} missing a title`);
		}
		const missingIds = uploadable.filter(f => !f.documentId || f.documentId.trim() === '');
		if (missingIds.length > 0) {
			errors.push(`${missingIds.length} font${missingIds.length === 1 ? '' : 's'} missing a document ID`);
		}
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
		onStartExecution();
	}, [validationErrors, onStartExecution]);

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
					<Flex align="center" gap={3}>
						<Text size={1} weight="semibold">
							{processedCount} document{processedCount === 1 ? '' : 's'}
						</Text>
						<Flex gap={1}>
							{createCount > 0 && <Badge tone="positive" fontSize={0}>{createCount} create</Badge>}
							{updateCount > 0 && <Badge tone="caution" fontSize={0}>{updateCount} update</Badge>}
							{errorCount > 0 && <Badge tone="critical" fontSize={0}>{errorCount} error{errorCount === 1 ? '' : 's'}</Badge>}
						</Flex>
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
					<Card padding={2} radius={1} style={{ background: 'var(--card-muted-bg-color)' }}>
						<Flex align="center" gap={2}>
							<Text size={1} weight="semibold">
								{subfamily}
							</Text>
							<Badge mode="outline" fontSize={0}>{entries.length}</Badge>
						</Flex>
					</Card>
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
