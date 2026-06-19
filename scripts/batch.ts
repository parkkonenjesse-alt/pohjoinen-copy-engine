/**
 * Batch catalog copy generator — the production-path proof for Opportunity #2.
 *
 * The web tool generates copy for one product at a time. This script loops the
 * SAME Claude call (BRAND_SYSTEM + buildUserPrompt) over a whole CSV catalog
 * across every target language, with bounded concurrency and retries, then
 * writes a Shopify-importable output CSV.
 *
 * Usage:
 *   npx tsx scripts/batch.ts <input.csv> <output.csv> [langs=fi,en,et,lv,lt]
 *
 * Requires ANTHROPIC_API_KEY in the environment. The key is never logged.
 */
import { writeFile, readFile } from "node:fs/promises";
import Anthropic from "@anthropic-ai/sdk";
import { BRAND_SYSTEM, buildUserPrompt, type Product } from "@/lib/prompt";
import { LANGS, type Lang } from "@/lib/samples";
import { buildCsv, slugify, type CsvRow } from "@/lib/csv";
import type { CopyResult } from "@/lib/types";

// --- Tunables (mirrors app/api/generate/route.ts, cheaper model for scale) ---
const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 2048;
const TIMEOUT_MS = 30_000;
const CONCURRENCY = 5;
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1000;
const DEFAULT_LANGS = ["fi", "en", "et", "lv", "lt"];
// Per-product cost ballpark for the ~ Haiku price tier (rough; tokens vary by
// language). Used only for the closing estimate, not for billing decisions.
const COST_PER_CALL_USD = 0.0015;

type ParsedProduct = Product & { handle: string };

type Job = { product: ParsedProduct; lang: Lang };
type JobResult =
  | { ok: true; handle: string; row: CsvRow }
  | { ok: false; handle: string; lang: string; error: string };

// --- Robust RFC 4180-ish CSV parsing (handles quoted cells, escaped quotes,
// commas and newlines inside quotes, and trailing newline). ----------------
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  // Normalise CRLF so newline handling stays simple.
  const s = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  // Flush the final cell/row unless the file ended on a clean newline.
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function readProducts(rows: string[][]): ParsedProduct[] {
  if (rows.length < 2) {
    throw new Error("CSV has no data rows (need a header + at least one product).");
  }
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const required = ["name", "category", "features", "price"] as const;
  const index: Record<(typeof required)[number], number> = {
    name: header.indexOf("name"),
    category: header.indexOf("category"),
    features: header.indexOf("features"),
    price: header.indexOf("price"),
  };
  for (const col of required) {
    if (index[col] === -1) {
      throw new Error(`CSV is missing required column: "${col}".`);
    }
  }

  const products: ParsedProduct[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    // Skip blank trailing lines.
    if (r.length === 1 && r[0].trim() === "") continue;
    const name = (r[index.name] ?? "").trim();
    if (name === "") continue; // a product without a name is unusable
    products.push({
      name,
      category: (r[index.category] ?? "").trim(),
      features: (r[index.features] ?? "").trim(),
      price: (r[index.price] ?? "").trim(),
      handle: slugify(name),
    });
  }
  if (products.length === 0) {
    throw new Error("No usable product rows found (every row was missing a name).");
  }
  return products;
}

function resolveLangs(arg: string | undefined): Lang[] {
  const codes = (arg ?? DEFAULT_LANGS.join(",")).split(",").map((c) => c.trim()).filter(Boolean);
  const langs: Lang[] = [];
  for (const code of codes) {
    const lang = LANGS.find((l) => l.code === code);
    if (!lang) {
      const known = LANGS.map((l) => l.code).join(", ");
      throw new Error(`Unknown language code "${code}". Known codes: ${known}.`);
    }
    langs.push(lang);
  }
  if (langs.length === 0) throw new Error("No languages selected.");
  return langs;
}

// --- Claude call: same prompt as the live tool, defensive JSON extraction. ---
function extractJson(text: string): CopyResult {
  let t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) {
    throw new Error("Model response did not contain a JSON object.");
  }
  const parsed = JSON.parse(t.slice(first, last + 1)) as Partial<CopyResult>;
  if (
    typeof parsed.seo_title !== "string" ||
    typeof parsed.meta_description !== "string" ||
    typeof parsed.description !== "string" ||
    !Array.isArray(parsed.bullets) ||
    !Array.isArray(parsed.keywords)
  ) {
    throw new Error("Model response was missing required fields.");
  }
  return {
    seo_title: parsed.seo_title,
    meta_description: parsed.meta_description,
    description: parsed.description,
    bullets: parsed.bullets.map(String),
    keywords: parsed.keywords.map(String),
  };
}

