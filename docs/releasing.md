# Releasing to npm

`@axc/uikit` is released from `main` by `.github/workflows/publish.yml`. The workflow uses npm Trusted Publisher
(OIDC), contains no npm credential and never falls back to a token. Trusted publishing creates npm provenance for the
public package automatically.

## Release guarantees

- A push to `main` must pass the complete `CI` workflow before the publish workflow can run.
- The publish job accepts only a successful `push` run for `main` from this repository and checks out its exact tested
  commit. It refuses to publish if that commit is no longer the current `origin/main`.
- The job uses a GitHub-hosted runner, does not restore a dependency cache and does not persist checkout credentials.
- The package name, version, repository, public registry, public access and lockfile metadata are validated before
  dependencies are installed.
- Registry failures, malformed Registry data, missing bootstrap configuration and release-gate failures are errors.
  They are not converted to a publish decision.
- npm versions are immutable. An existing version is a successful no-op; the workflow never guesses or increments a
  version.

This automation does not create versions, edit the changelog, create Git tags or GitHub Releases, recover an npm
version, or bypass npm authentication. Those operations require an explicit maintainer decision.

## One-time npm setup

### 1. Create the package

npm requires the package to exist before its settings can hold a Trusted Publisher. A maintainer must create the first
version once using interactive npm account authentication:

```sh
npm ci
npm run verify
npm pack --dry-run
npm publish --access public
```

Do not put the interactive credential in this repository, `.npmrc`, GitHub Secrets, a document or a command transcript.
Log out after the bootstrap publication. Until this is complete, the automatic workflow reports `bootstrap` and fails
explicitly so an unpublished release cannot appear successful.

### 2. Configure Trusted Publisher

Open the package settings on npmjs.com and add this connection:

| Setting              | Value                 |
| -------------------- | --------------------- |
| Provider             | GitHub Actions        |
| Organization or user | `axclogo`             |
| Repository           | `AxcUIKit-TypeScript` |
| Workflow filename    | `publish.yml`         |
| Environment          | _(empty)_             |
| Allowed action       | `npm publish`         |

Enter the filename only, not `.github/workflows/publish.yml`. Values are case-sensitive. A newly created Trusted
Publisher must complete its first successful publish within npm's two-day activation window. Existing connections are
immutable; replace a wrong connection instead of trying to edit it.

The manual bootstrap version does not activate a connection that is configured afterwards. Create the Trusted
Publisher only when the next reviewed version is ready, then push that new version within two days and confirm that the
OIDC workflow publishes it. Do not expect a rerun of the already published bootstrap version to exercise OIDC.

Do not create `NPM_TOKEN` or set `NODE_AUTH_TOKEN`. The job's `id-token: write` permission lets npm CLI exchange the
workflow identity for a short-lived publish credential. Trusted Publisher requires a supported npm CLI and
GitHub-hosted runner; the workflow fixes Node to version 24 and disables the setup-node package cache.

## Preparing a release

The release commit is the source of truth. Before merging or pushing it to `main`:

1. Choose a stable SemVer version deliberately according to the compatibility impact. Do not reuse a published version.
2. Set the same version in `package.json`, the top level of `package-lock.json` and the lockfile root package.
3. Add the user-visible implementation or protocol changes to `CHANGELOG.md`.
4. Run `npm ci` when dependency metadata changed, then run `npm run verify`.
5. Optionally run `npm pack --dry-run` and inspect the included files for a high-risk packaging change.
6. Review the release diff. It must not contain credentials, local paths, generated archives or unrelated changes.
7. Merge or push the reviewed commit to `main`.

Public API and protocol issue-code changes are already subject to the repository release gate: they require an API
reference update, changelog entry and package version bump. Do not lower coverage, size or API gates for a release.
Prerelease versions are rejected until the project defines an explicit npm dist-tag policy; they must never silently
replace `latest`.

## Automated decision table

After `CI` succeeds, `scripts/check-publish.mjs` reads the public npm Registry and produces exactly one state:

