<!--
SPDX-FileCopyrightText: 2026 Kevin de Jong <monkaii@hotmail.com>
SPDX-License-Identifier: MIT
-->

# DocsMe

Keep your documentation in the repository, versioned and reviewed with the code, and publish it **one way** to the
repository's GitHub Wiki for humans. Nobody edits the wiki by hand.

DocsMe does not rely on AI, but is easy for LLMs (and scripts) to use: it is deterministic, idempotent (a second run
makes no commit), and prints compact output or `--json`.

What `docs-me publish` does:

- maps every Markdown file of the configured sources to a unique, stable wiki page name (`Engine-docs-catalogue`);
- rewrites relative links between docs to wiki links (anchors kept), links to other repository files to
  `blob`/`tree` URLs at the published commit, and copies referenced images;
- strips YAML front matter (it may give the page title) and puts a banner on every page:
  "Generated from `path` at `sha`: edit it in the repository";
- writes `Home.md` and `_Sidebar.md`;
- removes pages it published before whose source is gone (only pages carrying its marker comment);
- commits and pushes the wiki only when something changed.

```sh
$ docs-me publish --dry-run --strict
docs-me plan owner/repo @ 3f2a1bc: +4 ~1 -0 =2 pages, assets +1 ~0 -0
  + Engine-catalogue
  ...
```

Usage and configuration:

- [GitHub Action](./docs/github-action.md) (`on: push` to the default branch)
- [Command Line Interface](./docs/cli.md)
- [Configuration](./docs/config.md)

## Contributing

If you have suggestions for how docs-me could be improved, or want to report a bug, open an issue! For more, check out
the [Contributing Guide](CONTRIBUTING.md).

## License

- [MIT](./LICENSES/MIT.txt) © 2026 Kevin de Jong \<monkaii@hotmail.com\>
