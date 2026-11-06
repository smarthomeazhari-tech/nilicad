# Private Cloudflare deployment

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
