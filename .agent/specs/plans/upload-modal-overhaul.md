# Upload Modal Overhaul — Spec & Design

Status: Draft — post panel review, critical fixes applied.
Last updated: 2026-05-28

## Related Specs

| Spec | Purpose |
|---|---|
| [plan-types.md](../plan-types.md) | Type definitions for PlanObject, actions, results, callbacks |
| [reducer-action-catalog.md](../reducer-action-catalog.md) | Complete reducer action types with payloads and transitions |
| [font-upload-testing-strategy.md](../font-upload-testing-strategy.md) | Unit, integration, component, and contract test plan |
| [failure-modes-and-recovery.md](../failure-modes-and-recovery.md) | Error handling, retry, idempotency, partial failure |
| [font-metadata-field-mapping.md](../font-metadata-field-mapping.md) | OpenType name table → plan fields → Sanity document fields |
| [weight-classification-reference.md](../weight-classification-reference.md) | Unified weight keyword → number mapping |
| [variable-font-axis-handling.md](../variable-font-axis-handling.md) | Axis semantics, subfamily interaction, ital/slnt/opsz |
| [accessibility-interaction-spec.md](../accessibility-interaction-spec.md) | Focus management, ARIA, keyboard nav, screen reader |
| [migration-guide.md](../migration-guide.md) | v2→v3 breaking changes, consumer migration |
| [mckl-fixes-port.md](./mckl-fixes-port.md) | Prerequisite port plan |

## Problem Statement

When users batch-upload fonts, the system silently makes dozens of decisions: renaming files, deriving titles from metadata, expanding abbreviations, choosing document IDs, deciding whether to create or update existing font documents, assigning subfamilies, setting weights, detecting italic styles, and organizing subfamily groups. Users have no visibility into these choices and no opportunity to correct mistakes before data lands in Sanity.

Font naming is notoriously inconsistent across foundries and even within a single typeface family. The current "fire and forget" approach works when everything aligns but creates cleanup work when it doesn't — wrong titles, duplicate documents, misassigned subfamilies, split families that should be unified, etc.

## Goal

Replace the current upload-and-pray flow with a **multi-step modal** that:

1. Preserves all existing decision-making logic as **smart defaults / suggestions**
2. Surfaces every automated decision to the user for review
3. Lets users approve, adjust, or override each decision before anything touches Sanity
4. Uses Sanity UI components exclusively (no custom UI beyond layout)

Think: the experience of uploading to Figma, Transloadit, or a bulk e-commerce product importer — staged, reviewable, correctable.

---

## Architecture Overview

### Two-Phase Upload

The current flow is single-phase: `processFontFiles` → `uploadFontFiles` → `updateTypefaceDocument`, all in one `handleConfirmUpload`. The overhaul splits this into:

| Phase | What happens | User interaction |
|---|---|---|
| **1. Plan** | Read files, parse metadata, run all decision logic, resolve existing documents, organize subfamilies | User reviews a complete changeset and makes adjustments |
| **2. Execute** | Upload assets to Sanity CDN, create/update font documents, patch typeface document | Progress display per-file with status indicators |

Phase 1 produces a **plan object** — a complete data structure describing every action that Phase 2 will take. The user reviews and edits this plan. Phase 2 is a pure executor that reads the finalized plan and applies it.

### Plan Object Shape

The plan object is fully typed in [plan-types.md](../plan-types.md). Key architectural decisions from the panel review:

1. **Two separate state containers.** The `UploadPlan` (settings, fonts, subfamilyGroups) is managed by one `useReducer`. Execution progress (`ExecutionState`) lives in a separate `useReducer` or `useRef` to prevent Phase 2 progress ticks from re-rendering the review UI.

2. **Processing-owned vs. user-owned write domains.** The plan reducer enforces that processing callbacks (`ADD_PROCESSED_FONT`) only write to processing-owned fields, while user actions (`SET_FONT_TITLE`, etc.) only write to `decisions.*.userOverride`. This prevents the race condition where a processing dispatch overwrites a user edit.

3. **Version-stamped plan.** `plan.version = 1` from day one, enabling future migrations if the shape changes.

4. **Typed callbacks.** `onProgress` is not a generic `(msg) => void` — it emits structured `ProcessingProgressEvent` and `ExecutionProgressEvent` objects that the component layer adapts into reducer dispatches. See [plan-types.md](../plan-types.md) for the full event types.

