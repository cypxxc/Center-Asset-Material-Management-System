# PostgreSQL production deployment

The deployment image runs the Next.js standalone server as UID/GID 10001 behind Caddy HTTPS. It joins the **existing** `camms-postgres-local_default` Docker network and uses the existing `postgres` service on port 5432. It does not declare, replace, migrate, or recreate the database container or `camms-postgres-local_postgres_data` volume. Uploaded images remain in the existing host directory through an explicit bind mount.

This is deployment preparation, not evidence of a public release. The final hostname, access network, off-machine backup destination and target load still require operator decisions. Starting these services does not stop a host app already using port 3000; the container app has no published port and is reached through Caddy only.

Local verification completed on 14 September 2026: the image is running with Caddy at `https://localhost:8443`, both containers are healthy, TLS was verified using the exported CA, browser login and five edits passed, private image/SSE permissions passed, and an actual application-process kill recovered automatically. A 20-client/20-SSE test with 1,000 fixture items returned 200 successful requests (p95 943 ms). This local CA has **not** been installed into the Windows/browser trust store. Docker Desktop startup after current-user Windows login is now enabled; unattended boot without login was not tested. See [current release review](../release-review/README.md) for the precise remaining deployment inputs and [scheduled backups](backup-README.md).

## Prepare an explicit endpoint

Run commands from the repository root. Keep `.env.postgres.app`, `.env.postgres.local`, and the existing upload directory in place. Take and verify a full database + file backup before changing the deployed version. Apply any required migrations using the separate operator setup command before starting the new image; migration credentials never enter the running web container.

For a public hostname with DNS already pointing to the intended server:

```sh
npx tsx scripts/prepare-production.ts --site inventory.example.org --tls public --bind 0.0.0.0
```

`inventory.example.org` is an example; supply the actual hostname. Public ACME certificate issuance requires inbound ports 80/443 and appropriate DNS/firewall configuration. Public access is explicitly enabled by `--bind 0.0.0.0`; the helper defaults to loopback.

For a loopback-only HTTPS trial that preserves existing port 3000:

```sh
npx tsx scripts/prepare-production.ts --site localhost --tls internal --https-port 8443 --http-port 8080
```

Open `https://localhost:8443` directly. With nonstandard mapped ports, the automatic HTTP redirect does not select port 8443. Caddy uses an internal CA in this mode. `skip_install_trust` prevents automatic installation into trust stores. The browser will not trust it until an operator explicitly distributes and trusts that CA; no script disables certificate checks or silently installs a root certificate. For a LAN endpoint, supply the actual resolvable LAN hostname and an explicit bind address instead of localhost.

Preparation creates two new Git-ignored files and refuses to overwrite existing production configuration:

| File | Contents |
|---|---|
| `.env.production.compose` | HTTPS site, port bindings, external database network, existing image-storage path |
| `.env.production.runtime` | Only `camms_app` and `camms_auth` connection strings, rewritten to Docker hostname `postgres:5432` |

The helper does not modify `.env.local` or the database. The runtime secret is mounted read-only under `/run/secrets`, never passed as an image argument or included in image layers. The container checks role names and rejects additional secret keys, including the migration-owner URL. Docker Compose file secrets retain host file permission constraints: on Linux, grant **UID 10001** read access to the secret and read/write access to the upload directory using a narrow ACL. Do not make secrets world-readable. Windows Docker Desktop bind permissions differ; run the preflight below to confirm them.

## Build, preflight and start

```sh
docker compose --env-file .env.production.compose -f compose.production.yaml config --quiet
docker compose --env-file .env.production.compose -f compose.production.yaml build
docker compose --env-file .env.production.compose -f compose.production.yaml run --rm --no-deps app node --input-type=module -e "import {readFileSync,accessSync,constants} from 'node:fs'; import {runtimeConnections} from './deploy/runtime-config.mjs'; runtimeConnections(readFileSync('/run/secrets/camms_runtime','utf8')); accessSync('/data/storage',constants.R_OK|constants.W_OK); console.log('Restricted runtime secret and existing storage accessible')"
docker compose --env-file .env.production.compose -f compose.production.yaml up -d --wait --wait-timeout 120
docker compose --env-file .env.production.compose -f compose.production.yaml ps
```

