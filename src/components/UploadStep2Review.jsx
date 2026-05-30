// Step 2 — Processing & Review (skeleton — full implementation in Phase C.17)

import React, { useMemo } from 'react';
import { Box, Stack, Flex, Text, Button, Card, Spinner, Badge } from '@sanity/ui';
import { PLAN_PHASE, FONT_STATUS } from '../utils/planTypes';

/**
 * Step 2 — displays processing progress and font review cards.
 * Currently a functional skeleton that shows progress and font list.
 * Full review card editing UI will be built in Phase C.17.
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
	const fontEntries = useMemo(() => Object.values(plan.fonts), [plan.fonts]);
	const processedCount = fontEntries.filter(f => f.status === FONT_STATUS.PROCESSED).length;
	const errorCount = fontEntries.filter(f => f.status === FONT_STATUS.ERROR).length;
	const totalCount = plan.processingProgress.total;

	const hasConflicts = fontEntries.some(f => f._idConflict);
	const canUpload = isReviewing && processedCount > 0 && !hasConflicts;

	const handleUpload = () => {
		if (hasConflicts) {
			window.alert('Please resolve document ID conflicts before uploading.');
			return;
		}
		const createCount = fontEntries.filter(f => {
			const d = f.decisions?.existingDocument;
			const choice = d?.userChoice;
			const rec = d?.recommendation;
			return choice === 'create' || (!choice && (rec === 'create' || rec === 'ambiguous'));
		}).length;
		const updateCount = processedCount - createCount;

		if (!window.confirm(`Upload ${processedCount} fonts?\n\n• ${createCount} new document${createCount === 1 ? '' : 's'}\n• ${updateCount} update${updateCount === 1 ? '' : 's'}\n\nThis cannot be undone.`)) return;

		onStartExecution();
	};

	return (
		<Stack space={4}>
			{/* Processing progress bar */}
			{isProcessing && (
				<Card border padding={3} radius={2}>
					<Stack space={3}>
						<Flex align="center" gap={3}>
							<Spinner />
							<Text size={1}>
								Processing {plan.processingProgress.completed} of {totalCount} files...
							</Text>
						</Flex>
						{/* Progress bar */}
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

			{/* Font card list (simplified — full review cards in Phase C.17) */}
			{fontEntries.length > 0 && (
				<Stack space={2}>
					<Text size={1} weight="semibold">
						Fonts ({fontEntries.length})
					</Text>
					<Box style={{ maxHeight: 400, overflowY: 'auto' }}>
						<Stack space={1}>
							{fontEntries.map(entry => (
								<Card
									key={entry.tempId}
									border
									radius={1}
									padding={2}
									tone={entry.status === FONT_STATUS.ERROR ? 'critical' : entry._idConflict ? 'caution' : 'default'}
								>
									<Flex align="center" justify="space-between" gap={2}>
										<Flex align="center" gap={2} style={{ flex: 1, minWidth: 0 }}>
											<Text size={1} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
												{entry.title || entry.sourceFileName}
											</Text>
										</Flex>
										<Flex gap={1} align="center">
											{entry.status === FONT_STATUS.ERROR && (
												<Badge tone="critical" fontSize={0}>Error</Badge>
											)}
											{entry._idConflict && (
												<Badge tone="caution" fontSize={0}>ID Conflict</Badge>
											)}
											{entry.variableFont && (
												<Badge tone="primary" fontSize={0}>VF</Badge>
											)}
											<Badge fontSize={0}>{entry.weight}</Badge>
											<Badge tone={entry.style === 'Italic' ? 'primary' : 'default'} mode="outline" fontSize={0}>
												{entry.style}
											</Badge>
											{entry.decisions?.existingDocument?.recommendation !== 'create' && (
												<Badge tone="positive" fontSize={0}>Update</Badge>
											)}
											{isReviewing && entry.status !== FONT_STATUS.ERROR && (
												<Button
													mode="bleed"
													tone="critical"
													fontSize={0}
													padding={1}
													text="Remove"
													onClick={() => dispatch({ type: 'REMOVE_FONT', tempId: entry.tempId })}
												/>
											)}
										</Flex>
									</Flex>
									{entry.status === FONT_STATUS.ERROR && (
										<Text size={0} muted style={{ marginTop: 4 }}>{entry.error}</Text>
									)}
								</Card>
							))}
						</Stack>
					</Box>
				</Stack>
			)}

			{/* Upload button */}
			{isReviewing && (
				<Flex justify="flex-end" gap={2}>
					<Button
						mode="default"
						tone="primary"
						text={`Upload ${processedCount} Font${processedCount === 1 ? '' : 's'} to Sanity`}
						disabled={!canUpload}
						onClick={handleUpload}
					/>
				</Flex>
			)}
		</Stack>
	);
}
