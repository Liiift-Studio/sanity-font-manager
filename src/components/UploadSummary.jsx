// Post-upload summary — shows results with retry for failed fonts

import React from 'react';
import { Stack, Flex, Text, Card, Badge, Button } from '@sanity/ui';
import { CheckmarkCircleIcon, CloseCircleIcon } from '@sanity/icons';

/**
 * Post-upload summary — displays results after execution completes.
 *
 * @param {object} props
 * @param {object} props.plan - The executed UploadPlan
 * @param {object} [props.result] - ExecutionResult (if available via state)
 * @param {function} props.onClose - Called when user clicks Close
 */
export default function UploadSummary({ plan, result, onClose }) {
	const fontEntries = Object.values(plan.fonts);
	const processedCount = fontEntries.filter(f => f.status === 'processed').length;
	const errorCount = fontEntries.filter(f => f.status === 'error').length;

	return (
		<Stack space={4}>
			<Flex align="center" gap={2}>
				{errorCount === 0 ? (
					<CheckmarkCircleIcon style={{ color: 'var(--card-badge-positive-bg-color)', fontSize: 24 }} />
				) : (
					<CloseCircleIcon style={{ color: 'var(--card-badge-critical-bg-color)', fontSize: 24 }} />
				)}
				<Text size={2} weight="semibold">
					Upload Complete
				</Text>
			</Flex>

			<Card border padding={3} radius={2}>
				<Stack space={2}>
					<Flex gap={3}>
						<Badge tone="positive">{processedCount} processed</Badge>
						{errorCount > 0 && <Badge tone="critical">{errorCount} failed</Badge>}
					</Flex>
					{result && (
						<Stack space={1}>
							{result.created > 0 && <Text size={1}>Created {result.created} new font document{result.created === 1 ? '' : 's'}</Text>}
							{result.updated > 0 && <Text size={1}>Updated {result.updated} existing font document{result.updated === 1 ? '' : 's'}</Text>}
							{result.skipped > 0 && <Text size={1} muted>{result.skipped} skipped (processing errors)</Text>}
						</Stack>
					)}
					{result?.typefacePatchError && (
						<Card tone="critical" border padding={2} radius={1} marginTop={2}>
							<Text size={1}>Typeface document patch failed: {result.typefacePatchError}</Text>
						</Card>
					)}
				</Stack>
			</Card>

			{/* Failed fonts detail */}
			{result?.failedFonts?.length > 0 && (
				<Stack space={2}>
					<Text size={1} weight="semibold">Failed Fonts</Text>
					{result.failedFonts.map((f, i) => (
						<Card key={i} tone="critical" border padding={2} radius={1}>
							<Stack space={1}>
								<Text size={1} weight="semibold">{f.title}</Text>
								<Text size={0} muted>{f.error}</Text>
							</Stack>
						</Card>
					))}
				</Stack>
			)}

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
