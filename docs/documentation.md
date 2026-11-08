# Building and publishing the docs

The site uses [Sphinx](https://www.sphinx-doc.org/),
[MyST Markdown](https://myst-parser.readthedocs.io/), and the
[Furo theme](https://pradyunsg.me/furo/). Existing Markdown files stay readable on
GitHub and are rendered into a searchable site with light/dark themes and sidebar
navigation. The setup guide includes the repository README rather than copying it.

## Local preview

Inside the Nix development shell:

```sh
just docs-build
just docs
```

Open <http://localhost:8000>. Preview binds to loopback only. Stop it with Ctrl-C;
after editing, rebuild with `just docs-build` in another terminal and refresh.
The generated site lives at `build/docs/html/` and is ignored by Git. The build
is strict: warnings and unresolved documentation references fail the command.
Nix pins the toolchain through `flake.lock` alongside the firmware tools.

Without Nix, use Python 3.12 or newer and the pinned direct dependencies:

```sh
python3 -m venv build/docs-venv
build/docs-venv/bin/pip install -r docs/requirements.txt
build/docs-venv/bin/sphinx-build -n -W --keep-going -b html docs build/docs/html
python3 -m http.server 8000 --bind 127.0.0.1 --directory build/docs/html
```

## GitHub Pages

`.github/workflows/docs.yml` builds and checks documentation on pushes and pull
requests. It uploads a preview artifact. A manual workflow run can publish the
selected ref; pushes to the repository's default branch publish automatically.
Feature-branch pushes and pull requests only build and never replace the public
site. While development stays on `stm32-bringup`, use a manual run on that branch
if you want to publish it.

One-time repository setup: **Settings → Pages → Build and deployment → Source →
GitHub Actions**. Run the Documentation workflow after committing and pushing the
site files. The deployment job exposes its actual URL. The usual project URL is
`https://k1dkev.github.io/inverted-pendulum/`; configuration alone does not mean
that URL is live. The `github-pages` environment must allow the selected branch
for manual publication.

This site is static documentation. The control dashboard still needs its local
server to access USB serial and is launched separately with `just web`.

## Editing

Edit `docs/*.md`; add new pages to a toctree in `docs/index.md`. Keep internal
links relative to Markdown files so Sphinx can check them. Hardware files outside
the documentation tree link to their GitHub source. The build does not fetch or
validate external URLs; PDF datasheets and other remote references need separate
review when changed.
