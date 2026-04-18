import { describe, it, expect } from "vitest";
import { expandRowWithRowspans } from "../scripts/sync-polls.ts";

type Carry = { html: string; rowsRemaining: number } | null;

describe("expandRowWithRowspans", () => {
  it("passes raw cells through when no rowspans are active", () => {
    const carries: Carry[] = [];
    const out = expandRowWithRowspans(["<td>A</td>", "<td>B</td>", "<td>C</td>"], carries);
    expect(out).toEqual(["<td>A</td>", "<td>B</td>", "<td>C</td>"]);
    expect(carries.filter(Boolean)).toHaveLength(0);
  });

  it("registers a rowspan=2 cell so the next row inherits it at the same column", () => {
    const carries: Carry[] = [];
    // Row 1: third cell has rowspan=2
    const row1 = expandRowWithRowspans(
      ["<td>A</td>", "<td>B</td>", '<td rowspan="2">SPAN</td>', "<td>D</td>"],
      carries,
    );
    expect(row1).toHaveLength(4);
    // Row 2 has one fewer raw cell because the rowspan covers column 2
    const row2 = expandRowWithRowspans(
      ["<td>a</td>", "<td>b</td>", "<td>d</td>"],
      carries,
    );
    expect(row2).toEqual(["<td>a</td>", "<td>b</td>", '<td rowspan="2">SPAN</td>', "<td>d</td>"]);
    // After consumption the carry should be gone
    expect(carries.filter(Boolean)).toHaveLength(0);
  });

  it("reproduces the Alba-column bug: Reform not mis-read as Alba under rowspan", () => {
    const carries: Carry[] = [];
    // Row A: More in Common-style row — Alba is rowspan=2 N/A cell at col 9
    const morrisRow = [
      '<td>date</td>',
      '<td>More in Common</td>',
      '<td>N/A</td>',
      '<td>1008</td>',
      '<td>32%</td>', // snp
      '<td>12%</td>', // con
      '<td>19%</td>', // lab
      '<td>11%</td>', // libdem
      '<td>7%</td>', // green
      '<td rowspan="2">N/A</td>', // alba, spans 2 rows
      '<td>18%</td>', // reform
      '<td>2%</td>', // others
      '<td>13</td>', // lead
    ];
    expandRowWithRowspans(morrisRow, carries);
    // Row B: YouGov, missing an Alba cell because it's covered by rowspan
    const yougovRow = [
      '<td>date</td>',
      '<td>YouGov</td>',
      '<td>Sky News</td>',
      '<td>3925</td>',
      '<td>41%</td>', // snp
      '<td>8%</td>', // con
      '<td>18%</td>', // lab
      '<td>10%</td>', // libdem
      '<td>2%</td>', // green
      '<td>19%</td>', // reform (was being read as Alba before the fix)
      '<td>-</td>', // others
      '<td>23</td>', // lead
    ];
    const expanded = expandRowWithRowspans(yougovRow, carries);
    expect(expanded).toHaveLength(13);
    expect(expanded[9]).toBe('<td rowspan="2">N/A</td>'); // Alba slot filled from carry
    expect(expanded[10]).toBe('<td>19%</td>'); // Reform lands in the right column
    expect(expanded[11]).toBe('<td>-</td>'); // Others likewise
  });

  it("handles rowspan=3 across three rows", () => {
    const carries: Carry[] = [];
    expandRowWithRowspans(["<td>A</td>", '<td rowspan="3">X</td>', "<td>C</td>"], carries);
    const row2 = expandRowWithRowspans(["<td>a</td>", "<td>c</td>"], carries);
    expect(row2[1]).toBe('<td rowspan="3">X</td>');
    const row3 = expandRowWithRowspans(["<td>a2</td>", "<td>c2</td>"], carries);
    expect(row3[1]).toBe('<td rowspan="3">X</td>');
    // After 3 rows the carry should be cleared
    expect(carries.filter(Boolean)).toHaveLength(0);
    // And a fourth row should pass through unmodified
    const row4 = expandRowWithRowspans(["<td>a3</td>", "<td>b3</td>", "<td>c3</td>"], carries);
    expect(row4).toEqual(["<td>a3</td>", "<td>b3</td>", "<td>c3</td>"]);
  });
});
