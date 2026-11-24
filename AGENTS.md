# AxcUIKit-TypeScript contributor rules

This repository distributes focused React and TypeScript components through the explicit subpaths of `@axc/uikit`. Each component owns its source, tests, examples, and public contract.

## Before you finish

```sh
npm run verify
```

All checks must pass. CI runs the same command, the release gate, and an import check for the package entry points. Do not lower a threshold or budget to make a change pass.

## Shared engineering rules

- Keep parsing and validation in a React-free core. Reject invalid data with structured issues. Preserve valid values as provided and keep editor-only state out of emitted data.
- Keep controls replaceable with typed, value-oriented props. Use native controls and locale text by default. Every native button has `type="button"`. Scope styles to the component.
- Keep component source within its own module. React and React DOM are the shared peers. CodeMirror runtime dependencies are used by the explicit JSON Editor adapter subpath.
- Add abstractions, dependencies, and public options for concrete use cases. Write English JSDoc for public functions covering their behavior and failure conditions.
- Run strict TypeScript, ESLint, knip, and Prettier. Production code has no `any`, `@ts-ignore`, double casts, `console`, or floating promises. Inline ESLint suppression is disabled.
- Test real behavior on React 18 and 19. Verification prints its results. Maintained API references document interfaces.
- Update the changelog for implementation or protocol changes. Bump the package version when public API references or protocol issue codes change.

## Condition gates

| Rule                                                                                                                             | Enforced by                                                   |
| -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Core code imports only Condition core. Other Condition code imports only its own source and React.                               | `scripts/check-boundaries.mjs`                                |
| Native form controls reside in `src/ui`. Outside that directory, control imports use `ui/controls`, `ui/types` or `ui/provider`. | `scripts/check-boundaries.mjs`                                |
| UI copy uses locales. CJK text resides in `src/core/locales`.                                                                    | `scripts/check-boundaries.mjs`                                |
| Line coverage ≥ 98%, branch coverage ≥ 95%, function coverage ≥ 93%.                                                             | `npm run test:condition`                                      |
| Protocol issue codes, ordering and fixture results are stable. All issue codes have fixtures and localized messages.             | `packages/condition/protocol`, protocol and i18n tests        |
| Intended API changes update the interface reference.                                                                             | `npm run api` after a build and `npm run api:check` for drift |
| Gzip budgets are 22,000 bytes for JavaScript and 1,500 bytes for CSS.                                                            | `npm run size`                                                |

Condition validation returns each issue as `{ code, path, params }`. New failure kinds require a code, a fixture, and messages in every locale. Wrong data is reported as an issue and incorrect configuration throws `TypeError`. Persisted condition and decision protocols contain no node IDs.

## JSON Editor gates

The JSON core has no external imports and the standard editor loads independently of the CodeMirror adapter. The suite covers parsing, editing behavior, and the public React controls. TypeScript entry points have maintained API references. The JavaScript and CSS budgets are 18,000 and 1,500 bytes gzip. See the [JSON Editor contract](./docs/architecture.md#json-editor-contract).

## Layout

```text
packages/condition/    condition builders, protocol, docs, API reference, demo, tests
packages/json-editor/  JSON tree, parameter and source editors, docs, tests
tests/                shared DOM setup and React 18 test runtime
scripts/              build, demo, boundary, API, size and release checks
```
