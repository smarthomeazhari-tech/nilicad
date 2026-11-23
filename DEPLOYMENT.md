# Private Cloudflare deployment

Owner's permanent site: <https://nilicad.smart-home-azhari.workers.dev>.
Login secrets belong in **Runtime variables and secrets > Production**, not
the similarly named variables section inside Build settings. Both
`AUTH_USERNAME` and `AUTH_PASSWORD` must be present at runtime.
The Wrangler configuration preserves dashboard runtime variables with
`keep_vars: true`; use the Secret type for credentials. If a deployed Worker
returns 503, its message identifies the missing runtime setting or binding
without disclosing any value. A successful build does not prove login readiness.

For the Cloudflare Worker named `nilicad`, use the following Git build settings:

- Repository: `smarthomeazhari-tech/nilicad`
- Production branch: `feat/private-preview-auth`
- Root directory: `/` (repository root)
- Build command: `npm run build:private`
- Deploy command: `npm run private:deploy -- --name nilicad`

Save the build settings before starting a new build. Retrying a failed `main`
build can reuse its original main commit, which has no package.json. A new push
to the configured production branch triggers a fresh build of that branch.
Check the branch label on the new build; it must be `feat/private-preview-auth`.

Once deployed, configure AUTH_USERNAME and AUTH_PASSWORD as Cloudflare Secrets
in this same Worker's Settings > Variables and Secrets. Passwords must have at
least 16 characters. Until both secrets are configured the app intentionally
returns 503 instead of serving unprotected assets.

Detailed setup and limitations: [private-preview/README.md](private-preview/README.md).

The protected build bundles the UI into a deferred classic `app.js` script, so
starting the drawing viewport does not require Safari import-map support or a
module dependency waterfall behind HTTP authentication. OCCT still runs in its
own worker. If startup fails, the page shows a visible error instead of leaving
an unexplained blank drawing area. Physical iPad verification is still required.
