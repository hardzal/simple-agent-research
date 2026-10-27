import { marked } from "marked";
import { normalizeSourceUrl, type Source } from "./source-registry.js";

export function reportCitationIds(content: string): string[] {
  const heading = /^##\s+(?:Sources|Sumber|References|Referensi)\s*$/im.exec(
    content,
  );
  const body = content.slice(0, heading?.index ?? content.length);
  return [
    ...new Set(
      [...body.matchAll(/\[(S[1-9]\d*)\]/g)].map((match) => match[1]!),
    ),
  ];
}

function linksIn(content: string): { urls: string[]; hasHtml: boolean } {
  const tokens = marked.lexer(content);
  const urls = Object.values(tokens.links).map((link) => link.href);
  let hasHtml = false;
  marked.walkTokens(tokens, (token) => {
    if (token.type === "link" || token.type === "image") urls.push(token.href);
    if (token.type === "html") hasHtml = true;
  });
  // Code and other non-link text must not smuggle unregistered URLs either.
  for (const match of content.matchAll(/https?:\/\/[^\s<>"'`[\]]+/gi)) {
    let raw = match[0].replace(/[,.;!?]+$/, "");
    // A Markdown closing delimiter is not part of the URL, but balanced
    // parentheses in a path/query are. Never trim the source's own pair.
    let extraClosings =
      (raw.match(/\)/g)?.length ?? 0) - (raw.match(/\(/g)?.length ?? 0);
    while (extraClosings > 0 && raw.endsWith(")")) {
      raw = raw.slice(0, -1);
      extraClosings--;
    }
    if (!urls.includes(raw)) urls.push(raw);
  }
  return { urls, hasHtml };
}

export function validateReport(
  content: string,
  sources: Source[],
  maxBytes: number,
): string[] {
  if (!content.trim()) return ["EMPTY_REPORT"];
  if (Buffer.byteLength(content, "utf8") > maxBytes)
    return ["REPORT_TOO_LARGE"];
  const issues = new Set<string>();
  const heading = /^##\s+(?:Sources|Sumber|References|Referensi)\s*$/im.exec(
    content,
  );
  if (!/^#\s+\S.+$/m.test(content) || !heading) issues.add("REPORT_STRUCTURE");
  const body = content.slice(0, heading?.index ?? content.length);
  const sourceSection = heading ? content.slice(heading.index) : "";
  const registry = new Map(
    sources.map((source) => [source.sourceId, source.url]),
  );
  const allowed = new Set(sources.map((source) => source.url));
  const citations = [...body.matchAll(/\[(S[1-9]\d*)\]/g)].map(
    (match) => match[1]!,
  );
  if (!citations.length) issues.add("MISSING_CITATION");
  for (const match of content.matchAll(/\[(S[1-9]\d*)\]/g)) {
    if (!registry.has(match[1]!)) issues.add("UNKNOWN_SOURCE_ID");
  }
  for (const id of citations) {
    const expected = registry.get(id);
    const mapped = sourceSection.split(/\r?\n/).some((line) => {
      if (!line.includes(`[${id}]`)) return false;
      return linksIn(line).urls.some((url) => {
        try {
          return normalizeSourceUrl(url) === expected;
        } catch {
          return false;
        }
      });
    });
    if (!expected || !mapped) issues.add("CITATION_SOURCE_MISMATCH");
  }
  const links = linksIn(content);
  if (links.hasHtml) issues.add("HTML_NOT_SUPPORTED");
  for (const url of links.urls) {
    try {
      if (!allowed.has(normalizeSourceUrl(url)))
        issues.add("FOREIGN_SOURCE_URL");
    } catch {
      issues.add("INVALID_SOURCE_URL");
    }
  }
  return [...issues];
}
