# Fictional production v2 examples

Every value is a **sample**. These files contain no actual source observations,
drive identities or serial numbers. They demonstrate the proposed contract and
do not activate a production policy or authorize downstream implementation.

Rebuild with `uv run --frozen --no-sync python fixtures/production-v2/build_synthetic.py`.
The builder reads no source data and only replaces its own `sample-*.json` files.
Start with the single `sample-index.<sha256>.json`; follow its descriptor links,
then each descriptor's matrix and quarter links relative to this directory.
Paths contain the SHA-256 of exact referenced bytes. Context hashes use compact,
sorted-key UTF-8 JSON with nonfinite numbers prohibited. No payload embeds its
descriptor hash.

- `sample-prefix-gap-reentry` covers an unpublished calendar quarter, a partial
  publication prefix with a proven population lower bound, a later complete
  qualifier, a missing quarter, a below-threshold quarter and reentry. Missing
  and unpublished quarters have no supporting payload. Partial totals remain
  null. Earlier incomplete history prevents complete-history claims.
- `sample-modern-locations` covers the 2023-Q3 location-field boundary. Before
  the boundary all population and capacity reconcile under `Unknown`; after it
  the fictional population has a reported location.
- Both retain a never-qualified seed HDD in supporting context, admit a
  qualifying off-seed HDD from a new fictional vendor, and retain SSD and
  unclassified inventory outside comparison. Unknown manufacturer stays explicit.
- Matrix values use known recorded exposure, include pre-anchor/subthreshold
  components and preserve calendar gaps. Deltas reference the previous eligible
  quarter and its actual distance. Future padding is `snapshot_end` with null
  cumulative evidence and metrics. Lifetime exposure is always incomplete.

The aggregate builder assumes nested fictional identity populations when deriving
new counts: the current population's excess over its earlier maximum is new.
These assumptions are examples, not upstream evidence. Capacity values illustrate
the payload produced by a positive per-model capacity mode; no daily capacity
records are asserted or stored here. Semantic validation establishes internal
consistency, not the truth of a producer's source or classification evidence.
