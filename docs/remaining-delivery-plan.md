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
explicitly owner-approved, with its RFR lane held for Terry's later move. #0094's
[integrated localhost review packet](integrated-release-validation.md) now records
the accepted release validation. Terry explicitly approved #0094; its RFR lane
is held for his later move. Terry also explicitly accepted parent #0017's
[integrated handoff](integrated-production-handoff.md), with its RFR lane held for
his later move. See the
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
separate and is being handed off Needs Terry for concrete account/domain/project
inputs. Local preparation does not authorize live deployment or account changes.

Terry accepted #0096 for the **cool B2 us-west replication setup**. Initial copy
completion and restore integrity remain unverified. The storage hierarchy
is hot B2 us-east, cool B2 us-west and cold Glacier Deep Archive. #0096's runtime
and owner-controlled Completed lane are separate from Bot's implementation work.

The optional Sol observations (#0020) and Glacier backup (#0019) retain their
explicit deferred scope. The TypeScript compatibility follow-ups (#0024/#0025)
retain their owner-Blocked lanes. None gates baseline delivery.

Current rolling author/reviewer assignments are in private plan **r040**. The
roster covers all remaining planned turns, preserves earlier revisions and
does not start workers or approve prerequisites. Normal implementation is at
most three cards per turn, with six direct subagents and depth one; past
ten-quarter source-batch exceptions do not expand this implementation limit.

Terry explicitly accepted #0017, with its RFR lane held for his later move.
#0007's [static Pages package](cloudflare-hosting.md) is prepared and locally
verified. It will be Needs Terry for the account, hostname and any existing Pages
project details he will supply in the morning. Target-specific configuration and
hosted verification remain unfinished; no deployment authority is inferred.
#0097's dependencies were removed at Terry's request. Its
[minimized static build](asset-minimization.md) is ready for owner review without
waiting for hosting. Only unfinished #0007 target configuration and hosted
verification remain planned; its missing owner inputs stay visible. Use an
explicitly accepted bundle when a later upload is authorized. The roster starts
no workers and does not treat RFR alone as approval.
