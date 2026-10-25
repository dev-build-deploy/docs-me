/*
 * SPDX-FileCopyrightText: 2026 Kevin de Jong <monkaii@hotmail.com>
 * SPDX-License-Identifier: MIT
 */

import { parse as parseYaml } from "yaml";

export interface FrontMatter {
  data: Record<string, unknown>;
  body: string;
}

/** Splits a leading YAML front matter block from the Markdown body. */
export function splitFrontMatter(text: string): FrontMatter {
  const m = /^﻿?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(text);
  if (!m) return { data: {}, body: text };
  let data: Record<string, unknown> = {};
  try {
    const parsed = parseYaml(m[1]);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) data = parsed as Record<string, unknown>;
  } catch (_e) {
    return { data: {}, body: text };
  }
  return { data, body: text.slice(m[0].length) };
}

/** First level-1 ATX heading outside code fences. */
export function firstHeading(body: string): string | undefined {
  let fence: string | undefined;
  for (const line of body.split(/\r?\n/)) {
    const f = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
    if (f) {
      if (!fence) fence = f[1].slice(0, 1);
      else if (f[1].slice(0, 1) === fence) fence = undefined;
      continue;
    }
    if (fence) continue;
    const h = /^#\s+(.+?)\s*#*\s*$/.exec(line);
    if (h) return h[1];
  }
  return undefined;
}

/** A link found in a document. */
export interface LinkRef {
  dest: string;
  image: boolean;
  line: number;
}

type Rewriter = (link: LinkRef) => string;

const INLINE = /(!?)\[((?:[^\[\]]|\[[^\]]*\])*)\]\(\s*(<[^>]*>|[^\s)]+)((?:\s+"[^"]*")?)\s*\)/g;
const REFDEF = /^(\s{0,3}\[[^\]]+\]:\s*)(<[^>]*>|\S+)/;
const HTMLATTR = /(<(img|a)\b[^>]*?\s(?:src|href)=)(["'])(.*?)\3/gi;

/**
 * Rewrites every link destination (inline links, images, reference definitions, and src/href in raw HTML)
 * outside code fences and inline code with the given function.
 */
export function rewriteLinks(body: string, fn: Rewriter): string {
  let fence: string | undefined;
  return body
    .split("\n")
    .map((line, idx) => {
      const f = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
      if (f) {
        if (!fence) fence = f[1].slice(0, 1);
        else if (f[1].slice(0, 1) === fence) fence = undefined;
        return line;
      }
      if (fence) return line;
      // Keep inline code spans untouched: only rewrite the parts between them
      const parts = line.split(/(`+[^`]*?`+)/);
      return parts
        .map((part, i) => {
          if (i % 2 === 1) return part;
          const ref = REFDEF.exec(part);
          if (ref) {
            const dest = ref[2].replace(/^<|>$/g, "");
            return ref[1] + fn({ dest, image: false, line: idx + 1 }) + part.slice(ref[0].length);
          }
          let out = part.replace(INLINE, (_m, bang: string, text: string, dest: string, title: string) => {
            const d = dest.replace(/^<|>$/g, "");
            const r = fn({ dest: d, image: bang === "!", line: idx + 1 });
            return `${bang}[${text}](${r.includes(" ") ? `<${r}>` : r}${title})`;
          });
          out = out.replace(HTMLATTR, (_m, pre: string, tag: string, q: string, dest: string) => {
            return pre + q + fn({ dest, image: tag.toLowerCase() === "img", line: idx + 1 }) + q;
          });
          return out;
        })
        .join("");
    })
    .join("\n");
}
