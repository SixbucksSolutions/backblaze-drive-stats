# Historical cache transfer and snapshot publication

Preferred processing storage uses **`drive-stats/cache-v2`**, discovered through
**`drive-stats/current-cache.json`**. The verified catalog contains 53 datasets
from 2013 Q2 through 2026 Q2: 45 complete and eight partials. Its requested-period
ledger separately records unpublished 2013 Q1, making 54 requested periods. Local analysis uses
`data/preferred-cache-v2/`; private runtime discovery is `data/preferred-cache.json`.
`cache-v1` and original local working inputs remain legacy recovery evidence.

The [source-history completion record](source-history-completion.md) now covers
2013-04-10 through 2026-06-30 computationally: **53 datasets / 54 requested
periods**, comprising 45 complete quarters, eight partials and unpublished 2013 Q1.
There are **4,817 retained dates / 743,490,518 known observations**, with 13
problematic captures within the published span and 99 pre-publication calendar
days unavailable. The unpublished quarter is metadata only, with no payload
dataset or warm-cache hit.

The accepted append adds nine data-bearing quarters and separate availability
and source-domain metadata while preserving all prior immutable references. Its
847 delta payloads / 186,487,415 bytes passed encrypted readback, zero-write reuse
and isolated restore, with zero old-payload transfers. The published catalog
references 5,029 payloads / 4,554,589,393 bytes. The local mirror passed independent
full-keyset/hash verification, preserved all 4,182 previous payloads and retained
the previous discovery record. Terry accepted #0023 and all source cards.
Current worker assignments are r031; no further source
cards are queued after this handoff. #0017 retains production integration and
#0063 remains owner-Completed research.

The earlier [migration/repack report](ten-item-backfill-and-repack.md),
[ten-quarter append](ten-quarter-origin-backfill.md) and
[epoch backfill](ten-quarter-epoch-backfill.md) retain their historical acceptance
evidence. The epoch append preserves the accepted isolated-root 2017 Q2 source;
published object keys remain canonical. Serial local restore and mirror copies
retain all fixed-root and immutable-write guards.

Implemented for #0016 using local storage first. On 2026-10-31, #0056 verified
the adapter against the owner's private Backblaze B2 bucket with a dedicated,
bucket- and prefix-restricted application key supplied outside the repository.
The subsequent [first durable cache migration](b2-cache-migration.md) copied and
restored 192 completed Q1/Q2 objects by verified manifest. That completed copy
remains separate from the initial connection check below.

The [four-quarter backfill retention](parallel-quarter-benchmark.md) then added
477 verified processing objects for 2024 Q4 through 2025 Q4, including the
previously accepted 2025 Q4 cache. Readback, zero-write reuse and a separate-root
restore succeeded. Those seven quarters have durable projected data,
receipts and retained summaries. Raw ZIPs remain outside these processing copies.

## Storage recovery tiers

The owner’s intended recovery hierarchy is **hot: B2 us-east**, **cool: B2 us-west**,
and **cold: Glacier Deep Archive**. Terry owns In Progress #0096 for cross-region
B2 backup. This records ownership and intent, not a claim that the west-region
copy is verified. #0019 retains the later Glacier scope.

## Real service verification

The initial probe uploaded one 175-byte object, verified its SHA-256 by readback,
repeated the transfer with zero writes and one verified reuse, then downloaded it
to a separate local root and verified it again. The explicit transfer manifest
and sanitized receipt remain in ignored `data/staging/0056/`. The object was
initially kept as verification evidence; the owner later deleted the disposable test
object. Its local receipt remains. That cleanup does not affect processing caches
or recovery manifests. The probe performed no deletes or Parquet transfers.

Native API inspection confirmed the exact intended bucket and `drive-stats/`
key restriction, private access, SSE-B2/AES256 default encryption and empty
lifecycle rules. S3 object metadata confirmed AES256 for the uploaded object.
The key cannot inspect Object Lock configuration, so that setting is unverified
by the probe. The recommendation for initial setup was to leave it disabled;
immutable object naming and WORM retention are separate guarantees.

