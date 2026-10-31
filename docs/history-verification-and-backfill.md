# Existing-quarter verification and proposed historical execution

#0016 implementation evidence and #0017 execution status, 2026-10-31.
The original full-history estimate is retained below; it does not authorize a
full backfill.

## Approved pilot and current gates

The owner approved newest-first quarter cards and a single-quarter pilot.
#0027 has imported and verified 2026 Q1; see the [measurements and acceptance
audit](quarter-pilot.md). #0028–#0055 queue 2025 Q4 through the provisional
2019 Q1 floor behind pilot acceptance. Wider parallel execution awaits the
owner's next direction. No older-quarter archive was downloaded for the pilot.

Continue backward until a complete quarter has zero observations of exact model
HUH721212ALN604, extending the queue earlier if needed. Record first observation
and first >=2,000-drive quarter separately. The old workbook compresses retained
positions and does not establish its calendar anchor. One zero quarter is a
bounded search endpoint, not proof against older deployments or reentry.

#0056 verified the owner's private B2 connection with a small object and
SHA-256 roundtrip. Parquet migration has not run; completed object manifests
and byte totals must precede it. Local sources remain intact.

## Measured local verification

The existing 2026 Q2 projected cache contains 31,968,003 daily records across 91
partitions, about 222 MB including its receipt. No archive was downloaded or
reimported. The generator ran with four Polars workers and an explicit
`worktree-<generator-source-hash>` revision. Private evidence is retained in
`data/staging/0016/real-quarter-verification.json`.

- A measured cold pass took **9.1 seconds**, followed by **2.3 seconds** for a
  verified reuse pass. A spy prohibited daily Parquet scanning on the reuse pass.
- Process peak working set was **4,134,080,512 bytes (3.85 GiB)**, measured through
  the Windows process-memory API. The first attempt's unavailable peak measurement
  was replaced by this measured cold run; this is one process/quarter, not a
  full-history memory guarantee.
- The private quarter summary/cache plus generation stamp occupies about **2.75 MB**.
  Source bytes are still hashed before reuse; eliminating parsing does not
  eliminate source-byte I/O.
- All **38 seed models** match the existing explorer's per-model Count, New and
  total nominal capacity; all **19 eligible models** match recorded exposure,
  failure flags and quarterly/cumulative-window AFR, using exact integers and
  `1e-10` relative/absolute float tolerance. Selected Count is **333,560**.
- All-source inventory contains **80 models** and **359,101 observed identities**.
  The seed-only verification registry leaves two qualifying off-seed models
  explicitly pending: ST8000NM0055 (13,112) and ST8000DM002 (6,903). Production
  classification must resolve them from retained evidence; the benchmark did not
  substitute fictional registry entries or claim exhaustive HDD classification.
- Matrix/supporting artifacts passed both validators, paired publication checks,
  and idempotent immutable publication into ignored staging. Published site data
  was not replaced. This window begins in 2026 Q2; its New includes the initial
  fleet and its AFR does not reconstruct lifetime exposure or real model anchors.