See [plan-types.md](../plan-types.md) for the complete `UploadPlan`, `FontPlanEntry`, `FontDecisions`, `ExecutionState`, `ExecutionResult`, and all callback type definitions.

---

## Modal Steps

### Step 1: Settings & File Selection

**What the user sees:**
- Price input (existing `PriceInput` component)
- Toggle: "Preserve shortened names" (existing)
- Toggle: "Preserve file names" (existing)
- Drag-and-drop zone / file browser (existing UI, moved into modal)
- File list with remove buttons (existing)
- "Process Files" button to advance to Step 2

**Sanity UI components:** `Dialog` (modal container), `Card`, `Grid`, `Stack`, `Switch`, `Button`, `Text`, `Label`, `Tooltip`

**Logic:** No processing happens here — just collecting inputs. This is essentially the current upload UI reorganized into a modal.

**Transitions:**
- Files selected + settings configured → "Process Files" button enabled
- Click "Process Files" → advance to Step 2

---

### Step 2: Processing & Review (merged)

Processing and review are a **single step**. As each font finishes parsing, its review card appears immediately and is editable while remaining fonts are still processing. This eliminates dead waiting time.

**What the user sees:**
- A persistent progress bar at top: "Processing 12/48 files..." with overall count
- Below the progress bar: review cards appearing one by one as fonts finish processing
- Each card starts collapsed, showing the derived title, weight badge, style badge, and action badge
- Cards are **grouped by subfamily** by default (not a flat list) — this is critical for navigating large families
- Error cards appear inline with a distinct error treatment (see [failure-modes-and-recovery.md](../failure-modes-and-recovery.md))
- Once all processing is complete, the progress bar transitions to a summary: "48 fonts processed (2 errors)"

**What happens behind the scenes:**
- `buildUploadPlan` orchestrator runs in sequence, calling `onProgress` after each font
- Font parsing runs in a **Web Worker** to avoid blocking the main thread during user interaction
- Existing document resolution uses a **single batched GROQ query** up front (all fonts for this typeface), then matches in-memory — not one query per font
- The component dispatches `ADD_PROCESSED_FONT` for each completed font, which adds a card to the review UI
- No Sanity writes happen — only reads (the initial batch query for existing documents)

**Sanity UI components:** `Spinner`, `Card`, `Flex`, `Text`, `Badge`, progress indicators

**Transitions:**
- User reviews and edits cards as they appear (no need to wait for all processing)
- When ready: clicks "Upload to Sanity" button
- **Confirmation dialog** shown first: "You are about to create X new fonts and update Y existing fonts. Proceed?"
- Validation runs: duplicate IDs, missing required fields (title, documentId)
- If validation fails → highlight problem cards, scroll to first error
- If validation passes → advance to Step 3

---

This is the core of the overhaul — the review screen. It should be **scrollable** with **collapsible sections**.

#### 2a. Font Document Review (per-font cards)

Each font gets a collapsible card. The card header shows:
- Font title (editable inline)
- Weight badge (e.g. "400")
- Style badge ("Regular" / "Italic")
- Subfamily badge
- Action badge: "Create New" (green) or "Update Existing" (blue) or "Conflict" (yellow)

**Collapsed state:** Just the header — enough info to scan and spot problems.

**Expanded state:** Full detail view with editable fields:

| Field | Display | Editable | Notes |
|---|---|---|---|
| **Title** | Text input, pre-filled with processed title | Yes | Show original raw value as hint text below |
| **Document ID** | Text input, auto-derived from title | Yes | Warn if ID already exists and action is "Create" |
| **Weight** | Number input (1-1000, not restricted to 100-step increments) | Yes | Show source: "OS/2 table: 700" or "Keyword match: Bold → 700". See [weight-classification-reference.md](../weight-classification-reference.md) |
| **Weight Name** | Text input | Yes | e.g. "Bold", "Light" |
| **Style** | Toggle or radio: Regular / Italic | Yes | Show why it was detected ("italic angle: -12") |
| **Subfamily** | Text input or dropdown of detected subfamilies | Yes | |
| **Variable Font** | Read-only badge | No | Auto-detected |
| **Existing Document** | Card showing match details | Selectable | See below |

