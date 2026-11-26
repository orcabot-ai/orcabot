# CLI conventions

The Commander help layout, help/version header, UTC build timestamp validation and
Git provenance generator are adapted from
[Mininglamp-OSS/octo-runtime](https://github.com/Mininglamp-OSS/octo-runtime) at
`67a44ebc4a421e53aa0f22994157b2b6cd6c036c`, under Apache-2.0 (see [LICENSE](LICENSE)).
Reference files: `apps/cli/src/command-tree.ts`, `help.ts`, `main.ts`, `output.ts`
and `scripts/write-build-info.mjs`.

Orcabot uses the same help sections, text/JSON channel convention and build header
format, with its own product description, commands, validation and package version.
Its advanced Runtime commands invoke the original installed CLI; they do not copy
its native service-management implementation. Automatic worker startup prepares
the dependency and checks readiness through the public client SDK.