| Registry result                                | State         | Workflow result                                                |
| ---------------------------------------------- | ------------- | -------------------------------------------------------------- |
| Package is absent (`404`)                      | `bootstrap`   | Fail with the one-time setup instruction                       |
| Exact `name@version` exists                    | `published`   | Succeed without installing, packing or publishing              |
| Package exists but the exact version is absent | `unpublished` | Install, run `npm run verify`, inspect the archive and publish |
| Timeout, non-404 error or malformed response   | no decision   | Fail; never reinterpret the error as permission to publish     |

An ordinary `main` push with no version change therefore runs the workflow but does not republish. A version change is
required for a new npm artifact.

## Security and repository controls

- Protect `main`: require review and the `CI` checks, restrict force pushes and limit who can merge release changes.
- Keep workflow permissions minimal. `contents: read` is the default; only the publish job receives `id-token: write`.
- Pin third-party workflow actions to reviewed full commit SHAs; keep the readable release tag in a comment.
- Do not add a token fallback. OIDC failure is a configuration or identity error that must remain visible.
- Do not enable dependency caching in the privileged publish workflow. It installs only from the committed lockfile.
- Do not change the workflow filename, repository name, owner or optional GitHub Environment without replacing the
  matching npm Trusted Publisher connection.
- Treat any npm credential that appeared in a file, chat, screenshot or log as compromised and revoke it immediately.
- Review changes to `.github/workflows/publish.yml`, release scripts, `package.json` and `package-lock.json` as
  release-authority changes.

The `workflow_run` trigger has elevated OIDC capability. It is constrained to successful same-repository `main` pushes;
do not broaden it to pull-request heads, forks or downloaded artifacts.

## Acceptance and post-release checks

Local acceptance before a workflow change is merged:

```sh
npm run test:publish
npm run verify
npm pack --dry-run
```

`test:publish` covers valid and invalid metadata, missing packages, existing versions, unpublished versions, Registry
errors, malformed responses, timeout-signal wiring and the workflow's security invariants. Prettier parses the workflow
YAML during `npm run verify`.

After an automatic publication, verify on npmjs.com:

1. The expected `name@version` exists and the `latest` tag points to the intended stable version.
2. The files list matches the dry-run archive and contains no source secrets or machine-local files.
3. Provenance links to `axclogo/AxcUIKit-TypeScript`, the expected workflow and commit.
4. The GitHub publish run checked out the same commit that passed CI.
5. A clean consumer can import the documented package subpaths.

## Failures, retries and recovery

- **CI fails:** no publish attempt occurs. Fix the source and push a new commit; do not bypass the gate.
- **`bootstrap`:** complete the one-time package creation and Trusted Publisher setup, then push a reviewed commit. Do
  not make the missing package a successful skip.
- **`ENEEDAUTH` or OIDC rejection:** check the exact npm publisher fields, workflow filename, runner and
  `id-token: write` permission. Do not add a token fallback. If the connection passed its two-day activation window,
  replace it.
- **Version already exists:** confirm its content. If it is correct, no action is required. If it is wrong, publish a
  corrected new version; npm versions cannot be overwritten.
- **Registry or network error:** retry the failed GitHub run after npm is healthy. The decision gate will query state
  again before any publish.
- **Publish succeeded but a later display/check failed:** confirm npm state first. A rerun will see `published` and
  become a no-op.
- **Bad release:** do not silently replace it. Deprecate it when appropriate and publish a corrected version. npm
  unpublish is policy-limited and should be an explicit maintainer action, never an automatic recovery path.

Git tags and GitHub Releases are outside this workflow. If the project adopts them later, create them only after npm
publication is confirmed and document their ownership and retry behavior before automating them.

## References

- [npm Trusted publishing](https://docs.npmjs.com/trusted-publishers/)
- [npm provenance statements](https://docs.npmjs.com/generating-provenance-statements/)
- [GitHub `workflow_run` security](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_run)
