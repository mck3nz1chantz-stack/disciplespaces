/**
 * Download public-domain World English Bible (WEB) from getbible.net
 * and write DiscipleSpaces book JSON under public/data/bible/web/
 *
 * Usage: node scripts/fetch-web-bible.mjs
 */
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public/data/bible/web");
const KJV_INDEX = join(ROOT, "public/data/bible/index.json");
const BASE = "https://api.getbible.net/v2/web";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

async function main() {
  const kjvIndex = JSON.parse(await readFile(KJV_INDEX, "utf8"));
  const booksMeta = [...kjvIndex.books].sort((a, b) => a.order - b.order);

  await mkdir(OUT, { recursive: true });

  const webBooks = [];
  let verseCount = 0;

  for (const meta of booksMeta) {
    const nr = meta.order; // getbible uses 1–66 Protestant order
    process.stdout.write(`WEB ${nr}/66 ${meta.name}… `);
    const raw = await fetchJson(`${BASE}/${nr}.json`);
    const chapters = (raw.chapters || []).map((ch) =>
      (ch.verses || []).map((v) => String(v.text || "").trim()),
    );
    for (const ch of chapters) verseCount += ch.length;

    const book = {
      id: meta.id,
      name: meta.name,
      abbrev: meta.abbrev,
      testament: meta.testament,
      chapters,
    };
    await writeFile(
      join(OUT, `${meta.id}.json`),
      JSON.stringify(book),
      "utf8",
    );
    webBooks.push({
      id: meta.id,
      name: meta.name,
      abbrev: meta.abbrev,
      testament: meta.testament,
      chapterCount: chapters.length,
      order: meta.order,
    });
    console.log(`${chapters.length} ch`);
    await sleep(80);
  }

  const index = {
    version: "WEB",
    translation: "World English Bible",
    publicDomain: true,
    bookCount: webBooks.length,
    verseCountApprox: verseCount,
    books: webBooks,
    license:
      "Public domain. World English Bible (WEB). No registration required.",
    source: "https://api.getbible.net/v2/web (packaged for DiscipleSpaces)",
  };
  await writeFile(join(OUT, "index.json"), JSON.stringify(index, null, 2), "utf8");
  console.log(`\nDone: ${webBooks.length} books, ~${verseCount} verses → ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
