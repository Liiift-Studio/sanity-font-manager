// Per-font collapsible review card — inline editing for title, weight, style, subfamily, documentId with decision source hints

import React, { useState, useCallback, useEffect, memo } from 'react';
import { Card, Stack, Flex, Box, Text, TextInput, Badge, Button, Select, Tooltip, Label } from '@sanity/ui';
import { ChevronDownIcon, ChevronRightIcon, TrashIcon, ResetIcon, InfoOutlineIcon } from '@sanity/icons';
import { FONT_STATUS, RECOMMENDATION } from '../utils/planTypes';
import ExistingDocumentResolver from './ExistingDocumentResolver';

/**
 * Collapsible review card for a single font in the upload plan.
 * Wrapped in React.memo — receives only its own font entry slice, not the full plan.
 * Dispatches user edit actions on blur, not on every keystroke.
 */
const FontReviewCard = memo(function FontReviewCard({ entry, dispatch, allExpanded }) {
	const [expanded, setExpanded] = useState(false);

	// Sync with allExpanded toggle from BulkActions
	useEffect(() => {
		setExpanded(allExpanded);
	}, [allExpanded]);
	// Local state for typing — dispatches on blur
	const [localTitle, setLocalTitle] = useState(entry.title);
	const [localDocId, setLocalDocId] = useState(entry.documentId);
	const [localWeight, setLocalWeight] = useState(String(entry.weight));
	const [localWeightName, setLocalWeightName] = useState(entry.weightName);

	const isError = entry.status === FONT_STATUS.ERROR;
	const hasConflict = entry._idConflict;
	const resolution = entry.decisions?.existingDocument;
	const isUpdate = resolution?.userChoice === 'update' ||
		(!resolution?.userChoice && (resolution?.recommendation === RECOMMENDATION.USE_EXACT || resolution?.recommendation === RECOMMENDATION.USE_CANDIDATE));

	const cardTone = isError ? 'critical' : hasConflict ? 'caution' : 'default';

	const handleTitleBlur = useCallback(() => {
		if (localTitle !== entry.title) {
			dispatch({ type: 'SET_FONT_TITLE', tempId: entry.tempId, title: localTitle });
		}
	}, [localTitle, entry.title, entry.tempId, dispatch]);

	const handleDocIdBlur = useCallback(() => {
		if (localDocId !== entry.documentId) {
			dispatch({ type: 'SET_FONT_DOCUMENT_ID', tempId: entry.tempId, documentId: localDocId });
		}
	}, [localDocId, entry.documentId, entry.tempId, dispatch]);

	const handleWeightBlur = useCallback(() => {
		const num = Number(localWeight);
		if (!isNaN(num) && num !== entry.weight) {
			dispatch({ type: 'SET_FONT_WEIGHT', tempId: entry.tempId, weight: num });
		}
	}, [localWeight, entry.weight, entry.tempId, dispatch]);

	const handleWeightNameBlur = useCallback(() => {
		if (localWeightName !== entry.weightName) {
			dispatch({ type: 'SET_FONT_WEIGHT_NAME', tempId: entry.tempId, weightName: localWeightName });
		}
	}, [localWeightName, entry.weightName, entry.tempId, dispatch]);

	const handleStyleChange = useCallback((e) => {
		dispatch({ type: 'SET_FONT_STYLE', tempId: entry.tempId, style: e.target.value });
	}, [entry.tempId, dispatch]);

	const handleSubfamilyChange = useCallback((e) => {
		dispatch({ type: 'SET_FONT_SUBFAMILY', tempId: entry.tempId, subfamily: e.target.value });
	}, [entry.tempId, dispatch]);

	const handleReset = useCallback(() => {
		dispatch({ type: 'RESET_FONT_TO_SUGGESTIONS', tempId: entry.tempId });
		setLocalTitle(entry.decisions.title.processed);
		setLocalDocId(entry.decisions.documentId.generated);
		setLocalWeight(String(entry.decisions.weight.detected));
		setLocalWeightName(entry.decisions.weightName.detected);
	}, [entry, dispatch]);

	const handleRemove = useCallback(() => {
		dispatch({ type: 'REMOVE_FONT', tempId: entry.tempId });
	}, [entry.tempId, dispatch]);

	/** Source hint text for a decision */
	const sourceHint = (decision) => {
		if (!decision?.source) return null;
		const src = decision.source.replace(/-/g, ' ').replace('fontkit ', '');
		const reason = decision.reason ? ` (${decision.reason})` : '';
		return `Source: ${src}${reason}`;
	};

	return (
		<Card border radius={2} tone={cardTone}>
			{/* Header — always visible */}
			<Box
				as="button"
				onClick={() => !isError && setExpanded(v => !v)}
				style={{
					width: '100%',
					background: 'none',
					border: 'none',
					cursor: isError ? 'default' : 'pointer',
					textAlign: 'left',
					padding: 0,
				}}
			>
				<Box padding={2}>
					<Flex align="center" gap={2}>
						{!isError && (expanded ? <ChevronDownIcon /> : <ChevronRightIcon />)}
						<Text size={1} weight="semibold" style={{ flex: 1,  textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
							{entry.title || entry.sourceFileName}
						</Text>
						<Flex gap={1} align="center" style={{ flexShrink: 0 }}>
							{isError && <Badge tone="critical" fontSize={0}>Error</Badge>}
							{hasConflict && <Badge tone="caution" fontSize={0}>ID Conflict</Badge>}
							{entry.variableFont && <Badge tone="primary" fontSize={0}>VF</Badge>}
							<Badge fontSize={0}>{entry.weight}</Badge>
							<Badge tone={entry.style === 'Italic' ? 'primary' : 'default'} mode="outline" fontSize={0}>
								{entry.style}
							</Badge>
							{entry.files?.length > 1 && (
								<Badge mode="outline" fontSize={0}>{entry.files.length} files</Badge>
							)}
							<Badge tone={isUpdate ? 'caution' : 'positive'} fontSize={0}>
								{isUpdate ? 'Update' : 'Create'}
							</Badge>
						</Flex>
					</Flex>
				</Box> 
			</Box>

			{/* Error message */}
			{isError && (
				<Box paddingX={2} paddingBottom={2}>
					<Flex justify="space-between" align="center">
						<Text size={0} muted>{entry.error}</Text>
						<Button mode="bleed" tone="critical" icon={TrashIcon} padding={1} onClick={handleRemove} />
					</Flex>
				</Box>
			)}

			{/* Expanded detail — editable fields */}
			{expanded && !isError && (
				<Box padding={3} style={{ borderTop: '1px solid var(--card-border-color)' }}>
					<Stack space={4}>
						{/* Files in this document */}
						{entry.files?.length > 0 && (
							<Stack space={2}>
								<Label size={0}>Files ({entry.files.length})</Label>
								<Flex gap={1} wrap="wrap">
									{entry.files.map((f, i) => {
										const ext = f.name?.split('.').pop()?.toUpperCase() || '?';
										return (
											<Badge key={i} fontSize={0} tone="primary">
												{ext}: {f.name}
											</Badge>
										);
									})}
								</Flex>
							</Stack>
						)}

						{/* Title */}
						<Stack space={2}>
							<Label size={0}>Font Title</Label>
							<TextInput
								value={localTitle}
								onChange={(e) => setLocalTitle(e.target.value)}
								onBlur={handleTitleBlur}
								fontSize={1}
							/>
							{entry.decisions?.title && (
								<Text size={0} muted>{sourceHint(entry.decisions.title)}</Text>
							)}
							{entry.decisions?.title?.alternatives?.length > 0 && (
								<Flex gap={1} wrap="wrap">
									{entry.decisions.title.alternatives.filter(a => a.value).map((alt, i) => (
										<Tooltip key={i} content={<Box padding={1}><Text size={0}>{alt.source}</Text></Box>} portal>
											<Badge
												mode="outline"
												fontSize={0}
												style={{ cursor: 'pointer' }}
												onClick={() => {
													setLocalTitle(alt.value);
													dispatch({ type: 'SET_FONT_TITLE', tempId: entry.tempId, title: alt.value });
												}}
											>
												{alt.value.length > 30 ? alt.value.slice(0, 30) + '...' : alt.value}
											</Badge>
										</Tooltip>
									))}
								</Flex>
							)}
						</Stack>

						{/* Document ID */}
						<Stack space={2}>
							<Label size={0}>Document ID</Label>
							<TextInput
								value={localDocId}
								onChange={(e) => setLocalDocId(e.target.value)}
								onBlur={handleDocIdBlur}
								fontSize={1}
								style={{ fontFamily: 'monospace' }}
							/>
							{hasConflict && (
								<Text size={0} tone="caution">This ID conflicts with another font in this batch</Text>
							)}
						</Stack>

						{/* Weight + Weight Name row */}
						<Flex gap={3}>
							<Box style={{ flex: 1 }}>
								<Stack space={2}>
									<Label size={0}>Weight (1-1000)</Label>
									<TextInput
										type="number"
										value={localWeight}
										onChange={(e) => setLocalWeight(e.target.value)}
										onBlur={handleWeightBlur}
										fontSize={1}
									/>
									{entry.decisions?.weight && (
										<Text size={0} muted>{sourceHint(entry.decisions.weight)}</Text>
									)}
								</Stack>
							</Box>
							<Box style={{ flex: 1 }}>
								<Stack space={2}>
									<Label size={0}>Weight Name</Label>
									<TextInput
										value={localWeightName}
										onChange={(e) => setLocalWeightName(e.target.value)}
										onBlur={handleWeightNameBlur}
										fontSize={1}
									/>
									{entry.decisions?.weightName && (
										<Text size={0} muted>Source: {entry.decisions.weightName.detected ? `detected "${entry.decisions.weightName.detected}"` : 'none'}</Text>
									)}
								</Stack>
							</Box>
						</Flex>

						{/* Style + Subfamily row */}
						<Flex gap={3}>
							<Box style={{ flex: 1 }}>
								<Stack space={2}>
									<Label size={0}>Style</Label>
									<Select value={entry.style} onChange={handleStyleChange} fontSize={1}>
										<option value="Regular">Regular</option>
										<option value="Italic">Italic</option>
									</Select>
									{entry.decisions?.style && (
										<Text size={0} muted>{sourceHint(entry.decisions.style)}</Text>
									)}
								</Stack>
							</Box>
							<Box style={{ flex: 1 }}>
								<Stack space={2}>
									<Label size={0}>Subfamily</Label>
									<TextInput
										value={entry.subfamily}
										onChange={handleSubfamilyChange}
										fontSize={1}
									/>
									{entry.decisions?.subfamily && (
										<Text size={0} muted>{sourceHint(entry.decisions.subfamily)}{entry.decisions.subfamily.detected ? ` → "${entry.decisions.subfamily.detected}"` : ''}</Text>
									)}
								</Stack>
							</Box>
						</Flex>

						{/* VF axes info */}
						{entry.variableFont && entry.variationAxes && (
							<Stack space={2}>
								<Label size={0}>Variable Font Axes</Label>
								<Flex gap={1} wrap="wrap">
									{Object.entries(entry.variationAxes).map(([tag, axis]) => (
										<Badge key={tag} mode="outline" fontSize={0}>
											{tag} {axis.min}–{axis.max}
										</Badge>
									))}
								</Flex>
								{entry.decisions?.weight?.userOverride != null && entry.variationAxes?.wght && (
									(entry.weight < entry.variationAxes.wght.min || entry.weight > entry.variationAxes.wght.max) && (
										<Text size={0} tone="caution">
											Weight {entry.weight} is outside the wght axis range ({entry.variationAxes.wght.min}–{entry.variationAxes.wght.max})
										</Text>
									)
								)}
							</Stack>
						)}

						{/* File formats */}
						<Stack space={2}>
							<Label size={0}>File Formats</Label>
							<Flex gap={1}>
								{entry.files?.map((f, i) => {
									const ext = f.name.split('.').pop().toUpperCase();
									return <Badge key={i} mode="outline" fontSize={0}>{ext}</Badge>;
								})}
							</Flex>
							{entry.glyphCount > 0 && (
								<Text size={0} muted>{entry.glyphCount} glyphs</Text>
							)}
						</Stack>

						{/* Existing document resolution */}
						<ExistingDocumentResolver
							decision={entry.decisions?.existingDocument}
							tempId={entry.tempId}
							dispatch={dispatch}
						/>

						{/* Actions */}
						<Flex justify="flex-end" gap={2}>
							<Button
								mode="ghost"
								tone="default"
								icon={ResetIcon}
								text="Reset to Suggestions"
								fontSize={1}
								padding={2}
								onClick={handleReset}
							/>
							<Button
								mode="ghost"
								tone="critical"
								icon={TrashIcon}
								text="Remove"
								fontSize={1}
								padding={2}
								onClick={handleRemove}
							/>
						</Flex>
					</Stack>
				</Box>
			)}
		</Card>
	);
});

export default FontReviewCard;
