# Versioning and releases

English · [简体中文](../zh-CN/releases.md)

Orcabot follows OctoRuntime's release model: source package versions stay at
`0.0.0`; an annotated `vX.Y.Z` tag selects an immutable stable release. Private
workspace packages are assembled into one standalone distribution. The CLI
always reports its version, source commit and UTC build time.

`release.config.json` selects the npm package name. The current proposed name is
`@orcabot-ai/orcabot`; verify npm scope ownership before the first publication.
The GitHub repository currently remains private. npm provenance is enabled only
for a public source repository because [npm does not support provenance for private repositories](https://docs.npmjs.com/trusted-publishers/).

## Verify a checkout

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm format:check
pnpm e2e
pnpm pack:release --version 0.0.0
pnpm verify:release dist/release/orcabot-ai-orcabot-0.0.0.tgz
```

The placeholder archive is for verification and cannot pass production publication.
`prepack` rejects direct workspace-root publishing. The assembled archive bundles
production dependencies, compiled CLI/worker and web assets, root MIT license,
Apache adaptation notices, third-party notices and Manrope's OFL text. It contains
no workspace links, local database, key, project integration or source checkout.

Verification installs the archive offline with an empty npm cache, starts its own
worker in remote-execution mode and its own web service on ephemeral loopback
ports, then checks SQLite-backed state, authentication and the HTML shell. It
installs no Runtime, changes no existing service and makes no provider calls.
This is a Linux CI and local macOS smoke test, not Windows release certification.

## Publish a version

1. Confirm `release.config.json`, npm ownership and the intended version. Configure
   a least-privilege `NPM_TOKEN` in this repository's GitHub Actions secrets. Never
   put a token in the checkout or an issue.
2. Wait for the intended main-branch commit's **CI Gate** to pass.
3. Create and push an annotated tag, for example:

   ```sh
   git tag -a v0.1.0 -m "Release v0.1.0"
   git push origin v0.1.0
   ```

The Release Publish workflow validates stable SemVer, annotated-tag identity and
main-branch ancestry. It reruns Node 24/26 CI at that exact commit. The release's
build time is the commit's UTC timestamp, so retries use the same provenance.
Only the Node 24 verified archive is uploaded to npm and attached to GitHub Release.

Publication first checks an existing npm version's SHA-512 integrity. A matching
archive can be recovered; differing bytes fail without overwrite. The GitHub asset
check likewise refuses replacement. A version-specific npm dist-tag is applied
before the global `latest` tag; older stable releases never roll `latest` back.
The workflows serialize publication. GitHub Release is created only after npm
publication is confirmed.

## Dry-run and recovery

Use **Actions → Release Publish → Run workflow**, supply an existing annotated
tag and select `dry-run`. This validates and assembles the release without npm
uploads, dist-tag changes or GitHub Release publication. A clean tag is required.
Choose `recover` to complete a partially published version using the same tag;
never move or replace the tag. Credential or registry failures remain failures.

No version or npm package was published as part of initial workflow setup.

Release builds normalize TanStack's root hydration cache timestamp to the fixed
build time. A second web/CLI build and pack must produce identical archive bytes;
CI rejects a changed serialization shape or mismatched bytes before publication.
