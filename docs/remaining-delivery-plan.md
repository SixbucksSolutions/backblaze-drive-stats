# Remaining production delivery

Terry accepted the source-history cards and #0023 on 2026-10-31. All 53
data-bearing quarters are retained and independently verified; requested 2013 Q1
is recorded as unpublished. #0063 remains accepted research. Production
contracts, generation and UI integration are delivered under #0017.

The remaining scoped work is tracked at P3. Ready for Work can retain
dependencies; it does not waive their owner-acceptance gates. Move a ticket
In Progress before implementation, tests or review. Terry controls Completed.

| Ticket | Deliverable | Prerequisites |
| --- | --- | --- |
| #0084 | Shared production contracts and model-selection rules | Accepted #0014, #0023, #0063 |
| #0085 | Apply accepted cohort, reporting-epoch and gap rules in the generator | #0084 |
| #0086 | Real matrix/Explore JSON, quarter payloads and immutable generation index | #0085 |
| #0088 | Shared snapshot loading, model filters and navigation | #0084 |
| #0087 | Production flagship AFR matrix | #0086, #0088 |
| #0089 | Explore: model deployments | #0086, #0088 |
| #0090 | Explore: model distribution | #0086, #0088 |
| #0091 | Explore: total raw capacity over time | #0086, #0088 |
| #0092 | Explore: manufacturer capacity and deployment shares | #0086, #0088 |
| #0093 | Explore: datacenter capacity | #0086, #0088 |
| #0095 | Repeatable offline quarterly refresh workflow | #0086 |
| #0094 | Independent integrated release validation and localhost handoff | #0087, #0089–#0093, #0095 |
| #0007 | Existing Cloudflare static-hosting preparation | Accepted #0017 release |

#0084 is owner-Completed. #0085's offline producer and #0088's shared reader/model
context are owner-Completed. #0086's [real aggregate release](production-release.md)
is owner-approved: 2026 Q2 plus the 2025 Q3/Q4 workbook cutoffs, with
explicit [reconciliation limits](production-workbook-reconciliation.md). Terry
asked to record approval without moving #0086's RFR lane; that explicit approval
satisfies the dependent acceptance gate. Terry also approved #0087, #0089 and
#0090 while reserving their later lane moves. #0091, #0092 and #0093 now implement
the remaining capacity, manufacturer and datacenter views; those cards are now
owner-Completed. #0095's [maintained refresh workflow](quarterly-refresh.md) is
owner-Completed. #0094's
[integrated localhost review packet](integrated-release-validation.md) now records
the accepted release validation; #0094 is owner-Completed. Parent #0017's
[integrated handoff](integrated-production-handoff.md) is also owner-Completed.
See the
[producer documentation](historical-generator.md) and
[shared reader handoff](snapshot-reader.md).

Users select **brands and models**. Serial numbers remain private aggregation
identities and never enter public JSON, tables, filters or CSV downloads. The
supporting selected-HDD context must retain seeded and smaller-population models
under the adopted rules; purchase-default filtering must not silently alter
that context or imply a whole-fleet denominator.

The five Explore views retain their existing purposes and each has its own
reviewable ticket. The 2,000-drive comparison threshold belongs to the flagship
timeline; it does not silently filter supporting report rows. Total capacity and
datacenters use their separately labeled all-supplied scope. Unreported locations
before 2023 Q3 and partial source coverage remain explicit.

The artifact task starts with the real 2026 Q2 paired snapshot and reconciles the
two supplied workbook cutoffs where source coverage permits. It advertises only
validated snapshots and supplies calendar-quarter Explore data without inventing
observations for unavailable periods. This does not require a matrix snapshot for
every historical cutoff before the first production release.

Fresh independent review, meaningful numerical/accessibility checks, Backblaze
attribution and the maintained Python/web quality gates are part of handoff.
Parent #0017 and its integrated validation are accepted. Cloudflare #0007 remains
separate; the owner has now supplied its exact account/token/project target for
the requested static deployment. Unrelated account, DNS and resource changes
remain outside that deployment scope.

Terry accepted #0096 for the **cool B2 us-west replication setup**. Initial copy
completion and restore integrity remain unverified. The storage hierarchy
is hot B2 us-east, cool B2 us-west and cold Glacier Deep Archive. #0096's runtime
and owner-controlled Completed lane are separate from Bot's implementation work.

The optional Sol observations (#0020) and Glacier backup (#0019) retain their
explicit deferred scope. The TypeScript compatibility follow-ups (#0024/#0025)
retain their owner-Blocked lanes. None gates baseline delivery.

Current rolling author/reviewer assignments are in private plan **r047**. The
roster covers all remaining planned turns, preserves earlier revisions and
does not start workers or approve prerequisites. Normal implementation is at
most three cards per turn, with six direct subagents and depth one; past
ten-quarter source-batch exceptions do not expand this implementation limit.

Terry has moved #0017 and #0097–#0100 to Completed.
For #0007 he supplied the account, token file and
`backblaze-drive-stats-analysis` target for the requested pages.dev deployment.
The [static Pages package](cloudflare-hosting.md) is configured for production
branch `main`. The hosting card records its qualified release, project/deployment
receipt and actual hosted verification. Credentials remain outside Git and the
served bundle. Future commits do not automatically authorize or trigger uploads.
#0097's dependencies were removed at Terry's request. Its
[minimized static build](asset-minimization.md) is owner-Completed.
Hosting qualification remains tracked under #0007. Use an
explicitly accepted bundle when a later upload is authorized. The roster starts
no workers and does not treat RFR alone as approval.

Separate follow-up #0098's [whole-project review](project-review-0098.md) is
owner-Completed. A Sol / High lead curated three Astra / Medium packets and
fresh Sol / High validation challenged the findings for evidence and practical
value. Three P3 defects survived, with one conditional test follow-on; no broad
refactor, language-modernization pass or test deletion was justified.

#0099's user-focused README, linked navigation/legacy records and reference URLs
are owner-Completed. #0100's captured datacenter availability, consistent UI/CSV
wording and focused cold/retained regressions are also owner-Completed. Existing
immutable artifacts and cache identity remain unchanged. Ambiguous modern
all-Unknown legacy inputs require verified capture evidence for new generations;
mixed captures preserve valid known locations.

Both cards reference the approved #0098 review and retain no blocking dependency.
The UI wiring scenario remains conditional on the next relevant change or an
inexpensive harness; no standalone tooling project was added. Terry approved
#0007 and moved it to Completed on 2026-11-01. No further Astra execution is
implied by the completed review.

#0102's [buildchain audit](buildchain-freshness-0102.md) qualifies exact npm pins
and two Python transitive updates. #0103's
[metric reconciliation](afr-metric-reconciliation-0103.md) implements versioned
quarterly unique Failed/AFR counts, final-observed Retired with a censored terminal
quarter, and original-code delta baselines. Terry approved both #0102 and #0103
and moved them to Completed. The separate
[full-history refresh #0104](full-history-refresh-0104.md) publishes all 53
retained cutoffs with per-view evidence bounds across all six views and calculation
2.1.0; the exact old graph remains in an unserved archive.

Terry explicitly held #0101 for its own turn. It remains Ready for Work and has
not started. Terry separately authorized #0104 for this turn, including the
consistent full-history refresh and existing-target Pages deployment. Its
handoff records the final verification and actual deployment receipt. Terry
requested new #0106 for next turn to document the durable historical time-warp
intent; that card is created only and unstarted. The remaining roster lists
#0106 followed by #0101's dedicated held turn. Planning does not start either
card or authorize #0101's source moves, downloads, ETL or publication.
