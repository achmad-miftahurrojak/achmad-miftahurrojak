# Dynamic language chart deployment

The profile README embeds a Vercel function at:

`https://achmad-miftahurrojak.vercel.app/api/most-used-languages`

Import this repository into Vercel and set the project name to `achmad-miftahurrojak` so that this URL is assigned to it. Add `GH_STATS_TOKEN` in the Vercel project's Production environment variables before deploying, then redeploy.

The token must be able to list all repositories owned by `achmad-miftahurrojak` and read their repository metadata, including private repositories. A fine-grained token with read-only metadata access to all owned repositories is sufficient. The function only reads repository language byte counts and never sends the token to the browser.

The chart is calculated when Vercel calls the endpoint. GitHub's README image proxy can cache rendered images, so a newly updated repository may take a short while to appear in the profile preview.
