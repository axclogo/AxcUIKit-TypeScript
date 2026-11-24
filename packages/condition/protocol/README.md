# Protocol fixtures

These files freeze the observable protocol. `tests/protocol.test.ts` fails when behaviour drifts from them.

- `issue-codes.json`: the complete, ordered list of `AxcIssueCode` values. Hosts branch on these codes, so
  adding, removing or renaming one is a breaking change.
- `condition.fixtures.json` / `decision.fixtures.json`: inputs with the exact issues (`code`, `path`, `params`)
  the validators must return. A case may override catalog properties with its own `catalog`.

Every issue code must appear in at least one fixture, and every valid condition case must also pass
`conditionSchema`. Change these files only together with a CHANGELOG entry.