The console's Read and Write preset includes additional capabilities such as
object deletion. The application does not exercise those capabilities in this
verification or cache transfer. Credential contents, IDs, authorization tokens
and owner connection settings are not committed. The secret stays in the
owner-provided local file and is passed to the SDK in memory.

Before larger migration, enumerate completed retained objects in a private
manifest, review its byte/object totals and preserve the local sources. Keep
one writer per destination prefix. This roundtrip verifies the small-object
GetObject/PutObject path and content checks; it does not establish multipart,
large-object, distributed-writer or full-history performance behavior.

## Separate private processing from public delivery

Private projected Parquet, identity-quarter summaries, capacity frequencies,
source receipts, generation stamps and their manifests belong in an ignored local
cache and eventually the owner's Backblaze B2 prefix. They contain drive serials
and per-drive dates. Public delivery contains only validated aggregate matrix and
supporting JSON with source/cohort/version metadata. Cloudflare is the later CDN;
no private Parquet or cache manifests belong in the website bundle.

`history_storage.LocalObjectStore` and `B2ObjectStore` use the same relative POSIX
object keys. Root directory, bucket, prefix and endpoint are transport settings,
not semantic cache identities. Migration copies bytes and verifies SHA-256; it
does not regenerate CSV or summaries merely because their location changed.
Keys use portable ASCII names; case aliases within a transfer, trailing dots or
spaces, and Windows reserved device names are refused before copying.

## Verified object-level resume

Create a transfer manifest with `build_transfer_manifest(root, relative_paths)`.
Supply an explicit list of retained completed objects, including their commit
manifests; omit active locks and temporary files. The manifest records relative
path, byte length and SHA-256 for each object. Keep it private with the cache.

`transfer_verified(source, target, manifest)` checks the source against that
manifest, skips target objects only after reading and verifying their actual
bytes, copies missing/corrupt objects, then reads back and verifies every copied
object. ETags and checksum metadata alone are never trusted. On failure, no
successful completion receipt is returned. Retrying the same manifest reuses
completed verified objects; the interrupted object is copied again in full.
Resume granularity is **one object**, not byte ranges or multipart uploads.

