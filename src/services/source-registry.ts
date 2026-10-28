import type { SearchHit } from "../providers/search-provider.js";
export type Source = SearchHit & { sourceId: string };

export function normalizeSourceUrl(value: string): string {
  try {
    const url = new URL(value);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      throw new Error();
    url.hash = "";
    return url.href;
  } catch {
    throw new Error("INVALID_SOURCE_URL");
  }
}

export function createSourceRegistry(maxSnippetChars: number) {
  const sources = new Map<string, Source>();
  return {
    add(hit: SearchHit): Source {
      const url = normalizeSourceUrl(hit.url);
      let source = sources.get(url);
      if (!source) {
        source = {
          ...hit,
          url,
          sourceId: `S${sources.size + 1}`,
          title: hit.title.slice(0, 500),
          snippet: hit.snippet.slice(0, maxSnippetChars),
        };
        sources.set(url, source);
      }
      return { ...source };
    },
    list(): Source[] {
      return Array.from(sources.values(), (source) => ({ ...source }));
    },
  };
}
export type SourceRegistry = ReturnType<typeof createSourceRegistry>;
