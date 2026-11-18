# Ondura website

Source of [ondura.mirranet.de](https://ondura.mirranet.de), the product page of the [Ondura](https://github.com/Ondura-Suite/Ondura-Core) office suite. Plain HTML, CSS and a little JavaScript, in English and German – no framework, no external requests from the visitor's browser.

## Languages

English is the default and lives at the root (`/`), German under `/de/`. Both are rendered from the same templates in `src/pages/`, where each text holds both languages side by side:

```html
<h2>{{de}}Herunterladen{{en}}Download{{/}}</h2>
```

[`scripts/build.py`](scripts/build.py) (Python standard library only) renders `src/` into `site/`. The supported placeholders are documented at the top of the script.

Which language a visitor gets:

1. An explicit choice from the DE/EN switcher in the header wins. It is kept in `localStorage` (`ondura-lang`), nothing else is stored.
2. Otherwise the browser's preferred language decides: German (`de-*`) gets `/de/`, everything else gets English.
3. German pages never redirect a visitor who hasn't chosen, so shared `/de/` links stay German.

All pages carry `hreflang` alternates for search engines.

## How it stays in sync

Screenshots, app icons and release information are **not** stored in this repository. They come from [Ondura-Core](https://github.com/Ondura-Suite/Ondura-Core) every time the site is deployed:

| What | Source in Ondura-Core | Lands in |
| --- | --- | --- |
| Screenshots | `docs/screenshots/*.png` | `site/assets/screens/` |
| App icons | `apps/ondura/public/{ondura,mail,text,sheets,slides}.svg` | `site/assets/brand/` |
| Latest release (version, date, download links) | GitHub Releases API | `site/release.json` |

The workflow [`deploy.yml`](.github/workflows/deploy.yml) builds the pages, runs [`scripts/sync-core.sh`](scripts/sync-core.sh) and publishes `site/` to GitHub Pages:

- on every push to `main`,
- every three hours (picks up new releases and screenshots automatically),
- manually via *Actions › Deploy website › Run workflow*,
- on a `repository_dispatch` event of type `ondura-core-updated` (optional, see below).

The download buttons link straight to the matching release asset (`*_x64_Setup.exe`, `.deb`, `.rpm`, `.AppImage`). Without a published release they fall back to the releases page.

## One-time setup

1. **Pages:** *Settings › Pages › Build and deployment › Source:* **GitHub Actions**.
2. **Custom domain:** *Settings › Pages › Custom domain:* `ondura.mirranet.de`, then tick *Enforce HTTPS* once the certificate is issued.
3. **DNS (Hetzner):** add a record in the `mirranet.de` zone:

   ```
   ondura   CNAME   ondura-suite.github.io.
   ```

4. Optional – **verify the domain** for the organization (*Organization settings › Pages › Add a domain*) so nobody else can claim it. GitHub shows a TXT record to add at Hetzner.

### Optional: deploy immediately after a release

The three-hourly schedule is enough for most cases. To update the site the moment a release is published, add a step to Ondura-Core's release workflow using a fine-grained token with *Contents: read & write* on this repository (stored as secret `WEBSITE_DISPATCH_TOKEN`):

```yaml
- name: Update website
  run: |
    curl -fsSL -X POST \
      -H "Authorization: Bearer ${{ secrets.WEBSITE_DISPATCH_TOKEN }}" \
      -H "Accept: application/vnd.github+json" \
      https://api.github.com/repos/Ondura-Suite/Ondura-Website/dispatches \
      -d '{"event_type":"ondura-core-updated"}'
```

## Local preview

```sh
git clone --depth 1 https://github.com/Ondura-Suite/Ondura-Core.git .core
python3 scripts/build.py
scripts/sync-core.sh .core site      # needs curl and jq
python3 -m http.server -d site 8080
```

## Layout

```
src/
  pages/              index, legal (Impressum), privacy (Datenschutz) – both languages
  partials/           head (language detection), header (with DE/EN switch), footer
  static/             copied as-is: CSS, JS, fonts (Instrument Sans, SIL OFL 1.1), 404, CNAME
scripts/
  build.py            renders src/ into site/ (en at /, de at /de/)
  sync-core.sh        adds screenshots, icons and release.json from Ondura-Core
site/                 build output, not committed
```

| Page | English | German |
| --- | --- | --- |
| Home | `/` | `/de/` |
| Legal notice | `/legal-notice.html` | `/de/impressum.html` |
| Privacy | `/privacy.html` | `/de/datenschutz.html` |
