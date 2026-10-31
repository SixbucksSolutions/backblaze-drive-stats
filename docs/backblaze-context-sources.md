# Backblaze context for quarterly discovery and analysis

Owner clarification during #0014: use Backblaze's own writing as primary evidence
for drive classification, new model/vendor announcements and operational context.
This supplements the all-source inventory scan. It does not implement article
ingestion or the future Sol analysis stage (#0020).

## Initial sources

- [Backblaze Drive Stats, 2026 Q2](https://www.backblaze.com/blog/backblaze-drive-stats-for-q2-2026/),
  published September 29, 2026. The report discusses retirements and deployment
  concentration in higher-capacity drives. It states no new models entered during
  that quarter. Its quarterly table requires more than 100 drives and 10,000
  drive-days; those criteria differ from this project's 2,000-drive convention.
- [10 Stories From 10 Years of Drive Stats Data](https://www.backblaze.com/blog/10-stories-from-10-years-of-drive-stats-data/),
  published April 10, 2023. Its boot-drive section explains that boot records share
  the dataset and that drive role/type had to be identified by model. Historically,
  boot drives included HDDs as well as SSDs. It also explains recorded drive-days
  and limitations at the start of the dataset.
- [The SSD Edition: 2021 Drive Stats Review](https://www.backblaze.com/blog/?p=104968),
  published March 3, 2022. Backblaze identifies the SSDs in that report as boot
  drives and discusses their distinct workloads. This supports excluding SSDs
  from the owner's HDD comparison; do not generalize a dated report into a claim
  about every SSD workload throughout Backblaze's business forever.

Use the [Drive Stats archive](https://www.backblaze.com/blog/category/hard-drive-stats/)
to find relevant reports and deep dives, rather than treating every blog post as
relevant. Credit Backblaze and link the original post beside any contextual claim.

## Quarterly use

- A new-brand/model announcement is a **candidate discovery flag**. Reconcile its
  model names/aliases and HDD classification with source observations, then apply
  this project's >=2,000 unique observed drives per complete quarter rule. An
  article is not required for a qualifying model to be discovered or admitted.
- A model mentioned in a report may already exist below threshold; an omission
  may reflect the article's population/exposure filters. Neither proves absence
  from the raw dataset. Investigate disagreement between announced models and the
  inventory; do not silently replace either with the other.
- Use cited operational explanations as Backblaze's statements. Keep them distinct
  from calculated observations and Sol's hypotheses. Validate quoted numerical
  claims; blog prose and tables can contain typos and may use different populations.
- Retain article URL/title, publication date, relevant data period, retrieval/source
  revision and the claim it supports. An article published after quarter-end can
  explain that quarter; expose its publication date rather than claiming it was
  known at the measurement cutoff. Never use later observations to change an old
  data snapshot silently.
- SSDs are outside the owner's selected HDD cohort regardless of population.
  Media classification and boot/data role are separate facts; a historical boot
  HDD must not be mislabeled an SSD. The generator's classification policy must
  record available role evidence; handling any newly identified boot-HDD cohort
  should be explicit rather than assumed from a model-name or capacity heuristic.

The quarterly generator (#0016) owns inventory/classification and reconciliation
against any retained announcement evidence. The future Explore enhancement
(#0020) owns selecting relevant prose, citations and Sol-authored observations for
the output JSON. No new event overlays, financial ingestion, unrelated blog crawl
or backend API service is introduced into the flagship scope.