**Existing Document Resolution UI:**

When `resolveExistingFont` finds matches, show a decision card:

- **`use-exact`**: "Found existing document: `halyard-display-bold`. Will update it."
  - Option to switch to "Create new document instead"
- **`use-candidate`**: "No exact ID match, but found a likely match: `halyard-display-bold` (same weight, style, subfamily)."
  - Option: "Update this document" (default) or "Create new document"
- **`ambiguous`**: "Multiple potential matches found:" + list of candidates
  - Radio select: pick one to update, or create new
  - Each candidate shows: title, ID, weight, style, subfamily
- **`create`**: "No existing document found. Will create new."
  - Option to manually link to an existing document (search/autocomplete)

**File format listing:** Below the metadata fields, show which file formats were provided:
- TTF, OTF, WOFF, WOFF2 — with checkmarks for present formats
- This is read-only (just informational)

**Sanity UI components:** `Card` (collapsible), `TextInput`, `NumberInput`, `Select`, `RadioGroup` or `MenuButton`, `Badge`, `Inline`, `Stack`, `Flex`, `Text`, `Button` (expand/collapse), `Autocomplete` (for document search)

#### 2b. Subfamily Organization (bottom of Step 2)

A collapsible section at the bottom showing how fonts are grouped into subfamilies:

- Each subfamily is a card with its name as a header
- Inside: list of font titles assigned to it
- Drag-to-reorder or reassign fonts between subfamilies (stretch goal — v1 can just use dropdowns)
- Add new subfamily group
- Remove empty subfamily groups

**Sanity UI components:** `Card`, `Stack`, `Text`, `Select` (to reassign), `Button` (add/remove)

#### 2c. Bulk Actions (sticky bar at top of review area)

Above the font cards, a sticky bar with bulk operations:
- "Expand All" / "Collapse All"
- "Accept All Suggestions" — resets all userOverrides to null (accepts system recommendations). **Scoped**: applies only to currently filtered/visible fonts, not the entire batch.
- "Reset to Suggestions" per-card (in each card header)
- Filter/sort: by subfamily, by weight, by action type (create/update/conflict)
- Search: filter font cards by title
- Filters apply live to incoming cards during processing

**Sanity UI components:** `Button`, `TextInput` (search), `Select` (filter), `MenuButton` (sort)

---

### Step 3: Upload & Execute

**What the user sees:**
- List of all fonts with per-font progress
- Each font row shows: title, current operation ("Uploading TTF...", "Generating CSS...", "Creating document..."), progress bar or spinner
- Status icons: queued (grey), in-progress (blue spinner), complete (green check), error (red X)
- Overall progress: "Uploading 5/24 fonts..."
- Elapsed time counter (existing)
- "Do not close" warning (existing)
- Wake Lock (existing)

**What happens:**
- Phase 2 executor reads the finalized plan
- For each font: upload assets → generate CSS → generate font data → create/update document
- Each step updates the separate `ExecutionState` (not the plan object)
- On completion: patch typeface document with new references + subfamily structure

**Sanity UI components:** `Spinner`, `Card`, `Flex`, `Text`, `Badge`, progress indicators, `Stack`

**Upload concurrency:** Max 3 concurrent uploads with exponential backoff on 429 rate-limit responses. See [failure-modes-and-recovery.md](../failure-modes-and-recovery.md).

**Post-completion:**
- Summary: "24 fonts uploaded successfully. 2 updated, 22 created."
- If errors: list failed fonts with error messages, which step failed, and "Retry Failed" button
- Retry skips already-uploaded assets (cached `assetRefs` in execution progress)
- If typeface patch failed: separate "Retry Typeface Patch" button
- "Close" button to dismiss modal

---

## Component Architecture

