# Font Metadata Field Mapping

Status: Draft
Last updated: 2026-05-28
Related: [upload-modal-overhaul.md](./plans/upload-modal-overhaul.md), [plan-types.md](./plan-types.md)

Single source of truth for how OpenType name table fields map through fontkit to plan object fields to Sanity document fields.

---

## OpenType Name Table → fontkit v2 Properties

| Name ID | OpenType Field | fontkit v2 Property | Type | Notes |
|---|---|---|---|---|
| 0 | Copyright | `font.copyright` | `string` | |
| 1 | Font Family | `font.familyName` | `string` | RIBBI model (max 4 styles per family) |
| 2 | Font Subfamily | `font.subfamilyName` | `string` | Only Regular/Bold/Italic/Bold Italic in RIBBI |
| 4 | Full Name | `font.fullName` | `string` | Display name, may be truncated to 63 chars |
| 5 | Version | `font.version` | `string` | Prefixed with "Version " |
| 6 | PostScript Name | `font.postscriptName` | `string` | No spaces, ASCII only |
| 16 | Typographic Family | `font.name.records.preferredFamily` | `string\|object` | Preferred over ID 1 for large families |
| 17 | Typographic Subfamily | `font.name.records.preferredSubfamily` | `string\|object` | Preferred over ID 2 for large families |

### Language-keyed fields

Name IDs 16 and 17 can be language-keyed objects: `{ en: "Bold", de: "Fett" }`. Always extract the `en` value first, falling back to the first available key:

```js
function extractNameString(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    return value.en || value[Object.keys(value)[0]] || '';
  }
  return '';
}
```

---

## Metadata → Plan Object Field Derivation

### Title (`FontPlanEntry.title`)

| Priority | Source | Condition | Processing |
|---|---|---|---|
| 1 | Original filename | `preserveFileNames === true` | Strip extension, replace hyphens with spaces, split camelCase, title-case |
| 2 | `font.fullName` (name ID 4) | Always available | `formatFontTitle()`: strip hyphens, title-case, optionally expand abbreviations |
| 3 | `font.name.records.preferredFamily` + `preferredSubfamily` (IDs 16+17) | Fallback if fullName is empty/garbage | Concatenate with space, title-case |
| 4 | Original filename | Last resort if all metadata is empty | Strip extension, replace hyphens with spaces |

**Alternatives array** (`decisions.title.alternatives`): Always populated with values from ALL sources so user can pick:

| Source key | Value |
|---|---|
| `nameId1-familyName` | `font.familyName` |
| `nameId4-fullName` | `font.fullName` (raw, unprocessed) |
| `nameId6-postscriptName` | `font.postscriptName` |
| `nameId16-preferredFamily` | `extractNameString(font.name.records.preferredFamily)` |
| `nameId17-preferredSubfamily` | `extractNameString(font.name.records.preferredSubfamily)` |
| `filename` | Original filename without extension |

### Document ID (`FontPlanEntry.documentId`)

| Priority | Source | Processing |
|---|---|---|
| 1 | Derived from title | `sanitizeForSanityId(title)` |
| 2 | Derived from filename | `sanitizeForSanityId(filename)` when `preserveFileNames` is on |

### Weight (`FontPlanEntry.weight`)

| Priority | Source | fontkit Property | Notes |
|---|---|---|---|
| 1 | OS/2 usWeightClass | `font['OS/2'].usWeightClass` | Most reliable. Range: 1-1000. |
| 2 | Keyword match against weightName | See [weight-classification-reference.md](./weight-classification-reference.md) | Used when OS/2 is missing or 0 |
| 3 | Default | — | 400 (Regular) |

### Weight Name (`FontPlanEntry.weightName`)

| Priority | Source | Processing |
|---|---|---|
| 1 | `font.name.records.preferredSubfamily` (ID 17) | Strip italic keywords, optionally expand abbreviations |
| 2 | `font.name.records.fontSubfamily` (ID 2) | Same processing |
| 3 | Extracted from `fullName` minus typeface title | When subfamilyis empty or "Roman" |

