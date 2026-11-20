# mergelio-website

Source for [mergelio.com](https://mergelio.com/), the landing page for
[Mergelio](https://github.com/senseyman/mergelio). The site was moved here from
the `website/` directory of the main repo.

Mergelio and this site are created and maintained by Serhii Kotenko
([@senseyman](https://github.com/senseyman)).

Plain static HTML, CSS and JS — no framework, no package manager.

## Layout

```
website/
├── index.html        landing page
├── privacy.html      privacy policy
├── style.css
├── main.js
├── play.js           hero playground: live commit graph with undo/redo
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
fills `index.html` from the latest release in `senseyman/mergelio` (override
with `REPO=owner/name`): version, release date, and for each platform file
(`.dmg`, Windows `setup.exe`, `.deb`, `.rpm`) its download URL, name, size and
SHA-256 digest, plus links to `SHA256SUMS.txt` and its `.asc` signature. The
sitemap `lastmod` is set to the release's publish date. Set `GH_TOKEN` to avoid
API rate limits.

The build fails if the release is missing any platform file or its digest, or
if a `{{PLACEHOLDER}}` is left unfilled, so a deploy never publishes a dead
download button.

On the page, `main.js` detects the visitor's OS: the hero button becomes a
direct download for that platform (`.deb` on Linux, with an `.rpm` link next to
it), and the download section opens on the matching tab. Without JS, or on
phones and tablets, the hero button scrolls to the download section, which then
lists every platform.

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
- daily (06:17 UTC), so download links follow new releases of
  `senseyman/mergelio`,
- on a `repository_dispatch` of type `mergelio-release`,
- manually via **Actions → Website → Run workflow**.

To pick up a new app release right away, trigger the workflow manually, or
have the release workflow in `senseyman/mergelio` send the dispatch (needs a
token with access to this repo):

```sh
gh api repos/senseyman/mergelio-website/dispatches -f event_type=mergelio-release
```

Repo settings: **Settings → Pages → Source** must be **GitHub Actions**, with
`mergelio.com` as the custom domain.

## License

Code is [BSD 3-Clause](LICENSE). Fonts are under the SIL Open Font License —
see `website/fonts/OFL-*.txt`.
