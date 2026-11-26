# Licensing and dependency distribution

English · [简体中文](../zh-CN/licensing.md)

Original Orcabot code, documentation and owner-supplied assets are MIT. The imported
cross-service package, imported tests and upstream CLI adaptations retain their
Apache-2.0 license, attribution and change notices. Root MIT does not relicense
those portions. See the package-level LICENSE and UPSTREAM files.

Run `pnpm licenses:report` to regenerate the dependency inventory in
[THIRD_PARTY_NOTICES](../../THIRD_PARTY_NOTICES.md). License and NOTICE texts stay
in the upstream packages rather than a generated repository directory. It covers
installed development/production dependencies on the current platform; regenerate
on every distribution platform for optional binaries. It does not inventory the
separately installed Runtime, harness executables or model service terms.

Review findings include MPL-2.0 lightningcss build tooling/native code and CC-BY-4.0
caniuse-lite data. Preserve their notices and attribution; redistribution or
modification of covered MPL files requires the corresponding-source handling
specified by that license. See each package's source and license texts.
Other recorded expressions include MIT, Apache-2.0, ISC, BSD-3-Clause, BlueOak-1.0.0,
Python-2.0, Unlicense and 0BSD. A permissive project license does not remove these
component-specific obligations. Verify the actual contents before distributing
bundled executables, browser assets or a future desktop application.

The supplied logo and derived transparent variants are in `apps/web/public/brand`.
The project asset license does not imply endorsement of downstream projects.

Primary terms: [MIT](https://opensource.org/license/mit),
[Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0),
[Mozilla MPL FAQ](https://www.mozilla.org/en-US/MPL/2.0/FAQ/),
[CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/).

One installed package, abstract-logging 2.0.1, declares MIT and an author license
URL but publishes no standalone license text. Its manifest/source link and this
gap remain recorded rather than inventing a replacement copyright notice.

The self-hosted Manrope Variable font is OFL-1.1. Its upstream license text is shipped in `apps/web/public/fonts/Manrope-OFL.txt` and copied into the web distribution. Base UI primitives retain their MIT dependency license.
