# Repeatable offline quarterly refresh

#0095 provides maintained `refresh_history.py` **plan**, **run** and **verify**
entry points, plus `refresh_sources.py` for explicitly permitted local projection.
Python stays offline. Private projected Parquet, identity-quarter summaries and
retention stay separate from public aggregate JSON. CSV is only the website's
optional aggregate download, not an intermediate refresh format.

## Prepare the operator configuration

Use `uv sync --frozen --extra postgres`. Keep the configuration, receipts, source
ZIPs, projected data and cache under ignored private directories. Preserve the
original configuration for repeatability. Paths below are operator examples,
not credentials or a claim that those files already exist.

Start from the producer configuration shape in
[historical generator](historical-generator.md#production-v2-producer-0085), adding:

```json
{
  "baselineDirectory": "web/public/data/production",
  "outputDirectory": "data/refresh/public-staging",
  "receiptPath": "data/refresh/receipt.json",
  "historyStart": "2013-Q1",
  "generatorRevision": "actual-reviewed-producer-revision",
  "generatedAt": "2026-11-01T04:00:00Z",
  "catalog": {
    "localRoot": "data/preferred-cache-v2",
    "path": "data/refresh/reviewed-catalog.json",
    "sha256": "<exact reviewed catalog SHA-256>"
  }
}
```

Also supply the reviewed `registry`, positive-seed `patterns` and explicit
`selection` object. These are JSON objects/arrays, not filenames. Use the existing
reviewed `config/backblaze-hdd-evidence-2026-Q2.json` registry and
`drives_of_interest_regexes.json` seed as inputs; preserve canonical model aliases
and the accepted analysis/default/reference choices. `summaryManifests` can
replace `catalog` with explicitly pinned retained manifests, but do not supply
both. Retain an exact copy of the public baseline graph.

`data/preferred-cache.json` records the preferred catalog key, hash and local
root. Obtain the catalog itself through the separately verified retention/restore
workflow. The refresh never resolves remote pointers or downloads a source ZIP.
Check the catalog's exact hash and preserve its source-availability/recovery
metadata. In particular, 2013 Q1 is unpublished, 2013 Q2 is partial and the
accepted 2017 Q2 recovery contains 84/91 days. A new source helper is not a
general missing-date bypass for these established exceptions.

If `asOfQuarter` is omitted, the tool selects the newest quarter in the supplied
pinned catalog/manifests/source inventory. This is the newest **evidenced supplied
published period**, not an internet discovery claim or an assumption that the
previous calendar quarter has been released. An explicit cutoff bounds which
quarter objects can be read. Do not include source observations beyond it.

## Inspect, execute and verify

From the repository root:

```console
uv run --frozen --no-sync python refresh_history.py plan --config data/refresh/config.json
uv run --frozen --no-sync python refresh_history.py run --config data/refresh/config.json
uv run --frozen --no-sync python refresh_history.py verify --config data/refresh/config.json
```

`plan` verifies the indexed public baseline graph and retained evidence and reports discovery or
publication gates without writes. New daily inputs require the explicit `run`
stage before their discovery can be known. The default is not permission to
download, project or publish new observations automatically.

`run` writes sanitized private status receipts, reuses verified summaries and
publishes aggregate objects only after the complete graph and model decisions
pass. Its statuses distinguish preparing, gated, prepared, published and
unchanged work. Console failures are generic; inspect the sanitized receipt and
the configured private inputs locally rather than logging their paths/contents.
`verify` requires a matching successful receipt and checks exact output bytes and
baseline preservation without writes. `run` inspects the whole output tree before
publication; `verify` requires its exact indexed file set. Unexpected private,
unadvertised or nonregular files and reparse links are rejected and left intact
for inspection. Only the currently held publication lock is allowed during run.
A failed or gated run is not verification.

For an unchanged cutoff and producer revision, the workflow can reproduce the
baseline's established timestamp rather than manufacturing a new generation on
each invocation. An explicitly changed producer revision takes effect and can
create a same-quarter revision. Keep `generatedAt` stable while retrying one
generation. Public payload/index writes are counted separately from private
receipts and cooperative lock metadata. A verified no-op reports zero public
payload/index writes and leaves their bytes and modification times unchanged.

## A genuinely new local quarter

After obtaining and independently pinning the official source, add a bounded
local source inventory and explicit private work/cache roots:

```json
{
  "sources": [{
    "quarter": "2026-Q3",
    "path": "data/raw/owner-reviewed-quarter.zip",
    "sha256": "<exact reviewed archive SHA-256>",
    "sizeBytes": 123456789,
    "url": "https://example.org/replace-with-official-source.zip"
  }],
  "allowProjection": true,
  "workRoot": "data/refresh/work",
  "cacheRoot": "data/refresh/private-summaries"
}
```

These are fictional placeholders, not a statement that 2026 Q3 is available or
that the illustrated byte length/URL is valid. Record publisher checksum evidence
where available; an operator-supplied local SHA-256 pin alone does not authenticate
the publisher. Keep source URLs public and free of credentials/query tokens.

The source adapter verifies exact ZIP length/hash, selects a complete quarter
calendar, and delegates the six-column enriched Parquet projection. It streams
source CSV members without extracting raw CSV files. Annual archives are selected
by quarter before unselected member bodies are read. Private completed projection
markers bind the source/profile, receipt and every output hash. Reuse rechecks
those bytes without projecting again; changed completed objects fail closed.
Future source objects are excluded before opening their bytes.

Failed projection attempts are preserved. Retrying the same pins creates a fresh
attempt rather than overwriting the partial one. Existing directory junctions or
symlinks below a private work/cache root must be rejected before writing through
them. The workflow refuses those pre-existing redirections into the public tree.
Already projected operator inputs can instead use `inputs` plus `cacheRoot` as in
the producer API. Do not combine `inputs` and `sources` for one refresh. New
summaries are merged with the retained history; conflicting quarter modes fail.

## Reconcile discoveries and decisions

Inventory all supplied canonical models before selection. The positive regex seed
is a hint for known HDDs, not an exhaustive vendor/model allowlist. Every new
qualifying model is reported. An unresolved newly qualifying medium gates public
publication until reviewed evidence classifies it. Do not infer HDD/SSD from a
name, a high count or procurement assumptions. Existing baseline-known unresolved
qualifiers remain reported; their previously accepted exclusion is not silently
converted into HDD admission or a new blocker on a no-op.

For an evidenced new qualifying HDD, explicitly record the updated analysis list.
The semantic calculation version remains `2.0.0`; a membership decision is not an
unsupported rate/selection algorithm. Supply a distinct decision revision:

```json
{
  "selection": {
    "version": "2.0.0",
    "analysisModelIds": ["<complete reviewed analysis ID list>"],
    "purchaseDefaultModelIds": [],
    "historicalReferenceModelIds": [],
    "update": {
      "decisionVersion": "2026-Q3-cohort-r001",
      "previousSelectionSha256": "<digest of the exact baseline context.selection>",
      "reason": "<public-safe evidence and decision summary>",
      "admittedModelIds": ["<exact newly admitted ID list>"],
      "removedModelIds": []
    }
  }
}
```

Use `historical_generator.digest(baseline_context['selection'])` for that exact
prior-selection binding. The receipt records the decision revision and selection
digests. The receipt's configuration hash binds the complete operator config;
the public generation identity binds source, registry, patterns, selection and
semantic generation inputs, rather than private operator/cache/receipt paths.
Lists must
match the actual change, and baseline exclusions/default/reference choices remain
preserved unless the update explicitly changes them. A new vendor is admitted
under the same evidence rules. Unsupported semantic versions stop public publication.

If classification/aliases change canonical IDs, old summaries cannot be reused
under a false identity. Explicitly summarize the affected already projected new
quarter with the reviewed registry into its new immutable cache identity. Do not
edit accepted summaries, change normalizer CRLF bytes, or trigger a silent scan of
older daily history. Preserve previous semantic/physical cache variants.

## Publication, interruption and rollback

Keep one cooperative writer per private summary root and public publication root.
The index switches atomically only after all referenced old/new artifacts verify.
Old generations remain advertised and immutable; an older cutoff does not replace
the newest one. Multiple validated revisions of one as-of quarter are valid and
must all remain readable. No raw/private file belongs in the public tree.

After an interrupted prepared publication, rerun the same config/receipt and
stable generation timestamp. Already verified immutable objects are reused. Do
not edit config to abandon that attempt silently: inspect recovery evidence or
choose a separate private staging output and receipt. Never overwrite an old
content-hashed object or manufacture a new timestamp to evade a conflict.
For a stale lock, first verify its writer has stopped; the workflow neither kills
processes nor guesses a stale lease. For rollback, restore a previously accepted
complete, byte-verified graph into clean staging, retaining the superseded graph
outside that publication root. Replacing only the index while leaving unadvertised
new objects behind fails the exact indexed-tree and release checks.

Private B2 retention is a **separate** `sync_history_cache.py push/pull` operation
using an explicit manifest, dedicated owner-cache bucket/prefix, verified
readback/resume and private environment credentials. The refresh does not create
keys, contact B2, update processing pointers, delete old objects, or claim that a
fake-client test verifies an actual remote copy. Reuse the verified commands in
[history storage](history-storage.md); prefer unchanged-object reuse and retain
their exact manifests for recovery. Public site deployment is separate again.

Before promoting staged JSON, run the normative Python graph validator and the
maintained browser-reader release checker against the staged directory. Pass its
expected latest quarter and unique list of advertised cutoffs explicitly:

```console
uv run --frozen --no-sync python tools/validate_production_v2.py data/refresh/public-staging
node --experimental-strip-types web/scripts/check-production-data.mjs data/refresh/public-staging 2026-Q2 2025-Q3,2025-Q4,2026-Q2
```

Replace those cutoffs with the actual approved release inventory. The checker
still consumes **every** snapshot/revision; deduplicating the quarter inventory
does not discard revisions. Update the committed build gate's expected cutoffs
only as part of the reviewed public release. Use the standard Python/web gates
and owner review before promoting a changed release or deploying it. No paid or
unattended schedule is created by these tools.

## Qualification evidence

The real retained qualification defaulted to 2026 Q2, reused all 53 accepted
quarter summaries, reported eight known pending classifications and no new
pending models, and verified the unchanged release. Its plan/two-run/verify
sequence made **zero public payload/index writes**, read zero daily partitions,
performed no source projection, and preserved all 161 payload/index hashes and
modification times in a private copy plus the untouched repository release.
Only private receipts and transient coordination locks were written. Detailed
evidence remains under ignored `data/staging/0095/`.

Synthetic tests cover a new quarter/vendor, versioned admission, unresolved media,
cache/source integrity, projection interruption, immutable publication recovery,
same-quarter revisions and reader compatibility. Windows junction probes use
fictional records in private staging only. No real source download, daily rescan,
preferred-cache update, cloud operation or deployment is part of this handoff.
