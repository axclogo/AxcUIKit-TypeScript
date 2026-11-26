# Changelog

## 0.6.0

- Publish the package as `@axclogo/uikit` and use `@axclogo/eval` for the optional WebAssembly executor.
- Add `AxcConditionSimulator`, a controlled sample picker and execution-trace view for the `@axclogo/eval` `simulateCondition` export. It shows the final result, decisive rules, negated groups, short-circuit positions and skipped nodes without implementing evaluation inside UIKit.
- Add typed simulation, trace and optional evidence callback contracts. Evaluator failures remain visible and are forwarded unchanged; stale results disappear when their condition, catalog, executor or selected record changes. UIKit does not retain records, results or evidence.
- Document the integration boundary and add English/Chinese simulator copy. Sample ids are explicit, non-empty and unique; invalid sample configuration throws instead of selecting a guessed record.
- Publish public releases through npm Trusted Publisher with workflow-bound OIDC and automatic provenance. Release jobs contain no npm token or token fallback, reject an uninitialized package explicitly and test every Registry decision path.
- Remove application-specific integration notes from public architecture documentation and align npm, LLM and component guidance with the published package contract.
- Document `@axclogo/eval` as the optional npm-installed WebAssembly executor for condition simulation.

## 0.5.0

- Separate public editor entry points, shared draft state, and core error types. Validate field configuration once per entry, use one Schema keyword dispatch, and remove unreachable option/file fallbacks. Preserve unexpected parser exceptions instead of relabeling them as JSON syntax errors. File slot paths are undefined for unnamed drafts, rather than guessed as empty property names; empty select placeholders remain explicit choices.

- JSON Editor accepts every JSON root type in both tree and source modes. Replace `JsonContent.kind: 'object'` with `'value'`, `parseJsonObject` with `parseJsonValue`, and `onValidObjectChange` with `onValidValueChange`; no legacy aliases are retained. Editor component names stay unchanged.
- Add recursive `JsonFieldDefinition` metadata (`fields`, `items`, `additionalProperties`, `format`), root metadata through `rootField`, and JSON-valued options, including null, objects and arrays. Hosts still own required/type/business validation; defaults are only applied by explicit actions.
- Add the React-free `jsonSchemaToField` converter for an explicit draft 2020-12 subset. Unsupported keywords/forms and malformed schemas throw `JsonConfigurationError` (a `TypeError`) with structured issue paths. Replace the obsolete `expected_object` issue with configuration/schema issue codes documented in the JSON Editor README.
- Add `file` fields and the host-owned `FileInput` slot. Only opaque string references enter JSON; missing slots fail explicitly, and read-only views show the reference plus the host-rendered display name.
- Add controlled `disabledKeys` / `onDisabledKeysChange` for root object properties. Toggles never change JSON values or clean up absent names. Add English and Chinese messages for the new UI and issues.

- Remove duplicate event guards, invalid selection recovery and exotic property-descriptor checks from JSON Editor. Trust typed object content without validating it again during rendering. Remove Condition list/range substitutions for non-array host values. Document the host and slot responsibility boundary.

## 0.4.0

- Distribute Condition and JSON Editor together as `@axclogo/uikit` from the AxcUIKit-TypeScript repository.
- Existing Condition exports are available at `@axclogo/uikit/condition`, `@axclogo/uikit/condition/core` and `@axclogo/uikit/condition/styles.css`. Condition names, data contracts and protocol fixtures stay the same.
- Add a structured JSON object editor with tree and parameter form editing, raw JSON drafts, pluggable controls, and a CodeMirror source adapter.

## 0.3.0

- Add an optional `ModelSelect` UI adapter receiving original model/provider metadata. Hosts can use cascading model pickers without parsing labels; model ids and AI protocols stay unchanged.

## 0.2.0

This release makes the package language-neutral, gives errors a machine-readable shape, and fixes
several editor bugs. The stored condition and decision JSON format is **unchanged**; existing data stays valid
(except values that were already broken, see below).

### Breaking changes and migration

1. **English is the default language.** All UI text, error messages and model prompts now come from a locale.
   To keep the previous Chinese UI, wrap your components:
   `<AxcUIProvider locale={zhCN}>…</AxcUIProvider>` (`zhCN` is exported from `@axc/condition` and `/core`).
   Request builders take the locale as a last argument: `conditionAssistRequest(model, req, current, catalog, zhCN)`,
   `decisionAssistRequest(…, zhCN)`, `decisionRequest(value, input, catalog, zhCN)`, `decisionFields(outputs, zhCN)`.

2. **Validation errors are `AxcValidationError` with every issue.** `parseCondition`, `parseDecisionPlan`,
   `parseConditionResult`, `parseDecisionResult`, `parseDecisionOutput`, `decisionRequest` and the assist request builders
   used to throw a plain `Error` with one Chinese message. They now throw `AxcValidationError` whose `issues` lists every
   problem as `{ code, path, params }`. `message` is a language-neutral debug string (`$.rules[0].value: type`).
   If you matched on message text, switch to `error.issues[i].code` and render with `formatIssue(issue, locale)`.
   To get issues without exceptions, use the new `validateCondition` / `validateDecisionPlan`.

