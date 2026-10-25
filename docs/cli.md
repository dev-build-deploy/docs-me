<!--
SPDX-FileCopyrightText: 2026 Kevin de Jong <monkaii@hotmail.com>
SPDX-License-Identifier: MIT
-->

# Command Line Interface

```sh
# Install the CLI tool
$ npm install -g https://github.com/dev-build-deploy/docs-me

$ docs-me publish --help
```

## `docs-me publish`

| Option                  | Description |
| ----------------------- | ----------- |
| `-C, --root <dir>`      | Repository root (default: the current directory) |
| `-c, --config <file>`   | Configuration file, relative to the root (default `.docs-me.json`) |
| `-n, --dry-run`         | Print the plan (pages added/changed/removed, broken links); write nothing |
| `--strict`              | Exit non-zero when a link is broken |
| `--json`                | Machine readable output |
| `-r, --repo <o/n>`      | Repository; default `GITHUB_REPOSITORY` or the `origin` remote |
| `-t, --token <token>`   | Token for the wiki; default `GITHUB_TOKEN`; without one your local git credentials are used |
| `--wiki-remote <url>`   | Explicit wiki remote (tests, forks) |
| `-m, --message <text>`  | Commit message for the wiki |

Exit codes: `0` ok, `1` the plan has errors (broken links with `--strict`, conflicts), `2` failure (bad
configuration, wiki not initialised, git error).

Compact output (`+` added, `~` changed, `-` removed):

```text
docs-me plan owner/repo @ 3f2a1bc: +4 ~1 -0 =2 pages, assets +1 ~0 -0
  + Engine-catalogue
  ~ Home
  broken engine/docs/catalogue.md:5 (nope.md): target does not exist
```

`--json` prints `{ ok, repo, sha, dryRun, wikiFound, changes: { added, changed, removed, unchanged, conflicts,
assets }, broken: [{ file, line, dest, reason }], committed, pushed, errors }`.

A dry run still clones the wiki to compare. If it cannot (not initialised, no access) the plan is made against an
empty wiki and `wikiFound` is `false`.

The "at `<sha>`" in each banner is the last commit that touched the source file, so unrelated pushes do not rewrite
every page. In a shallow clone this is the checked out commit; use a full clone for the stable behaviour.
