import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// We test the retry logic by importing the module and mocking global fetch
let fetchBuffer: (url: string, retries?: number, delayMs?: number) => Promise<Buffer>;
let fetchHtml: (url: string, retries?: number, delayMs?: number) => Promise<string>;

beforeEach(async () => {
  vi.stubGlobal("fetch", vi.fn());
  const mod = await import("../scripts/lib/api");
  fetchBuffer = mod.fetchBuffer;
  fetchHtml = mod.fetchHtml;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fetchHtml retry logic", () => {
  it("returns HTML on first success", async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: () => Promise.resolve("<html>test</html>"),
    });

    const result = await fetchHtml("https://example.com", 3, 1);
    expect(result).toBe("<html>test</html>");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("retries on failure then succeeds", async () => {
    (fetch as any)
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve("ok"),
      });

    const result = await fetchHtml("https://example.com", 3, 1);
    expect(result).toBe("ok");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("retries on 429 rate limit", async () => {
    (fetch as any)
      .mockResolvedValueOnce({ ok: false, status: 429 })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve("ok"),
      });

    const result = await fetchHtml("https://example.com", 3, 1);
    expect(result).toBe("ok");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("throws after all retries exhausted", async () => {
    (fetch as any)
      .mockRejectedValueOnce(new Error("fail1"))
      .mockRejectedValueOnce(new Error("fail2"))
      .mockRejectedValueOnce(new Error("fail3"));

    await expect(fetchHtml("https://example.com", 3, 1)).rejects.toThrow("fail3");
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});

describe("fetchBuffer retry logic", () => {
  it("returns buffer on first success", async () => {
    const data = new Uint8Array([1, 2, 3]).buffer;
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      arrayBuffer: () => Promise.resolve(data),
    });

    const result = await fetchBuffer("https://example.com/file.pdf", 3, 1);
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.length).toBe(3);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("retries on failure then succeeds", async () => {
    const data = new Uint8Array([4, 5]).buffer;
    (fetch as any)
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        arrayBuffer: () => Promise.resolve(data),
      });

    const result = await fetchBuffer("https://example.com/file.pdf", 3, 1);
    expect(result.length).toBe(2);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