```
BatchUploadFonts.jsx (existing — adds "Upload Fonts" button that opens modal)
  |
  +-- UploadModal.jsx (new — Dialog wrapper, 3-step state machine)
       |
       +-- UploadStep1Settings.jsx (new — price, toggles, file drop zone)
       |
       +-- UploadStep2ReviewableProcessing.jsx (new — merged processing + review)
       |    |
       |    +-- BulkActions.jsx (new — sticky bar: expand/collapse, accept all, filter/search)
       |    |
       |    +-- SubfamilyGroup.jsx (new — collapsible group per subfamily)
       |    |    |
       |    |    +-- FontReviewCard.jsx (new — per-font collapsible review card, React.memo wrapped)
       |    |         |
       |    |         +-- ExistingDocumentResolver.jsx (new — create/update decision UI)
       |    |
       |    +-- SubfamilyOrganizer.jsx (new — subfamily grouping section at bottom)
       |
       +-- UploadStep3Execute.jsx (new — upload progress per font)
       |
       +-- UploadSummary.jsx (new — post-upload summary with retry)
```

**Key architectural decisions from panel review:**
- `FontReviewCard` wrapped in `React.memo` — receives only its own font entry slice, not the full plan
- `ExistingDocumentResolver` receives only `decisions.existingDocument` and a narrow `onDecisionChange` callback
- Cards grouped by subfamily by default (not a flat list) — `SubfamilyGroup` component handles grouping
- Lazy boundary: `UploadModal` loaded via `React.lazy()` so fontkit and the full modal tree don't load at Studio boot

### Utility Refactors

The existing utility functions need minimal changes — they already contain the right logic. The main change is making them return data instead of immediately writing to Sanity:

| File | Change |
|---|---|
| `processFontFiles.js` | Return `decisions` audit trail with `alternatives` from name IDs 1,4,6,16,17 + filename. Add VF detection fix (min !== max). Add OS/2 `fsSelection` italic detection. |
| `uploadFontFiles.js` | Split into `buildUploadPlan.js` (Phase 1) and `executeUploadPlan.js` (Phase 2). Extract `resolveExistingFont` as standalone utility. Old export preserved as deprecated wrapper. |
| `updateTypefaceDocument.js` | Refactor to accept options object (not 12 positional params). Apply dot-path patch fix. preferredStyle sticky. |
| `generateFontData.js` | No changes needed. |
| `generateCssFile.js` | Add `size-adjust` to fallback @font-face. Add fallback `@font-face` blocks for browsers that don't support range syntax. |
| `generateKeywords.js` | No changes needed. |
| `sanitizeForSanityId.js` | Replace `Math.random()` hash with deterministic hash for long names. |
| `weight.js` (new) | Unified `resolveWeight()` function replacing divergent lists. See [weight-classification-reference.md](../weight-classification-reference.md). |
| `resolveExistingFont.js` (new) | Standalone document resolution. See port plan. |

### New Utility: `buildUploadPlan.js`

Orchestrates Phase 1. Uses Sanity client for READ operations only (existing document resolution). Font parsing runs in a Web Worker.

**NOTE:** `buildUploadPlan` performs a single batched GROQ query up front to fetch all existing font documents for the typeface, then matches in-memory. This is intentional — the alternative (no Sanity reads during plan building) would defer all resolution to Phase 2, losing the ability to show create/update decisions in the review UI.

Full typed signature in [plan-types.md](../plan-types.md).

### New Utility: `executeUploadPlan.js`

Orchestrates Phase 2. Max 3 concurrent uploads with exponential backoff on 429s. Caches asset references in `ExecutionState` for idempotent retry.

Full typed signature, `ExecutionResult` shape, and callback types in [plan-types.md](../plan-types.md). Failure modes and retry semantics in [failure-modes-and-recovery.md](../failure-modes-and-recovery.md).

---

## State Management

**Two separate state containers** to prevent execution progress ticks from re-rendering the review UI:

```js
// Plan state — settings, fonts, subfamilyGroups, processing progress
const [plan, planDispatch] = useReducer(planReducer, initialPlan);

// Execution state — separate, only active during Step 3
const [execution, execDispatch] = useReducer(executionReducer, initialExecution);
```

**Write domain isolation** — the plan reducer enforces that:
- Processing callbacks (`ADD_PROCESSED_FONT`) only write to processing-owned fields
- User edits (`SET_FONT_TITLE`, etc.) only write to `decisions.*.userOverride` sub-paths
- These domains never overlap, preventing the race condition where processing overwrites user edits

**Performance:** Each `FontReviewCard` is wrapped in `React.memo` with a selector that extracts only its own font entry by `tempId`. User edits dispatch on blur (not on every keystroke) — local component state handles typing.

