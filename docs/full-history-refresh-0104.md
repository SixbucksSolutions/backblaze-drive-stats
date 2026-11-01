# Consistent full-history production refresh

#0104 provides a source-bounded snapshot for **every retained quarter from
2013 Q2 through 2026 Q2: 53 cutoffs**. Each includes its entire history through
that cutoff. All six views offer historical selection where their evidence
permits it. Every active snapshot uses calculation **2.1.0**.

| View | Available cutoffs | Earliest cutoff | Evidence boundary |
| --- | ---: | --- | --- |
| AFR matrix | 53 | 2013 Q2 | Historically qualifying customer HDDs |
| Model deployments | 53 | 2013 Q2 | Historical customer-HDD fleet |
| Model distribution | 53 | 2013 Q2 | Historical customer-HDD fleet |
| Total raw capacity | 53 | 2013 Q2 | All supplied drive identities |
| Manufacturer shares | 53 | 2013 Q2 | Historical customer-HDD fleet |
| Datacenter capacity | 12 | 2023 Q3 | Captured location field |

The complete graph contains **1,431 quarter payloads, 53 matrices, 53
descriptors and one index: 1,538 files / 129,692,939 bytes**. This replaces the previous three-cutoff
selector, rather than merely refreshing historical rows inside those cutoffs.

The latest cutoff retains 45 complete and eight partial datasets. Unpublished
2013 Q1 remains unavailable. Underlying observations, exposure and source
coverage remain unchanged. Historical HDD classification and cohort coverage
expand; supporting HDD totals therefore reflect the historical fleet. The
separately labeled all-supplied scopes retain their original numerical values.
Every supporting payload is bound to its own source-bounded snapshot.

The first cutoff has five threshold-proven HDD models. Its source is partial,
so exact display metrics remain unavailable; model eligibility does not invent
a complete-quarter AFR. Later complete rows retain their observed values.

## Historical fleet policy

Selection/cohort **2.1.0** derives each fleet from observations through the
selected cutoff. It does not project the 2026 Q2 comparison cohort backward.
The context contains every evidenced customer HDD observed by that cutoff,
including populations below the AFR threshold. AFR analysis contains every
such HDD with threshold proof in that bounded history.

Terry adopted a **minimum nominal capacity of 1 TB** for the customer-HDD fleet,
recorded as `selection.minimumCapacityTB`. This is the project's policy.
[Brian Wilson's timeline](https://www.ski-epic.com/backblazetimeline/) records
twenty 1 TB datacenter drives on May 21, 2008, providing historical context.
It does not independently identify the role of every smaller reported drive.

Explicit observed model exclusions are bound in `selection.excludedModelIds`:
WD800LB, DELLBOSS VD and MQ01ABF050M. Terry designated the Toshiba as a boot-drive
exclusion; the other boot-role assumptions are not represented as verified
publisher facts. Media classification and fleet eligibility remain separate.
SSD media and unknown physical media are outside the evidenced HDD fleet;
source inventory and all-supplied audit budgets remain intact.

The [historical media registry](../config/backblaze-historical-drive-evidence-r001.json)
adds reviewed publisher/manufacturer evidence for older models and exact raw
aliases. It preserves every canonical ID and the normalizer's exact bytes.
Reported `MQ01ABF050M` is an HDD by explicitly bounded MQ01ABF-family inference
from [Toshiba's specifications](https://toshiba.semicon-storage.com/us/storage/product/internal-specialty/pc/articles/mq01abf-series.html);
the M suffix's exact meaning is unverified. A literal `Seagate SSD` label is
sufficient for SSD exclusion without identifying its exact SKU.

## Calculation and provenance

The [accepted metric reconciliation](afr-metric-reconciliation-0103.md) defines
the calculation. Failed counts each model/serial with a positive failure flag
once per quarter; cumulative AFR sums those quarterly counts over recorded
exposure. Retired counts identities whose last observation falls in a
nonterminal quarter, includes failed identities and is unavailable at the
snapshot quarter. Existing source-gap protections remain. Count/AFR deltas use
the original first-row synthetic zero and subsequent retained eligible rows.

Independent retained-summary audits cover every historical quarter in the
snapshots. They reproduce the one repeated failure-flag identity-quarter:
WDC/HGST WUH721816ALE6L0 in 2024 Q3 changes from eight flags to seven unique
failing identities. This correction propagates through each later cumulative
AFR containing that quarter. It changes no observed exposure or Count.

All historical-fleet snapshots bind producer revision
`9c0b5d9216322f4ba5ccb7cf64a90ed1d7fb56ae`, the reviewed registry, selection
policy and generation time `2026-11-01T13:14:26.624093Z`. The latest has 30
analysis models and 111 customer-HDD context models. Eight parallel generation
batches run each cutoff twice and compare complete output bytes. Superseded
modern-cohort draft graphs were never deployed and remain private evidence.
Guarded reads allow only the pinned retained summary Parquet objects; daily summarization,
downloads and cache writes were forbidden. No #0101 fresh-ETL work was performed.

## Consistent publication and preservation

The active index advertises only the 53 corrected snapshots. The active browser
release and hosting gates require rate, selection and cohort 2.1.0 plus the
explicit 1 TB minimum for every descriptor, and
negative tests reject both an all-legacy release and a mixed release whose
latest snapshot alone declares 2.1.0. Generic readers retain 2.0 compatibility.
The build independently checks per-view availability against every descriptor,
so selector boundaries cannot silently drift from cohort or capture evidence.
Direct links requesting an unavailable cutoff receive an explanation rather
than a different date presented as though it were selected.

The predecessor's complete 161-file graph remains byte-for-byte unchanged under
[`release-archive/production-rate-2.0/`](../release-archive/production-rate-2.0/),
outside the served tree, and in its prior Git revision. Its immutable files are
never relabeled as corrected data. Original XLSX reference fixtures retain
their original values and reference identity.

Publication uploads the coherent app/index/data bundle to the existing static
Pages project. Its prior production deployment is
`67e4cec5-1614-4ebe-9286-095fa712c922`; preserve that coherent predecessor as the
rollback target. The [hosting runbook](cloudflare-hosting.md) covers rollback
and warns that cached links to a different release may require a reload.

## Verification record

Fresh non-author Sol / High audits independently derive quarterly and cumulative
metrics from retained summaries, including first/last observations, repeated
failures, eligible-row baselines and gap/partial/null rules. All supporting
values and accepted byte pins reconcile. These checks inherit the accepted
retained-source provenance; they do not establish missing observations or
complete physical drive lifetimes.

Full Python/web gates, hosted Windows/Linux CI, exact release-manifest checks,
actual deployed payload verification and live UI checks are required before
handoff. The card records the final release commit, CI URL, deployment receipt
and verification results. Detailed local evidence is private under
`data/staging/0104/`; credentials and serial identities are excluded from the
served release and Git.
