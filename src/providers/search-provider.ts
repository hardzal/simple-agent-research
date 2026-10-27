import { z } from "zod";

export type SearchHit = {
  title: string;
  url: string;
  snippet: string;
  publishedAt?: string;
};
export interface SearchProvider {
  search(
    query: string,
    options: { maxResults: number; signal: AbortSignal },
  ): Promise<SearchHit[]>;
}

const responseSchema = z.object({
  results: z.array(
    z.object({
      url: z.string(),
      title: z.string().nullish(),
      content: z.string().nullish(),
      published_date: z.string().nullish(),
    }),
  ),
});

export function createTavilyProvider(
  apiKey: string,
  maxSnippetChars: number,
  fetcher: typeof fetch = fetch,
): SearchProvider {
  return {
    async search(query, { maxResults, signal }) {
      try {
        signal.throwIfAborted();
        const response = await fetcher("https://api.tavily.com/search", {
          method: "POST",
          signal,
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query,
            max_results: Math.min(5, maxResults),
            search_depth: "basic",
            auto_parameters: false,
            include_answer: false,
            include_raw_content: false,
            include_images: false,
          }),
        });
        if (!response.ok) throw new Error();
        const data = responseSchema.parse(await response.json());
        signal.throwIfAborted();
        return data.results.slice(0, Math.min(5, maxResults)).map((hit) => ({
          title: (hit.title ?? "").slice(0, 500),
          url: hit.url,
          snippet: (hit.content ?? "").slice(0, maxSnippetChars),
          ...(hit.published_date ? { publishedAt: hit.published_date } : {}),
        }));
      } catch {
        throw new Error(
          signal.aborted ? "SEARCH_ABORTED" : "SEARCH_PROVIDER_FAILED",
        );
      }
    },
  };
}
