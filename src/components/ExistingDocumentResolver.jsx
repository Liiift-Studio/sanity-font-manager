// Existing document resolution UI — create/update decision with candidate selection

import React from 'react';
import { Card, Stack, Flex, Text, Badge, Button, Label } from '@sanity/ui';
import { RECOMMENDATION } from '../utils/planTypes';

/**
 * Displays the existing document resolution decision and lets the user
 * choose between creating a new document or updating an existing one.
 */
export default function ExistingDocumentResolver({ decision, tempId, dispatch }) {
	if (!decision) return null;

	const { recommendation, exact, candidates, userChoice, selectedCandidate, lookupFailed } = decision;

	// Derive the effective action
	const effectiveAction = userChoice ||
		(recommendation === RECOMMENDATION.USE_EXACT || recommendation === RECOMMENDATION.USE_CANDIDATE ? 'update' : 'create');

	const handleSetAction = (action) => {
		dispatch({ type: 'SET_FONT_ACTION', tempId, decision: action });
	};

	const handleSelectCandidate = (candidate) => {
		dispatch({ type: 'SET_FONT_CANDIDATE', tempId, candidate });
	};

	// Lookup failed — show warning
	if (lookupFailed) {
		return (
			<Card tone="caution" border padding={2} radius={1}>
				<Text size={0}>Could not check for existing documents — will create new. Network or permissions issue.</Text>
			</Card>
		);
	}

	// No match — create new
	if (recommendation === RECOMMENDATION.CREATE && !userChoice) {
		return (
			<Stack space={2}>
				<Label size={0}>Existing Document</Label>
				<Card tone="default" border padding={2} radius={1}>
					<Text size={1}>No existing document found — will create new.</Text>
				</Card>
			</Stack>
		);
	}

	// Exact match
	if (recommendation === RECOMMENDATION.USE_EXACT && exact) {
		return (
			<Stack space={2}>
				<Label size={0}>Existing Document</Label>
				<Card tone="positive" border padding={2} radius={1}>
					<Stack space={2}>
						<Flex align="center" gap={2}>
							<Badge tone="positive" fontSize={0}>Exact Match</Badge>
							<Text size={1} style={{ fontFamily: 'monospace' }}>{exact._id}</Text>
						</Flex>
						<Text size={0} muted>
							{exact.title} · {exact.weightName} · {exact.style}
						</Text>
						<Flex gap={2}>
							<Button
								mode={effectiveAction === 'update' ? 'default' : 'ghost'}
								tone={effectiveAction === 'update' ? 'positive' : 'default'}
								text="Update this document"
								fontSize={0}
								padding={2}
								onClick={() => handleSetAction('update')}
							/>
							<Button
								mode={effectiveAction === 'create' ? 'default' : 'ghost'}
								tone={effectiveAction === 'create' ? 'primary' : 'default'}
								text="Create new instead"
								fontSize={0}
								padding={2}
								onClick={() => handleSetAction('create')}
							/>
						</Flex>
					</Stack>
				</Card>
			</Stack>
		);
	}

	// Single candidate
	if (recommendation === RECOMMENDATION.USE_CANDIDATE && candidates.length === 1) {
		const candidate = candidates[0];
		return (
			<Stack space={2}>
				<Label size={0}>Existing Document</Label>
				<Card tone="caution" border padding={2} radius={1}>
					<Stack space={2}>
						<Flex align="center" gap={2}>
							<Badge tone="caution" fontSize={0}>Likely Match</Badge>
							<Text size={1} style={{ fontFamily: 'monospace' }}>{candidate._id}</Text>
						</Flex>
						<Text size={0} muted>
							{candidate.title} · {candidate.weightName} · {candidate.style}
							{candidate.subfamily ? ` · ${candidate.subfamily}` : ''}
						</Text>
						<Flex gap={2}>
							<Button
								mode={effectiveAction === 'update' ? 'default' : 'ghost'}
								tone={effectiveAction === 'update' ? 'positive' : 'default'}
								text="Update this document"
								fontSize={0}
								padding={2}
								onClick={() => handleSelectCandidate(candidate)}
							/>
							<Button
								mode={effectiveAction === 'create' ? 'default' : 'ghost'}
								tone={effectiveAction === 'create' ? 'primary' : 'default'}
								text="Create new instead"
								fontSize={0}
								padding={2}
								onClick={() => handleSetAction('create')}
							/>
						</Flex>
					</Stack>
				</Card>
			</Stack>
		);
	}

	// Ambiguous — multiple candidates
	if (recommendation === RECOMMENDATION.AMBIGUOUS && candidates.length > 1) {
		return (
			<Stack space={2}>
				<Label size={0}>Existing Document</Label>
				<Card tone="caution" border padding={2} radius={1}>
					<Stack space={3}>
						<Flex align="center" gap={2}>
							<Badge tone="caution" fontSize={0}>Multiple Matches</Badge>
							<Text size={0} muted>{candidates.length} potential matches found</Text>
						</Flex>
						{candidates.map((candidate, i) => (
							<Card
								key={candidate._id}
								border
								radius={1}
								padding={2}
								tone={selectedCandidate?._id === candidate._id ? 'positive' : 'default'}
								style={{ cursor: 'pointer' }}
								onClick={() => handleSelectCandidate(candidate)}
							>
								<Flex align="center" gap={2}>
									<input
										type="radio"
										name={`candidate-${tempId}`}
										checked={selectedCandidate?._id === candidate._id}
										onChange={() => handleSelectCandidate(candidate)}
									/>
									<Stack space={1} style={{ flex: 1 }}>
										<Text size={1} style={{ fontFamily: 'monospace' }}>{candidate._id}</Text>
										<Text size={0} muted>
											{candidate.title} · {candidate.weightName} · {candidate.style}
											{candidate.subfamily ? ` · ${candidate.subfamily}` : ''}
										</Text>
									</Stack>
								</Flex>
							</Card>
						))}
						<Button
							mode={effectiveAction === 'create' ? 'default' : 'ghost'}
							tone="primary"
							text="Create new document instead"
							fontSize={0}
							padding={2}
							onClick={() => handleSetAction('create')}
						/>
					</Stack>
				</Card>
			</Stack>
		);
	}

	// User chose create after initially having a match
	if (userChoice === 'create') {
		return (
			<Stack space={2}>
				<Label size={0}>Existing Document</Label>
				<Card border padding={2} radius={1}>
					<Flex align="center" justify="space-between">
						<Text size={1}>Will create new document</Text>
						{(exact || candidates.length > 0) && (
							<Button
								mode="ghost"
								tone="positive"
								text="Switch to update"
								fontSize={0}
								padding={2}
								onClick={() => handleSetAction('update')}
							/>
						)}
					</Flex>
				</Card>
			</Stack>
		);
	}

	return null;
}
