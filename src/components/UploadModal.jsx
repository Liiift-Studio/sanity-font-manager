// Upload modal — 3-step state machine: Settings → Review → Execute

import React, { useReducer, useCallback, useState, useMemo, useRef, useEffect } from 'react';
import { Dialog, Box, Flex, Text, Badge, Button } from '@sanity/ui';
import { planReducer } from '../utils/planReducer';
import { createEmptyPlan, PLAN_PHASE } from '../utils/planTypes';
import { buildUploadPlan } from '../utils/buildUploadPlan';
import { generateStyleKeywords } from '../utils/generateKeywords';
import UploadStep1Settings from './UploadStep1Settings';
import UploadStep2Review from './UploadStep2Review';
import UploadStep3Execute from './UploadStep3Execute';
import UploadSummary from './UploadSummary';

/** Step labels for the step indicator */
const STEPS = [
	{ key: 1, label: 'Settings' },
	{ key: 2, label: 'Review' },
	{ key: 3, label: 'Upload' },
];

/** Maps plan phase to active step number */
function phaseToStep(phase) {
	switch (phase) {
		case PLAN_PHASE.IDLE: return 1;
		case PLAN_PHASE.PROCESSING: return 2;
		case PLAN_PHASE.REVIEWING: return 2;
		case PLAN_PHASE.READY: return 2;
		case PLAN_PHASE.EXECUTING: return 3;
		case PLAN_PHASE.COMPLETE: return 3;
		case PLAN_PHASE.ERROR: return 3;
		default: return 1;
	}
}

/**
 * Upload modal — wraps the 3-step upload workflow in a Sanity UI Dialog.
 *
 * @param {object} props
 * @param {boolean} props.open - Whether the modal is visible
 * @param {function} props.onClose - Called when the modal requests close
 * @param {object} props.client - Sanity client
 * @param {string} props.docId - Typeface document _id
 * @param {string} props.typefaceTitle - Typeface title
 * @param {object} props.stylesObject - Existing typeface styles
 * @param {object} props.preferredStyleRef - Current preferredStyle
 * @param {object} props.slug - Typeface slug
 */