See [reducer-action-catalog.md](../reducer-action-catalog.md) for the complete list of 22 action types with payloads and state transitions.

---

## Sanity UI Component Mapping

| Need | Sanity UI Component | Notes |
|---|---|---|
| Modal container | `Dialog` | Full-width, scrollable body |
| Step navigation | `TabList` + `Tab` or custom step indicator | Could use `Flex` + `Badge` for step dots |
| Collapsible cards | `Card` + `Button` toggle | Or use `details`/`summary` pattern with Card styling |
| Text inputs | `TextInput` | For title, ID, weight name |
| Number inputs | `TextInput` type="number" | For weight |
| Dropdowns | `Select` or `MenuButton` + `Menu` + `MenuItem` | For subfamily, style |
| Toggles | `Switch` | Existing usage |
| Badges | `Badge` | For weight, style, action type, file format |
| Progress | `Spinner` + `Text` | No built-in progress bar in Sanity UI — use a thin styled `Box` |
| Tooltips | `Tooltip` | Already used extensively |
| Search/filter | `TextInput` with `SearchIcon` | For filtering font cards |
| Radio choices | `Flex` + `Radio` or `Card` clickable selection | For existing document resolution |
| Toast/alerts | `Card` with `tone="caution"` or `tone="critical"` | For warnings and errors |
| Autocomplete | `Autocomplete` | For manual document linking |

### Missing from Sanity UI (need minimal custom CSS)

- **Progress bar**: Sanity UI has no progress bar component. Use a `Box` with `style={{ width: `${percent}%`, height: 4, background: 'var(--card-focus-ring-color)', transition: 'width 0.3s' }}`.
- **Step indicator**: No stepper component. Build with `Flex` + `Badge` or numbered `Box` elements with active/inactive states.
- **Drag-and-drop reordering** (for subfamily organization): Out of scope for v1 — use `Select` dropdowns to reassign instead.

---

## Decision Priority / Suggestion Ranking

For each editable field, the UI should show why the system chose the value it did. The ranking follows the existing logic priority:

### Title Derivation Priority
1. `preserveFileNames` is on → normalized filename (hyphen→space, camelCase split)
2. `fontkit.fullName` → formatted and title-cased
3. Fallback: raw filename without extension

Show as hint text: "Derived from: fontkit fullName 'HalyardDisplay-Bold'"

### Weight Priority
1. `font['OS/2'].usWeightClass` (most reliable)
2. Keyword matching against weight name string
3. Default: 400

Show as hint text: "Source: OS/2 usWeightClass = 700"

### Style Priority
1. OS/2 `fsSelection` bit 1 (italic) → Italic
2. OS/2 `fsSelection` bit 9 (oblique) → Italic
3. `font.italicAngle !== 0` → Italic
4. fullName contains "italic" (case-insensitive) → Italic
5. Otherwise → Regular

Show as hint text: "Detected: OS/2 fsSelection italic bit set"

### Document Resolution Priority
1. Exact `_id` match
2. Exact `slug.current` match
3. Content match (typefaceName + weightName + style + subfamily + variableFont)
4. No match → create new

Show as card: "Matched by: document ID 'halyard-display-bold'"

### Subfamily Priority
1. `font.name.records.preferredFamily` minus typeface title (most reliable for large families)
2. `font.fullName` minus typeface title, minus weight/italic keywords (fallback)
3. If empty → "Regular"
4. If variable font WITH `opsz` axis → empty (VF covers full optical range)
5. If variable font WITHOUT `opsz` axis → preserve detected subfamily (e.g., "Halyard Display VF" keeps "Display")

See [variable-font-axis-handling.md](../variable-font-axis-handling.md) for full VF subfamily rules.

---

## Edge Cases & Validation

### Duplicate IDs within batch
If two fonts in the same upload batch resolve to the same document ID:
- Flag both cards with a warning badge
- User must differentiate them (rename one) before proceeding

### ID conflicts with existing documents
If a new font's ID matches an existing document and the user chose "Create New":
- Show warning: "Document ID 'halyard-bold' already exists. Creating will overwrite it."
- Suggest appending a suffix or changing the ID

### Empty/missing metadata
Some fonts (especially web formats) have stripped name tables:
- Show warning on the card: "Limited metadata — title derived from filename"
- Pre-fill from TTF companion if available (existing `handleWebfontMetadata` logic)

