[English](operational-continuity.md) · [简体中文](../zh-CN/operational-continuity.md)

# Operational continuity

This M1 slice adds durable observation recovery, an operator attention view and
artifact references. External channels and SOP scheduling are subsequent work.

## Recovery contract

Before submitting to a Kernel, persist the original lookup identity and expected
Kernel instance. Persist its accepted reference when available. Store the upstream
cursor in the same SQLite transaction as each canonical event. Application event
sequences and upstream sequences are independent: recovery notices must not shift
the cursor used to read a remote bridge or Kernel stream.

A restarted controller marks interrupted work unknown, then attempts bounded
observation recovery for saved checkpoints. Local recovery queries the original
identity on the expected Kernel instance and subscribes after its saved cursor.
Remote recovery queries the original bridge run and reads after its saved cursor.
Neither path resubmits the invocation. Unknown work without a saved identity,
expired history, changed Kernel identity or an unavailable execution remains
unknown and visible for operator investigation. The operator can explicitly retry
observation; this action never retries the business prompt.

The control service stores an immutable target snapshot with each execution.
Target credentials and checkpoint data are never returned to browser APIs.
Recovery uses the saved target, so editing future configuration cannot retarget
an existing execution. The same concurrency budget covers new and recovered work.
Closing a service stops observation without cancelling the execution host's work.

## Attention and review

Pending interactions, failed runs and unknown outcomes appear in a bounded
attention view. Operators can open the source conversation, recover observation
or acknowledge investigated failures/unknown outcomes with a note. Acknowledgement
pins the last observed event sequence and fails on a stale version. It never
changes the execution result, unblocks an unknown conversation or suppresses a
pending approval. New events invalidate an older acknowledgement. Review notes
remain persisted as an audit history.

## Artifacts

A run can reference a file/object/HTTP location with a name, optional media type,
summary and SHA-256 digest. Attaching a reference does not cause the server to
open a local file or fetch a URL. The reference remains unverified metadata;
artifact content validation and business acceptance belong to a future delivery
workflow. Browser links are limited to HTTP(S); file and object-store locations
are displayed as text.

## Compatibility

The schema migrates existing M0 databases without dropping their records. M0
runs whose upstream identities were not saved remain readable; the application
cannot safely recover them by inventing a new execution. No provider credentials
or paid calls are needed for automated recovery tests.

## Workbench implementation

The owner selected the TanStack stack for this slice: Start in SPA mode, typed
Router conversation URLs, Query read caches/mutations, Form operator inputs,
Table attention records and Virtual long conversation rows. Fastify continues to
serve the authenticated API, durable SSE and static shell. Both Light and Dark
themes, plus System mode, cover every workbench surface. See [frontend architecture](frontend.md).
