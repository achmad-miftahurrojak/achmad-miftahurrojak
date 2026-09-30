# Dynamic language chart deployment

The profile README embeds this Vercel function:

`https://achmad-miftahurrojak.vercel.app/api/most-used-languages`

The function now lives in the private repository `achmad-miftahurrojak/profile-language-chart`. The public profile repository can drop its backend files only after the existing Vercel project uses this private repository.

## Move the existing Vercel project

1. Open the Vercel dashboard and select the existing project **achmad-miftahurrojak**. Do not create a new project; keeping this project preserves the current `achmad-miftahurrojak.vercel.app` domain and its environment variables.
2. Open **Settings → Git** and disconnect the old public profile repository.
3. Connect **achmad-miftahurrojak/profile-language-chart**. If GitHub asks which repositories the Vercel app may access, grant it access to this private repository.
4. Keep the project root directory as `./` and the framework preset as **Other**.
5. In **Settings → Environment Variables**, confirm `GH_STATS_TOKEN` exists for **Production**. If it is missing, add it there. Use a GitHub token that can list all repositories owned by `achmad-miftahurrojak` and read their repository metadata, including private repositories. Never put the token in a repository file.
6. Trigger a Production redeployment from the **Deployments** tab.

## Verify before removing public backend files

After the deployment is Ready, open:

`https://achmad-miftahurrojak.vercel.app/api/most-used-languages`

It should return an SVG chart, not an error message. Then check the profile README image and confirm the language data includes private repositories. Only after those checks pass should the public repository remove `api/most-used-languages.js`, `package.json`, and `vercel.json`.

The chart is calculated when Vercel calls the endpoint. GitHub's README image proxy can cache images, so newly updated repository data may take a short while to appear in the profile preview.
