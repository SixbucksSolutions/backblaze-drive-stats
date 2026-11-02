# Remaining production delivery

Terry accepted the source-history cards and #0023 on 2026-10-31. All 53
data-bearing quarters are retained and independently verified; requested 2013 Q1
is recorded as unpublished. #0063 remains accepted research. Production
contracts, generation and UI integration are delivered under #0017.

The table below records the original implementation scope. Current priorities
and assignments are in the rolling plan. Ready for Work can retain dependencies;
it does not waive their owner-acceptance gates. Move a ticket
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

The initial artifact release used the real 2026 Q2 paired snapshot and reconciled
the two supplied workbook cutoffs where source coverage permitted. The accepted
#0104 refresh expands that release to all 53 retained historical cutoffs. Each
view advertises only evidence-supported dates without inventing observations for
unavailable periods.

Fresh independent review, meaningful numerical/accessibility checks, Backblaze
attribution and the maintained Python/web quality gates are part of handoff.
Parent #0017 and its integrated validation are accepted. Cloudflare #0007 remains
separate; the owner has now supplied its exact account/token/project target for
the requested static deployment. Unrelated account, DNS and resource changes
remain outside that deployment scope.

Terry accepted #0096 for the **cool B2 us-west replication setup**. On 2026-11-01,
he reported an automatic east-to-west replication run and supplied a screenshot
showing 7.5 GB in the west bucket. This is an owner-observed run; Bot has not
performed a restore-integrity test. The storage hierarchy
is hot B2 us-east, cool B2 us-west and cold Glacier Deep Archive. #0096's runtime
and owner-controlled Completed lane are separate from Bot's implementation work.

The optional Sol observations (#0020) and Glacier backup (#0019) retain their
explicit deferred scope. The TypeScript compatibility follow-ups (#0024/#0025)
retain their owner-Blocked lanes. None gates baseline delivery.

Private plan **r059** records #0115's navigation handoff and #0113's accepted closeout,
preserving **r054**'s owner-accepted closeout and earlier assignments. #0101's
twelve-worker exception remains historical. #0115's shared collapsible navigation
is implemented and independently reviewed; it awaits Terry's review. No Ready for
Work cards remain, so no future execution workers are assigned. #0114's Seagate
ordering remains Backlog/P5 and unstarted. Planning never starts workers, approves
prerequisites or expands current limits.

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

Terry accepted #0104 and moved it to Completed. Its handoff retains the full
historical-fleet verification and actual Pages deployment receipt. #0106 now
documents the durable time-warp intent in
[project navigation](project-navigation.md); #0108 implements
[static presentation loading](static-page-loading-0108.md). Terry has approved
both cards and moved them to Completed.

Terry explicitly requested production publication for #0108's review. The verified
`e001e25` static bundle was published at
<https://backblaze-drive-stats-analysis.pages.dev/>. The publication receipt retains
the accepted #0104 deployment as the rollback target; publication does not mark
#0108 approved or Completed. Terry subsequently reviewed and completed it.

Terry selected #0109 for this turn. Its
[cache policy and publication compatibility gate](cloudflare-hosting.md#cache-policy)
preserve immutable URLs while adding 24-hour caching for unversioned successes.
Terry has approved #0109 and moved it to Completed. Follow-up #0112 investigates
[HTML reload validators](cloudflare-hosting.md#html-reload-validation-0112).
Its verified static candidate obtains body-free `304`s at the cost of HTML
compression. Terry chose to retain compression, resolving #0112 without a
production change, and moved it to Completed. He then explicitly resumed #0101
for its dedicated cold-quarter rehearsal. The [benchmark and operator record](quarterly-refresh-benchmark-0101.md)
documents fresh intake, verified B2 retention and catalog discovery, exact local
recovery and production publication. Release `d402829` was published as deployment
`f290ba5d-abd1-4398-b0c3-f38b164fe0b4`; the prior deployment is preserved for rollback.
Terry approved #0101 and moved it to Completed on 2026-11-01. Its closeout roster
had no remaining implementation or review handoff. Architecture ideas #0110/#0111
remain unstarted in Backlog.
Optional #0107 is Terry-owned research in Backlog, not Bot work or a release gate.
Planning does not start those cards or authorize later source work or publication.
Completed lanes remain owner-controlled.

Terry selected #0113 after the closeout. Its [startup-feedback record](matrix-startup-0113.md)
documents a prompt, accessible loading indicator followed by the complete stable
view. The original renderer is retained because the measured cleanup did not
establish a reliable speedup. The larger indicator now fades out over 150 ms,
then the complete view fades in over 200 ms; reduced motion switches immediately.
Source `069a245` is live as production deployment
`c5d1535d-6d69-4e95-811f-c845b27ecc02`; the full hosted union is verified
and `28006713` remains its rollback predecessor. The focused capture verifies
sequencing and stable geometry, while skipped early fade frames limit claims
about smoothness. Terry approved #0113 and moved it to Completed on 2026-11-01;
#0101 and #0112 remain owner-Completed.

#0115 replaces the separate navigation layouts with one shared collapsible menu
for all six published views. The [navigation handoff](navigation-0115.md) records
route/context retention, responsive and keyboard behavior, independent review,
227 web tests, 59 browser checks and exact-source CI. Source `9660065` is live as
deployment `8e871449-c5d1-42c9-888f-4157b15406d0`; all 3,230 hosted assets passed
verification, and predecessor `c5d1535d` remains retained for rollback. #0115 is
ready for Terry's review; #0113 remains owner-Completed.
