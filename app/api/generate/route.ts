import { NextResponse } from "next/server";
import { BRAND_SYSTEM, buildUserPrompt, type Product } from "@/lib/prompt";
import { LANGS } from "@/lib/samples";
import type { CopyResult, GenerateResponse } from "@/lib/types";

// Node runtime (server-side fetch, env access — key never reaches the browser).
export const runtime = "nodejs";

// Provider-agnostic free engine. By default it uses Pollinations, a KEYLESS
// free LLM gateway, so the live demo works with zero setup and costs nothing to
// evaluate. If a GROQ_API_KEY is present it upgrades to Groq (faster, stronger).
// Same brand-voice system prompt + per-language structured-JSON call either way,
// so production can point at Claude/OpenAI by swapping the endpoint + key.
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const POLLINATIONS_URL = "https://text.pollinations.ai/openai";
const POLLINATIONS_MODEL = process.env.POLLINATIONS_MODEL || "openai-fast";
const MAX_TOKENS = 2048;
const TIMEOUT_MS = Number(process.env.GENERATE_TIMEOUT_MS) || 40_000;
const MAX_FIELD_LEN = 2000;

function fail(error: string, status = 400): NextResponse<GenerateResponse> {
  return NextResponse.json({ ok: false, error }, { status });
}

// Validate the product payload at the boundary; never trust the client.
function parseProduct(raw: unknown): Product | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  const fields = ["name", "category", "features", "price"] as const;
  for (const f of fields) {
    const v = p[f];
    if (typeof v !== "string" || v.trim() === "" || v.length > MAX_FIELD_LEN) {
      return null;
    }
  }
  return {
    name: p.name as string,
    category: p.category as string,
    features: p.features as string,
    price: p.price as string,
  };
}

// Be defensive: slice from the first "{" to the last "}" before parsing, even
// though we request a JSON response format.
function extractJson(text: string): CopyResult {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) {
    throw new Error("Model response did not contain a JSON object.");
  }
  const parsed = JSON.parse(text.slice(first, last + 1)) as Partial<CopyResult>;

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

// Calls the free LLM and returns raw text content. Keyless Pollinations by
// default; Groq when GROQ_API_KEY is set.
async function callModel(
  system: string,
  user: string,
  signal: AbortSignal,
): Promise<string> {
  const groqKey = process.env.GROQ_API_KEY;
  const url = groqKey ? GROQ_URL : POLLINATIONS_URL;
  const model = groqKey ? GROQ_MODEL : POLLINATIONS_MODEL;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (groqKey) headers.Authorization = `Bearer ${groqKey}`;
  const payload = JSON.stringify({
    model,
    max_tokens: MAX_TOKENS,
    temperature: 0.4,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  // Free endpoints rate-limit under load; retry transient 429/5xx with backoff.
  let lastStatus = 0;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 1200 * attempt));
    }
    const res = await fetch(url, { method: "POST", headers, body: payload, signal });
    if (res.ok) {
      const json = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = json.choices?.[0]?.message?.content;
      if (content) return content;
      lastStatus = 0;
      continue;
    }
    lastStatus = res.status;
    if (res.status !== 429 && res.status < 500) {
      throw new Error(`provider returned HTTP ${res.status}`);
    }
  }
  throw new Error(
    lastStatus === 429
      ? "rate limited, please try again"
      : `provider unavailable (HTTP ${lastStatus})`,
  );
}

export async function POST(req: Request): Promise<NextResponse<GenerateResponse>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Request body was not valid JSON.");
  }

  const { product: rawProduct, langCode } = (body ?? {}) as {
    product?: unknown;
    langCode?: unknown;
  };

  const product = parseProduct(rawProduct);
  if (!product) {
    return fail("Missing or empty product fields (name, category, features, price).");
  }

  const lang = LANGS.find((l) => l.code === langCode);
  if (!lang) {
    return fail(`Unsupported language code: ${String(langCode)}.`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const text = await callModel(
      BRAND_SYSTEM,
      buildUserPrompt(product, lang.full),
      controller.signal,
    );
    const data = extractJson(text);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return fail("Generation timed out. Please try again.", 504);
    }
    const message = err instanceof Error ? err.message : "Unknown generation error.";
    return fail(`Generation failed: ${message}`, 502);
  } finally {
    clearTimeout(timeout);
  }
}
