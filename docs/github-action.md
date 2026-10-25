<!--
SPDX-FileCopyrightText: 2026 Kevin de Jong <monkaii@hotmail.com>
SPDX-License-Identifier: MIT
-->

# GitHub Action

Publish on every push to the default branch:

```yaml
name: Publish Wiki
on:
  push:
    branches: [main]
    paths: ["**/*.md", ".docs-me.json"]   # optional

permissions:
  contents: write   # required to push to the wiki

concurrency: wiki

jobs:
  docs-me:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0   # banners show the last commit that touched each file
      - uses: dev-build-deploy/docs-me@v0
        with:
          strict: true
```

| Input     | Default        | Description |
| --------- | -------------- | ----------- |
| `token`   | `github.token` | Token with write access to the wiki |
| `config`  | `.docs-me.json`| Configuration file |
| `dry-run` | `false`        | Only print the plan |
| `strict`  | `false`        | Fail on broken links |

Outputs: `changed` (a commit was pushed), `pages` (added + changed + removed), `broken-links`.

## Requirements

- **The wiki must be initialised once.** GitHub only creates the wiki git repository when the first page is saved:
  enable *Wiki* in the repository settings and create a first page (any content, e.g. "Home") in the GitHub UI. This is
  a GitHub limitation; before that, the action fails with a hint.
- The workflow needs `permissions: contents: write`; `github.token` can then push to `<repo>.wiki.git`.
- Nobody should edit the wiki by hand: pages DocsMe owns are overwritten, and removed when the source is gone.
