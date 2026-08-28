# CI Test Timeout Design

## Goal

Make the `npm test` release gate terminate deterministically and identify the exact test file when a Node test worker hangs.

## Scope

The change is limited to the repository test runner at `scripts/run-tests.ts` and its existing test coverage. The public `npm test` command and CI workflow stay unchanged.

## Design

`scripts/run-tests.ts` will execute discovered test files one at a time instead of giving all files to one Node test invocation. Each child process receives a finite timeout. A successful file advances to the next file. If a file exits unsuccessfully or exceeds its timeout, the runner stops immediately and exits non-zero.

Timeout errors must name the test file and the configured duration. This preserves the failed test as a release blocker while making it directly diagnosable from GitHub Actions logs. The runner must kill the full child process tree on Windows so a timed-out test cannot keep CI alive.

## Error Handling

- No discovered test files remains a non-zero error.
- A child exit code other than zero fails the runner without continuing to later files.
- A timeout fails the runner with the normalized relative test path and timeout duration.
- Unexpected spawn errors fail the runner with the child-process error.

## Testing

Add focused unit coverage around child-process invocation and timeout behavior using dependency injection or exported helpers. Verify that the runner builds one-file invocations, reports failures with the relevant path, and returns a timeout result when the child does not exit.

The full `npm test` command remains the integration check. CI will then expose the exact test file if a worker stalls, rather than remaining indefinitely at `Run tests`.

## Non-goals

- Do not skip, weaken, or remove existing tests.
- Do not add a workflow-level timeout as the primary control; it cannot identify the responsible file.
- Do not change application behavior or production runtime code.
