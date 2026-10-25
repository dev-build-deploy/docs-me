<!--
SPDX-FileCopyrightText: 2026 Kevin de Jong <monkaii@hotmail.com>
SPDX-License-Identifier: MIT
-->

# Configuration

DocsMe reads `.docs-me.json` from the repository root (or the file given with `--config`).

```json
{
  "sources": [
    { "path": "engine/docs/**", "section": "Engine" },
    { "path": "games/leertoren/docs", "section": "Leertoren", "prefix": "Leertoren-docs" }
  ],
  "exclude": ["**/draft/**"],
  "home": "README.md",
  "sidebar": "docs/sidebar.md",
  "index": ["index.md", "README.md"],
  "banner": "> Generated from [`{path}`]({url}) at `{sha}`: edit it in the repository, not in the wiki.",
  "blobRef": "sha"
}
```

| Key       | Description |
| --------- | ----------- |
| `sources` | Required. Folders or globs (relative to the root); only `.md`/`.markdown` files are published. `section` is the sidebar heading and the default page name prefix; `prefix` overrides the prefix. A file matched by several sources belongs to the first. |
| `exclude` | Globs that are never published. `node_modules` and `.git` are always excluded. |
| `home`    | Markdown file published as `Home`. Default: a generated Home listing the sections. |
| `sidebar` | Markdown file published as `_Sidebar` (links rewritten, no banner). Default: built from the folder structure. |
| `index`   | File names acting as the index of a folder (default `index.md`, `README.md`). |
| `banner`  | Banner template; `{path}`, `{url}`, `{sha}`, `{repo}`. |
| `blobRef` | Ref in links to non-doc files: `sha` (default: the published commit) or a branch name such as `main`. |

## Page names

The name is `<prefix>-<path relative to the source folder>`, with `/` replaced by `-`, the extension removed and
unsafe characters replaced by `-`. For `engine/docs/**` with section "Engine", `engine/docs/catalogue.md` becomes
`Engine-catalogue`; use `"prefix": "Engine-docs"` to get `Engine-docs-catalogue`. A folder's index file is named after
the folder (`Engine`, `Engine-sub`). Two files with the same name (case-insensitive) are an error.

## Sidebar

Built per source: the section heading (linked when the source root has an index file), then files (by title) and
folders (linked when they have an index file), alphabetically and nested. A file's title comes from the front matter
`title`, else its first `# heading`, else its file name.

## Front matter

A leading YAML block is removed from the page. `title` sets the sidebar title; `wiki: false` keeps the file out of the
wiki.

## Links

- relative link to a published doc: `[x](../a/b.md#h)` becomes `[x](Section-a-b#h)`;
- relative link to a folder: its index page when published, else a `tree` URL;
- images: copied to `_assets/<repository path>` (the whole `_assets/` folder belongs to DocsMe);
- any other existing file: a `blob` URL;
- external URLs and `#anchors` are left alone; links to missing files are reported as **broken** (and fail with
  `--strict`). Code blocks and inline code are never rewritten.

## Ownership

Every page DocsMe writes starts with `<!-- docs-me:source=<path> -->`. Only such pages are updated or removed. A page
that exists in the wiki without the marker and has the name of a doc is a conflict: nothing is pushed and the run
fails. `Home` and `_Sidebar` are the exception: the page created in the GitHub UI to initialise the wiki is replaced.