Preflight never prints connection strings. `config --quiet` validates without printing configuration. Do not use unfiltered `docker inspect` or `config` output when sharing logs from installations containing secrets.

Check `/api/health/readiness` over the chosen HTTPS endpoint, then log in and verify a known existing record and image. Readiness checks database connectivity and storage access; successful container startup alone does not prove account access, file ownership or correct DNS.

For a local CA trial, export the public root certificate without installing it:

```sh
docker compose --env-file .env.production.compose -f compose.production.yaml cp proxy:/data/caddy/pki/authorities/local/root.crt .cache/postgres/camms-local-root.crt
curl --cacert .cache/postgres/camms-local-root.crt https://localhost:8443/api/health/readiness
```

Create `.cache/postgres` first if it does not exist. Validate the CA fingerprint through a trusted channel before deciding to install it for browsers. The `caddy_data` volume holds certificate private keys and must remain private; preserve it across restarts. Do not distribute its private keys.

## Restart, health and logs

Both services use `restart: unless-stopped`. The application has an HTTP readiness health check and Caddy waits for it on initial startup. Caddy has its own local admin-endpoint health check. Log rotation retains at most five 10 MB files per service. The app filesystem is read-only except its cache, temporary directory, and existing image storage.

```sh
docker compose --env-file .env.production.compose -f compose.production.yaml logs --tail 100
docker compose --env-file .env.production.compose -f compose.production.yaml restart app proxy
docker compose --env-file .env.production.compose -f compose.production.yaml ps
```

Repeat the HTTPS readiness/login/image checks after restart. A health check marks an unresponsive process unhealthy; Docker restart policy restarts exited processes, not every unhealthy process. Use external uptime monitoring and an operator response for persistent health failures.

On Windows, restart policy only applies **after Docker Desktop's engine is running**. Enable and verify Docker Desktop startup for the intended operator account. Desktop startup after user login is not the same as a server service starting before login. For unattended service after machine boot without interactive login, use a supported continuously running Docker host or an explicitly managed host startup arrangement and perform a supervised reboot test. This repository does not silently install a scheduled task or change host startup settings.

Stop only the new web/TLS services with `docker compose --env-file .env.production.compose -f compose.production.yaml stop`. Do not remove the existing database volume or run `down --volumes` against either project. Rolling back application code requires a compatible schema and a previously built image tag; database rollback requires the separately verified full recovery procedure.

## CI release gate

The `postgres-release` job in `.github/workflows/ci.yml` uses a fresh PostgreSQL 17 Docker service, generated CI-only credentials, restricted app/auth roles and migrations. Setup runs twice to check idempotency. The gate runs actual RLS/session security checks, live query/admin/fresh-restore tests, typecheck/lint/build, authenticated browser CRUD, private file/session-event HTTP checks, request-size limits, full recovery verification, and a credential-free Docker image build. Failures prevent the manually dispatched staging job through `needs: [build, postgres-release]`.

CI runs on an isolated runner. Its setup/activation steps intentionally create runner-local files; do not replay those preparation steps over an existing installation merely to test CI. The live fixture tests can be run locally against the existing database using their explicit opt-ins; fixtures are scoped or rolled back. Branch protection must require `postgres-release` in the repository's hosting settings to prevent merges when this job fails.

References: [Next.js standalone output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output), [Docker external networks](https://docs.docker.com/reference/compose-file/networks/), [Docker service secrets and restart policy](https://docs.docker.com/reference/compose-file/services/), [Caddy reverse proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy), [Caddy trust installation option](https://caddyserver.com/docs/caddyfile/options#skip-install-trust).
