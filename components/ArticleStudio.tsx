"use client";

import { useState } from "react";
import { LANGS } from "@/lib/samples";
import type { ArticleResponse, ArticleResult, PublishResponse } from "@/lib/types";

const SAMPLE_TOPICS = [
  "Miten valita talvitakki retkeilyyn",
  "Best hiking backpacks for beginners",
  "Pyöräily talvella: varusteet",
  "Kuinka huoltaa sadetakki",
];

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "done"; data: ArticleResult };

export function ArticleStudio() {
  const [topic, setTopic] = useState(SAMPLE_TOPICS[0]);
  const [lang, setLang] = useState("fi");
  const [state, setState] = useState<State>({ status: "idle" });

  async function draft() {
    if (topic.trim() === "" || state.status === "loading") return;
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, langCode: lang }),
      });
      const json = (await res.json()) as ArticleResponse;
      setState(
        json.ok
          ? { status: "done", data: json.data }
          : { status: "error", error: json.error },
      );
    } catch (err) {
      setState({
        status: "error",
        error: err instanceof Error ? err.message : "Network error.",
      });
    }
  }

  return (
    <div className="engine-grid">
      {/* input */}
      <div className="panel">
        <div className="panel-head">
          <span className="eyebrow">Keyword in</span>
          <h3 className="h-lg">Topic or keyword</h3>
        </div>

        <div className="samples">
          {SAMPLE_TOPICS.map((t) => (
            <button
              key={t}
              type="button"
              className="chip"
              data-active={topic === t}
              aria-pressed={topic === t}
              onClick={() => setTopic(t)}
            >
              {t.length > 22 ? `${t.slice(0, 22)}…` : t}
            </button>
          ))}
        </div>

        <label className="f">
          <span>Target keyword / topic</span>
          <input value={topic} onChange={(e) => setTopic(e.target.value)} />
        </label>

        <div className="langs">
          <span className="eyebrow">Language</span>
          <div className="lang-row">
            {LANGS.map((l) => (
              <button
                key={l.code}
                type="button"
                className="lang-toggle"
                data-on={lang === l.code}
                aria-pressed={lang === l.code}
                onClick={() => setLang(l.code)}
              >
                {l.name}
                <span className="code">{l.flag}</span>
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          className="cta"
          onClick={draft}
          disabled={state.status === "loading" || topic.trim() === ""}
        >
          {state.status === "loading" ? (
            "Drafting…"
          ) : (
            <>
              Draft the article <span className="arr">→</span>
            </>
          )}
        </button>

        <p className="pipe-note">
          In production: <strong>Semrush</strong> supplies the keyword + competitor
          content-gap, the model drafts this brief, an editor refines it for E-E-A-T, and
          it publishes via the <strong>WordPress REST API</strong>.
        </p>
      </div>

      {/* output */}
      <div className="output" aria-live="polite">
        <div className="out-head">
          <h3 className="h-lg">The draft.</h3>
        </div>

        {state.status === "idle" && (
          <div className="empty">
            <span className="em">No draft yet.</span>
            Enter a keyword, pick a language, and draft a buyer&rsquo;s-guide article
            structured for SEO and AI-assistant search.
          </div>
        )}

        {state.status === "loading" && (
          <div className="card">
            <p className="card-loading">Researching and drafting…</p>
          </div>
        )}

        {state.status === "error" && (
          <div className="card">
            <p className="card-error">{state.error}</p>
          </div>
        )}

        {state.status === "done" && <DraftCard data={state.data} />}
      </div>
    </div>
  );
}

type PubState =
  | { s: "idle" }
  | { s: "loading" }
  | { s: "done"; link: string }
  | { s: "error"; msg: string };

function DraftCard({ data }: { data: ArticleResult }) {
  const [pub, setPub] = useState<PubState>({ s: "idle" });

  async function publish() {
    setPub({ s: "loading" });
    try {
      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ article: data }),
      });
      const json = (await res.json()) as PublishResponse;
      setPub(json.ok ? { s: "done", link: json.link } : { s: "error", msg: json.error });
    } catch (err) {
      setPub({ s: "error", msg: err instanceof Error ? err.message : "Network error." });
    }
  }

  return (
    <article className="card">
      <div className="field">
        <div className="field-head">
          <span className="label">H1 · {data.title.length} chars</span>
        </div>
        <p className="value title-val">{data.title}</p>
      </div>

      <div className="field">
        <div className="field-head">
          <span className="label">Meta title / description</span>
        </div>
        <p className="value">{data.meta_title}</p>
        <p className="value body-val" style={{ marginTop: "0.4rem" }}>
          {data.meta_description}
        </p>
      </div>

      <div className="field">
        <div className="field-head">
          <span className="label">Intro</span>
        </div>
        <p className="value body-val">{data.intro}</p>
      </div>

      <div className="field">
        <div className="field-head">
          <span className="label">Outline</span>
        </div>
        <ul className="bullets">
          {data.outline.map((h, i) => (
            <li key={i}>{h}</li>
          ))}
        </ul>
      </div>

      {data.faq.length > 0 && (
        <div className="field">
          <div className="field-head">
            <span className="label">Q&amp;A for AI-assistant search</span>
          </div>
          <div className="faq">
            {data.faq.map((f, i) => (
              <div className="faq-item" key={i}>
                <p className="faq-q">{f.q}</p>
                <p className="value body-val">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="field">
        <div className="field-head">
          <span className="label">Target keywords</span>
        </div>
        <div className="keywords">
          {data.target_keywords.map((k, i) => (
            <span key={i} className="kw">
              {k}
            </span>
          ))}
        </div>
      </div>

      {data.internal_link_ideas.length > 0 && (
        <div className="field">
          <div className="field-head">
            <span className="label">Internal links to add</span>
          </div>
          <div className="keywords">
            {data.internal_link_ideas.map((k, i) => (
              <span key={i} className="kw">
                {k}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="field">
        <div className="field-head">
          <span className="label">Publish</span>
        </div>
        <button
          type="button"
          className="btn-pill"
          onClick={publish}
          disabled={pub.s === "loading"}
        >
          {pub.s === "loading" ? (
            "Publishing…"
          ) : (
            <>
              Publish to WordPress (draft) <span className="arr">↗</span>
            </>
          )}
        </button>
        {pub.s === "done" && (
          <p className="value body-val" style={{ marginTop: "0.6rem" }}>
            Published as a draft for editor review
            {pub.link ? (
              <>
                {" — "}
                <a href={pub.link} target="_blank" rel="noopener noreferrer">
                  view in WordPress
                </a>
              </>
            ) : (
              "."
            )}
          </p>
        )}
        {pub.s === "error" && (
          <p className="card-error" style={{ marginTop: "0.6rem" }}>
            {pub.msg}
          </p>
        )}
      </div>
    </article>
  );
}
