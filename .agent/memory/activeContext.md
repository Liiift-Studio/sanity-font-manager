# Active Context — @liiift-studio/sanity-font-manager

Last updated: 2026-05-28

## Pending work

- **Port MCKL "preserve file names" fixes into this package.** A 9-commit fix branch on `mckl/cms` (`fix/font-uploader-preserve-filenames`, HEAD `6c35828`) wires the `preserveFileNames` feature end to end, stops the typeface patch from wiping `styles.collections` / `styles.pairs`, makes `preferredStyle` sticky, and adds a structured `resolveExistingFont` helper as the seam for a future "review candidates" modal. Detailed port plan at `.agent/specs/plans/mckl-fixes-port.md`. Not yet started in this repo.

## Recent state

- v2.3.19 published. `preserveFileNames` toggle exists in `BatchUploadFonts.jsx` but the feature is non-functional: `uploadFontFiles` does not accept the flag, `originalFilename` is dropped before save, and the asset is named after `fontObject._id` regardless.

## Out-of-scope follow-ups captured in the port plan

- `generateCollectionsPairsComponent.jsx` uses `createOrReplace` for pairs / collections, silently rewriting any customisations and the contents of docs that historical orders reference.
- Two-phase upload (plan → execute) needed before a "review candidates" modal lands.
- State-machine refactor of `BatchUploadFonts.jsx` will follow the modal.
