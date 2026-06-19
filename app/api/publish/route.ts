import { NextResponse } from "next/server";
import type { ArticleResult, PublishResponse } from "@/lib/types";

export const runtime = "nodejs";

function fail(error: string, status = 400): NextResponse<PublishResponse> {
  return NextResponse.json({ ok: false, error }, { status });
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Compose the draft body HTML from the structured article.
function buildHtml(a: ArticleResult): string {
  const parts: string[] = [];
  if (a.intro) parts.push(`<p>${esc(a.intro)}</p>`);
  for (const h of a.outline) parts.push(`<h2>${esc(h)}</h2>`);
  if (a.faq.length) {
    parts.push("<h2>FAQ</h2>");
    for (const f of a.faq) parts.push(`<h3>${esc(f.q)}</h3>\n<p>${esc(f.a)}</p>`);
  }
  return parts.join("\n");
}

// Publishes the draft to WordPress via the REST API. Always creates a DRAFT
// (status: "draft") so a human editor reviews for E-E-A-T before going live.
// Real integration — works against any WordPress with an application password,
// configured via WP_URL / WP_USER / WP_APP_PASSWORD.
export async function POST(req: Request): Promise<NextResponse<PublishResponse>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Request body was not valid JSON.");
  }

  const article = (body as { article?: ArticleResult } | null)?.article;
  if (
    !article ||
    typeof article.title !== "string" ||
    article.title.trim() === "" ||
    !Array.isArray(article.outline)
  ) {
    return fail("Missing or invalid article to publish.");
  }

  const base = process.env.WP_URL;
  const user = process.env.WP_USER;
  const pass = process.env.WP_APP_PASSWORD;
  if (!base || !user || !pass) {
    return fail(
      "WordPress not configured. Set WP_URL, WP_USER and WP_APP_PASSWORD to enable publishing.",
      501,
    );
  }

  const auth = Buffer.from(`${user}:${pass}`).toString("base64");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/wp-json/wp/v2/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
      body: JSON.stringify({
        title: article.title,
        content: buildHtml(article),
        excerpt: article.meta_description ?? "",
        status: "draft",
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      return fail(`WordPress rejected the post (HTTP ${res.status}).`, 502);
    }
    const json = (await res.json()) as { link?: string; status?: string };
    return NextResponse.json({
      ok: true,
      link: json.link ?? "",
      status: json.status ?? "draft",
    });
  } catch (err) {
    console.error("[publish]", err);
    if (err instanceof Error && err.name === "AbortError") {
      return fail("WordPress request timed out.", 504);
    }
    return fail("Publishing failed. Please try again.", 502);
  } finally {
    clearTimeout(timer);
  }
}
