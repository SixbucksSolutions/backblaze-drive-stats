# Offline historical generator

`historical_generator.py` implements #0016 against the accepted #0014 matrix and
supporting contracts. It performs no downloads, network operations, provisioning
or cloud writes. Historical execution and backfill remain separately gated.

Run with the locked project environment:

```powershell
uv run --frozen python historical_generator.py --config private/generation.json
uv run --frozen python -m unittest discover -s tests -p test_historical_generator.py
```

The private configuration supplies `inputs` (each with `quarter`, `directory` and
optional `receipt`), `cacheRoot`, `asOfQuarter`, `historyStart`, `generatorRevision`,
`outputDirectory`, `registry`, and `patterns`. `kind` defaults to `backblaze` and may
be `sample` for fictional observations; `revisionOf` is optional. Paths are local.
The receipt defaults to `import-metadata.json` in the input directory and uses the
daily `files` records emitted by `prepare_quarter_zip.py`: `date`, `rowCount`,
and `outputFile`. Each record must identify exactly one daily Parquet partition.
Supply the full retained input set for each selected as-of window. Omitted quarters
are explicit source gaps; they are never measured zero populations.

The generator revision must identify the actual code revision used, including
working changes when applicable. Do not label modified code with an unchanged
release identifier. `patterns` is the retained positive 2025 Q4 seed list, matched
against canonical `vendor + space + modelNumber`. Hashes of JSON definitions use
UTF-8 JSON with sorted keys, compact separators and finite numbers. Source
Parquet hashes identify exact file bytes, not filesystem times or cloud ETags.

Registry and discovery

- The registry is a versioned JSON object with `version` and `models`. Each model
  requires `vendor`, exact `modelNumber`, `mediaClass`, `evidence` and optional
  `aliases`. Media classes are `hdd`, `non_hdd`, or `unclassified`.
- `evidence` is public prose or a public HTTPS citation. Local filesystem paths,
  credential-bearing or signed/query URLs, fragments, and private hosts are rejected
  before inventory serialization. Optional `privateEvidence` may retain private
  classification references in the private configuration; it is never copied to
  public artifacts. Errors do not repeat evidence values.
- Exact aliases merge spelling/prefix variants only. Distinct model suffixes
  remain distinct. Conflicting aliases or a registry contradicting a positive
  known-HDD seed fail generation. The canonical vendor/model string is also an
  alias. Additional bare names must be listed explicitly.
- Every raw model is inventoried before selection, including SSDs, unknown names,
  and unfamiliar vendors. Unrecognized names survive under `Unknown` until an
  explicit exact-alias entry supplies their canonical vendor and evidence.
- Positive seed matches are confirmed HDDs. Additional explicitly classified HDDs
  enter the fixed as-of cohort after any complete quarter reaches 2,000 drives.
  Seed HDDs below 2,000 remain in supporting context. Qualifying unclassified
  entries remain in the public aggregate inventory and generation diagnostics
  with a pending classification explanation; they do not enter the matrix.
- [The example registry](../config/historical-registry.example.json) is fictional
  and must not serve as real device evidence. Supply retained specifications,
  announcements or other reviewed evidence for production classifications.
- [The retained 2026 Q2 evidence registry](../config/backblaze-hdd-evidence-2026-Q2.json)
  classifies two real qualifying off-seed Seagate HDDs from Backblaze's report.
  It supplements the owner's positive seed and is not an exhaustive future-model
  catalog. Keep investigating newly qualifying unclassified candidates.

Private cache and recovery

New quarter objects live under
`quarters/YYYY-QN/<semantic-input-hash>.<physical-parquet-profile>/`. Legacy
`<input-content-hash>/` directories remain readable and preserved. Each contains
`drives.parquet` (one identity/quarter record with first/last observation, exposure,
failures and latest location), `capacities.parquet` (positive finite capacity
observation frequencies), and `manifest.json` (coverage, raw aliases, byte hashes,
source receipt and semantic versions). Serial identities and per-drive dates stay
private. Never copy this cache to the public site.

The [shared Parquet profile](parquet-profile.md) enriches new outputs. Verified
legacy summaries can be repacked into a current physical variant without reading
daily observations or changing their semantic identity. Old bytes remain intact;
physical write errors surface rather than causing a raw-data rescan.

Before computing a quarter, the generator hashes its source files and checks the
manifest content hash and both retained object hashes. Valid hits read only the
small summaries; historical daily Parquet is not parsed again. Source corrections
produce a new affected-quarter object path and a new snapshot. Missing, damaged,
or partially written summary objects are recomputed. Temporary object writes are
replaced atomically and the manifest is the final commit marker. Interrupted
generations can restart; old content-addressed partitions remain available.
One writer per cache root is required. Concurrent cache mutation is unsupported.

