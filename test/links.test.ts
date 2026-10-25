/*
 * SPDX-FileCopyrightText: 2026 Kevin de Jong <monkaii@hotmail.com>
 * SPDX-License-Identifier: MIT
 */

import { parseConfiguration } from "../src/config";
import { firstHeading, rewriteLinks, splitFrontMatter } from "../src/markdown";
import { buildPlan } from "../src/plan";

import { CONFIG, makeTree, TREE } from "./helpers";

const info = { repo: "o/r", sha: "f".repeat(40), shortSha: "fffffff" };
const plan = (): ReturnType<typeof buildPlan> => buildPlan(makeTree(TREE), parseConfiguration(CONFIG), info);

describe("front matter", () => {
  test("is stripped and gives the title", () => {
    const fm = splitFrontMatter("---\ntitle: Hi\n---\n# Body\n");
    expect(fm.data.title).toBe("Hi");
    expect(fm.body).toBe("# Body\n");
  });
  test("absent or invalid front matter leaves the text alone", () => {
    expect(splitFrontMatter("# x").body).toBe("# x");
    expect(splitFrontMatter("---\n: : :\n  - [\n---\nx").body).toContain("x");
  });
  test("first heading ignores code fences", () => {
    expect(firstHeading("```\n# no\n```\n# Yes\n")).toBe("Yes");
  });
});

describe("rewriteLinks", () => {
  test("skips fences and inline code, handles images, refs and html", () => {
    const seen: string[] = [];
    const out = rewriteLinks(
      '[a](x.md)\n```\n[b](y.md)\n```\n`[c](z.md)` ![i](p.png)\n[r]: q.md\n<img src="h.png">',
      l => {
        seen.push(l.dest);
        return "N";
      }
    );
    expect(seen).toEqual(["x.md", "p.png", "q.md", "h.png"]);
    expect(out).toContain("[a](N)");
    expect(out).toContain("[b](y.md)");
    expect(out).toContain("`[c](z.md)`");
    expect(out).toContain("[r]: N");
  });
});

describe("page names", () => {
  test("are path-derived and stable, with folder indexes named after the folder", () => {
    const names = plan()
      .docs.map(d => d.page)
      .sort();
    expect(names).toEqual(["Engine", "Engine-catalogue", "Engine-sub-deep", "Home", "Leertoren-design"]);
  });
  test("collisions are an error", () => {
    const root = makeTree({ "a/x.md": "#a", "a/x/index.md": "#b", "a/x.markdown": "#c" });
    expect(() => buildPlan(root, parseConfiguration({ sources: [{ path: "a", section: "S" }] }), info)).toThrow(
      /collision/
    );
  });
  test("excludes are honoured", () => {
    expect(plan().pages.has("Engine-draft-wip")).toBe(false);
  });
});

describe("link rewriting", () => {
  const p = plan();
  const cat = p.pages.get("Engine-catalogue") as string;
  test("doc links become wiki links, anchors kept", () => {
    expect(cat).toContain("[up](Engine)");
    expect(cat).toContain("[sub](Engine-sub-deep#x)");
    expect(p.pages.get("Home")).toContain("[catalogue](Engine-catalogue#items)");
  });
  test("links across sources work", () => {
    expect(p.pages.get("Engine-sub-deep")).toContain("[leertoren](Leertoren-design)");
  });
  test("non-doc files and folders become blob/tree urls at the commit", () => {
    expect(p.pages.get("Home")).toContain(`[code](https://github.com/o/r/blob/${info.sha}/engine/src/main.c)`);
    expect(p.pages.get("Engine-sub-deep")).toContain(`[dir](https://github.com/o/r/tree/${info.sha}/engine/src)`);
  });
  test("images are copied and linked", () => {
    expect(cat).toContain("![pic](_assets/engine/docs/img/a.png)");
    expect([...p.assets.keys()]).toEqual(["engine/docs/img/a.png"]);
  });
  test("broken links are reported (not in code), external and anchors untouched", () => {
    expect(p.broken.map(b => `${b.file}:${b.line}:${b.dest}`)).toEqual(["engine/docs/catalogue.md:5:nope.md"]);
    expect(cat).toContain("[ext](https://example.com/a.md) [anchor](#here)");
  });
  test("banner and marker on every page, front matter gone", () => {
    expect(
      cat.startsWith("<!-- docs-me:source=engine/docs/catalogue.md -->\n> Generated from [`engine/docs/catalogue.md`]")
    ).toBe(true);
    expect(cat).not.toContain("title: The Catalogue");
  });
});
