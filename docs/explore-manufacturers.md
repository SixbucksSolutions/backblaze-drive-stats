# Manufacturer capacity and deployment shares

The Explore manufacturer report groups filtered `selected_hdd` model rows by
vendor. Its initial population is the full supporting HDD context, including
seeded, historical, subthreshold and evidenced new-vendor models.

- Count sums distinct drive identities observed per model anywhere in the reporting quarter.
- New sums first recorded identities in supplied history, including its initial
  observed fleet. It does not establish installation dates.
- Raw capacity sums supplied model capacity aggregates in decimal TB.
- Population, first recorded and capacity shares divide each filtered vendor's
  metric by the corresponding unfiltered whole selected-HDD quarter metric.

Filters narrow numerators only. Filtered shares can sum to less than 100%.
A zero or unavailable denominator gives an unavailable share. Unavailable model
capacity makes that vendor's capacity unavailable while preserving known Count
and New. Incomplete coverage makes observations and shares unavailable. These are
selected-context shares, not market share or a physical-fleet census.

The capacity chart previews up to eight vendors with available capacity. The
sortable table and CSV retain every filtered vendor, including zero and unknown
values, without a synthetic Other vendor. Unknown numeric values sort last in
either direction. The table provides the chart's accessible numeric equivalent.
CSV retains numeric TB and fractional shares without display rounding, plus each
whole-context denominator. The shared Explore shell attaches snapshot, quarter,
coverage, source and filter metadata.

The report tests check independent sums, distinct denominators, filtered
numerators, known counts with unavailable capacity, zero and partial coverage,
new vendors, escaped labels, sorting and chart/table/export completeness. They
also reconcile every manufacturer metric and share against accepted public
supporting payloads for the 2026 Q2, 2025 Q3 and 2025 Q4 as-of cuts. These checks
read public aggregates only.
