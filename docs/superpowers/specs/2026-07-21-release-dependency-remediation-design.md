# Release Dependency Remediation Design

## Goal

Restore a clean release audit and make the repository's supported Node runtime easy to select locally, without changing application behavior or performing broad dependency upgrades.

## Scope

- Update compatible transitive dependency versions in `package-lock.json` with the standard npm audit remediation.
- Add `.nvmrc` pinned to Node `20.19.5`, which satisfies the existing `package.json` engine range and matches the Node 20 release line used by CI.
- Preserve all existing application, database, test, and workflow changes in the working tree.

## Approach

Run `npm audit fix` without `--force`. This permits lockfile updates only within the dependency constraints already declared by the project. Do not add manual package overrides unless the compatible remediation fails. Do not perform general direct-dependency upgrades.

The current audit findings originate in transitive dependency chains involving `brace-expansion` and `js-yaml`. The remediation is successful only when the production dependency audit reports no high-severity findings.

## Safety and Error Handling

- Review the generated manifest and lockfile diff before accepting it.
- Reject any unexpected direct-dependency changes or semver-major upgrades.
- Do not overwrite or revert pre-existing user changes.
- If npm cannot remediate within current constraints, stop and reassess a narrowly scoped override or direct dependency change instead of using `npm audit fix --force`.

## Verification

Run the following checks after remediation:

1. `npm run audit:release`
2. `npm test`
3. `npm run lint`
4. `npm run build`

The change is complete when all four commands pass and the resulting diff contains only the intended runtime-selection and dependency-lock changes, in addition to the separately committed design document.
