# Weight Classification Reference

Status: Draft
Last updated: 2026-05-28
Related: [plan-types.md](./plan-types.md), [font-metadata-field-mapping.md](./font-metadata-field-mapping.md)

Single source of truth for all weight keyword → numeric value mappings. Replaces the divergent lists in `processFontFiles.js:determineWeight()` and `parseVariableFontInstances.js:weightTerms`.

---

## Canonical Weight Map

This table covers the full OpenType `usWeightClass` range (1-1000). CSS `font-weight` accepts the same range.

| Numeric Value | Canonical Name | Aliases | Notes |
|---|---|---|---|
| 100 | Hairline | Hairline, Extra Thin, ExtraThin | Some foundries use "Hairline" as lighter than Thin |
| 100 | Thin | Thin | When used as the lightest weight in a family |
| 200 | Extra Light | ExtraLight, Ultra Light, UltraLight | |
| 200 | Thin | Thin | When the family also has Hairline at 100 |
| 250 | — | — | Non-standard; some foundries use for "Light" variants |
| 300 | Light | Light, Book (some families), Lite | |
| 350 | — | Book (some families) | Non-standard |
| 400 | Regular | Regular, Normal, Roman, Plain | Default weight |
| 500 | Medium | Medium | |
| 600 | Semi Bold | SemiBold, Demi Bold, DemiBold, Demi | |
| 700 | Bold | Bold | |
| 800 | Extra Bold | ExtraBold, Ultra Bold, UltraBold | |
| 900 | Black | Black, Heavy, Ultra | |
| 950 | Extra Black | ExtraBlack | Non-standard; rarely used |

### Priority rules for ambiguous keywords

| Keyword | Value | Condition |
|---|---|---|
| "Thin" | 200 | Default |
| "Thin" | 100 | If family also has "Hairline" or "ExtraThin" at 100 |
| "Book" | 300 | Default |
| "Book" | 350 | If family has distinct "Light" at 300 |
| "Ultra" (standalone) | 900 | — |
| "Demi" (standalone) | 600 | — |

---

## Keyword Matching Function

Replace both `determineWeight()` and the inline `weightTerms` array with a single exported function:

```js
/**
 * Maps a weight name string to a numeric CSS font-weight value.
 * Tests patterns from most specific to least specific to avoid
 * substring false positives (e.g., "ExtraLight" before "Light").
 *
 * @param {number|null} usWeightClass - OS/2 usWeightClass value (preferred, may be null/0)
 * @param {string} weightName - Human-readable weight name
 * @returns {number} CSS font-weight value (1-1000)
 */
export function resolveWeight(usWeightClass, weightName) {
  // Priority 1: OS/2 table (most reliable)
  if (usWeightClass && usWeightClass > 0) {
    return usWeightClass;
  }

  // Priority 2: Keyword matching (ordered most specific → least specific)
  const wn = (weightName || '').toLowerCase();

  // Most specific multi-word patterns first
  if (/extra\s*black/.test(wn)) return 950;
  if (/extra\s*bold|ultra\s*bold/.test(wn)) return 800;
  if (/semi\s*bold|demi\s*bold/.test(wn)) return 600;
  if (/extra\s*light|ultra\s*light/.test(wn)) return 200;
  if (/extra\s*thin/.test(wn)) return 100;

  // Single-word patterns (order matters — test before substrings)
  if (/\bhairline\b/.test(wn)) return 100;
  if (/\bthin\b/.test(wn)) return 200;
  if (/\blight\b|\blite\b/.test(wn)) return 300;
  if (/\bbook\b/.test(wn)) return 300;
  if (/\bregular\b|\bnormal\b|\broman\b|\bplain\b/.test(wn)) return 400;
  if (/\bmedium\b/.test(wn)) return 500;
  if (/\bdemi\b/.test(wn)) return 600;
  if (/\bbold\b/.test(wn)) return 700;
  if (/\bheavy\b|\bblack\b|\bnero\b|\bnerissimo\b/.test(wn)) return 900;
  if (/\bultra\b|\bfat\b|\bposter\b/.test(wn)) return 900;

  // Non-English weight names
  if (/\bmager\b|\bmaigre\b|\bchiaro\b|\bleicht\b/.test(wn)) return 300;
  if (/\bstark\b|\bkräftig\b/.test(wn)) return 500;
  if (/\bviertelfett\b/.test(wn)) return 500;
  if (/\bhalbfett\b/.test(wn)) return 600;
  if (/\bdreiviertelfett\b/.test(wn)) return 700;
  if (/\bfett\b|\bextrafett\b|\bgras\b|\bneretto\b/.test(wn)) return 700;
  if (/\bnero\b|\bnerissimo\b/.test(wn)) return 900;
  if (/\bbuch\b/.test(wn)) return 300;
  if (/\bdark\b|\bthick\b/.test(wn)) return 700;

  // Priority 3: Default
  return 400;
}
```

### Key fixes vs. current code

1. **"UltraBold" now returns 800** (was falling through to "Bold" = 700)
2. **"UltraLight" now returns 200** (was falling through to "Light" = 300)
3. **"Heavy" consistently returns 900** (was missing from `determineWeight`)
4. **"ExtraBlack" returns 950** (was not handled)
5. **Multi-word patterns tested before single-word** to prevent false matches
6. **Word boundary `\b` used** to prevent substring matches ("Midas Lt" won't match "Light")

---

## Abbreviation → Canonical Name Mapping

The full abbreviation table lives in `generateKeywords.js` (`alternativeSpelling` object). This reference documents the most commonly encountered abbreviations and their canonical expansions:

| Abbreviation | Canonical | Category |
|---|---|---|
| Bd, Bld | Bold | Weight |
| Blk, Blak | Black | Weight |
| Lt, Lght | Light | Weight |
| Md, Med | Medium | Weight |
| Reg, Rg | Regular | Weight |
| Thn | Thin | Weight |
| Hl, Hln | Hairline | Weight |
| SmBd, Sb, Sbd, Sbld, Sbold | SemiBold | Weight |
| Xbd, XBd, Xbld, ExBd | ExtraBold | Weight |
| Xlt, XLt, Xlght, XLight | ExtraLight | Weight |
| Xthn, XThn, XThin | ExtraThin | Weight |
| It, Ital | Italic | Style |
| Obl | Oblique | Style |
| Sl | Slant | Style |
| Cond, Cnd | Condensed | Width |
| Exp | Expanded | Width |
| Ext | Extended | Width |

### When abbreviation expansion applies

- `preserveShortenedNames = false` (default): All abbreviations are expanded
- `preserveShortenedNames = true`: Abbreviations kept as-is

### Known false positive risks

These short abbreviations can match legitimate word fragments:

| Abbrev | Risk | Example |
|---|---|---|
| Md | "Md" in font names like "Maryland" | Low — word boundary helps |
| Lt | "Lt" in names like "Midas Lt" | Medium — would expand to "Light" |
| Sl | "Sl" standalone | Low |
| Hl | "Hl" in names like "Schulbuch Hl" | Medium |

Mitigation: The review UI shows the original value alongside the expanded value, so users can catch and revert false expansions.