### Style (`FontPlanEntry.style`)

| Priority | Source | Condition | Result |
|---|---|---|---|
| 1 | OS/2 `fsSelection` bit 1 | `font['OS/2'].fsSelection & 0x01` | `'Italic'` |
| 2 | OS/2 `fsSelection` bit 9 | `font['OS/2'].fsSelection & 0x200` | `'Italic'` (oblique) |
| 3 | `font.italicAngle` | `!== 0` | `'Italic'` |
| 4 | Name contains "italic" | Case-insensitive check on fullName | `'Italic'` |
| 5 | Default | — | `'Regular'` |

**Note:** Current code only checks priorities 3-5. The spec recommends adding OS/2 `fsSelection` checks (priorities 1-2) as they are the definitive indicators.

### Subfamily (`FontPlanEntry.subfamily`)

| Priority | Source | Processing |
|---|---|---|
| 1 | `font.name.records.preferredFamily` minus typeface title | If preferredFamily contains more than the typeface name (e.g., "Halyard Display" - "Halyard" = "Display") |
| 2 | `font.fullName` minus typeface title, minus weight keywords, minus italic keywords | String subtraction with keyword stripping |
| 3 | Default | `'Regular'` if empty after processing |

**Variable font exception:** See [variable-font-axis-handling.md](./variable-font-axis-handling.md) — only clear subfamily when the VF has NO optical-size distinction.

### Variable Font (`FontPlanEntry.variableFont`)

| Condition | Result |
|---|---|
| `font.variationAxes` exists AND at least one axis has `min !== max` | `true` |
| Otherwise | `false` |

---

## Plan Object → Sanity Document Fields

| Plan Field | Sanity Font Document Field | Notes |
|---|---|---|
| `documentId` | `_id` | Also used as `slug.current` |
| `title` | `title` | |
| `title` (lowercase, slugified) | `slug.current` | |
| `settings.price` | `price` | |
| `settings.price > 0` | `sell` | `true` if price > 0 |
| `weight` | `weight` | Number |
| `weightName` | `weightName` | |
| `style` | `style` | "Regular" or "Italic" |
| `subfamily` | `subfamily` | |
| `variableFont` | `variableFont` | Boolean |
| `files[].ttf` asset ref | `fileInput.ttf` | `{ _type: 'file', asset: { _ref, _type: 'reference' } }` |
| `files[].otf` asset ref | `fileInput.otf` | Same shape |
| `files[].woff` asset ref | `fileInput.woff` | Same shape |
| `files[].woff2` asset ref | `fileInput.woff2` | Same shape |
| Generated CSS asset ref | `fileInput.css` | Same shape |
| fontkit metadata | `metaData` | `{ postscriptName, fullName, familyName, subfamilyName, copyright, version, genDate }` |
| fontkit metrics | `metrics` | `{ unitsPerEm, ascender, descender, lineGap, underlinePosition, underlineThickness, italicAngle, capHeight, xHeight, boundingBox }` |
| fontkit features | `opentypeFeatures` | `{ chars: [...feature tags] }` |
| fontkit characterSet | `characterSet` | `{ chars: [...codepoints] }` |
| fontkit variableAxes | `variableAxes` | JSON stringified |
| fontkit variableInstances | `variableInstances` | JSON stringified |
| Glyph count | `glyphCount` | Number |
| Typeface title | `typefaceName` | From parent typeface |

---

## Sanity Typeface Document Patch

The typeface document is patched using **dot-path keys** to preserve sibling fields:

| Patch Key | Value | Notes |
|---|---|---|
| `'styles.fonts'` | `[...existing, ...newFontRefs]` | Append new references |
| `'styles.variableFont'` | `[...existing, ...newVFRefs]` | Append new VF references |
| `'styles.subfamilies'` | Updated subfamily array | Merge new groups, deduplicate refs within groups |
| `preferredStyle` | Reference | Only set if currently empty |

Fields NOT touched (preserved by dot-path approach):
- `styles.collections`
- `styles.pairs`
- `styles.free`
- `styles.displayStyles`
