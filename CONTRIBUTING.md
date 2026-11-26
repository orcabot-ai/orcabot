# Contributing

English · [简体中文](CONTRIBUTING.zh-CN.md)

Discuss large behavior changes in an issue before opening a pull request. Describe
the problem, intended behavior, boundaries and checkable acceptance criteria.
Use Node 24/26 and pnpm 11.25.0, then run `pnpm install --frozen-lockfile`.

Before submitting run `pnpm check`, `pnpm format:check` and, when dependencies change,
`pnpm licenses:report`. Add behavior tests proportional to risk. No paid provider
calls or native service registration in ordinary test runs. Explain OS-specific
checks and skipped coverage honestly. Never commit keys, databases or transcripts.

Keep original execution identity/recovery, authentication, transaction and evidence
invariants intact. UI changes need desktop/mobile and light/dark inspection.
Maintain English and Chinese documentation together; English is the default.
Use Conventional Commit subjects. PRs should explain behavior, risks and validation.

Your original contributions are submitted under MIT. Preserve upstream licenses,
notices and provenance for imported code; never relabel third-party code as MIT.
This checkout keeps octo-spec and generated agent integrations local and ignored.