export default function UploadModal({
	open,
	onClose,
	client,
	docId,
	typefaceTitle,
	stylesObject,
	preferredStyleRef,
	slug,
}) {
	const [plan, dispatch] = useReducer(planReducer, null, () => createEmptyPlan());
	const [processingCancelled, setProcessingCancelled] = useState(false);
	const cancelRef = useRef(false);

	const { weightKeywordList, italicKeywordList } = useMemo(() => generateStyleKeywords(), []);
	const currentStep = phaseToStep(plan.phase);
	const isExecuting = plan.phase === PLAN_PHASE.EXECUTING;

	// Prevent accidental close during upload
	useEffect(() => {
		if (!open || !isExecuting) return;
		const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
		window.addEventListener('beforeunload', handler);
		return () => window.removeEventListener('beforeunload', handler);
	}, [open, isExecuting]);

	/** Handle close — confirm if plan has data, block during execution */
	const handleClose = useCallback(() => {
		if (isExecuting) return; // Blocked during upload
		const hasFonts = Object.keys(plan.fonts).length > 0;
		if (hasFonts && plan.phase !== PLAN_PHASE.COMPLETE) {
			if (!window.confirm('Close the upload modal? All progress will be lost.')) return;
		}
		dispatch({ type: 'SET_PHASE', phase: PLAN_PHASE.IDLE });
		onClose();
	}, [plan, isExecuting, onClose]);

	/** Start processing — transition to Step 2 and build the plan */
	const handleStartProcessing = useCallback(async (files, settings) => {
		dispatch({ type: 'SET_SETTINGS', settings });
		dispatch({ type: 'SET_PHASE', phase: PLAN_PHASE.PROCESSING });
		cancelRef.current = false;
		setProcessingCancelled(false);

		try {
			const builtPlan = await buildUploadPlan({
				files,
				typefaceTitle,
				docId,
				settings,
				client,
				stylesObject,
				weightKeywordList,
				italicKeywordList,
				onProgress: (event) => {
					if (cancelRef.current) return;
					if (event.type === 'font-processed' && event.fontEntry) {
						dispatch({ type: 'ADD_PROCESSED_FONT', tempId: event.tempId, fontEntry: event.fontEntry });
					} else if (event.type === 'font-error') {
						dispatch({ type: 'SET_PROCESSING_ERROR', tempId: event.tempId, error: event.error });
					}
				},
			});

			if (!cancelRef.current) {
				// Merge the full plan's fonts into the reducer (some may have been added via callbacks already)
				for (const [tempId, entry] of Object.entries(builtPlan.fonts)) {
					dispatch({ type: 'ADD_PROCESSED_FONT', tempId, fontEntry: entry });
				}
				dispatch({ type: 'SET_PHASE', phase: PLAN_PHASE.REVIEWING });
			}
		} catch (err) {
			console.error('Processing failed:', err);
			dispatch({ type: 'SET_PHASE', phase: PLAN_PHASE.REVIEWING });
		}
	}, [typefaceTitle, docId, client, stylesObject, weightKeywordList, italicKeywordList]);

	/** Cancel processing and return to Step 1 */
	const handleCancelProcessing = useCallback(() => {
		cancelRef.current = true;
		setProcessingCancelled(true);
		dispatch({ type: 'SET_PHASE', phase: PLAN_PHASE.IDLE });
	}, []);

	/** Mark plan as ready for upload */
	const handleReadyToUpload = useCallback(() => {
		dispatch({ type: 'SET_PHASE', phase: PLAN_PHASE.READY });
	}, []);

	/** Transition to execution */
	const handleStartExecution = useCallback(() => {
		dispatch({ type: 'SET_PHASE', phase: PLAN_PHASE.EXECUTING });
	}, []);

	/** Mark execution complete */
	const handleExecutionComplete = useCallback(() => {
		dispatch({ type: 'SET_PHASE', phase: PLAN_PHASE.COMPLETE });
	}, []);

	if (!open) return null;

	return (
		<Dialog
			id="upload-modal"
			header={
				<Flex align="center" justify="space-between" style={{ width: '100%' }}>
					<Text weight="semibold">Upload Fonts</Text>
					<Flex gap={2}>
						{STEPS.map((step) => (
							<Badge
								key={step.key}
								tone={currentStep === step.key ? 'primary' : currentStep > step.key ? 'positive' : 'default'}
								mode={currentStep === step.key ? 'default' : 'outline'}
								fontSize={0}
								padding={1}
							>
								{step.key}. {step.label}
							</Badge>
						))}
					</Flex>
				</Flex>
			}
			width={2}
			onClose={isExecuting ? undefined : handleClose}
			onClickOutside={isExecuting ? undefined : handleClose}
		>
			<Box padding={4}>
				{/* Step 1: Settings & File Selection */}
				{currentStep === 1 && (
					<UploadStep1Settings
						settings={plan.settings}
						onStartProcessing={handleStartProcessing}
					/>
				)}

				{/* Step 2: Processing & Review */}
				{currentStep === 2 && (
					<UploadStep2Review
						plan={plan}
						dispatch={dispatch}
						onCancelProcessing={handleCancelProcessing}
						onReadyToUpload={handleReadyToUpload}
						onStartExecution={handleStartExecution}
						processingCancelled={processingCancelled}
					/>
				)}

				{/* Step 3: Upload Execution */}
				{currentStep === 3 && plan.phase !== PLAN_PHASE.COMPLETE && (
					<UploadStep3Execute
						plan={plan}
						client={client}
						docId={docId}
						stylesObject={stylesObject}
						preferredStyleRef={preferredStyleRef}
						onComplete={handleExecutionComplete}
					/>
				)}

				{/* Post-completion Summary */}
				{plan.phase === PLAN_PHASE.COMPLETE && (
					<UploadSummary
						plan={plan}
						onClose={handleClose}
					/>
				)}
			</Box>
		</Dialog>
	);
}
