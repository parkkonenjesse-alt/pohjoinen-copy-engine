"use client";

import { useState } from "react";
import type { Lang } from "@/lib/samples";
import type { CopyResult } from "@/lib/types";

export type LangResult =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "done"; data: CopyResult };

function CharCount({ n, max }: { n: number; max: number }) {
  return (
    <span className="count" data-over={n > max}>
      {n}/{max}
    </span>
  );
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      window.setTimeout(() => setDone(false), 1400);
    } catch {
      // Clipboard can be blocked (e.g. insecure context); fail quietly.
    }
  }

  return (
    <button type="button" className="copy" data-done={done} onClick={copy}>
      {done ? "Copied ✓" : label}
    </button>
  );
}

const STATUS_LABEL: Record<LangResult["status"], string> = {
  loading: "Generating",
  error: "Failed",
  done: "Ready",
};

export function ResultCard({ lang, result }: { lang: Lang; result: LangResult }) {
  return (
    <article className="card">
      <div className="card-head">
        <h3 className="lang-name">
          {lang.name}
          <span className="code">{lang.flag}</span>
        </h3>
        <span className="card-status" data-status={result.status}>
          {STATUS_LABEL[result.status]}
        </span>
      </div>

      {result.status === "loading" && (
        <p className="card-loading">Writing on-brand copy…</p>
      )}

      {result.status === "error" && <p className="card-error">{result.error}</p>}

      {result.status === "done" && <DoneBody data={result.data} />}
    </article>
  );
}

function DoneBody({ data }: { data: CopyResult }) {
  const paragraphs = data.description.split(/\n\n+/).filter(Boolean);

  return (
    <>
      <div className="field">
        <div className="field-head">
          <span className="label">SEO title</span>
          <CharCount n={data.seo_title.length} max={60} />
          <CopyButton text={data.seo_title} />
        </div>
        <p className="value title-val">{data.seo_title}</p>
      </div>

      <div className="field">
        <div className="field-head">
          <span className="label">Meta description</span>
          <CharCount n={data.meta_description.length} max={155} />
          <CopyButton text={data.meta_description} />
        </div>
        <p className="value">{data.meta_description}</p>
      </div>

      <div className="field">
        <div className="field-head">
          <span className="label">Description</span>
          <CopyButton text={data.description} />
        </div>
        <div className="value body-val">
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </div>

      <div className="field">
        <div className="field-head">
          <span className="label">Feature bullets</span>
        </div>
        <ul className="bullets">
          {data.bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      </div>

      <div className="field">
        <div className="field-head">
          <span className="label">Keywords</span>
          <CopyButton text={data.keywords.join(", ")} />
        </div>
        <div className="keywords">
          {data.keywords.map((k, i) => (
            <span key={i} className="kw">
              {k}
            </span>
          ))}
        </div>
      </div>
    </>
  );
}
