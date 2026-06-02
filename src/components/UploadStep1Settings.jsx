// Step 1 — Settings & file selection: price, toggles, drag-and-drop zone, file list

import React, { useState, useCallback, useRef } from 'react';
import { Box, Flex, Grid, Stack, Text, Label, Switch, Button, Card, Tooltip } from '@sanity/ui';
import { UploadIcon, TrashIcon, InfoOutlineIcon } from '@sanity/icons';
import PriceInput from './PriceInput';

/** Accepted font file extensions */
const ACCEPTED_EXTENSIONS = ['ttf', 'otf', 'woff', 'woff2', 'eot', 'svg'];

/** Sort order: TTF/OTF before web formats so metadata is available for webfont fallback */
const TYPE_ORDER = ['ttf', 'otf', 'eot', 'svg', 'woff', 'woff2'];

/** Returns only files with accepted font extensions */
const filterFontFiles = (files) =>
	Array.from(files).filter(f => ACCEPTED_EXTENSIONS.includes(f.name.split('.').pop().toLowerCase()));

/** Sorts font files so TTF/OTF are processed before web formats */
const sortFilesByType = (files) =>
	Array.from(files).sort((a, b) => {
		const aIdx = TYPE_ORDER.indexOf(a.name.split('.').pop().toLowerCase());
		const bIdx = TYPE_ORDER.indexOf(b.name.split('.').pop().toLowerCase());
		if (aIdx === bIdx) return a.name.localeCompare(b.name);
		return aIdx - bIdx;
	});

/**
 * Step 1 component — collects settings and files before processing.
 *
 * @param {object} props
 * @param {object} props.settings - Current plan settings
 * @param {function} props.onStartProcessing - Called with (sortedFiles, settings) when user clicks "Process Files"
 */
