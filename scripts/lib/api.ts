export async function fetchJson<T>(url: string, retries = 3, delayMs = 1000): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url);
      if (response.status === 429) {
        const wait = delayMs * attempt;
        console.log(`Rate limited, waiting ${wait}ms (attempt ${attempt}/${retries})`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${url}`);
      }
      return (await response.json()) as T;
    } catch (error) {
      if (attempt === retries) throw error;
      console.log(`Fetch failed, retrying in ${delayMs * attempt}ms (attempt ${attempt}/${retries})`);
      await new Promise((r) => setTimeout(r, delayMs * attempt));
    }
  }
  throw new Error(`Failed after ${retries} retries: ${url}`);
}

export async function fetchBuffer(url: string, retries = 3, delayMs = 1000): Promise<Buffer> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url);
      if (response.status === 429) {
        const wait = delayMs * attempt;
        console.log(`Rate limited, waiting ${wait}ms (attempt ${attempt}/${retries})`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      if (attempt === retries) throw error;
      console.log(`Fetch failed, retrying in ${delayMs * attempt}ms (attempt ${attempt}/${retries})`);
      await new Promise((r) => setTimeout(r, delayMs * attempt));
    }
  }
  throw new Error(`Failed after ${retries} retries: ${url}`);
}

export async function fetchHtml(url: string, retries = 3, delayMs = 1000): Promise<string> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url);
      if (response.status === 429) {
        const wait = delayMs * attempt;
        console.log(`Rate limited, waiting ${wait}ms (attempt ${attempt}/${retries})`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
      return response.text();
    } catch (error) {
      if (attempt === retries) throw error;
      console.log(`Fetch failed, retrying in ${delayMs * attempt}ms (attempt ${attempt}/${retries})`);
      await new Promise((r) => setTimeout(r, delayMs * attempt));
    }
  }
  throw new Error(`Failed after ${retries} retries: ${url}`);
}
