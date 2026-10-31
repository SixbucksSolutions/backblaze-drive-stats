# Greenfield quarterly generator assessment

Decision proposal for #0011, 2026-10-30. This supersedes the selection basis in
[the earlier assessment](quarterly-generator-recommendation.md). Existing code is
requirements evidence only: reuse, porting effort and sunk cost receive no weight.
This proposal does not authorize a rewrite or settle the flagship's metric rules.

**RECOMMENDED: Python + Polars lazy expressions, quarter-partitioned Parquet, and
standard-library ZIP/JSON orchestration.** Confidence is moderate. This is a
greenfield productivity and maintenance choice, not a claim that Python is the
fastest language or that this stack has won a representative benchmark.

There is no compelling performance reason to insist on Python. C#/.NET with
DuckDB is a close alternative; Python with DuckDB is also credible. A concrete
preference for SQL, typed application code, or distribution as a compiled tool
can change the choice without compromising reasonable efficiency.

## What actually consumes time

The representative quarter contains about 32 million daily observations in a
2 GB ZIP, with 197 CSV columns but only six needed for the current outputs. The
main work is decompression, parsing, projection, hash aggregation, joins, distinct
identities and historical state. It is not primarily dense numerical simulation.
The ratio used for AFR is inexpensive after the exposure and failure totals exist.

