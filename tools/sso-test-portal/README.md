# CAMMS local SSO integration test

This is a **development-only** demo IdP on `127.0.0.1:3001`. It uses a one-time authorization code (60 seconds) exchanged server-to-server for an HS256 JWT. Do not deploy the portal: it intentionally has no real user authentication.

## Setup

1. Start PostgreSQL and CAMMS as usual on `http://localhost:3000`.
2. Generate **two different** secrets with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
3. Put the following in CAMMS `.env.local`:

```env
SSO_ENABLED=true
SSO_LOCAL_TEST_ENABLED=true
SSO_JWT_ALGORITHM=HS256
SSO_JWT_ISSUER=camms-local-test
SSO_JWT_AUDIENCE=camms-local
SSO_JWT_SECRET=<first-generated-secret>
SSO_LOCAL_TEST_CLIENT_SECRET=<second-generated-secret>
```

4. Set the **same** `SSO_JWT_SECRET` and `SSO_LOCAL_TEST_CLIENT_SECRET` in the portal process environment. Set `SSO_LOCAL_TEST_SUBJECT` to a test identity such as `local-demo-001`.
5. Link this subject to an existing **active test user** in `public.user_sso_identities` using the existing `bindUserSSOIdentity` server-side utility, with issuer `camms-local-test`, subject matching `SSO_LOCAL_TEST_SUBJECT`, and the user's UUID. Do not auto-link by email.
6. Run CAMMS with `npm run dev`; separately run `node tools/sso-test-portal/server.mjs` with the portal environment variables. Visit `http://127.0.0.1:3001` and click **Login to CAMMS**.

The original password login remains unchanged. The new callback is unavailable in production and when `SSO_LOCAL_TEST_ENABLED` is not `true`. The code is sent through the browser but the JWT is only exchanged server-to-server, never placed in the URL. Local HTTP is for loopback testing only.

## Tests

```sh
node --test tools/sso-test-portal/server.test.mjs
```

The test covers JWT signing, code single-use and exchange authentication. End-to-end login additionally requires a running CAMMS database, active linked user, and both servers.

## Limitations

This demo is **not** a production identity provider or OAuth/OIDC implementation. In-memory authorization codes are not shared across processes. Use HTTPS and a standards-compliant OIDC provider for real SSO.
