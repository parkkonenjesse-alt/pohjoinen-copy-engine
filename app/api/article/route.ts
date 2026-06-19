import { NextResponse } from "next/server";
import { BLOG_SYSTEM, buildArticlePrompt } from "@/lib/prompt";
import { LANGS } from "@/lib/samples";
import { runModel, extractJsonObject, isTimeout, MAX_FIELD_LEN } from "@/lib/llm";
import type { ArticleResult, ArticleResponse, FaqItem } from "@/lib/types";

export const runtime = "nodejs";

function fail(error: string, status = 400): NextResponse<ArticleResponse> {
  return NextResponse.json({ ok: false, error }, { status });
}

function toArticle(obj: Record<string, unknown>): ArticleResult {
  if (
    typeof obj.title !== "string" ||
    typeof obj.intro !== "string" ||
    !Array.isArray(obj.outline) ||
    !Array.isArray(obj.faq)
  ) {
    throw new Error("Model response was missing required fields.");
  }
  const str = (k: string) => (typeof obj[k] === "string" ? (obj[k] as string) : "");
  const arr = (k: string) => (Array.isArray(obj[k]) ? (obj[k] as unknown[]).map(String) : []);
  const faq: FaqItem[] = (obj.faq as unknown[])
    .map((item) => {
      const f = (item ?? {}) as Record<string, unknown>;
      return {
        q: typeof f.q === "string" ? f.q : "",
        a: typeof f.a === "string" ? f.a : "",
      };
    })
    .filter((f) => f.q && f.a);

  return {
    title: obj.title,
    meta_title: str("meta_title"),
    meta_description: str("meta_description"),
    target_keywords: arr("target_keywords"),
    outline: arr("outline"),
    intro: obj.intro,
    faq,
    internal_link_ideas: arr("internal_link_ideas"),
  };
}

export async function POST(req: Request): Promise<NextResponse<ArticleResponse>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Request body was not valid JSON.");
  }

  const { topic, langCode } = (body ?? {}) as { topic?: unknown; langCode?: unknown };
  if (typeof topic !== "string" || topic.trim() === "" || topic.length > MAX_FIELD_LEN) {
    return fail("Missing or invalid topic / keyword.");
  }
  const lang = LANGS.find((l) => l.code === langCode);
  if (!lang) {
    return fail(`Unsupported language code: ${String(langCode)}.`);
  }

  try {
    const text = await runModel(BLOG_SYSTEM, buildArticlePrompt(topic, lang.full));
    const data = toArticle(extractJsonObject(text));
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error("[article]", err);
    if (isTimeout(err)) return fail("Generation timed out. Please try again.", 504);
    const m = err instanceof Error ? err.message : "";
    if (/rate limited/i.test(m)) {
      return fail("The free model is rate limited right now. Try again in a moment.", 429);
    }
    return fail("Generation failed. Please try again.", 502);
  }
}