3. **`parseCondition(value, catalog, allowEmpty)` → `parseCondition(value, catalog, { allowEmpty })`.**
   Replace a trailing `true` with `{ allowEmpty: true }`.

4. **Configuration mistakes throw `TypeError`.** Invalid `maxLevels`, duplicate field names, host fields named `ai.*`
   (decision APIs) and `values` on a non-string field are reported as `TypeError`, including during render.

5. **`values` is only allowed on `string`, `enum` and `array` fields** (type-level and runtime). Before, a
   `number`/`boolean` field with `values` rendered and generated strings that the parser always rejected, so no such
   configuration ever worked. Migration: use `dataType: 'enum'` with string options, or drop `values`.

6. **Built-in operators no longer carry a `label`**, and `ConditionOperator.label` is optional. If you displayed
   `operatorsFor(field)[i].label`, use `locale.operators[name]` (`array.<name>` for array text fields). Custom operators
   may still set `label`, which takes precedence.

7. **The "multi-word" editing mode is removed.** It silently merged same-field `contains` rules in a group, could not be
   controlled by the host, and made a row jump into another when its operator changed. Every rule is now its own row.
   Stored data is unaffected. For bulk keyword entry, declare a list operator such as
   `{ name: 'containsAny', valueShape: 'list', label: '…' }` and evaluate it yourself. The `.axc-keyword-row` and
   `.axc-mode` classes are gone.

8. **Number drafts are parsed strictly.** `' '`, `'0x10'`, `'Infinity'` and similar text stay strings (and are reported
   as `type` issues) instead of becoming `0`, `16` or `Infinity`.

9. **`regex` / `notRegex` values must compile** as a JavaScript `RegExp` (`regex` issue). Previously any text passed.

10. **Checkbox adapters render `label` as visible text.** Components no longer wrap `Checkbox` in a `<label>` with a
    second text node. Custom `Checkbox` adapters should show `label`. The `.axc-inline` class is replaced by
    `.axc-native-checkbox` on the default checkbox.

11. **Errors are shown next to their row.** `AxcCondition` and `AxcDecision` no longer render one alert at the bottom;
    each rule, group and decision control shows its own issues. `AxcDecision` no longer wraps its multi-select and
    textarea in `<label>` elements; the control `label` is the accessible name.

12. **Blank `model` or `requirement` in assist request builders** throws `AxcValidationError` (`required` at `model` /
    `requirement`). `decisionRequest` reports a missing model as `required` at `model` and missing inputs as `required`
    at `input.<field>`.

13. **Schema details.** Text values use `pattern: "\\S"` (non-blank) instead of `minLength: 1`, matching the parser.
    The generated `$defs` layout is otherwise the same.

14. **`AxcUIProvider` renders no wrapper element** and no longer takes `className` / `style`. Put theme classes,
    CSS variables or `data-axc-theme` on your own container instead.

15. **`dist/` is no longer committed.** Installing from git runs `prepare`, which builds the package. If you vendor the
    repository, run `npm ci && npm run build`.

### Fixed

- Rules, nested groups and decision outputs use stable internal keys. Deleting a middle row no longer gives the next
  row the deleted row's search text or tag draft.
- `index.js` and `core.js` share one chunk instead of each bundling the core.

### Added

- `validateDecision` / `parseDecision`: the plan plus the runtime model check (previously only inside `AxcDecision`).
- `docs/ui-adapters.md` (+ zh-CN): per-control guide, checklist, AI prompt, and a tested Ant Design 5 adapter; shipped in the package.
- Control contract: `invalid` and `describedBy` on every control. Default controls set `aria-invalid` and
  `aria-describedby`, linking each control to its error text. Custom adapters should forward them.
- `validateCondition`, `validateDecisionPlan`, `AxcValidationError`, `formatIssue`, `formatPath`, `en`, `zhCN`,
  `useAxcLocale`, and the `AxcIssue`, `AxcIssueCode`, `AxcLocale` types.
- `AxcUIProvider` `locale` prop.
- Tests on React 18 and 19 with Testing Library and happy-dom; JSON Schema ↔ parser consistency tests; GitHub Actions CI;
  Prettier; ESLint (no inline disables); API reports (`api/`); frozen protocol fixtures (`protocol/`); coverage, size
  and CHANGELOG/version gates; `AGENTS.md`; knip (unused files, exports and dependencies fail `npm run check`); stricter boundary checks (no native controls outside `src/ui`, non-submit buttons, no hard-coded UI text).

## 0.1.1

- Hosts can restrict condition groups to AND and OR (`allowNot: false`).

## 0.1.0

- Initial release.