export default function UploadStep1Settings({ settings, onStartProcessing }) {
	const [inputPrice, setInputPrice] = useState(String(settings.price || 0));
	const [preserveShortenedNames, setPreserveShortenedNames] = useState(settings.preserveShortenedNames ?? true);
	const [preserveFileNames, setPreserveFileNames] = useState(settings.preserveFileNames ?? false);
	const [pendingFiles, setPendingFiles] = useState([]);
	const [isDragging, setIsDragging] = useState(false);
	const fileInputRef = useRef(null);

	const handleFileSelect = useCallback((e) => {
		const files = filterFontFiles(e.target.files);
		if (files.length > 0) setPendingFiles(prev => [...prev, ...files]);
		e.target.value = '';
	}, []);

	const handleRemoveFile = useCallback((file) => {
		setPendingFiles(prev => prev.filter(f => f !== file));
	}, []);

	const handleDragEnter = useCallback((e) => { e.preventDefault(); setIsDragging(true); }, []);
	const handleDragOver = useCallback((e) => { e.preventDefault(); }, []);
	const handleDragLeave = useCallback((e) => { e.preventDefault(); setIsDragging(false); }, []);
	const handleDrop = useCallback((e) => {
		e.preventDefault();
		setIsDragging(false);
		const files = filterFontFiles(e.dataTransfer.files);
		if (files.length > 0) setPendingFiles(prev => [...prev, ...files]);
	}, []);

	const handleProcess = useCallback(() => {
		const sorted = sortFilesByType(pendingFiles);
		onStartProcessing(sorted, {
			price: Number(inputPrice) || 0,
			preserveShortenedNames,
			preserveFileNames,
		});
	}, [pendingFiles, inputPrice, preserveShortenedNames, preserveFileNames, onStartProcessing]);

	const renderTooltipLabel = (label, description) => (
		<Tooltip
			content={<Box padding={2} style={{ maxWidth: 260 }}><Text size={1} style={{ lineHeight: 1.6 }}>{description}</Text></Box>}
			placement="top"
			portal
		>
			<Flex align="center" gap={1} style={{ cursor: 'default' }}>
				<Label>{label}</Label>
				<InfoOutlineIcon style={{ opacity: 0.5, display: 'block' }} />
			</Flex>
		</Tooltip>
	);

	const dropZoneStyle = {
		border: `2px dashed ${isDragging ? 'var(--card-focus-ring-color)' : 'var(--card-border-color)'}`,
		borderRadius: 4,
		padding: pendingFiles.length > 0 ? '10px 16px' : '28px 16px',
		textAlign: 'center',
		background: isDragging ? 'rgba(100, 153, 255, 0.06)' : 'transparent',
		transition: 'border-color 0.12s, background 0.12s',
	};

	return (
		<Stack space={4}>
			{/* Settings row */}
			<Grid columns={[2]} gap={4}>
				<Box>
					<PriceInput
						inputPrice={inputPrice}
						handleInputChange={(e) => setInputPrice(e.target.value)}
					/>
				</Box>
				<Stack space={3}>
					<Flex align="center" gap={2}>
						<Switch
							checked={preserveShortenedNames}
							onChange={(e) => setPreserveShortenedNames(e.target.checked)}
						/>
						{renderTooltipLabel(
							'Preserve shortened names',
							'Abbreviations in font names are kept as-is (e.g. "XNarrow" stays "XNarrow", "Bd" stays "Bd").'
						)}
					</Flex>
					<Flex align="center" gap={2}>
						<Switch
							checked={preserveFileNames}
							onChange={(e) => setPreserveFileNames(e.target.checked)}
						/>
						{renderTooltipLabel(
							'Preserve file names',
							'Original filename is used for the font title and document ID instead of the embedded font name metadata.'
						)}
					</Flex>
				</Stack>
			</Grid>

			{/* Drop zone */}
			<Box
				onDragEnter={handleDragEnter}
				onDragOver={handleDragOver}
				onDragLeave={handleDragLeave}
				onDrop={handleDrop}
				style={dropZoneStyle}
			>
				<input
					ref={fileInputRef}
					type="file"
					multiple
					hidden
					accept=".ttf,.otf,.woff,.woff2,.eot,.svg"
					onChange={handleFileSelect}
				/>
				{pendingFiles.length === 0 ? (
					<Stack space={3}>
						<Text size={1} muted>{isDragging ? 'Release to add files' : 'Drop font files here'}</Text>
						<Flex justify="center">
							<Button
								mode="ghost"
								tone="primary"
								fontSize={1}
								padding={2}
								text="Browse files"
								onClick={() => fileInputRef.current?.click()}
							/>
						</Flex>
					</Stack>
				) : (
					<Flex align="center" justify="center" gap={2}>
						<Text size={1} muted>{isDragging ? 'Release to add' : 'Drop more files or'}</Text>
						<Button
							mode="bleed"
							tone="primary"
							fontSize={1}
							padding={1}
							text="browse"
							onClick={() => fileInputRef.current?.click()}
						/>
					</Flex>
				)}
			</Box>

			{/* File list */}
			{pendingFiles.length > 0 && (
				<Stack space={2}>
					<Flex align="center" justify="space-between">
						<Text size={1} muted>
							{pendingFiles.length} file{pendingFiles.length === 1 ? '' : 's'} selected
						</Text>
						<Button
							mode="bleed"
							tone="default"
							fontSize={1}
							padding={1}
							text="Clear all"
							onClick={() => setPendingFiles([])}
						/>
					</Flex>
					<Stack space={2} style={{ maxHeight: 300, overflowY: 'auto' }}>
						{sortFilesByType(pendingFiles).map((file, i) => {
							const ext = file.name.split('.').pop().toUpperCase();
							return (
								<Card key={`${file.name}-${file.size}-${i}`} border radius={1} paddingX={2} paddingY={2}>
									<Flex justify="space-between" align="center" gap={2}>
										<Flex gap={3} align="center" style={{ flex: 1, minWidth: 0 }}>
											<Text size={0} style={{ fontFamily: 'monospace', minWidth: '2.5rem', flexShrink: 0 }}>
												{ext}
											</Text>
											<Box style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
												<Text size={1}>{file.name}</Text>
											</Box>
										</Flex>
										<Button
											mode="bleed"
											tone="critical"
											icon={TrashIcon}
											padding={2}
											onClick={() => handleRemoveFile(file)}
										/>
									</Flex>
								</Card>
							);
						})}
					</Stack>
				</Stack>
			)}

			{/* Process button */}
			{pendingFiles.length > 0 && (
				<Button
					mode="ghost"
					tone="primary"
					icon={UploadIcon}
					text={`Process ${pendingFiles.length} File${pendingFiles.length === 1 ? '' : 's'}`}
					style={{ width: '100%' }}
					onClick={handleProcess}
				/>
			)}
		</Stack>
	);
}
