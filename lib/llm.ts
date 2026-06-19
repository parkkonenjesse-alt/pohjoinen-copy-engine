// Shared LLM call used by both the product-copy engine and the blog drafter.
// Provider-agnostic free engine: keyless Pollinations by default, Groq when
// GROQ_API_KEY is set. Production swaps to Claude/OpenAI by changing this file.
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const POLLINATIONS_URL = "https://text.pollinations.ai/openai";
const POLLINATIONS_MODEL = process.env.POLLINATIONS_MODEL || "openai-fast";
const MAX_TOKENS = Number(process.env.MAX_TOKENS) || 2048;
const TIMEOUT_MS = Number(process.env.GENERATE_TIMEOUT_MS) || 40_000;

export const MAX_FIELD_LEN = 2000;

// Calls the configured free LLM, returns raw text. Retries transient 429/5xx
// with backoff; aborts after a timeout. Throws on failure.
export async function runModel(system: string, user: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
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

    let lastStatus = 0;
    for (let attempt = 0; attempt < 4; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 1200 * attempt));
      const res = await fetch(url, { method: "POST", headers, body: payload, signal: controller.signal });
      if (res.ok) {
        const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
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
  } finally {
    clearTimeout(timeout);
  }
}

// Slice from first "{" to last "}" and parse — defensive even with JSON mode.
export function extractJsonObject(text: string): Record<string, unknown> {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) {
    throw new Error("Model response did not contain a JSON object.");
  }
  return JSON.parse(text.slice(first, last + 1)) as Record<string, unknown>;
}

export function isTimeout(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError";
}
