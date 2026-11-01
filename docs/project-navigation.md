# Project navigation

Start with the [README](../README.md) to open the committed-data explorer.
This index keeps technical details and historical evidence available without
requiring them for ordinary viewing.

## Product intent: history at the selected cutoff

Treat the explorer as though it had existed since Backblaze began publishing
its drive data. All six views should let people select any relevant historical
cutoff for which their evidence supports the view. A selection describes the
fleet actually observed through that cutoff, rather than projecting a modern
fleet backward. No later observations, capacity evidence, exposure or threshold
proof may leak into an earlier snapshot.

The customer-HDD fleet uses the owner’s nominal capacity floor of 1 TB and
explicit observed model exclusions. Supporting HDD views include eligible models
below the separate >=2,000-drive threshold used for AFR analysis. All-supplied
capacity has a broader scope. Datacenter views depend on captured location data,
which starts in 2023 Q3. Partial and unpublished source coverage remains
unknown where an exact value cannot be established; it is never filled in as
zero.

The [production data contract](production-data-v2.md) defines these semantics;
the [full-history refresh record](full-history-refresh-0104.md) documents the
current release and its evidence boundaries. Its cutoff count is a release fact,
not a permanent limit on future refreshes.

## Explorer and data definitions

- [Matrix interface and reading guide](flagship-ui.md)
- Explore: [deployments](explore-deployments.md), [drive mix](explore-distribution.md), [capacity history](explore-capacity.md), [manufacturer shares](explore-manufacturers.md), [datacenters](explore-datacenters.md)
- [Shared production v2 contracts](production-data-v2.md) and [snapshot reader](snapshot-reader.md)
- [Real production aggregate release](production-release.md), [workbook reconciliation limits](production-workbook-reconciliation.md) and [integrated release validation](integrated-release-validation.md)
- [Golden workbook fixtures](flagship-workbook-fixtures.md) and [workbook reference analysis](workbook-reference-analysis.md)
- [Original matrix v1 contract](flagship-matrix-contract.md) and [supporting-report v1 contract](supporting-report-contract.md)

The real matrix opens at `?view=matrix`; `?view=explore` opens its shared model
context. All five current Explore routes are listed in the README. The original
quarterly reliability report remains at `?view=reliability`; adding `legacy=1`
to an original Explore route selects its v1 implementation. Workbook and
synthetic matrix references require `?view=matrix&reference=1`.

## Refresh, development and hosting

The [quarterly refresh workflow](quarterly-refresh.md) is the maintained entry
point for offline plan/run/verify, pinned local sources, retained-summary reuse,
model-discovery gates and recoverable immutable aggregate publication. An
unchanged refresh reuses the approved generation without public payload/index
writes. Private B2 retention and website deployment remain separate operations.
Viewing committed aggregates does not require any refresh step.

- [Historical generator and v2 producer](historical-generator.md)
- [Python toolchain](python-toolchain.md), [code-quality policy](code-quality.md) and [coding-agent instructions](../AGENTS.md)
- [Static Cloudflare Pages package](cloudflare-hosting.md) and [asset minimization record](asset-minimization.md)
- [Original v1 ZIP importer](zip-import.md), [v1 web-data exporter](web-data.md), [v1 validation evidence](web-validation.md) and [legacy Iceberg-to-XLSX analysis](legacy-analysis.md)

The original importer/exporter and regex-only web pipeline are legacy v1
references. They are not the current production refresh instructions. Shared
SMART normalization remains in `drive_model_names.py`; the original analysis
helper and workbook retain their entry points.

## Historical source and cache evidence

These records preserve the sequence and evidence of completed source work.
Their historical next-step statements do not authorize new downloads, backfills,
cloud operations or publication.

- [Source-history completion](source-history-completion.md): 2013-04-10 through 2026-06-30, with 53 data-bearing datasets across 54 requested periods, 45 complete quarters, eight partials and one unpublished period. The record retains 4,817 valid dates and 743,490,518 known observations; unavailable captures and prepublication dates remain explicit.
- [Quarter pilot](quarter-pilot.md), [2025 Q4 audit](quarter-2025-Q4.md) and [durable Q1/Q2 B2 copy](b2-cache-migration.md)
- [Four-quarter benchmark and recovery](parallel-quarter-benchmark.md) and [eight-quarter batch](eight-quarter-benchmark.md)
- [Ten-item backfill and lossless repack](ten-item-backfill-and-repack.md), [ten-quarter origin search](ten-quarter-origin-backfill.md) and [ten-quarter epoch backfill](ten-quarter-epoch-backfill.md)
- [Verified local/B2 transfer](history-storage.md), [enriched Parquet profile](parquet-profile.md) and [history verification/backfill gates](history-verification-and-backfill.md)
- [Cohort/history evidence proposal](cohort-history-evidence.md)

## Plans and scope records

- [Flagship AFR plan](flagship-afr-plan.md)
- [Remaining delivery plan](remaining-delivery-plan.md)

These records distinguish historical proposals, accepted contracts and execution
gates. Consult the current owner-controlled work board before starting ticket work.
