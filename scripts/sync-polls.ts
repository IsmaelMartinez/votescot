import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchHtml } from "./lib/api";

const WIKI_URL =
  "https://en.wikipedia.org/wiki/Opinion_polling_for_the_2026_Scottish_Parliament_election";
const OUTPUT_PATH = path.join(process.cwd(), "data/polls.json");

// Normalize pollster names: map predecessor brands to current names
const POLLSTER_ALIASES: Record<string, string> = {
  "Ipsos MORI": "Ipsos",
  "Savanta ComRes": "Savanta",
};

// Normalize client names: fix typos that appear in the Wikipedia source so
// the same commissioning client doesn't split into multiple brand strings
// when grouping or charting.
const CLIENT_ALIASES: Record<string, string> = {
  "Diffley Parntership": "Diffley Partnership",
};

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

interface MrpEntry {
  date: string;
  endDate: string;
  pollster: string;
  client: string;
  sampleSize: number | null;
  seats: {
    snp: number | null;
    con: number | null;
    lab: number | null;
    green: number | null;
    libdem: number | null;
    reform: number | null;
  };
  majority: string;
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

  const crossMatch = text.match(/(\d{1,2})\s+(\w+)\s*[–\-]\s*\d{1,2}\s+(\w+)\s+(\d{4})/);
  if (crossMatch) {
    const day = crossMatch[1].padStart(2, "0");
    const startMonth = parseMonth(crossMatch[2]);
    const endMonth = parseMonth(crossMatch[3]);
    if (startMonth && endMonth) {
      // If the start month is after the end month, the range crosses a year
      // boundary (e.g. "22 Dec – 1 Jan 2023" starts in 2022) and the year
      // should be decremented for the start date.
      const year = startMonth > endMonth ? parseInt(crossMatch[4]) - 1 : parseInt(crossMatch[4]);
      return `${year}-${startMonth}-${day}`;
    }
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

function cellRowspan(cellHtml: string): number {
  const m = cellHtml.match(/rowspan="(\d+)"/i);
  return m ? parseInt(m[1], 10) : 1;
}

// Expand a row's raw <td> cells into logical columns, filling in positions
// covered by rowspan cells from earlier rows. Wikipedia uses rowspan="2" for
// Alba/Reform "N/A" cells that span consecutive pollsters — without expanding
// these, the pollster beneath the rowspan appears to be missing a column and
// every subsequent cell shifts left (Reform read as Alba, etc.).
//
// carries[colIdx] holds the cell HTML currently covering that column, plus
// how many rows (including the current one) it still applies to.
export function expandRowWithRowspans(
  rawCells: string[],
  carries: Array<{ html: string; rowsRemaining: number } | null>,
): string[] {
  const result: string[] = [];
  let rawIdx = 0;
  let colIdx = 0;
  while (rawIdx < rawCells.length || carries[colIdx]) {
    const carry = carries[colIdx];
    if (carry) {
      result.push(carry.html);
      carry.rowsRemaining--;
      if (carry.rowsRemaining <= 0) carries[colIdx] = null;
    } else {
      const cell = rawCells[rawIdx++];
      result.push(cell);
      const rs = cellRowspan(cell);
      if (rs > 1) carries[colIdx] = { html: cell, rowsRemaining: rs - 1 };
    }
    colIdx++;
  }
  return result;
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

  // Rowspan carry-over is stateful across data rows in the order they appear
  // in the HTML, so the expansion happens inside this loop (not per-row).
  const rowspanCarries: Array<{ html: string; rowsRemaining: number } | null> = [];

  for (const row of dataRows) {
    const rawCells = extractCells(row);
    if (rawCells.length < 5) continue;

    // Skip wide-colspan annotation rows (e.g. "Closure of nominations") before
    // touching the rowspan tracker — they have one merged cell and would
    // confuse expansion.
    const colspanMatch = row.match(/colspan="(\d+)"/);
    if (colspanMatch && parseInt(colspanMatch[1]) > 5) continue;

    // Expand now so the rowspan tracker stays in sync even for rows we drop
    // (e.g. baseline election-result rows that still have full party columns).
    const cells = expandRowWithRowspans(rawCells, rowspanCarries);
    if (cells.length < 10) continue;

    const rowText = stripTags(row).toLowerCase();
    // Skip baseline election-result rows. Wikipedia formats these as "2021
    // Scottish Parliament election" / "2016 Scottish Parliament election",
    // so a loose regex catches both the short-form and long-form variants.
    if (/\b(201[16]|202[16])\b[^.]*election/.test(rowText) || rowText.includes("election result")) continue;

    const getCellText = (idx: number): string => {
      if (idx >= cells.length) return "";
      return stripTags(cells[idx]);
    };

    const dateCellHtml = cells[colMap.date] || "";
    const endDate = extractEndDate(dateCellHtml);
    if (!endDate) continue;

    const dateText = stripTags(dateCellHtml);
    const startDate = parseStartDate(dateText, endDate);

    const pollsterName = getCellText(colMap.pollster);
    const normalizedPollster = POLLSTER_ALIASES[pollsterName] ?? pollsterName;
    const clientName = getCellText(colMap.client);
    const normalizedClient = CLIENT_ALIASES[clientName] ?? clientName;

    results.push({
      date: startDate,
      endDate,
      pollster: normalizedPollster,
      client: normalizedClient,
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

interface MrpColMap {
  date: number;
  pollster: number;
  client: number;
  sample: number;
  snp: number;
  con: number;
  lab: number;
  green: number;
  libdem: number;
  reform: number;
  majority: number;
}

function buildMrpColMap(headerRows: string[]): MrpColMap | null {
  const order: string[] = [];
  for (const row of headerRows) {
    for (const m of row.matchAll(/<th([^>]*)>([\s\S]*?)<\/th>/gi)) {
      const t = stripTags(m[2]).toLowerCase();
      if (["snp", "con", "lab", "grn", "green", "ld", "lib dem", "lib dems", "ref", "reform", "majority"].includes(t)) {
        order.push(t);
      }
    }
  }

  if (order.length < 7) return null;

  const map: Partial<MrpColMap> = { date: 0, pollster: 1, client: 2, sample: 3 };
  let colIdx = 4;
  for (const p of order) {
    const key: keyof MrpColMap | null =
      p === "snp" ? "snp" :
      p === "con" ? "con" :
      p === "lab" ? "lab" :
      p === "grn" || p === "green" ? "green" :
      p === "ld" || p === "lib dem" || p === "lib dems" ? "libdem" :
      p === "ref" || p === "reform" ? "reform" :
      p === "majority" ? "majority" :
      null;
    if (key && map[key] === undefined) {
      map[key] = colIdx;
      colIdx++;
    }
  }

  const required: (keyof MrpColMap)[] = ["date", "pollster", "client", "sample", "snp", "con", "lab", "green", "libdem", "reform", "majority"];
  for (const k of required) {
    if (map[k] === undefined) return null;
  }
  return map as MrpColMap;
}

function parseSeatCount(val: string): number | null {
  const clean = val.trim();
  if (clean === "–" || clean === "-" || clean === "" || clean === "N/A") return null;
  const n = parseInt(clean, 10);
  return isNaN(n) ? null : n;
}

function parseMrpTable(tableHtml: string): MrpEntry[] {
  const rows = tableHtml.split(/<tr[\s>]/);
  const results: MrpEntry[] = [];
  const headerRows: string[] = [];
  const dataRows: string[] = [];

  for (const row of rows) {
    if (!row.trim()) continue;
    if (/<th[^>]*>/i.test(row)) headerRows.push(row);
    else if (/<td[^>]*>/i.test(row)) dataRows.push(row);
  }

  const colMap = buildMrpColMap(headerRows);
  if (!colMap) {
    console.warn("  Could not build MRP column map from headers");
    return results;
  }

  const rowspanCarries: Array<{ html: string; rowsRemaining: number } | null> = [];

  for (const row of dataRows) {
    const rawCells = extractCells(row);
    if (rawCells.length < 5) continue;

    const colspanMatch = row.match(/colspan="(\d+)"/);
    if (colspanMatch && parseInt(colspanMatch[1]) > 5) continue;

    const cells = expandRowWithRowspans(rawCells, rowspanCarries);
    if (cells.length < 10) continue;

    const getCellText = (idx: number): string => {
      if (idx >= cells.length) return "";
      return stripTags(cells[idx]);
    };

    const dateCellHtml = cells[colMap.date] || "";
    const endDate = extractEndDate(dateCellHtml);
    if (!endDate) continue;

    const dateText = stripTags(dateCellHtml);
    const startDate = parseStartDate(dateText, endDate);

    const pollsterName = getCellText(colMap.pollster);
    const normalizedPollster = POLLSTER_ALIASES[pollsterName] ?? pollsterName;
    const clientName = getCellText(colMap.client);
    const normalizedClient = CLIENT_ALIASES[clientName] ?? clientName;

    results.push({
      date: startDate,
      endDate,
      pollster: normalizedPollster,
      client: normalizedClient,
      sampleSize: parseSampleSize(getCellText(colMap.sample)),
      seats: {
        snp: parseSeatCount(getCellText(colMap.snp)),
        con: parseSeatCount(getCellText(colMap.con)),
        lab: parseSeatCount(getCellText(colMap.lab)),
        green: parseSeatCount(getCellText(colMap.green)),
        libdem: parseSeatCount(getCellText(colMap.libdem)),
        reform: parseSeatCount(getCellText(colMap.reform)),
      },
      majority: getCellText(colMap.majority),
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

  if (tables.length < 3) {
    throw new Error(`Expected at least 3 wikitables (constituency, regional, MRP), found ${tables.length}`);
  }

  console.log("Parsing constituency table...");
  const constituency = parseTable(tables[0]);
  console.log(`  Extracted ${constituency.length} constituency polls`);

  console.log("Parsing regional table...");
  const regional = parseTable(tables[1]);
  console.log(`  Extracted ${regional.length} regional polls`);

  // Locate the MRP table by header signature ("majority" column) rather than
  // a fixed index, so a future Wikipedia table insertion doesn't silently
  // make us parse the wrong table.
  const mrpTableIdx = tables.findIndex((t) => /<th[^>]*>[^<]*majority[^<]*<\/th>/i.test(t));
  if (mrpTableIdx === -1) {
    throw new Error("Could not find MRP seat-projection table (no wikitable with a 'Majority' column)");
  }
  if (mrpTableIdx !== 2) {
    console.warn(`  MRP table found at index ${mrpTableIdx} (expected 2). Wikipedia may have rearranged tables.`);
  }
  console.log("Parsing MRP seat-projection table...");
  const mrp = parseMrpTable(tables[mrpTableIdx]);
  console.log(`  Extracted ${mrp.length} MRP rows`);

  // Guard against silent parse failure: if Wikipedia renames a party column,
  // buildColMap returns null, parseTable returns [], and we'd write an empty
  // polls file that the scheduled workflow would auto-commit. Require a
  // plausible minimum count so a broken parse fails loudly.
  const MIN_POLLS = 50;
  if (constituency.length < MIN_POLLS || regional.length < MIN_POLLS) {
    throw new Error(
      `Unexpectedly few polls parsed (constituency=${constituency.length}, regional=${regional.length}). ` +
        `Check for Wikipedia schema changes before writing to ${OUTPUT_PATH}.`
    );
  }

  const MIN_MRP_ROWS = 3;
  if (mrp.length < MIN_MRP_ROWS) {
    throw new Error(
      `Unexpectedly few MRP rows parsed (mrp=${mrp.length}). ` +
        `Check for Wikipedia schema changes before writing to ${OUTPUT_PATH}.`
    );
  }

  const output = {
    lastUpdated: new Date().toISOString(),
    constituency,
    regional,
    mrp,
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

// Only run main() when invoked directly; skip when imported (e.g. from tests).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