Summary semantics, normalization implementation and exact aliases participate in
the cache identity. Summary v2 scopes alias dependencies to the raw names actually
observed in each quarter: adding a new vendor/model registry entry reuses old
quarters whose canonical mappings are unchanged. Candidate manifests and object
checksums are verified before their retained names are compared with the current
registry. An alias remap rebuilds only quarters containing that affected raw name.
The input identity hashes canonical JSON of the retained source lineage plus this
quarter-specific raw-name-to-canonical-ID mapping.
Selection or media-evidence changes alone reuse unchanged
canonical summaries, then regenerate cohort discovery and aggregate outputs.
Changing aliases rebuilds affected identity semantics from daily input. Source
partition hashes are still read on reuse; avoiding daily parsing does not mean
zero source-byte I/O. No historical raw observation frame is collected into Python.
Memory scales primarily with private identity/quarter summaries and publication
cells, rather than all daily rows. This is not a full-history memory guarantee.

Verified source coverage

Receipt dates must be unique, inside their declared quarter, and match each
nonempty partition's actual dates and physical row count. Valid empty daily files
count toward source coverage. Missing daily files produce incomplete coverage;
wrong dates, duplicate normalized identity/date observations, and invalid required
fields fail generation. Observation dates are parsed first, and records beyond
the cutoff are removed before other field conversions or validation. A malformed
date cannot safely be assigned to either side of the cutoff and remains an error.
Capacity is optional evidence: nonpositive, nonnumeric or nonfinite capacities
do not enter its mode. A model with no valid capacity has unavailable capacity,
while its known population remains visible.

Duplicate checks run separately within each canonicalized daily partition after
proving the partition date, bounding their grouping state to a daily fleet. The
quarter identity aggregation still retains lifecycle/latest-location state and
uses a date sort within identity groups; its full resource use needs the bounded
real-data measurement and is not a full-history memory claim.

Incomplete or missing pre-anchor coverage prevents production publication, since
it could hide an earlier qualifying quarter. Later gaps remain explicit and keep
cumulative AFR unavailable even after complete observation resumes. Eligibility
returns retain the original calendar anchor and prior eligible delta baseline.
The global selected-population last observation governs historical retirement;
the selected cutoff quarter uses the explicitly provisional Failed proxy.

Supporting reports use exactly the as-of cohort with all aliases and all its
pre-eligibility records. Overall capacity and datacenters use all supplied models.
Nominal capacity is the mode of positive daily observations through the cutoff,
ties choosing the smaller value, with decimal TB. Datacenter allocation uses each
identity's last location within its quarter; blank locations become `Unknown` and
remain in counts and capacity denominators. Capacity changes compare immediately
adjacent complete calendar quarters, never bridge gaps.

Publication and durable migration

Both validators run before publication. The CLI calls
`history_storage.publish_generation`, which writes immutable matrix/supporting
objects and changes the small generation index last. The matrix path is
`snapshots/<snapshot-id>/matrix.json`. Snapshot identity includes cutoff, retained
source manifests, cohort definitions, code revision and revision relationship.
A private generation stamp preserves creation time for an identical rerun, so
repeated publication can verify identical immutable content. Changing inputs or
semantics yields a new identity; earlier snapshots remain unchanged.

Malformed summary manifests are cache misses and are rebuilt. A damaged creation
stamp must never silently assign a new timestamp to an existing snapshot ID. The
CLI supplies the publication directory; a matching validated immutable matrix can
restore its original timestamp. API users supply `output_root` for this recovery.
If a damaged stamp has no authoritative published artifact, generation refuses
with a recovery instruction and preserves existing objects.

`history_storage` and `sync_history_cache.py` provide location-independent verified
transfer. Copy retained source, quarter summary objects, manifests and generation
stamps together using relative object paths. Verification and object-level resume
must complete before using a migrated cache. B2 integration requires the owner's
separate bucket/prefix/endpoint/access; official Backblaze source access remains
separate. No actual B2 service operation is implied by local/fake-client tests.

Synthetic tests cover pre-eligibility cumulative exposure, exact integer counts,
calendar threshold gaps/reentry, prior eligible deltas, new-vendor discovery,
SSD exclusion, pending media classification, all-alias capacity modes/latest
location, cutoff-first validation, invalid date partitions, identity duplicates,
partial coverage, cache reuse, source corrections and damaged-object recovery.
No historical source downloads are used by those tests.
