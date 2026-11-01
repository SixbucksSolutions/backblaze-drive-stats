# Explore datacenter capacity

The datacenter report consumes the accepted v2 supporting-quarter payload. Its
scope is always `all_supplied`: HDD, SSD and unclassified identities, independent
of the personal HDD selection or vendor/model filters.

Each normalized identity contributes once per quarter at its last observed
location. The browser uses the validated aggregate directly; it does not infer
individual moves or reconstruct private identities. Unknown remains in totals and
both population and capacity share denominators.

The assignment semantics are defined in
[the accepted supporting report contract](supporting-report-contract.md#measures-and-denominators).
Frontend tests verify that the accepted allocations remain unchanged and
reconcile to all-supplied totals; they do not independently establish individual
source moves from aggregate JSON.

Capacity uses nominal decimal TB under the accepted identity capacity policy.
It is not quarter-end installed stock, usable storage, customer uploads or demand.
No geographic or causal interpretation is supplied.

The chart, full table and CSV use the same rows. The CSV includes raw numeric
fractions for population/capacity shares and known-location population coverage;
`Unavailable` preserves null metrics. The chart and table format those fractions
as percentages. Known population remains visible when capacity is unavailable.

Known-location coverage measures population, not capacity share. A positive
all-Unknown population has zero known-location coverage. Zero or unavailable
denominators yield unavailable shares and coverage. Incomplete quarters never
become exact zero totals.

Before 2023 Q3 the source datacenter field is unreported. The report explains this
and omits location bars, retaining the accepted Unknown counts/capacity in the
table and CSV. This is neither zero capacity nor evidence of flat growth.

For newer generations, a modern quarter whose captured source lacks the field
also reports Unreported and retains Unknown totals. A present field containing
only null values remains Reported with Unknown observations and zero known-location
coverage. Mixed captures remain Reported when per-file header evidence proves
the field was present in at least one partition; missing values remain Unknown.
Reported therefore does not imply every partition supplied a location value.

The generator reads header evidence from the checksum-bound import receipt in
the retained summary, identically for cold and retained inputs. Contradictory or
incomplete header evidence is rejected before publication. For legacy receipts
without header metadata, retained known locations prove field presence. A modern
all-Unknown legacy summary requires captured header evidence before generating a
new release: Unknown alone cannot distinguish an absent field from present nulls.
Existing immutable generations and retained cache identities are unchanged.
If a new generation needs additional header evidence, obtain it through verified
source intake and a new summary lineage. Existing verified receipts/manifests
remain immutable; an availability flag is not a substitute for capture evidence.
The receipt's all-files flag alone proves absence for a single captured file.
For multiple files, a false flag permits mixed headers and cannot prove absence;
per-file or column-union evidence resolves that distinction.
