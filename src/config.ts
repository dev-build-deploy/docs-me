/*
 * SPDX-FileCopyrightText: 2026 Kevin de Jong <monkaii@hotmail.com>
 * SPDX-License-Identifier: MIT
 */

import fs from "fs";
import path from "path";

/** A set of documents mapped to a wiki section. */
export interface Source {
  /** Folder or glob (relative to the repository root), e.g. "engine/docs/**" */
  path: string;
  /** Section title in the sidebar; also the default page name prefix */
  section: string;
  /** Page name prefix (default: the section, spaces replaced by "-") */
  prefix?: string;
}

export interface Configuration {
  sources: Source[];
  exclude: string[];
  /** Markdown file published as Home.md (default: none, Home is generated) */
  home?: string;
  /** Markdown file published as _Sidebar.md (default: built from the folder structure) */
  sidebar?: string;
  /** File names that act as the index of a folder (first match wins) */
  index: string[];
  /** Banner template; placeholders: {path} {url} {sha} {repo} */
  banner: string;
  /** Ref used for links to non-doc files: "sha" (the published commit) or a branch name */
  blobRef: string;
}

export const DEFAULT_BANNER =
  "> Generated from [`{path}`]({url}) at `{sha}`: edit it in the repository, not in the wiki.";

export const DEFAULT_CONFIG_FILE = ".docs-me.json";

export function parseConfiguration(raw: unknown): Configuration {
  if (typeof raw !== "object" || raw === null) throw new Error("Configuration must be a JSON object");
  const cfg = raw as Record<string, unknown>;
  if (!Array.isArray(cfg.sources) || cfg.sources.length === 0)
    throw new Error('Configuration needs a non-empty "sources" array');
  const sources: Source[] = cfg.sources.map((s: unknown, i: number) => {
    const o = s as Record<string, unknown>;
    if (typeof o?.path !== "string" || typeof o?.section !== "string")
      throw new Error(`sources[${i}] needs a "path" and a "section" (strings)`);
    return { path: o.path, section: o.section, prefix: typeof o.prefix === "string" ? o.prefix : undefined };
  });
  const strings = (v: unknown, name: string, def: string[]): string[] => {
    if (v === undefined) return def;
    if (!Array.isArray(v) || v.some(x => typeof x !== "string"))
      throw new Error(`"${name}" must be an array of strings`);
    return v as string[];
  };
  const opt = (v: unknown, name: string): string | undefined => {
    if (v === undefined || v === null) return undefined;
    if (typeof v !== "string") throw new Error(`"${name}" must be a string`);
    return v;
  };
  return {
    sources,
    exclude: strings(cfg.exclude, "exclude", []),
    home: opt(cfg.home, "home"),
    sidebar: opt(cfg.sidebar, "sidebar"),
    index: strings(cfg.index, "index", ["index.md", "README.md"]),
    banner: opt(cfg.banner, "banner") ?? DEFAULT_BANNER,
    blobRef: opt(cfg.blobRef, "blobRef") ?? "sha",
  };
}

export function loadConfiguration(root: string, file = DEFAULT_CONFIG_FILE): Configuration {
  const p = path.resolve(root, file);
  if (!fs.existsSync(p)) throw new Error(`Configuration file not found: ${p}`);
  return parseConfiguration(JSON.parse(fs.readFileSync(p, "utf8")));
}
