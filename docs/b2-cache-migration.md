# First durable processing-cache copy

Localswim #0057 follows the owner-accepted 2026 Q1 pilot (#0027) and real B2
connection check (#0056). This migration copies retained processing bytes;
it does not recompute source data or publish website JSON.

## Verified result

The reviewed migration completed in **160.72 seconds** on 2026-10-31:

- Initial copy: 192 objects uploaded and verified by readback.
- Full repeated copy: zero writes, 192 verified reuses.
- Separate-root restore from the remotely retrieved manifest: all 192 verified.
- Restored 2026 Q1 and Q2 enriched summaries were cache hits with logical daily
  reads forbidden (351,095 and 359,101 model/serial identity rows respectively).

The recovery manifest itself is retained in B2 and verified against its
content-addressed name. Original local files remain intact; no deletes occurred.
The elapsed time covers copy, readback, repeat verification, manifest storage,
separate restore and restored-cache checks, rather than upload speed alone.

## Reviewed scope

The private manifest lists **192 objects / 406,709,538 bytes (387.9 MiB)**:

- 181 daily Parquet files covering all 90 days of 2026 Q1 and 91 days of 2026 Q2.
- Two original import receipts.
- Nine summary objects/manifests: the enriched Q1 variant, original Q2 variant
  and enriched Q2 variant.

The largest object is 2,486,593 bytes. The payload is below the 1 GiB execution
cap and every object is below the adapter's 128 MiB limit. Repeated verification
and restoration transfer more bytes than the retained payload; the cap is not
a network-traffic limit. No CSV is extracted or Parquet rewritten. The older
Q2 projection and legacy summary retain their original physical metadata.

The exact transfer manifest SHA-256 is
`0fb27251ded8bfc3f4edaf004b33ae70902b8a8a301540f37e3c5d0ecc39df75`.
The private prepared manifest, inventory and execution evidence live under
ignored `data/staging/0057/`. Connection settings and credentials remain private.

Raw ZIPs, workbooks, generation timestamps, public snapshots, environments,
temporary files/locks and active 2025 Q4 work are excluded. The source ZIPs
remain local and can be downloaded again from Backblaze; this copy protects the
expensive reusable processing results. It is not an archive of the entire laptop.

## Transfer and recovery procedure

1. Verify complete receipt calendars, summary manifest self-hashes, summary
   object hashes and exact daily partition lineage before building the manifest.
2. Independently review the explicit source list, object sizes, content hashes,
   destination scope and transfer procedure before cloud writes.
3. Use one writer and the accepted private bucket/prefix. Verify source bytes,
   upload missing objects and read back actual remote bytes to verify SHA-256.
4. Repeat the complete manifest and require every object to be reused with zero
   new writes. ETags and checksum metadata alone are insufficient.
5. Store the content-addressed recovery manifest in B2 only after every object
   verifies. Read it back and verify its filename/content hash. Objects from an
   interrupted upload remain uncommitted until the complete manifest verifies.
6. Fetch that recovery manifest from B2 and restore all listed objects to a
   separate local root. Verify every restored byte, then require both enriched
   quarter summaries to be valid cache hits with logical daily reads forbidden.

The relative hierarchy preserves `processed/<quarter>/...` and
`history-cache/quarters/<quarter>/...` beneath the configured cache prefix.
Recovery needs the configured bucket/prefix and a key authorized to read them.
Find the content-addressed manifest in that prefix's `manifests/` directory;
verify its SHA-256 before using its paths. The generic transfer primitive is
documented in [history-storage.md](history-storage.md). Restore the hierarchy
under a new local data root and use the matching semantic code/config versions.
The manifest is stored remotely so recovery does not depend on its local copy.

Keep a completed source version stable in its destination namespace. Future
source corrections or semantic replacements need a new versioned namespace;
they must not overwrite objects referenced by an earlier recovery manifest.
Appending a new quarter with new paths can preserve earlier manifests. The
adapter's corrupt-object repair path is not permission to revise valid history.

Local source files remain intact. No remote or local delete operation is part of
this migration, and no retention or Object Lock setting is changed. B2 is the
durable object home; independent Glacier backup remains later backlog work.

Object-level transfer supports retry by verified content. This one-run restore
wrapper requires a new restore directory; after an interrupted restore, inspect
the receipt and deliberately choose a fresh root or use the generic verified
transfer primitive to resume. Do not blindly rerun an operational wrapper.
