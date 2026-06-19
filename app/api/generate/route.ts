import { NextResponse } from "next/server";
import { BRAND_SYSTEM, buildUserPrompt, type Product } from "@/lib/prompt";
import { LANGS } from "@/lib/samples";
import { runModel, extractJsonObject, isTimeout, MAX_FIELD_LEN } from "@/lib/llm";
import type { CopyResult, GenerateResponse } from "@/lib/types";

export const runtime = "nodejs";

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

function toCopyResult(obj: Record<string, unknown>): CopyResult {
  if (
    typeof obj.seo_title !== "string" ||
    typeof obj.meta_description !== "string" ||
    typeof obj.description !== "string" ||
    !Array.isArray(obj.bullets) ||
    !Array.isArray(obj.keywords)
  ) {
    throw new Error("Model response was missing required fields.");
  }
  return {
    seo_title: obj.seo_title,
    meta_description: obj.meta_description,
    description: obj.description,
    bullets: obj.bullets.map(String),
    keywords: obj.keywords.map(String),
  };
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

  try {
    const text = await runModel(BRAND_SYSTEM, buildUserPrompt(product, lang.full));
    const data = toCopyResult(extractJsonObject(text));
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    if (isTimeout(err)) return fail("Generation timed out. Please try again.", 504);
    const message = err instanceof Error ? err.message : "Unknown generation error.";
    return fail(`Generation failed: ${message}`, 502);
  }
}
