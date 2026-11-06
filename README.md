# mergelio-website

Source for [mergelio.com](https://mergelio.com/), the landing page for
[Mergelio](https://github.com/senseyman/mergelio). The site was moved here from
the `website/` directory of the main repo.

Plain static HTML, CSS and JS — no framework, no package manager.

## Layout

```
website/
├── index.html        landing page
├── privacy.html      privacy policy
├── style.css
├── main.js
├── sitemap.xml       template; {{DATE_ISO}} is filled in at build time
├── robots.txt
├── CNAME             custom domain for GitHub Pages (mergelio.com)
├── build.sh          renders the site into an output directory
├── fonts/            self-hosted JetBrains Mono + Schibsted Grotesk (OFL)
├── img/              screenshots (light/dark), videos, icons, og.jpg
└── og/
    ├── og.html       source for the social preview image
    └── render.sh     renders og.html into img/og.jpg
```

## Preview locally

Open `website/index.html` directly, or serve the directory:

```sh
python3 -m http.server -d website 8000
```

## Build

```sh
./website/build.sh _site                 # fetches the latest release from the GitHub API
./website/build.sh _site release.json    # uses a saved API response instead
```

Requires `bash`, `curl` and `jq`. The script copies the site into `_site` and
sets the sitemap `lastmod` to the publish date of the latest release in
`senseyman/mergelio` (override with `REPO=owner/name`). Set `GH_TOKEN` to avoid
API rate limits. The build fails if a `{{PLACEHOLDER}}` is left unfilled.

## Social preview image

`img/og.jpg` (1200×630) is generated from `og/og.html`:

```sh
./website/og/render.sh
```

Needs Google Chrome and `ffmpeg`. Set `CHROME=/path/to/chrome` if Chrome isn't
in the default macOS location.

## Deployment

[`.github/workflows/website.yml`](.github/workflows/website.yml) builds the
site with `build.sh` and publishes it to GitHub Pages at `mergelio.com`. It runs:

- on push to `main` that touches `website/**` or the workflow itself,
- weekly (Mondays 06:17 UTC), so the sitemap `lastmod` picks up new
  releases of `senseyman/mergelio`,
- manually via **Actions → Website → Run workflow**.

To pick up a new app release right away, trigger the workflow manually.

Repo settings: **Settings → Pages → Source** must be **GitHub Actions**, with
`mergelio.com` as the custom domain.

## License

Code is [BSD 3-Clause](LICENSE). Fonts are under the SIL Open Font License —
see `website/fonts/OFL-*.txt`.
