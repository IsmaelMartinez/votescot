import fs from "node:fs";
import path from "node:path";
import { fetchHtml } from "./lib/api";

const SOURCES: { name: string; url: string; feed: string }[] = [
  {
    name: "BBC News",
    url: "https://www.bbc.co.uk/news/scotland/scotland_politics",
    feed: "https://feeds.bbci.co.uk/news/scotland/scotland_politics/rss.xml",
  },
];

const OUTPUT_PATH = path.join(process.cwd(), "data/news.json");
const MAX_ITEMS = 20;
const MIN_ITEMS = 3;

interface NewsItem {
  title: string;
  description: string;
  url: string;
  publishedAt: string;
  source: string;
}

function decode(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? decode(match[1]) : "";
}

function parseRss(xml: string, sourceName: string): NewsItem[] {
  const items: NewsItem[] = [];
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = extractTag(block, "title");
    const link = extractTag(block, "link");
    if (!title || !link) continue;
    const description = extractTag(block, "description");
    const pubDate = extractTag(block, "pubDate");
    const publishedAt = pubDate ? new Date(pubDate).toISOString() : "";
    if (!publishedAt) continue;
    items.push({ title, description, url: link, publishedAt, source: sourceName });
  }
  return items;
}

async function main(): Promise<void> {
  const collected: NewsItem[] = [];
  for (const src of SOURCES) {
    console.log(`Fetching ${src.name}: ${src.feed}`);
    const xml = await fetchHtml(src.feed);
    const parsed = parseRss(xml, src.name);
    console.log(`  Parsed ${parsed.length} items from ${src.name}`);
    collected.push(...parsed);
  }

  if (collected.length < MIN_ITEMS) {
    throw new Error(
      `Unexpectedly few news items parsed (got ${collected.length}, expected at least ${MIN_ITEMS}). ` +
        `Check for RSS schema changes before writing to ${OUTPUT_PATH}.`
    );
  }

  // Dedupe by canonical URL (strip query string) — the BBC feed sometimes
  // emits the same article multiple times with different #N suffixes.
  const seen = new Set<string>();
  const deduped: NewsItem[] = [];
  for (const item of collected) {
    const canonical = item.url.split("?")[0].split("#")[0];
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    deduped.push(item);
  }

  deduped.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const items = deduped.slice(0, MAX_ITEMS);

  const output = {
    lastUpdated: new Date().toISOString(),
    sources: SOURCES.map((s) => ({ name: s.name, url: s.url })),
    items,
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
  console.log(`\nWrote ${OUTPUT_PATH} with ${items.length} items.`);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