### Variable fonts
- "VF" suffix suggested but not forced — user can remove via title edit
- Subfamily preserved for VFs without `opsz` axis (see [variable-font-axis-handling.md](../variable-font-axis-handling.md))
- Show variable axes info as read-only badges: `wght 100-900`, `ital 0-1`, etc.
- Show glyph count (sanity check — a "Bold" with 50 glyphs vs "Regular" with 800 suggests wrong file)
- Variable instance mapping stays automatic (v2 feature for manual mapping)

---

## Implementation Plan

### Phase 0: Port MCKL Fixes (prerequisite)
The port plan at `.agent/specs/plans/mckl-fixes-port.md` must land first. It introduces:
- `resolveExistingFont` helper (critical for Step 3's document resolution UI)
- `preserveFileNames` wired end-to-end
- Dot-path typeface patch (prevents data loss)
- `preferredStyle` sticky behavior

### Phase 1: Plan/Execute Split
- Create `buildUploadPlan.js` and `executeUploadPlan.js`
- Refactor `processFontFiles` to return decision audit trail data
- Extract `resolveExistingFont` as a standalone utility
- Keep existing `BatchUploadFonts.jsx` working (don't break current flow yet)
- Write tests for plan generation

### Phase 2: Modal Shell
- Create `UploadModal.jsx` with step state machine
- Implement Step 1 (settings + files) — mostly moving existing UI into the modal
- Implement Step 4 (execution progress) — mostly moving existing progress UI
- Wire up: button in `BatchUploadFonts.jsx` opens modal, modal calls plan/execute

### Phase 3: Review UI
- Implement Step 3 (`UploadStep3Review.jsx`)
- Build `FontReviewCard.jsx` with all editable fields
- Build `ExistingDocumentResolver.jsx`
- Build `SubfamilyOrganizer.jsx`
- Build `BulkActions.jsx`
- This is the largest phase — the review UI is the core feature

### Phase 4: Processing UI
- Implement Step 2 (`UploadStep2Processing.jsx`)
- Per-file progress indicators
- Error handling and retry

### Phase 5: Polish
- Step transitions and animations
- Keyboard navigation
- Validation and error states
- Edge case handling
- Comprehensive testing

---

## Resolved Decisions

| Question | Decision | Rationale |
|---|---|---|
| Modal size | Large `Dialog` with `width={2}` (Sanity UI max). Revisit if cramped. | Full-screen portal is more work for marginal gain. |
| Batch size limits | No limit. Process everything with progress indicator. Soft recommendation in docs: split batches over 100 files. | 200 files at 30-60s is acceptable with the progress UI. |
| Save draft plan | No. In-memory only, single session. Close modal = gone. | Simplifies architecture massively. No serialization needed. |
| Variable instance mapping | Automatic (existing logic). Not exposed in review UI. | Rabbit hole. V2 feature if ever. |
| Undo in review | "Reset to suggestion" per-field and per-card. No undo history. | Store original computed value alongside userOverride — simple and sufficient. |
| Utilities section | Stays outside the modal as-is. No change needed. | Different UX concern — utilities operate on already-uploaded fonts. |
| Steps: 3 or 4? | 3 steps. Processing and review are merged (Step 2). | Users edit as fonts appear — no dead waiting time. |
| Execution state location | Separate from plan (second reducer or useRef). | Prevents progress ticks from re-rendering review UI. |
| Back navigation | No. Forward-only. | Adding files after processing started complicates state massively. |
| Breaking change strategy | Semver major (v3.0). Old functions preserved as deprecated wrappers. Migration guide for consumers. | See [migration-guide.md](../migration-guide.md). |

---

## Non-Goals (v1)

- Drag-and-drop reordering within subfamily groups (use dropdowns instead)
- Font preview rendering in the review cards
- Diff view against existing document data when updating
- Batch editing multiple font cards at once (e.g. "set all to subfamily X")
- Multi-user upload coordination
- Offline/resume support for interrupted uploads
- Variable font instance mapping UI (stays automatic, v2 feature)
- Plan persistence (save/load draft plans between sessions)
- Full TypeScript migration (JSDoc typedefs for now, TS migration is separate effort)
- Subpath exports / code splitting (desirable but separate effort — track in bundle optimization work)
