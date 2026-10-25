/*
 * SPDX-FileCopyrightText: 2026 Kevin de Jong <monkaii@hotmail.com>
 * SPDX-License-Identifier: MIT
 */

import fs from "fs";
import path from "path";

import { sync as globSync } from "fast-glob";

import { Configuration } from "./config";
import { firstHeading, rewriteLinks, splitFrontMatter } from "./markdown";

/** Marker on the first line of every page owned by docs-me. */
export const MARKER_PREFIX = "<!-- docs-me:";
export const ASSET_DIR = "_assets";
const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".avif", ".bmp", ".ico"]);

export interface RepoInfo {
  /** "owner/name" */
  repo: string;
  /** Commit the docs are published from (full sha) */
  sha: string;
  /** Short sha for display */
  shortSha: string;
  /** Last commit (full sha) touching a path; defaults to sha */
  lastCommit?: (file: string) => string | undefined;
}

export interface Doc {
  /** Repository path (posix, relative to the root) */
  file: string;
  section: string;
  title: string;
  /** Wiki page name (no extension) */
  page: string;
  isIndex: boolean;
  /** Directory relative to the source base ("" = the root of the source) */
  dir: string;
  sourceIndex: number;
}

export interface BrokenLink {
  file: string;
  line: number;
  dest: string;
  reason: string;
}

export interface Plan {
  /** page name -> full content (including marker) */
  pages: Map<string, string>;
  /** page name -> repository path it was generated from */
  origins: Map<string, string>;
  /** wiki path (under _assets/) -> repository path */
  assets: Map<string, string>;
  broken: BrokenLink[];
  docs: Doc[];
}

const toPosix = (p: string): string => p.split(path.sep).join("/");

