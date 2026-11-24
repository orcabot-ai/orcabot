# Upstream provenance

Imported from [Mininglamp-OSS/octo-runtime](https://github.com/Mininglamp-OSS/octo-runtime),
`packages/octo-runtime-cross-service`, at commit
`67a44ebc4a421e53aa0f22994157b2b6cd6c036c` (2026-11-24).

Copyright 2026 Mininglamp Technology. Licensed under Apache-2.0; see [LICENSE](LICENSE).
This is a source import, not a dependency on an unpublished SDK subpath.

Local changes: renamed the package and description, added the standard workspace
export/typecheck configuration, adapted documentation paths, translated comments
to English, and applied repository formatting. Runtime logic is retained.
Upstream lifecycle, failure, runner, and platform-native tests are retained under
`tests/cross-service`; imports point at this package. The Unix fixture helper keeps
only the helper these tests need. Native service lifecycle tests require `ORCABOT_TEST_NATIVE_SERVICES=1`;
OctoRuntime CLI-specific assertions were removed because its CLI was not imported; unsupported platforms are not represented as verified.

No native service is installed by importing the package or selecting a backend.
Application-level CLI integration is separate work.

The imported test suite also adds a single-credential-argument regression case,
verified by an inverted-condition mutation. This extends test coverage without
changing runtime validation behavior.
