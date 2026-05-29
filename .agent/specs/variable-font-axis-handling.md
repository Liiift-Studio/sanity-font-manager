# Variable Font Axis Handling

Status: Draft
Last updated: 2026-05-28
Related: [plan-types.md](./plan-types.md), [font-metadata-field-mapping.md](./font-metadata-field-mapping.md), [weight-classification-reference.md](./weight-classification-reference.md)

---

## Variable Font Detection

A font is classified as variable when:

```js
const axes = font.variationAxes;
const hasRealVariation = axes
  && Object.keys(axes).length > 0
  && Object.values(axes).some(axis => axis.min !== axis.max);

fontEntry.variableFont = hasRealVariation;
```

**Key fix:** The current code checks only `Object.keys(axes).length > 0`, which misclassifies fonts with degenerate axes (min === max, e.g., static instances exported from a variable source with vestigial `fvar` table).

---

## Registered Axis Tags

| Tag | CSS Descriptor | Name | Range | Notes |
|---|---|---|---|---|
| `wght` | `font-weight` | Weight | 1-1000 | Maps directly to CSS font-weight |
| `wdth` | `font-stretch` | Width | 50%-200% | Percentage of normal width |
| `ital` | `font-style: italic` | Italic | 0 or 1 | Binary toggle |
| `slnt` | `font-style: oblique Xdeg Ydeg` | Slant | degrees | Continuous slant angle |
| `opsz` | `font-optical-sizing` | Optical Size | point size | Controls optical size adjustments |

### Custom / Unregistered Axes

Custom axes (uppercase tags like `GRAD`, `XTRA`, `XHGT`, `YOPQ`) have no CSS `@font-face` descriptor. They are:
- Listed as informational badges in the review UI
- Included in CSS comments in the generated `@font-face`
- Stored as `variableAxes` on the Sanity font document

---

## Axis Impact on Plan Fields

### `wght` axis → Weight field validation

When a VF has a `wght` axis:
- `FontPlanEntry.weight` should default to the axis `default` value (not OS/2 usWeightClass, which for VFs often reports the default instance weight)
- The review UI should show the axis range as context: "Weight: 400 (axis range: 100-900)"
- If the user overrides weight to a value outside the axis range, show a warning (non-blocking)

### `wdth` axis → Subfamily interaction

Width axes do NOT replace subfamilies. A VF with `wdth` axis but named "Halyard Condensed VF" should keep "Condensed" as its subfamily — the width axis provides continuous variation within that optical design.

### `ital` axis → Style field

| `ital` axis state | Style derivation |
|---|---|
| No `ital` axis | Use standard italic detection (italicAngle, name, fsSelection) |
| `ital` axis with max > 0 | Font supports both Regular and Italic — style field is informational only |
| `ital` axis with max === 0 | Degenerate axis — ignore it, use standard detection |

**Important:** A VF with an `ital` axis produces both upright and italic from a single file. The current binary `'Regular' | 'Italic'` model cannot fully represent this. For v1, set style to `'Regular'` and note "Italic available via ital axis" in the review card.

### `slnt` axis → Style field

| `slnt` axis state | Style derivation |
|---|---|
| No `slnt` axis | Use standard italic detection |
| `slnt` axis with actual range | Font supports continuous slant — set style to `'Regular'`, note slant range |
| `slnt` + `ital` coexist | `slnt` takes priority for CSS descriptors (more expressive) |

### `opsz` axis → Subfamily preservation

This is the critical fix for the panel review finding about forcing VF subfamily to empty.

| Condition | Subfamily behavior |
|---|---|
| VF with `opsz` axis | Clear subfamily — the VF covers the full optical size range and replaces Display/Text/Micro distinctions |
| VF without `opsz` axis, but with subfamily (e.g., "Halyard Display VF") | PRESERVE subfamily — this VF represents one specific optical design within the family |
| VF without `opsz` axis, no subfamily detected | Subfamily stays empty (current behavior, correct) |

```js
// Updated logic (replaces unconditional subfamily clearing)
if (variableFont) {
  const hasOpszAxis = font.variationAxes?.opsz
    && font.variationAxes.opsz.min !== font.variationAxes.opsz.max;

  if (hasOpszAxis) {
    subfamilyName = ''; // VF covers full optical range
  }
  // Otherwise: preserve detected subfamilyName
}
```

---

## CSS @font-face Generation for Variable Fonts

### Axis → CSS descriptor mapping

```js
// From buildVFDescriptors() in generateCssFile.js
const cssAxes = {};
for (const [tag, axis] of Object.entries(variationAxes)) {
  const lo = Math.min(axis.min, axis.max);
  const hi = Math.max(axis.min, axis.max);

  if (lo === hi) continue; // Degenerate axis — skip

  switch (tag) {
    case 'wght':
      cssAxes['font-weight'] = `${lo} ${hi}`;
      break;
    case 'wdth':
      cssAxes['font-stretch'] = `${lo}% ${hi}%`;
      break;
    case 'slnt':
      // CSS requires ascending order
      cssAxes['font-style'] = `oblique ${lo}deg ${hi}deg`;
      break;
    case 'ital':
      // Only if font actually has italic range AND slnt hasn't already set font-style
      if (!cssAxes['font-style'] && hi > 0) {
        cssAxes['font-style'] = 'italic';
      }
      break;
    default:
      // opsz, GRAD, XTRA, etc. — no CSS descriptor
      break;
  }
}
```

### Browser compatibility concerns

| Feature | Chrome | Firefox | Safari | Fallback needed |
|---|---|---|---|---|
| `font-weight: 100 900` | Yes | Yes | Yes | No |
| `font-stretch: 75% 125%` | Yes | Partial | Partial | Yes — add `font-stretch: normal` fallback block |
| `font-style: oblique -12deg 0deg` | Yes | No | No | Yes — add `font-style: oblique` fallback block |
| `font-style: italic` (from ital axis) | Yes | Yes | Yes | No |
| `format('woff2-variations')` | Yes | Yes | Yes | No |

**Recommendation:** For axes with limited browser support (`wdth` range, `slnt` range), generate a fallback `@font-face` block with simple values alongside the range-syntax block. Browsers that don't understand range syntax will ignore the first block and use the fallback.

---

## VF Title Convention

Current behavior: append "VF" to title if not present.

**Recommended change:** Make "VF" suffix opt-out rather than forced:
- System suggestion: add "VF" suffix (matches current behavior)
- `decisions.title.alternatives` includes both "Halyard Display Bold VF" and "Halyard Display Bold"
- User can remove the suffix via title edit
- `resolveExistingFont` should check for matches both with and without "VF" suffix

---

## Variable Instance Mapping

Handled by `parseVariableFontInstances.js` — NOT exposed in the review UI for v1.

The 6-strategy matching system remains internal:
1. Exact title match
2. Title normalization (strip VF/var/variable prefixes)
3. Abbreviation expansion
4. Weight + style matching
5. weightName comparison
6. metaData.fullName fallback

**v2 consideration:** The review UI could expose instance mappings as a sub-section of the VF review card, showing each named instance with its matched static font (or "No match"). This would let users manually fix broken mappings.

---

## Review UI for Variable Fonts

The VF review card should show additional read-only information:

| Field | Display |
|---|---|
| Variation axes | Badges per axis: `wght 100-900`, `ital 0-1`, `opsz 8-144` |
| Named instances | Count: "24 named instances" |
| Instance mapping status | "22/24 matched to static fonts" (informational) |
| Axis range vs. weight | Warning if assigned weight is outside wght range |
