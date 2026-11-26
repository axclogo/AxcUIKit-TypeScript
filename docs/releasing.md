# Releasing to npm

`@axc/uikit` publishes from GitHub Actions with npm Trusted Publisher (OIDC). The workflow never reads an npm token,
and trusted publishing automatically creates npm provenance for this public package.

## npm Trusted Publisher settings

Configure the package on npmjs.com with these exact values:

| Setting              | Value                 |
| -------------------- | --------------------- |
| Provider             | GitHub Actions        |
| Organization or user | `axclogo`             |
| Repository           | `AxcUIKit-TypeScript` |
| Workflow filename    | `publish.yml`         |
| Environment          | _(empty)_             |
| Allowed action       | `npm publish`         |

Do not create an `NPM_TOKEN` GitHub secret. The publish job has `id-token: write`, uses a GitHub-hosted runner and runs
`npm publish` without `NODE_AUTH_TOKEN`. The npm CLI exchanges the workflow identity for a short-lived credential.

## Automatic release procedure

1. Update `CHANGELOG.md`, `package.json` and `package-lock.json` to the same version.
2. Push or merge the version commit to `main`.
3. Wait for CI to pass. **Publish to npm** starts from that successful CI run and checks out the exact tested commit.
4. If that version does not exist on npm, the workflow verifies, packs and publishes it. If it already exists, the
   workflow exits successfully without republishing.
5. Confirm the npm version, package files and provenance link on npmjs.com.

`scripts/check-publish.mjs` rejects incorrect package names, repository metadata, registry or access before the workflow
installs dependencies. It distinguishes an unavailable Registry from a missing package or version; network failures are
errors, never interpreted as permission to publish. The workflow then runs the same `npm run verify` gate as CI and
prints the final tarball contents before publishing.

npm versions are immutable. An ordinary `main` push with no version change is intentionally a successful no-op; the
workflow must not guess or auto-increment a version that is absent from source control.

## First publication only

npm requires a package to exist before a Trusted Publisher can be attached. If `@axc/uikit` does not yet exist, an npm
maintainer must create version `0.6.0` once using npm's interactive account authentication and `npm publish --access
public`. Do not put a token in this repository or GitHub. Until the package exists, the workflow reports `bootstrap` and
skips publishing without failing CI. Immediately configure the Trusted Publisher above and log out; all later versions
must use pushes to `main`.