Separate the host from the engine. Python, C#, Go, Rust and TypeScript can all
orchestrate a native analytical engine. Python Polars expressions execute through
Rust machinery; a Python loop over every observation is a materially different
design. Calling equivalent Polars operations directly from Rust does not itself
establish a speed advantage. Conversely, bespoke parsing and per-record logic
can make the host language consequential. [Polars overview](https://docs.pola.rs/),
[native expression guidance](https://docs.pola.rs/api/python/stable/reference/expressions/index.html).

C# is a serious performance candidate. Modern .NET compiles application methods
to native code through its JIT and optimizes code generation, allocation and hot
loops. Native AOT is an additional deployment option; it is not automatically a
throughput improvement for this batch job. Start with ordinary self-contained JIT
publishing and evaluate AOT only for a concrete distribution need. Libraries and
native assets must be checked in the published artifact. [.NET 10 runtime](https://learn.microsoft.com/en-us/dotnet/core/whats-new/dotnet-10/runtime),
[Native AOT](https://learn.microsoft.com/en-us/dotnet/core/deploying/native-aot/).

## Concrete candidates

| Stack | Greenfield strengths | Material tradeoffs |
| --- | --- | --- |
| Python + Polars | Compact analytical expressions, native columnar execution, direct CSV/Parquet facilities, standard ZIP and JSON tooling, straightforward experimentation and tests | Python environment distribution; runtime dataframe schemas; memory behavior depends on execution plan and engine version |
| Python + DuckDB | Small orchestration layer with native SQL scans, grouping, joins and windows; mature disk spilling; direct Parquet and JSON capabilities | SQL/result schemas need runtime checks; Python packaging; staging and native memory still need a budget |
| C#/.NET + DuckDB | Typed orchestration and output records, efficient managed runtime, standard ZIP/JSON APIs, self-contained Windows/Linux publishing, native SQL computation | DuckDB.NET has secondary upstream support; native assets and deployment must be tested; SQL column types remain runtime contracts |
| Go + DuckDB | Small explicit host, standard ZIP/JSON libraries, native SQL computation and a deployable compiled application | DuckDB integration uses cgo and a C compiler; native-library builds differ from pure-Go cross-compilation; SQL typing remains a runtime boundary |
| Rust + Polars | Direct native dataframe API, strong domain/output types, native delivery and control over custom processing | Larger build and feature-management surface; Rust dataframe API changes may occur without advance deprecation; dataframe schemas remain runtime concerns |
| Rust + DuckDB or DataFusion | Compiled host with a native SQL engine; useful integration/customization options | Native build/linking or Arrow/engine integration work; no demonstrated requirement for engine customization here |
| TypeScript + native Polars or DuckDB | Typed orchestration and native aggregation; optional shared JSON/domain definitions with the website | Node/native-addon distribution and integer conversion; binding coverage/version must be verified independently of other language bindings |

DuckDB documents spilling for grouping, joining, sorting and windows, with
remaining out-of-memory cases. Its memory setting is not a universal process-RSS
limit. Polars documents streaming with potential in-memory fallback. Its recent
2.1 release adds important out-of-core operations, but support must be established
for the selected binding/version and actual plan. These are reasons to evaluate
plans and resource limits, not declare either engine infallible.
[DuckDB workload guidance](https://duckdb.org/docs/2.0/guides/performance/how_to_tune_workloads),
[Polars streaming](https://docs.pola.rs/user-guide/concepts/streaming/),
[Polars 2.1](https://pola.rs/posts/polars-2-1-changelog/).

DuckDB currently gives primary support to Python, Go, Rust and Node clients;
.NET has secondary support. This affects dependency ownership, not the native
engine's speed. The Go client statically links prebuilt DuckDB libraries on common
platforms but requires cgo. The Rust binding can use a prebuilt/system library or
compile bundled C++ source. Rust Polars' API stability policy is a separate
maintenance consideration. [DuckDB clients](https://duckdb.org/docs/current/clients/overview),
[Go client](https://duckdb.org/docs/current/clients/go/overview),
[Rust DuckDB](https://github.com/duckdb/duckdb-rs),
[Polars versioning](https://docs.pola.rs/development/versioning/).

Custom streaming implementations in C#, Go, Rust, C++ or Java can be efficient.
They also make this project responsible for the aggregation algorithm, string
dictionary/state layout, history joins and any external-memory strategy. Neither
language reputation nor strong host types substitutes for validating those rules.
Java/JDBC with DuckDB is another viable engine-backed design; nothing in the
requirements establishes an advantage sufficient to prefer it over the shortlist.

## Why this recommendation survives the greenfield reset

The reasons are analytical iteration, a concise transformation API, mature native
dataframe facilities, straightforward ZIP orchestration and low host/build
complexity for a single quarterly operator. None depends on retaining existing
source. Python should construct plans, handle files and serialize small outputs;
it should not allocate a Python object for each daily observation or perform the
large aggregations in Python loops.

The two fresh independent assessments did not name a unanimous stack winner. The
compute assessment favored DuckDB SQL with a thin host because of resource-control
facilities, and explicitly declined to choose a host based on engine throughput.
The operations assessment favored Python/Polars on greenfield analytical iteration
and maintenance, with C#/.NET + DuckDB close behind. The primary's recommendation
weights the latter criteria for this non-real-time workload. Memory-constrained
historical processing or a strong SQL preference could favor DuckDB instead.

Rust and Go are not rejected as slow or unsuitable. Their compiled distribution
and host-language benefits are real; they simply do not establish an end-to-end
advantage for this workload by themselves. C#/.NET is equally eligible if its
typed development and deployment model are preferable. No benchmark winner has
been established among these complete stacks.

## Suggested dependencies

For the default proposal, use one supported Python version, `polars`, `uv` for a
locked environment, and standard-library `zipfile`, hashing, filesystem and `json`
facilities. Polars supplies the core Parquet path; pandas, PyArrow and a running
database server are not inherent requirements. Select and pin versions during a
dedicated compatibility/resource check rather than assume current engine features.

For C#/.NET, the corresponding narrow stack is the supported LTS .NET runtime,
`DuckDB.NET.Data.Full`, `System.IO.Compression`, `System.Text.Json` and SQL. The Full
package supplies the native DuckDB library. Prefer native engine file ingestion
and small typed result sets; test binding type conversions and platform publishing.
Avoid AOT and additional dataframe/CSV libraries until a requirement justifies
them. [DuckDB.NET setup](https://duckdb.net/docs/getting-started.html).

For Go, use `github.com/duckdb/duckdb-go/v2`, `database/sql` and the standard ZIP/JSON
libraries, with the required native build toolchain. For Rust/Polars, the core
crates would be `polars`, `zip`, `serde`/`serde_json`, `regex` and a CLI library such
as `clap`, with only the required engine features enabled. These are viable
alternatives, not dependencies to add to the Python proposal.

## Architecture and validation carry more weight than a language label

1. Ingest and validate each source quarter once; retain a private projected cache.
2. Persist sufficient quarter/drive summaries, capacity frequencies and source
   coverage so future jobs do not repeatedly decompress all historical ZIPs.
3. Derive the model-relative matrix from those summaries. Preserve calendar
   coordinates, failure-flag sums, normalization parity and actual exposure.
4. Keep input/cache versions and a deterministic rebuild path. Corrected or newly
   backfilled quarters must invalidate affected lifecycle/cumulative results.
5. Validate and publish small aggregate-only JSON through immutable generation
   paths and a final manifest switch.

The history window, relative-quarter anchor, minimum population treatment and
inferred-decommission definition remain owner decisions. They are requirements
to resolve for the flagship, not reasons to favor any implementation language.

Before committing to the full generator, measure a representative end-to-end
candidate against the same input, correct outputs, core/memory budget and history
cases: elapsed time, peak resident memory, spill/temp disk and packaging success.
A comparison of different engines measures the complete stacks; it cannot be
reported as proof that one host language is faster. No comparative benchmark,
compiler installation, implementation rewrite or cloud execution was performed
for this assessment.