A subsequent evidence-backed classification pass resolved those two qualifying
off-seed candidates using [Backblaze's 2026 Q2 hard-drive table](https://www.backblaze.com/blog/backblaze-drive-stats-for-q2-2026/).
The retained [registry](../config/backblaze-hdd-evidence-2026-Q2.json) identifies
both as 8 TB data HDDs. With daily scanning prohibited, the same verified summaries
produced **40 selected models, 21 eligible matrix models and 353,575 selected
drives** in about **2.36 seconds**, with no unresolved qualifying candidates in
this source window. Evidence: `data/staging/0016/classification-verification.json`.
This is a partial registry for that observed window, not a universal HDD catalog;
unfamiliar future models still require classification evidence. Old staged
snapshots were preserved. The initial seed-only parity and timing figures above
remain separately identified rather than rewritten to imply matching cohorts.

Generator-source SHA-256 for this measurement:
`6a686ab3f59d094a1ca970b8edbd6087346d6c6a4f57a2a7cbd750fe15cc4db9`.
Do not apply these timings or the memory figure to a later revision without
checking whether the execution path changed.
The final pre-commit cleanup removed trailing whitespace only; parsed Python AST
equivalence was checked against the measured source. It did not change this path.

## Metadata-only source inventory

The [official download catalog](https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data)
still lists 2026 Q2 as its newest archive. A metadata-only reading found **45
archives**: annual files for 2013–2015 and quarterly files from 2016 Q1 through
2026 Q2. Their rounded advertised sizes sum to approximately **35.23 GB compressed**
and **257.86–258.27 GB CSV**. The catalog repeats 2025 Q3 with conflicting CSV
sizes (11.32 and 11.73 GB), so the raw estimate is a range. Excluding the
already-local 2026 Q2 archive leaves **44
downloads, about 33.13 GB compressed** if all history is required. These are catalog
estimates, not HEAD-verified byte lengths or validated daily-partition counts.
The private parsed size catalog is `data/staging/0016/source-catalog-estimate.json`.

Backblaze's [history of the dataset](https://www.backblaze.com/blog/10-stories-from-10-years-of-drive-stats-data/)
dates its first snapshot to April 10, 2013. The opening quarter is therefore
partial. Do not infer complete quarters from an advertised file count.

## Current execution priority

Owner clarification on 2026-10-31 supersedes the former 2013-first starting order:
work **newest to oldest**, delivering current NAS purchase comparisons before
complete historical fleet coverage. #0022's language quality gates precede further
#0017 implementation. Broader oldest-source fleet exploration is backlog #0023.

- Reuse the retained newest-quarter cache first. Regex matches are positive
  interest hints, not proof that an exact model is still manufactured or buyable.
  Keep production/availability evidence separate from observed fleet deployment.
- Preserve all-source discovery, including unfamiliar qualifying HDDs/vendors,
  without forcing every legacy model into the first purchase-focused publication.
- Separate discovery inventory, the fixed published analysis cohort, purchase
  defaults and historical references in the #0017 contract amendment. A UI-only
  filter cannot remove the current generator's older-cohort history obligations.
- Work backward in bounded batches. The 2026 Q1 pilot is verified after the
  retained 2026 Q2 cache; 2025 Q4 (#0028) is next, pending pilot acceptance and
  the owner's next execution direction. Recheck transfer limits and resources
  before the next batch starts.
- Establish each candidate's anchor and pre-eligibility exposure honestly. The
  first loaded qualifying quarter is not proof of the original anchor, and an
  earlier zero quarter does not exclude an older deployment followed by reentry.
  Incomplete search/history must stay explicit; it cannot certify production
  cumulative AFR or silently restart the relative-age timeline.
- Extend only as far as the purchase cohort's validated history requires for the
  actionable release. Full-fleet/oldest-date completeness remains a later goal.

The Q1 pilot above supersedes the former inventory-only status. Earlier cache
measurements remain evidence; the old source-order proposal below is retained
as superseded context.

## Earlier bounded-sequence proposal (starting order superseded)

The earlier proposal was a small earliest-source/coverage audit before authorizing
the full historical build. After #0015/#0016 acceptance, inspect the 2013 annual
archive (advertised 81.2 MB) and reuse the existing current cache. This establishes
the first actual source dates, early populations, media/role inventory and which
models the expanded discovery cohort makes relevant. It does not yet publish a
historical matrix. Record the classifications and any source omissions.

The accepted contract refuses unresolved pre-anchor coverage. The partial opening
quarter may require an explicit owner decision on the declared history window or
a separately reviewed rule before a trustworthy full-history publication. Never
silently mark missing early days complete, impute drive-days, or reset anchors to
make validation pass. A first-available-quarter audit can expose that decision
without downloading every subsequent archive.

After that audit and its decisions are accepted, the outer source envelope is
the 45 catalog archives through 2026 Q2, minus verified local inputs. Narrow it
using demonstrated model/history requirements where possible; keep cumulative
pre-eligibility exposure. Annual archives must be projected once, then referenced
by quarter-specific receipts pointing to the same daily Parquet files. The
generator accepts such receipts; no duplicate daily files are needed.

Earlier broad local execution envelope, still subject to separate approval:

- Reserve **100 GB additional local disk** for the catalog-sized ZIP set,
  projected partitions, summaries and interrupted staging. This is an execution
  cap, not a prediction of Parquet size. Pause before exceeding it and present
  actual measurements. About 2.61 TB was free on D: during this check.
- Use four Polars workers initially. Process/project bounded batches, inspect
  their manifests and observed memory before expanding. Full-history aggregation
  retains identity-quarter dictionaries, so its memory grows with history;
  the single-quarter peak is not a bound. Stop and reassess if available-memory
  headroom becomes insufficient. No paid compute or cloud provisioning is implied.
- Keep raw CSV extraction off disk. Reuse valid projected/summary objects and
  preserve source/semantic checksums. All-source discovery and classification
  occur before the seed cohort is applied. Unknown qualifying candidates stay
  visible and need evidence before HDD admission.
- Keep original workbook comparisons separate from source correctness checks.
  Reconcile real 2025 Q3/Q4 and the newest generated cutoff only where validated
  coverage permits. Public output remains small aggregate JSON.
- Migrate retained Parquet, summaries and manifests to **owner Backblaze B2** only
  after bucket, prefix, endpoint/region and access are supplied and a real verified
  round trip succeeds. Local/fake-client tests are not that service verification.
  Cloudflare delivery and the long-term Glacier backup stay separate tasks.

At the time of that earlier proposal, no historical archive or remote object had
been created. The owner has since completed #0015/#0016/#0021/#0022/#0026.
#0017 is now In Progress; the pilot and B2 status at the top of this document
describe the current execution, with later history and production integration
still pending.
