# Private NiliCAD with real username/password authentication

This is a deployable Cloudflare Worker in front of the existing browser-only CAD
application. The browser shows its native HTTP Basic username/password dialog.
The Worker authenticates **every** request before returning HTML, model JSON,
JavaScript or any OCCT WASM part. It does not run a CAD backend.

Credentials are Cloudflare Secrets (`AUTH_USERNAME`, `AUTH_PASSWORD`), never
embedded in frontend source or committed to Git. The password must have at least
16 characters. No default production password is supplied. Until secrets and the
rate limiter are configured the Worker returns 503 and serves no app assets.

`assets.run_worker_first: true` is required. Removing it can make assets public.
Failed login attempts are rate-limited using the configured Cloudflare binding;
the limit is per Cloudflare location, not a strict global lockout. Correctly
supplied credentials are checked on every request, so changing the password takes
effect on subsequent requests. Responses use private/no-store caching. Basic
credentials are not forwarded to the asset binding or written to logs.

## Deploy from a computer

1. Use branch `feat/private-preview-auth` of this repository.
2. Run `npm ci` and `npm run build:private`.
3. Run `npx wrangler login` and authorize your own Cloudflare account.
4. Run `npm run private:deploy` to create the Worker. It initially returns 503
   because no credentials have been configured.
5. Run `npm run private:configure`. Enter your username, then enter and confirm a
   password of at least 16 characters. Password input is hidden. The setup writes
   secrets through Wrangler stdin without creating a credential file.
6. Open the HTTPS `workers.dev` URL returned by Cloudflare and verify both a
   rejected login and a successful login with model/geometry loading.

The Cloudflare account is not connected to the current execution environment;
this work does **not** claim a live protected deployment.

## Deploy from the Cloudflare dashboard

Create/import a Worker from GitHub repository `smarthomeazhari-tech/nilicad`,
branch `feat/private-preview-auth`. Use build command `npm run build:private`
and deploy command `npm run private:deploy` (repository root is the build root).
After deployment open Worker **Settings → Variables and Secrets** and add both
`AUTH_USERNAME` and `AUTH_PASSWORD` as **Secret** values, then apply/deploy the
change. Never put them in plain `vars`, commit them or paste them into an issue.
The Worker name and rate-limit namespace can be changed in `wrangler.jsonc` to
avoid conflicts with resources already in your account.

## Existing public copies

The current GitHub Pages preview remains public until you unpublish it. A private
new Worker does not protect that old URL or make the public source repository
private. After verifying the protected site, open the repository's **Settings →
Pages**, use the menu by the live URL and select **Unpublish site**. The connected
GitHub integration previously returned 403 for Pages administration, so this
owner action is still required. Previously downloaded copies cannot be recalled.

## Browser behavior and limits

Use HTTPS. There is no JavaScript-only password gate. The username/password dialog
is managed by Safari/Chrome; this initial version has no separate accounts,
password recovery, MFA or application logout. To end a cached Basic-auth login,
close the private browsing session; rotate the password to revoke access on
subsequent requests. Do not share the credentials with people who should not
access the application.

CAD geometry stays in the browser. Initial WASM download is approximately 22 MiB.
STEP is supported; IGES and nonuniform transforms remain browser-build limits.
Physical iPad/Pencil and Windows acceptance remains tracked separately.

## Tests and validation

`npm test` builds the private artifact and runs geometry/UI regressions plus
seven auth tests and protected Chromium/WebKit browser scenarios. Anonymous
requests for HTML, model JSON and WASM must be rejected before asset access;
authenticated browsers load the real CAD model and evaluate the WASM kernel.

`npx wrangler deploy --dry-run --config private-preview/wrangler.jsonc`
validates the Worker/asset/rate-limit bundle without Cloudflare credentials or a
live deployment. A successful dry run is not a production authentication test.

Cloudflare references:
- https://developers.cloudflare.com/workers/static-assets/routing/worker-script/
- https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
- https://developers.cloudflare.com/workers/configuration/secrets/

The unmodified WASM is packaged as hashed parts of at most 4 MiB. The browser
reassembles them in its Worker and verifies the full SHA-256 before compilation.
This supports hosts whose individual static-asset size limit is below 22 MiB.
