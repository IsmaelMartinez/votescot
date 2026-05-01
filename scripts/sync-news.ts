import fs from "node:fs";
import path from "node:path";
import { fetchHtml } from "./lib/api";

const SOURCES: { name: string; url: string; feed: string }[] = [
  {
    name: "BBC News",
    url: "https://www.bbc.co.uk/news/scotland/scotland_politics",
    feed: "https://feeds.bbci.co.uk/news/scotland/scotland_politics/rss.xml",
  },
  {
    name: "Ballot Box Scotland",
    url: "https://ballotbox.scot",
    feed: "https://ballotbox.scot/feed/",
  },
  {
    name: "The Guardian — Scotland politics",
    url: "https://www.theguardian.com/politics/scotland",
    feed: "https://www.theguardian.com/politics/scotland/rss",
  },
];

const OUTPUT_PATH = path.join(process.cwd(), "data/news.json");
const MAX_ITEMS = 30;
const MIN_ITEMS = 3;

interface NewsItem {
  title: string;
  description: string;
  url: string;
  publishedAt: string;
  source: string;
}

const NAMED_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
};

function decodeEntities(text: string): string {
  // Single-pass replacement avoids double-decoding (e.g. &amp;lt; should stay
  // "&lt;" not become "<") and keeps numeric/hex/named entities consistent.
  // `String.fromCodePoint` handles non-BMP characters (emoji etc.) correctly,
  // unlike `String.fromCharCode` which truncates to 16 bits.
  return text.replace(
    /&(?:#(\d+)|#x([0-9a-fA-F]+)|amp|lt|gt|quot|apos);/g,
    (match, dec, hex) => {
      if (dec !== undefined) return String.fromCodePoint(parseInt(dec, 10));
      if (hex !== undefined) return String.fromCodePoint(parseInt(hex, 16));
      return NAMED_ENTITIES[match] ?? match;
    },
  );
}

function decode(text: string): string {
  // Order matters: strip CDATA first, then decode entities, then strip tags.
  // Decoding entities before tag-stripping ensures input like `&lt;script&gt;`
  // becomes `<script>` so the tag stripper can remove it. Stripping tags
  // first would leave the encoded form intact and only sanitise it after,
  // which CodeQL flags as `js/incomplete-multi-character-sanitization`.
  // Doubly-encoded input like `&amp;lt;script&amp;gt;` decodes once to the
  // literal text `&lt;script&gt;`, which contains no real tags to strip.
  const withoutCdata = text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  const decoded = decodeEntities(withoutCdata);
  return decoded.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
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
    const parsed = pubDate ? new Date(pubDate) : null;
    const publishedAt = parsed && !isNaN(parsed.getTime()) ? parsed.toISOString() : "";
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
