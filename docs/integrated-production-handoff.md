# Integrated production release handoff

Parent #0017 is ready for owner review following Terry's explicit acceptance of
#0094. The acceptance is recorded on #0094 without changing Terry's control of
Completed. The same applies to the accepted #0095 refresh workflow.

## Delivered scope

- The accepted source history contains 53 datasets across 54 requested periods:
  45 complete, eight partial and unpublished 2013 Q1. The retained history covers
  4,817 dates and 743,490,518 observations.
- The production release pairs the flagship AFR matrix with all five Explore
  views at 2025 Q3, 2025 Q4 and 2026 Q2. Its 161 public aggregate JSON files total
  14,845,031 bytes. Individual drive serial identities remain private.
- The flagship uses the accepted threshold, reporting-epoch and gap rules.
  Deployments, drive mix and manufacturer shares retain the supporting HDD
  context; capacity history and datacenters retain the labeled all-supplied
  scope. Missing periods, partial coverage and Unknown locations stay explicit.
- The maintained offline quarterly refresh supplies operator plan/run/verify,
  pinned inputs, retained reuse, explicit model admission and immutable recovery.
  Python generation and private storage stay separate from website hosting.

The foundation and six-view implementation cards #0084–#0093 are owner-Completed.
The final #0094 release validation and #0095 workflow are explicitly approved,
with their Ready for Review lanes held for Terry's later moves. Earlier source
cards and accepted research remain unchanged.

## Evidence and review

The [integrated review packet](integrated-release-validation.md) contains the
six-view localhost links, source/numerical audit, actual CSV downloads, keyboard,
responsive and loading checks. The [refresh runbook](quarterly-refresh.md)
contains the operational and recovery procedure.

The accepted implementation is commit
`6909087eb96aef5163c44f38df3935679a6d4c1a`.
[Windows and Linux CI passed](https://github.com/SixbucksSolutions/backblaze-drive-stats/actions/runs/41273844131),
including 236 Python tests, 113 web tests and the maintained quality/build gates.
The independent release audit reconciled 268,107 comparisons against retained
summaries; its CSV audit checked 927 exports and 36,283 numeric cells. Private
review evidence remains in `data/staging/0094/` and `data/staging/0095/`.

No new source processing or UI changes accompany this parent handoff. Its fresh
independent scope/acceptance audit is retained under `data/staging/0017/`.

## Preserved limits and next gate

The [workbook reconciliation](production-workbook-reconciliation.md) still has
832 unexplained AFR/rate-delta cells under conditional Count/chronology mappings.
This release claims neither workbook equivalence nor lifetime reliability.
Native screen-reader certification and general device/network performance are
not established. #0096's accepted replication setup does not establish initial
copy completion or restore integrity.

Terry's review and acceptance of parent #0017 is the remaining release step.
Hosting #0007 remains Ready for Work until that acceptance. Its later package
must resolve the actual account/domain/access as needed; live deployment and
account/resource changes retain separate authorization. #0097 asset
minimization stays last, behind accepted #0007, #0017 and #0094. See the
[remaining delivery plan](remaining-delivery-plan.md).
