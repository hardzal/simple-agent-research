import { marked, type Token } from "marked";
import { normalizeSourceUrl, type Source } from "./source-registry.js";

type CitationEvent = { kind: "id" | "url"; value: string } | { kind: "break" };

function children(token: Token): Token[] {
  if (token.type === "list") return token.items;
  if (token.type === "table")
    return [...token.header, ...token.rows.flat()].flatMap(
      (cell) => cell.tokens,
    );
  return "tokens" in token && token.tokens ? token.tokens : [];
}

function reportParts(content: string) {
  const tokens = marked.lexer(content);
  const start = tokens.findIndex(
    (token) =>
      token.type === "heading" &&
      token.depth === 2 &&
      /^(?:Sources|Sumber|References|Referensi)$/i.test(token.text.trim()),
  );
  const end = tokens.findIndex(
    (token, index) =>
      index > start && token.type === "heading" && token.depth <= 2,
  );
  return {
    tokens,
    hasSources: start >= 0,
    body: start < 0 ? tokens : tokens.slice(0, start),
    sources:
      start < 0 ? [] : tokens.slice(start + 1, end < 0 ? undefined : end),
  };
}

// Work on rendered inline tokens, not raw block text: escaped markers and code
// cannot establish citations. Boundaries prevent a URL in another entry pairing.
function citationEvents(tokens: Token[], definitions = false): CitationEvent[] {
  const events: CitationEvent[] = [];
  function visit(token: Token) {
    if (["code", "codespan", "html", "escape", "image"].includes(token.type))
      return;
    if (token.type === "def") {
      if (definitions && /^s[1-9]\d*$/i.test(token.tag)) {
        events.push(
          { kind: "break" },
          { kind: "id", value: token.tag.toUpperCase() },
          { kind: "url", value: token.href },
          { kind: "break" },
        );
      }
      return;
    }
    const nested = children(token);
    const boundary = ["paragraph", "list_item", "heading", "br"].includes(
      token.type,
    );
    if (boundary) events.push({ kind: "break" });
    if (token.type === "link") {
      if (/^S[1-9]\d*$/.test(token.text))
        events.push({ kind: "id", value: token.text });
      else nested.forEach(visit);
      events.push({ kind: "url", value: token.href });
    } else if (nested.length) {
      nested.forEach(visit);
    } else if (token.type === "text") {
      for (const match of token.raw.matchAll(/\[(S[1-9]\d*)\]|\r?\n/g)) {
        events.push(
          match[1] ? { kind: "id", value: match[1] } : { kind: "break" },
        );
      }
    }
    if (boundary) events.push({ kind: "break" });
  }
  tokens.forEach(visit);
  return events;
}

function citationIds(tokens: Token[]): string[] {
  return [
    ...new Set(
      citationEvents(tokens).flatMap((event) =>
        event.kind === "id" ? [event.value] : [],
      ),
    ),
  ];
}

export function reportCitationIds(content: string): string[] {
  return citationIds(reportParts(content).body);
}

function rawUrls(text: string): string[] {
  return [...text.matchAll(/https?:\/\/[^\s<>"'`[\]]+/gi)].map((match) => {
    let raw = match[0].replace(/[,.;!?]+$/, "");
    let extraClosings =
      (raw.match(/\)/g)?.length ?? 0) - (raw.match(/\(/g)?.length ?? 0);
    while (extraClosings > 0 && raw.endsWith(")")) {
      raw = raw.slice(0, -1);
      extraClosings--;
    }
    return raw;
  });
}

function linksIn(tokens: Token[]): { urls: string[]; hasHtml: boolean } {
  const urls: string[] = [];
  let hasHtml = false;
  marked.walkTokens(tokens, (token) => {
    if (token.type === "html") hasHtml = true;
    if (["link", "image", "def"].includes(token.type) && "href" in token) {
      urls.push(token.href);
      if (token.title) urls.push(...rawUrls(token.title));
      if (token.type === "image") urls.push(...rawUrls(token.text));
    } else if (!children(token).length) {
      // Parsed destinations are authoritative. Only scan unparsed leaves for
      // smuggled URLs (including code/HTML), not entire Markdown link syntax.
      urls.push(...rawUrls(token.raw));
    }
  });
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
  const parts = reportParts(content);
  if (
    !parts.body.some(
      (token) =>
        token.type === "heading" && token.depth === 1 && token.text.trim(),
    ) ||
    !parts.hasSources ||
    !parts.body.some((token) =>
      ["paragraph", "list", "blockquote", "table"].includes(token.type),
    )
  )
    issues.add("REPORT_STRUCTURE");
  const registry = new Map(
    sources.map((source) => [source.sourceId, source.url]),
  );
  const allowed = new Set(sources.map((source) => source.url));
  const citations = citationIds(parts.body);
  if (!citations.length) issues.add("MISSING_CITATION");
  for (const match of content.matchAll(/\[(S[1-9]\d*)\]/g)) {
    if (!registry.has(match[1]!)) issues.add("UNKNOWN_SOURCE_ID");
  }

  const mapped = new Set<string>();
  let entry: { id: string; urls: string[] } | undefined;
  function finishEntry() {
    if (!entry) return;
    const expected = registry.get(entry.id);
    if (
      !expected ||
      !entry.urls.length ||
      entry.urls.some((url) => {
        try {
          return normalizeSourceUrl(url) !== expected;
        } catch {
          return true;
        }
      })
    )
      issues.add("CITATION_SOURCE_MISMATCH");
    else mapped.add(entry.id);
    entry = undefined;
  }
  for (const event of citationEvents(parts.sources, true)) {
    if (event.kind === "id") {
      finishEntry();
      entry = { id: event.value, urls: [] };
    } else if (event.kind === "url") {
      entry?.urls.push(event.value);
    } else finishEntry();
  }
  finishEntry();
  if (citations.some((id) => !mapped.has(id)))
    issues.add("CITATION_SOURCE_MISMATCH");

  // A citation rendered as a link must agree with its registry entry too,
  // even if the destination happens to belong to a different allowed source.
  marked.walkTokens(parts.tokens, (token) => {
    if (token.type !== "link" || !/^S[1-9]\d*$/.test(token.text)) return;
    try {
      if (normalizeSourceUrl(token.href) !== registry.get(token.text))
        issues.add("CITATION_SOURCE_MISMATCH");
    } catch {
      issues.add("CITATION_SOURCE_MISMATCH");
    }
  });
  const links = linksIn(parts.tokens);
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