function isTransient(err: unknown): boolean {
  if (err instanceof Anthropic.APIError) {
    const status = err.status;
    return status === 429 || status === 408 || (typeof status === "number" && status >= 500);
  }
  // Network/timeout errors (APIConnectionError, aborts) are worth retrying.
  return err instanceof Anthropic.APIConnectionError || err instanceof Anthropic.APIConnectionTimeoutError;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function generateOne(client: Anthropic, job: Job): Promise<CopyResult> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const msg = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: BRAND_SYSTEM,
        messages: [{ role: "user", content: buildUserPrompt(job.product, job.lang.full) }],
      });
      const text = msg.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
      return extractJson(text);
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_RETRIES && isTransient(err)) {
        // Exponential backoff with jitter.
        const delay = BASE_BACKOFF_MS * 2 ** (attempt - 1) + Math.floor(Math.random() * 250);
        await sleep(delay);
        continue;
      }
      break;
    }
  }
  const message = lastErr instanceof Error ? lastErr.message : "Unknown generation error.";
  throw new Error(message);
}

// --- Bounded-concurrency worker pool over the flat job list. ----------------
async function runPool(client: Anthropic, jobs: Job[]): Promise<JobResult[]> {
  const results: JobResult[] = [];
  let next = 0;
  let done = 0;
  const total = jobs.length;

  async function worker(): Promise<void> {
    while (next < jobs.length) {
      const job = jobs[next++];
      try {
        const data = await generateOne(client, job);
        results.push({ ok: true, handle: job.product.handle, row: { lang: job.lang, data } });
      } catch (err) {
        const error = err instanceof Error ? err.message : "Unknown error";
        results.push({ ok: false, handle: job.product.handle, lang: job.lang.code, error });
      }
      done++;
      const fails = results.filter((r) => !r.ok).length;
      process.stdout.write(`\r  Progress: ${done}/${total} done, ${fails} failed   `);
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker));
  process.stdout.write("\n");
  return results;
}

// --- Assemble output CSV. buildCsv() emits its own header per product, so we
// keep the first header and strip subsequent ones to produce one valid file. -
function assembleCsv(products: ParsedProduct[], results: JobResult[]): string {
  const rowsByHandle = new Map<string, CsvRow[]>();
  for (const res of results) {
    if (!res.ok) continue;
    const list = rowsByHandle.get(res.handle) ?? [];
    list.push(res.row);
    rowsByHandle.set(res.handle, list);
  }

  const blocks: string[] = [];
  let isFirst = true;
  for (const product of products) {
    const rows = rowsByHandle.get(product.handle);
    if (!rows || rows.length === 0) continue;
    const csv = buildCsv(product.handle, rows);
    const lines = csv.split("\r\n");
    blocks.push(isFirst ? csv : lines.slice(1).join("\r\n"));
    isFirst = false;
  }
  return blocks.join("\r\n");
}

async function main(): Promise<void> {
  const [, , inputPath, outputPath, langsArg] = process.argv;
  if (!inputPath || !outputPath) {
    console.error(
      "Usage: npx tsx scripts/batch.ts <input.csv> <output.csv> [langs=fi,en,et,lv,lt]",
    );
    process.exit(1);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("Error: ANTHROPIC_API_KEY is not set. Export it before running this script.");
    process.exit(1);
  }

  let langs: Lang[];
  let products: ParsedProduct[];
  try {
    langs = resolveLangs(langsArg);
    const text = await readFile(inputPath, "utf8");
    products = readProducts(parseCsv(text));
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
    return; // unreachable, but narrows types for the compiler
  }

  const jobs: Job[] = products.flatMap((product) => langs.map((lang) => ({ product, lang })));
  console.log(
    `Generating copy: ${products.length} products × ${langs.length} languages = ${jobs.length} calls`,
  );
  console.log(`Model: ${MODEL} | concurrency: ${CONCURRENCY} | retries: ${MAX_RETRIES}`);

  const client = new Anthropic({ apiKey, timeout: TIMEOUT_MS, maxRetries: 0 });
  const results = await runPool(client, jobs);

  const failures = results.filter((r): r is Extract<JobResult, { ok: false }> => !r.ok);
  const successes = results.length - failures.length;

  const csv = assembleCsv(products, results);
  if (csv.trim() === "") {
    console.error("Error: every generation failed; no output written.");
    if (failures.length > 0) console.error(`  First failure: ${failures[0].error}`);
    process.exit(1);
  }

  try {
    await writeFile(outputPath, csv, "utf8");
  } catch (err) {
    console.error(`Error writing ${outputPath}: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  console.log(`\nDone. Wrote ${successes} rows to ${outputPath}.`);
  if (failures.length > 0) {
    console.log(`${failures.length} call(s) failed:`);
    for (const f of failures.slice(0, 10)) {
      console.log(`  - ${f.handle} [${f.lang}]: ${f.error}`);
    }
    if (failures.length > 10) console.log(`  ...and ${failures.length - 10} more.`);
  }
  const estimate = (successes * COST_PER_CALL_USD).toFixed(2);
  console.log(
    `Cost ballpark: ~$${estimate} for ${successes} ${MODEL} calls ` +
      `(rough estimate at ~$${COST_PER_CALL_USD}/call; verify against real billing).`,
  );
}

main().catch((err: unknown) => {
  console.error(`Fatal: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
