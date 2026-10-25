/*
 * SPDX-FileCopyrightText: 2026 Kevin de Jong <monkaii@hotmail.com>
 * SPDX-License-Identifier: MIT
 */

import { parseConfiguration } from "../src/config";
import { buildPlan } from "../src/plan";

import { CONFIG, makeTree, TREE } from "./helpers";

const info = { repo: "o/r", sha: "f".repeat(40), shortSha: "fffffff" };

test("sidebar is built from the folder structure and index files", () => {
  const p = buildPlan(makeTree(TREE), parseConfiguration(CONFIG), info);
  expect(p.pages.get("_Sidebar")).toBe(
    [
      "<!-- docs-me:generated -->",
      "**[Home](Home)**",
      "",
      "### [Engine](Engine)",
      "",
      "- [The Catalogue](Engine-catalogue)",
      "- Sub",
      "  - [Deep](Engine-sub-deep)",
      "",
      "### Leertoren",
      "",
      "- [Design](Leertoren-design)",
      "",
    ].join("\n")
  );
});

test("a configured sidebar source is used, links rewritten, no banner", () => {
  const tree = { ...TREE, "docs/side.md": "* [Cat](../engine/docs/catalogue.md)\n" };
  const p = buildPlan(makeTree(tree), parseConfiguration({ ...CONFIG, sidebar: "docs/side.md" }), info);
  expect(p.pages.get("_Sidebar")).toBe("<!-- docs-me:source=docs/side.md -->\n* [Cat](Engine-catalogue)\n");
});

test("a generated Home lists the sections when no home is configured", () => {
  const p = buildPlan(makeTree(TREE), parseConfiguration({ ...CONFIG, home: undefined }), info);
  expect(p.pages.get("Home")).toContain("## [Engine](Engine)");
});
