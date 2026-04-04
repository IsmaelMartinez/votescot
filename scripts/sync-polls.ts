import fs from "node:fs";
import path from "node:path";
import { fetchHtml } from "./lib/api";

const WIKI_URL =
  "https://en.wikipedia.org/wiki/Opinion_polling_for_the_2026_Scottish_Parliament_election";
const OUTPUT_PATH = path.join(process.cwd(), "data/polls.json");

interface PollEntry {
  date: string;
  endDate: string;
  pollster: string;
  client: string;
  sampleSize: number | null;
  snp: number | null;
  con: number | null;
  lab: number | null;
  libdem: number | null;
  green: number | null;
  alba: number | null;
  reform: number | null;
  others: number | null;
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&ndash;|&#8211;/g, "–")
    .replace(/&nbsp;/g, " ")
    .replace(/&#32;/g, " ")
    .replace(/&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#91;[^\]]*&#93;/g, "")  // strip [footnote] references
    .replace(/\[[^\]]*\]/g, "")        // strip any remaining [x] footnotes
    .replace(/\s+/g, " ")
    .trim();
}

function parsePercent(val: string): number | null {
  const clean = val.replace(/%/g, "").trim();
  if (clean === "–" || clean === "-" || clean === "" || clean === "N/A") return null;
  const n = parseFloat(clean);
  return isNaN(n) ? null : n;
}

function parseSampleSize(val: string): number | null {
  const clean = val.replace(/,/g, "").trim();
  const n = parseInt(clean, 10);
  return isNaN(n) ? null : n;
}

function extractEndDate(tdHtml: string): string | null {
  const m = tdHtml.match(/data-sort-value="(\d{4}-\d{2}-\d{2})"/);
  return m ? m[1] : null;
}

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

function parseMonth(s: string): string | null {
  return MONTHS[s.toLowerCase().slice(0, 3)] ?? null;
}

function parseStartDate(text: string, endDate: string): string {
  const rangeMatch = text.match(/(\d{1,2})\s*[–\-]\s*(\d{1,2})\s+(\w+)\s+(\d{4})/);
  if (rangeMatch) {
    const day = rangeMatch[1].padStart(2, "0");
    const month = parseMonth(rangeMatch[3]);
    if (month) return `${rangeMatch[4]}-${month}-${day}`;
  }

  const crossMatch = text.match(/(\d{1,2})\s+(\w+)\s*[–\-]\s*\d{1,2}\s+\w+\s+(\d{4})/);
  if (crossMatch) {
    const day = crossMatch[1].padStart(2, "0");
    const month = parseMonth(crossMatch[2]);
    if (month) return `${crossMatch[3]}-${month}-${day}`;
  }

  const singleMatch = text.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
  if (singleMatch) {
    const day = singleMatch[1].padStart(2, "0");
    const month = parseMonth(singleMatch[2]);
    if (month) return `${singleMatch[3]}-${month}-${day}`;
  }

  return endDate;
}

function extractCells(trHtml: string): string[] {
  const cells: string[] = [];
  const tdRegex = /<td([^>]*)>([\s\S]*?)<\/td>/gi;
  let m: RegExpExecArray | null;
  while ((m = tdRegex.exec(trHtml)) !== null) {
    cells.push(m[0]);
  }
  return cells;
}

interface ColMap {
  date: number;
  pollster: number;
  client: number;
  sample: number;
  snp: number;
  con: number;
  lab: number;
  libdem: number;
  green: number;
  alba: number;
  reform: number;
  others: number;
}

function buildColMap(headerRows: string[]): ColMap | null {
  const partyOrder: string[] = [];
  for (const row of headerRows) {
    const thRegex = /<th([^>]*)>([\s\S]*?)<\/th>/gi;
    let m: RegExpExecArray | null;
    while ((m = thRegex.exec(row)) !== null) {
      const t = stripTags(m[2]).toLowerCase();
      if (["snp", "con", "lab", "lib dems", "lib dem", "ld", "greens", "green", "alba", "ref", "reform", "others"].includes(t)) {
        partyOrder.push(t);
      }
    }
  }

  if (partyOrder.length < 7) return null;

  function partyKey(name: string): keyof ColMap | null {
    if (name === "snp") return "snp";
    if (name === "con") return "con";
    if (name === "lab") return "lab";
    if (name === "lib dems" || name === "lib dem" || name === "ld") return "libdem";
    if (name === "greens" || name === "green") return "green";
    if (name === "alba") return "alba";
    if (name === "ref" || name === "reform") return "reform";
    if (name === "others") return "others";
    return null;
  }

  const map: Partial<ColMap> = { date: 0, pollster: 1, client: 2, sample: 3 };

  let colIdx = 4;
  for (const p of partyOrder) {
    const key = partyKey(p);
    if (key && map[key] === undefined) {
      map[key] = colIdx;
      colIdx++;
    }
  }

  const required: (keyof ColMap)[] = ["date", "pollster", "client", "sample", "snp", "con", "lab", "libdem", "green", "alba", "reform", "others"];
  for (const k of required) {
    if (map[k] === undefined) return null;
  }

  return map as ColMap;
}

function parseTable(tableHtml: string): PollEntry[] {
  const rows = tableHtml.split(/<tr[\s>]/);
  const results: PollEntry[] = [];
  const headerRows: string[] = [];
  const dataRows: string[] = [];

  for (const row of rows) {
    if (!row.trim()) continue;
    if (/<th[^>]*>/i.test(row)) {
      headerRows.push(row);
    } else if (/<td[^>]*>/i.test(row)) {
      dataRows.push(row);
    }
  }

  const colMap = buildColMap(headerRows);
  if (!colMap) {
    console.warn("  Could not build column map from headers");
    return results;
  }

  for (const row of dataRows) {
    const cells = extractCells(row);
    if (cells.length < 10) continue;

    const rowText = stripTags(row).toLowerCase();
    if (rowText.includes("2021 election") || rowText.includes("2016 election") || rowText.includes("election result")) continue;

    const colspanMatch = row.match(/colspan="(\d+)"/);
    if (colspanMatch && parseInt(colspanMatch[1]) > 5) continue;

    const getCellText = (idx: number): string => {
      if (idx >= cells.length) return "";
      return stripTags(cells[idx]);
    };

    const dateCellHtml = cells[colMap.date] || "";
    const endDate = extractEndDate(dateCellHtml);
    if (!endDate) continue;

    const dateText = stripTags(dateCellHtml);
    const startDate = parseStartDate(dateText, endDate);

    results.push({
      date: startDate,
      endDate,
      pollster: getCellText(colMap.pollster),
      client: getCellText(colMap.client),
      sampleSize: parseSampleSize(getCellText(colMap.sample)),
      snp: parsePercent(getCellText(colMap.snp)),
      con: parsePercent(getCellText(colMap.con)),
      lab: parsePercent(getCellText(colMap.lab)),
      libdem: parsePercent(getCellText(colMap.libdem)),
      green: parsePercent(getCellText(colMap.green)),
      alba: parsePercent(getCellText(colMap.alba)),
      reform: parsePercent(getCellText(colMap.reform)),
      others: parsePercent(getCellText(colMap.others)),
    });
  }

  return results;
}

function extractWikitables(html: string): string[] {
  const tables: string[] = [];
  let searchFrom = 0;

  while (true) {
    const start = html.indexOf('class="wikitable', searchFrom);
    if (start === -1) break;

    const tableStart = html.lastIndexOf("<table", start);
    if (tableStart === -1) break;

    let depth = 0;
    let pos = tableStart;
    let end = -1;

    while (pos < html.length) {
      const nextOpen = html.indexOf("<table", pos + 1);
      const nextClose = html.indexOf("</table>", pos + 1);

      if (nextClose === -1) break;

      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        pos = nextOpen;
      } else {
        if (depth === 0) {
          end = nextClose + 8;
          break;
        }
        depth--;
        pos = nextClose;
      }
    }

    if (end === -1) break;

    tables.push(html.slice(tableStart, end));
    searchFrom = end;
  }

  return tables;
}

async function main() {
  console.log("Fetching Wikipedia polling page...");
  const html = await fetchHtml(WIKI_URL);
  console.log(`Fetched ${html.length.toLocaleString()} bytes`);

  const tables = extractWikitables(html);
  console.log(`Found ${tables.length} wikitable(s)`);

  if (tables.length < 2) {
    throw new Error(`Expected at least 2 wikitables, found ${tables.length}`);
  }

  console.log("Parsing constituency table...");
  const constituency = parseTable(tables[0]);
  console.log(`  Extracted ${constituency.length} constituency polls`);

  console.log("Parsing regional table...");
  const regional = parseTable(tables[1]);
  console.log(`  Extracted ${regional.length} regional polls`);

  const output = {
    lastUpdated: new Date().toISOString(),
    constituency,
    regional,
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
  console.log(`\nWrote ${OUTPUT_PATH}`);
  console.log(`  Constituency polls: ${constituency.length}`);
  console.log(`  Regional polls: ${regional.length}`);

  if (constituency.length > 0) {
    console.log("\nMost recent constituency poll:");
    console.log(JSON.stringify(constituency[0], null, 2));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