/** Turns a string into a safe wiki page name part. */
export function slug(s: string): string {
  return s
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

function humanize(file: string): string {
  const b = path.posix.basename(file).replace(/\.(md|markdown)$/i, "");
  return b.replace(/[-_]+/g, " ").replace(/^\w/, c => c.toUpperCase());
}

/** The folder part of a glob or folder source ("engine/docs/**" -> "engine/docs"). */
export function staticBase(p: string): string {
  const segs = p.replace(/\/+$/, "").split("/");
  const out: string[] = [];
  for (const s of segs) {
    if (/[*?[\]{}!()]/.test(s)) break;
    out.push(s);
  }
  // a plain file path as a source: base is its folder
  const base = out.join("/");
  return base;
}

function expand(root: string, src: string, exclude: string[]): string[] {
  const clean = src.replace(/^\.\//, "");
  const isGlob = /[*?[\]{}]/.test(clean);
  let pattern = clean;
  if (!isGlob) {
    const abs = path.join(root, clean);
    pattern = fs.existsSync(abs) && fs.statSync(abs).isFile() ? clean : `${clean.replace(/\/+$/, "")}/**`;
  }
  return globSync(pattern, {
    cwd: root,
    ignore: ["**/node_modules/**", "**/.git/**", ...exclude],
    onlyFiles: true,
    dot: false,
  })
    .filter(f => /\.(md|markdown)$/i.test(f))
    .map(toPosix)
    .sort();
}

/** Discovers the documents of all sources and names their wiki pages. */
export function discover(root: string, cfg: Configuration): Doc[] {
  const docs: Doc[] = [];
  const seen = new Set<string>();
  const names = new Map<string, string>();
  const home = cfg.home ? toPosix(path.normalize(cfg.home)) : undefined;
  const sidebar = cfg.sidebar ? toPosix(path.normalize(cfg.sidebar)) : undefined;

  cfg.sources.forEach((src, sourceIndex) => {
    const base = staticBase(src.path.replace(/^\.\//, ""));
    const prefix = slug(src.prefix ?? src.section);
    for (const file of expand(root, src.path, cfg.exclude)) {
      if (seen.has(file) || file === sidebar) continue;
      seen.add(file);
      const rel =
        base && file.startsWith(base + "/")
          ? file.slice(base.length + 1)
          : base === file
            ? path.posix.basename(file)
            : file;
      const dir = path.posix.dirname(rel) === "." ? "" : path.posix.dirname(rel);
      const isIndex = cfg.index.includes(path.posix.basename(rel));
      const noExt = rel.replace(/\.(md|markdown)$/i, "");
      const nameRel = isIndex ? dir : noExt;
      const page =
        file === home ? "Home" : [prefix, slug(nameRel.split("/").map(slug).join("-"))].filter(Boolean).join("-");
      const key = page.toLowerCase();
      if (names.has(key) && names.get(key) !== file)
        throw new Error(
          `Page name collision: "${page}" for both ${names.get(key)} and ${file}; set a "prefix" or exclude one`
        );
      names.set(key, file);
      const { data, body } = splitFrontMatter(fs.readFileSync(path.join(root, file), "utf8"));
      if (data.wiki === false || data.publish === false) continue;
      const title = typeof data.title === "string" ? data.title : (firstHeading(body) ?? humanize(file));
      docs.push({ file, section: src.section, title, page, isIndex, dir, sourceIndex });
    }
  });

  // The home file may live outside of the sources
  if (home && !seen.has(home) && fs.existsSync(path.join(root, home))) {
    const { data, body } = splitFrontMatter(fs.readFileSync(path.join(root, home), "utf8"));
    const title = typeof data.title === "string" ? data.title : (firstHeading(body) ?? "Home");
    docs.push({ file: home, section: "", title, page: "Home", isIndex: false, dir: "", sourceIndex: -1 });
  }
  return docs;
}

interface Node {
  label: string;
  page?: string;
  children: Map<string, Node>;
}

function nodeFor(root: Node, dir: string): Node {
  let n = root;
  for (const seg of dir.split("/").filter(Boolean)) {
    if (!n.children.has("d:" + seg)) n.children.set("d:" + seg, { label: humanize(seg), children: new Map() });
    n = n.children.get("d:" + seg) as Node;
  }
  return n;
}

function renderNode(n: Node, depth: number, out: string[]): void {
  const keys = [...n.children.keys()].sort(
    (a, b) => a.slice(2).toLowerCase().localeCompare(b.slice(2).toLowerCase()) || a.localeCompare(b)
  );
  // files before folders, each alphabetical
  const ordered = [...keys.filter(k => k.startsWith("f:")), ...keys.filter(k => k.startsWith("d:"))];
  for (const k of ordered) {
    const c = n.children.get(k) as Node;
    const text = c.page ? `[${c.label}](${c.page})` : c.label;
    out.push(`${"  ".repeat(depth)}- ${text}`);
    renderNode(c, depth + 1, out);
  }
}

/** Builds the sidebar (or Home listing) from the folder structure and the folders' index files. */
export function buildTree(docs: Doc[], cfg: Configuration, heading: string): string {
  const out: string[] = [];
  cfg.sources.forEach((src, i) => {
    const mine = docs.filter(d => d.sourceIndex === i);
    if (mine.length === 0) return;
    const root: Node = { label: src.section, children: new Map() };
    for (const d of mine) {
      if (d.isIndex) {
        const n = nodeFor(root, d.dir);
        n.page = d.page;
        n.label = d.dir === "" ? src.section : d.title;
      } else {
        nodeFor(root, d.dir).children.set("f:" + d.file, { label: d.title, page: d.page, children: new Map() });
      }
    }
    out.push(`${heading} ${root.page ? `[${src.section}](${root.page})` : src.section}`, "");
    const lines: string[] = [];
    renderNode(root, 0, lines);
    out.push(...lines, "");
  });
  return out.join("\n");
}

function mark(file: string): string {
  return `${MARKER_PREFIX}source=${file} -->`;
}

/** Builds every wiki page for the repository in root. Pure with respect to the wiki: reads only the source tree. */
export function buildPlan(root: string, cfg: Configuration, info: RepoInfo): Plan {
  const docs = discover(root, cfg);
  const byFile = new Map(docs.map(d => [d.file, d]));
  const pages = new Map<string, string>();
  const origins = new Map<string, string>();
  const assets = new Map<string, string>();
  const broken: BrokenLink[] = [];
  const ref = cfg.blobRef === "sha" ? info.sha : cfg.blobRef;
  const blob = (kind: "blob" | "tree", p: string): string => `https://github.com/${info.repo}/${kind}/${ref}/${p}`;

  const convert = (file: string, body: string, offset = 0): string =>
    rewriteLinks(body, ({ dest, image, line }) => {
      if (dest === "" || dest.startsWith("#") || /^[a-z][a-z0-9+.-]*:/i.test(dest) || dest.startsWith("//"))
        return dest;
      const m = /^([^#?]*)([?#].*)?$/.exec(dest) as RegExpExecArray;
      let p = m[1];
      const tail = m[2] ?? "";
      try {
        p = decodeURI(p);
      } catch (_e) {
        /* keep as is */
      }
      const target = p.startsWith("/")
        ? path.posix.normalize(p.slice(1))
        : path.posix.normalize(path.posix.join(path.posix.dirname(file), p));
      if (target.startsWith("../") || target === "..") {
        broken.push({ file, line: line + offset, dest, reason: "outside the repository" });
        return dest;
      }
      const abs = path.join(root, target);
      if (!fs.existsSync(abs)) {
        broken.push({ file, line: line + offset, dest, reason: "target does not exist" });
        return dest;
      }
      const doc = byFile.get(target);
      if (doc) return doc.page + (tail.startsWith("#") ? tail : "");
      if (fs.statSync(abs).isDirectory()) {
        const idx = cfg.index.map(i => byFile.get(path.posix.join(target, i))).find(Boolean);
        return idx ? idx.page + (tail.startsWith("#") ? tail : "") : blob("tree", target) + tail;
      }
      if (image || IMAGE_EXT.has(path.posix.extname(target).toLowerCase())) {
        if (IMAGE_EXT.has(path.posix.extname(target).toLowerCase())) {
          assets.set(target, target);
          return `${ASSET_DIR}/${target.split("/").map(encodeURIComponent).join("/")}${tail}`;
        }
      }
      return blob("blob", target) + tail;
    });

  for (const d of docs) {
    const raw = fs.readFileSync(path.join(root, d.file), "utf8");
    const { body } = splitFrontMatter(raw);
    const offset = raw.split("\n").length - body.split("\n").length;
    const last = info.lastCommit?.(d.file) ?? info.sha;
    const url = `https://github.com/${info.repo}/blob/${last}/${d.file}`;
    const sha = last.slice(0, 7);
    const banner = cfg.banner
      .replace(/\{path\}/g, d.file)
      .replace(/\{url\}/g, url)
      .replace(/\{sha\}/g, sha)
      .replace(/\{repo\}/g, info.repo);
    const text = `${mark(d.file)}\n${banner}\n\n${convert(d.file, body, offset)
      .replace(/^\s*\n/, "")
      .trimEnd()}\n`;
    pages.set(d.page, text);
    origins.set(d.page, d.file);
  }

  // Home: the configured file, else generated
  if (!pages.has("Home")) {
    const text =
      `${MARKER_PREFIX}generated -->\n\n# ${info.repo.split("/")[1]}\n\n${buildTree(docs, cfg, "##")}`.trimEnd() + "\n";
    pages.set("Home", text);
    origins.set("Home", "(generated)");
  }

  // Sidebar: the configured file, else generated
  if (cfg.sidebar && fs.existsSync(path.join(root, cfg.sidebar))) {
    const sf = toPosix(path.normalize(cfg.sidebar));
    const { body } = splitFrontMatter(fs.readFileSync(path.join(root, sf), "utf8"));
    pages.set("_Sidebar", `${mark(sf)}\n${convert(sf, body).trimEnd()}\n`);
    origins.set("_Sidebar", sf);
  } else {
    pages.set(
      "_Sidebar",
      `${MARKER_PREFIX}generated -->\n**[Home](Home)**\n\n${buildTree(docs, cfg, "###")}`.trimEnd() + "\n"
    );
    origins.set("_Sidebar", "(generated)");
  }

  broken.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  return { pages, origins, assets, broken, docs };
}
