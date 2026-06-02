// Post-upload summary — results display with retry for failed fonts and typeface patch

import React, { useState, useCallback } from 'react';
import { Stack, Flex, Text, Card, Badge, Button, Box, Spinner } from '@sanity/ui';
import { CheckmarkCircleIcon, CloseCircleIcon, ResetIcon } from '@sanity/icons';
import { updateTypefaceDocument } from '../utils/updateTypefaceDocument';

/**
 * Post-upload summary — shows execution results with retry options.
 */
export default function UploadSummary({
	plan,
	result,
	onClose,
	onRetry,
	client,
	docId,
	stylesObject,
	preferredStyleRef,
}) {
	const [retryingPatch, setRetryingPatch] = useState(false);
	const [patchRetryResult, setPatchRetryResult] = useState(null);

	const hasFailedFonts = result?.failedFonts?.length > 0;
	const hasTypefacePatchError = result?.typefacePatchError && !patchRetryResult?.success;
	const allSuccess = result?.success && !hasTypefacePatchError;

	/** Retry the typeface document patch only */
	const handleRetryTypefacePatch = useCallback(async () => {
		if (!result || !client || !docId) return;
		setRetryingPatch(true);
		setPatchRetryResult(null);

		try {
			const subfamilies = {};
			const uniqueSubfamilies = new Set();
			for (const entry of Object.values(plan.fonts)) {
				if (entry.status === 'error') continue;
				subfamilies[entry.documentId] = entry.subfamily;
				if (entry.subfamily) uniqueSubfamilies.add(entry.subfamily);
			}

			await updateTypefaceDocument(
				docId,
				result.fontRefs || [],
				result.variableRefs || [],
				subfamilies,
				[...uniqueSubfamilies],
				stylesObject?.subfamilies || [],
				preferredStyleRef || {},
				{ weight: -100, style: 'Italic', _ref: result.fontRefs?.[0]?._ref || '' },
				stylesObject || {},
				client,
				() => {},
				() => {},
			);

			setPatchRetryResult({ success: true });
		} catch (err) {
			console.error('Typeface patch retry failed:', err);
			setPatchRetryResult({ success: false, error: err.message });
		}

		setRetryingPatch(false);
	}, [result, client, docId, plan, stylesObject, preferredStyleRef]);

	return (
		<Stack space={4}>
			{/* Header */}
			<Flex align="center" gap={2} ref={(el) => el?.focus?.()} tabIndex={-1}>
				{allSuccess ? (
					<CheckmarkCircleIcon style={{ color: 'var(--card-badge-positive-bg-color)', fontSize: 24 }} />
				) : (
					<CloseCircleIcon style={{ color: 'var(--card-badge-critical-bg-color)', fontSize: 24 }} />
				)}
				<Text size={2} weight="semibold">
					{allSuccess ? 'Upload Complete' : 'Upload Completed with Issues'}
				</Text>
			</Flex>

			{/* Stats */}
			{result && (
				<Card border padding={3} radius={2}>
					<Stack space={3}>
						<Flex gap={2} wrap="wrap">
							{result.created > 0 && (
								<Badge tone="positive">
									{result.created} created
								</Badge>
							)}
							{result.updated > 0 && (
								<Badge tone="primary">
									{result.updated} updated
								</Badge>
							)}
							{result.failed > 0 && (
								<Badge tone="critical">
									{result.failed} failed
								</Badge>
							)}
							{result.skipped > 0 && (
								<Badge mode="outline">
									{result.skipped} skipped
								</Badge>
							)}
						</Flex>

						{result.created > 0 && (
							<Text size={1}>Created {result.created} new font document{result.created === 1 ? '' : 's'}</Text>
						)}
						{result.updated > 0 && (
							<Text size={1}>Updated {result.updated} existing font document{result.updated === 1 ? '' : 's'}</Text>
						)}
						{result.skipped > 0 && (
							<Text size={1} muted>{result.skipped} skipped (processing errors)</Text>
						)}
					</Stack>
				</Card>
			)}

			{/* Failed fonts */}
			{hasFailedFonts && (
				<Stack space={2}>
					<Flex align="center" justify="space-between">
						<Text size={1} weight="semibold">Failed Fonts ({result.failedFonts.length})</Text>
						<Button
							mode="ghost"
							tone="primary"
							icon={ResetIcon}
							text="Retry Failed"
							fontSize={1}
							padding={2}
							onClick={() => onRetry(result.failedFonts.map(f => f.tempId).filter(Boolean))}
						/>
					</Flex>
					<Box style={{ maxHeight: 200, overflowY: 'auto' }}>
						<Stack space={1}>
							{result.failedFonts.map((f, i) => (
								<Card key={i} tone="critical" border padding={2} radius={1}>
									<Stack space={1}>
										<Flex align="center" gap={2}>
											<Text size={1} weight="semibold">{f.title}</Text>
											{f.failedAt && (
												<Badge tone="critical" fontSize={0} mode="outline">{f.failedAt}</Badge>
											)}
										</Flex>
										<Text size={0} muted>{f.error}</Text>
									</Stack>
								</Card>
							))}
						</Stack>
					</Box>
				</Stack>
			)}

			{/* Typeface patch error */}
			{hasTypefacePatchError && (
				<Card tone="caution" border padding={3} radius={2}>
					<Stack space={3}>
						<Text size={1} weight="semibold">Typeface Document Not Updated</Text>
						<Text size={1}>
							{result.created + result.updated} font document{result.created + result.updated === 1 ? '' : 's'} created/updated successfully, but the typeface document could not be patched to reference them.
						</Text>
						<Text size={0} muted>Error: {result.typefacePatchError}</Text>
						<Flex gap={2}>
							<Button
								mode="default"
								tone="primary"
								icon={retryingPatch ? undefined : ResetIcon}
								text={retryingPatch ? 'Retrying...' : 'Retry Typeface Patch'}
								disabled={retryingPatch}
								onClick={handleRetryTypefacePatch}
							/>
							{retryingPatch && <Spinner />}
						</Flex>
					</Stack>
				</Card>
			)}

			{/* Successful typeface patch retry */}
			{patchRetryResult?.success && (
				<Card tone="positive" border padding={3} radius={2}>
					<Text size={1}>Typeface document updated successfully on retry.</Text>
				</Card>
			)}

			{/* Failed typeface patch retry */}
			{patchRetryResult && !patchRetryResult.success && (
				<Card tone="critical" border padding={2} radius={1}>
					<Text size={1}>Retry failed: {patchRetryResult.error}</Text>
				</Card>
			)}

			{/* Close */}
			<Flex justify="flex-end">
				<Button
					mode="default"
					tone="primary"
					text="Close"
					onClick={onClose}
				/>
			</Flex>
		</Stack>
	);
}