An object is limited to 128 MiB by default. `transfer_verified(..., max_workers=8)`
or CLI `--workers 8` opts into bounded transfers across independent object keys;
the default remains one worker, with an allowed range of 1–16. The full manifest
is validated before object I/O, including case aliases and parent/child conflicts.
Each worker handles one object at a time, retaining bounded source/comparison
buffers rather than loading the manifest's contents together. This supports daily
projections/summaries, not arbitrary huge ZIPs; the API allows a deliberately
chosen larger object bound. A failure stops pending work and waits for started
workers before raising, without a completion receipt; verified partial objects
remain resumable. One coordinator process must own each target prefix. Its threads
share a pre-created low-level Boto3 client, following the
[client thread-safety caveats](https://docs.aws.amazon.com/boto3/latest/guide/clients.html#multithreading-or-multiprocessing-with-clients):
no shared client metadata/event mutation or cross-process sharing. Remote writes
are object-atomic transport operations; this adapter does not claim a distributed
lock, a cross-object transaction, or a B2 conditional-write capability. Do not use a
destination cache until the entire manifest verifies. The generator separately
rechecks summary/source manifests.

The explicit CLI is `sync_history_cache.py push|pull` with `--local-root`,
`--manifest`, `--bucket`, `--prefix`, `--endpoint`, and `--region`. These are private
runtime parameters; do not commit an owner bucket configuration. The endpoint
must be the matching HTTPS `s3.<region>.backblazeb2.com` service. Credentials come
only from **B2_CACHE_ACCESS_KEY_ID** and **B2_CACHE_SECRET_ACCESS_KEY**, separate
from official read-only source access. No credential flags or default credential
chain are used. Official Drive Stats source buckets are refused as write targets.

Backblaze documents the relevant API in its
[S3-compatible API guide](https://www.backblaze.com/docs/cloud-storage-s3-compatible-api),
[Put Object reference](https://www.backblaze.com/apidocs/s3-put-object), and
[application-key guide](https://www.backblaze.com/docs/cloud-storage-s3-compatible-app-keys).
Service compatibility, permissions and real round-trip verification must be
tested in the owner-supplied prefix before remote migration is accepted.

## Interpreting retained storage sizes

The original 2026 Q2 daily projection predates the enriched writer. Its six-column
Parquet uses Zstandard but lacks the newer model/serial/date clustering; it was
preserved as an unchanged baseline. The 2026 Q1 folder is about 176.5 MB versus
222.4 MB for Q2, while their observation counts differ by only about 4.5%.
A controlled single-day check of 345,738 Q2 rows reduced 2,378,871 bytes to
1,978,999 bytes (16.8%) with the enriched layout and exact logical-row parity.
The original file stayed unchanged. This is one-day evidence, not a forecast of
the full quarter's repacked size.

The Q2 **summary** folder has a separate explanation: both its original
2,747,932-byte summary variant and enriched 2,552,689-byte variant were retained,
totaling 5,300,621 bytes. Q1 has one 2,512,007-byte enriched variant. The generator
selects one verified candidate, preferring the current profile; it does not add
the versions together. Retaining migration evidence is not duplicate exposure.
Referenced objects must remain available to their existing recovery manifests.
The owner-requested full-quarter lossless repack in #0058 has since completed:
daily Parquet is 183,750,684 bytes (17.17% smaller). Its preferred processed
folder is 184,278,429 bytes including the receipt, and the preferred single
summary is 2,553,233 bytes. Old referenced objects remain intact in `cache-v1`;
use the current pointer for comparisons rather than the legacy baseline.

## Immutable aggregate publication

`publish_generation(output_root, matrix, supporting)` validates both contracts and
their shared snapshot ID, cutoff, source manifest, cohort and selection/version
definitions. It reconciles complete-quarter model Count/New between artifacts.
It writes `snapshots/<snapshot-id>/matrix.json` and `supporting.json` immutably;
the matrix's declared immutable path must match. Same ID/same bytes is idempotent.
Same ID/different bytes is an error, including changed generation timestamps.

A cooperative local `.publication.lock` serializes publishers. Immutable creation
uses an atomic exclusive link, protecting against a racing writer overwriting
another result. The index is replaced atomically only after both files succeed.
An interrupted unpublished generation can leave partial, unreferenced immutable
files; retrying identical content completes it. Old generations are retained.
If a process dies holding the lock, verify that writer has stopped before manually
removing the stale lock. The tool never kills a process or guesses a stale lease.

The small index contract has `artifactType: "flagship-index"`, `schemaVersion: 1`,
`latest`, and `snapshots`. Each snapshot entry carries `id`, `asOfQuarter`, UTC
`generatedAt`, matrix/supporting `{url, sha256, sizeBytes}`, and a
`generationSha256` over the canonical entry before that checksum is added.
Canonical JSON uses UTF-8, sorted keys, compact separators, a final newline and
finite numbers. Entries are newest cutoff first, then actual generation instant,
then ID; publishing an older cutoff does not make it latest. Index URLs are
generation-relative public artifact paths. Existing index entries and content
checksums are verified before extension; corruption requires explicit repair.

This supplies a local publication mechanism. Uploading public generations and
switching the CDN index is a later hosting step, not an implicit cloud action.

## Verification

```powershell
uv run --frozen python -m unittest discover -s tests -p test_history_storage.py
```

Tests exercise local/fake-B2 round trips, resume after interruption, corrupt source
and destination bytes, public/private path boundaries, dedicated credentials,
source-bucket protection, paired publication mismatch, partial publication retry,
immutable concurrent creation, cooperative locks, and damaged index/content
refusal. They use temporary files and invented aggregate data, without network.
