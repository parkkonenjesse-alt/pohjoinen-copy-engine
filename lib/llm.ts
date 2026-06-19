// Shared LLM call used by both the product-copy engine and the blog drafter.
// Provider-agnostic free engine: keyless Pollinations by default, Groq when
// GROQ_API_KEY is set. Production swaps to Claude/OpenAI by changing this file.
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const POLLINATIONS_URL = "https://text.pollinations.ai/openai";
const POLLINATIONS_MODEL = process.env.POLLINATIONS_MODEL || "openai-fast";
const MAX_TOKENS = Number(process.env.MAX_TOKENS) || 2048;
// Per-attempt timeout (each retry gets its own budget, not one shared deadline).
const ATTEMPT_TIMEOUT_MS = Number(process.env.GENERATE_TIMEOUT_MS) || 22_000;
const MAX_ATTEMPTS = 4;

export const MAX_FIELD_LEN = 2000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// Calls the configured free LLM, returns raw text. Each attempt has its own
// timeout; retries transient timeouts / 429 / 5xx with backoff. Throws a clear
// message on failure (never includes the API key).
export async function runModel(system: string, user: string): Promise<string> {
  const groqKey = process.env.GROQ_API_KEY;
  const url = groqKey ? GROQ_URL : POLLINATIONS_URL;
  const model = groqKey ? GROQ_MODEL : POLLINATIONS_MODEL;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (groqKey) headers.Authorization = `Bearer ${groqKey}`;

  const body: Record<string, unknown> = {
    model,
    max_tokens: MAX_TOKENS,
    temperature: 0.4,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };
  // JSON mode is reliable on Groq; some keyless gateways reject the field, so
  // only request it when on Groq (the prompt still mandates a JSON object).
  if (groqKey) body.response_format = { type: "json_object" };
  const payload = JSON.stringify(body);

  let lastError = "provider unavailable";
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) await sleep(1200 * attempt);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: payload,
        signal: controller.signal,
      });
      if (res.ok) {
        const json = (await res.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        const content = json.choices?.[0]?.message?.content;
        if (content && content.trim()) return content;
        lastError = "model returned empty content";
        continue;
      }
      // 4xx (except 429) is non-retryable.
      if (res.status !== 429 && res.status < 500) {
        throw new Error(`provider rejected the request (HTTP ${res.status})`);
      }
      lastError = res.status === 429 ? "rate limited" : `provider error (HTTP ${res.status})`;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        lastError = "request timed out";
        continue; // retry timeouts
      }
      // Non-retryable provider rejection — surface immediately.
      if (err instanceof Error && err.message.startsWith("provider rejected")) {
        throw err;
      }
      lastError = err instanceof Error ? err.message : "network error";
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`${lastError} (after ${MAX_ATTEMPTS} attempts)`);
}

// Slice from first "{" to last "}" and parse. Includes a snippet on parse
// failure so server logs/error messages are diagnosable.
export function extractJsonObject(text: string): Record<string, unknown> {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) {
    throw new Error("model response did not contain a JSON object");
  }
  try {
    return JSON.parse(text.slice(first, last + 1)) as Record<string, unknown>;
  } catch (err) {
    const reason = err instanceof Error ? err.message : "parse error";
    throw new Error(`could not parse model JSON: ${reason}`);
  }
}

export function isTimeout(err: unknown): boolean {
  return err instanceof Error && /timed out/i.test(err.message);
}
