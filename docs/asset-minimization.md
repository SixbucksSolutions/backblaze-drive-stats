# Minimized static build

#0097 minimizes the static release during `npm run build`. Readable source files,
golden fixtures, source workbooks, production JSON, fonts and license files remain
unchanged. The result is a static Pages directory; no Worker scripts, Functions,
data processing or cloud changes are introduced.

## Measured result

The same release before and after this change has the following uncompressed
file sizes. This is a byte comparison, not a network/device latency benchmark.

| File group | Before | After | Saved |
| --- | ---: | ---: | ---: |
| HTML | 1,755 | 1,521 | 234 |
| JavaScript | 189,872 | 148,570 | 41,302 |
| JSON | 15,576,479 | 15,438,811 | 137,668 |
| CSS | 37,273 | 37,273 | 0 |
| Fonts, notices and hosting control file | 548,997 | 548,997 | 0 |
| **Entire static directory** | **16,354,376** | **16,175,172** | **179,204** |

The complete release is **1.10% smaller**. Most bytes already belong to compact,
immutable production data and compressed fonts. CSS was already minified; its
minifier is now explicitly configured. The build has 199 files instead of 190:
small fictional graph assets now have separate hashed URLs rather than being
embedded as base64 JSON in JavaScript. This changes request granularity; it does
not imply nine additional requests on every production page load.

## Build behavior and preservation

- Vite uses **Oxc** for JavaScript and **Lightning CSS** for CSS, with production
  source maps disabled. Inline entry-page CSS is also handled by Vite.
- The two static HTML pages are minimized after Vite. Conservative whitespace
  collapse preserves inline word separators, quoted attributes, URLs,
  accessibility labels, preformatted/textarea content and attribution comments.
- Imported ordinary JSON is compacted before Vite assigns its hashed URL.
  Compaction removes only JSON whitespace outside strings, preserving exact
  number spellings, escaped Unicode, string contents and array order.
- Fictional example JSON is a derived graph: leaf bytes are compacted first,
  then reference paths, lengths and SHA-256 values are rebuilt bottom-up. Only
  those byte-reference objects change tokens. Both sample snapshots still pass
  the unchanged reader, and the fictional-data banner remains explicit.
- The mutable legacy index/quarter JSON and font provenance JSON are compacted
  in the build directory. Their source files stay unchanged. Font binaries,
  font notices and license texts retain exact deployed bytes.
- All **161 production JSON files** were already compact. Their exact bytes,
  including their existing final newline, remain unchanged so immutable hashes,
  accepted snapshot IDs and source lineage remain intact. No history is scanned
  or regenerated to minimize the website.

The hosting gate derives the exact expected representation from each reviewed
public source. Only the stated HTML/non-hash JSON transformations are permitted;
production hashes and the upload inventory retain their existing checks.
The release gate rejects noncompact JSON/HTML, disabled JS/CSS minifiers and
unexpected source maps. Source/output directory aliases and unexpected files
remain rejected.

## Images and browser checks

There are **no external raster or SVG image files** in the source/public/output
trees. The charts draw inline SVG or HTML meters from report data. No oversized
bitmap is downloaded. The capacity SVG retains its readable 900-unit chart in a
contained scroll region; at a 390-pixel viewport the document remains 375 pixels
wide. Font assets are not treated as images or resampled.

Chrome checks on the actual local Pages runtime covered all six production views
at the historical 2025 Q4 cutoff, custom fonts and narrow layout. The latest
production matrix still selects 22 models. Both derived fictional snapshots,
their return to production, the workbook reference matrix and the legacy
quarterly explorer loaded without alerts. Browser tabs were closed and the
temporary viewport override was reset.

Fresh Sol / High review independently verified original fixture bindings,
derived graph bindings, numerical-token preservation, emitted URLs and Vite
development/build behavior under a subpath. It also checked the local Pages
responses for all 12 example graph assets. Existing workbook reconciliation
limits remain unchanged; this is not a new numerical research pass or formal
accessibility certification.

## Reproduce and handoff

From `web/`:

```console
npm ci
npm run quality
npm test
npm run build
npm run check:minimized
```

The production build includes hosting and minimization gates. Local HTTP
verification and target-specific upload/rollback steps remain in the
[static Pages runbook](cloudflare-hosting.md). No live upload is part of #0097.

Private baseline/after manifests, independent probes, browser evidence and the
replacement static bundle are under `data/staging/0097/`. The final commit and
Windows/Linux CI are linked in the ticket handoff. #0007 remains Needs Terry for
the account, hostname and existing-project details; it is not a prerequisite for
this card, whose dependencies Terry removed.

Official implementation references:

- [Vite 8 build options](https://v8.vite.dev/config/build-options)
- [HTML Minifier Terser options](https://github.com/terser/html-minifier-terser/blob/master/README.md)
