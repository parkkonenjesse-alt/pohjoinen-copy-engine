"use client";

/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { Reveal } from "@/components/Reveal";
import { ResultCard, type LangResult } from "@/components/ResultCard";
import { ArticleStudio } from "@/components/ArticleStudio";
import { LANGS, SAMPLE_PRODUCTS, type Lang } from "@/lib/samples";
import { BRAND_SYSTEM, buildUserPrompt, type Product } from "@/lib/prompt";
import { buildCsv, slugify, type CsvRow } from "@/lib/csv";
import type { GenerateResponse } from "@/lib/types";

const DEFAULT_LANGS = ["fi", "en", "et", "lv"];
// Poster / fallback still shows if /hero.mp4 is absent.
const HERO_IMAGE =
  "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=72&w=2400&auto=format&fit=crop";

export default function Page() {
  const [product, setProduct] = useState<Product>(() => {
    const { name, category, features, price } = SAMPLE_PRODUCTS[0];
    return { name, category, features, price };
  });
  const [activeSample, setActiveSample] = useState<string>(SAMPLE_PRODUCTS[0].key);
  const [selected, setSelected] = useState<string[]>(DEFAULT_LANGS);
  const [results, setResults] = useState<Record<string, LangResult>>({});
  const [generating, setGenerating] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  const selectedLangs: Lang[] = LANGS.filter((l) => selected.includes(l.code));
  const doneRows: CsvRow[] = selectedLangs
    .map((lang) => ({ lang, result: results[lang.code] }))
    .filter(
      (r): r is { lang: Lang; result: Extract<LangResult, { status: "done" }> } =>
        r.result?.status === "done",
    )
    .map(({ lang, result }) => ({ lang, data: result.data }));

  function setField(key: keyof Product, value: string) {
    setProduct((prev) => ({ ...prev, [key]: value }));
    setActiveSample("");
  }

  function loadSample(key: string) {
    const sample = SAMPLE_PRODUCTS.find((s) => s.key === key);
    if (!sample) return;
    setProduct({
      name: sample.name,
      category: sample.category,
      features: sample.features,
      price: sample.price,
    });
    setActiveSample(key);
  }

  function toggleLang(code: string) {
    setSelected((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }

  async function generate() {
    if (selected.length === 0 || generating) return;
    setGenerating(true);

    // Seed every selected language as loading, then fill each in as its
    // request resolves (progressive reveal).
    const seeded: Record<string, LangResult> = {};
    for (const code of selected) seeded[code] = { status: "loading" };
    setResults(seeded);

    // Sequential, not parallel: free LLM endpoints rate-limit under concurrent
    // load. Each card fills in as its request resolves (progressive reveal).
    for (const code of selected) {
      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ product, langCode: code }),
        });
        const json = (await res.json()) as GenerateResponse;
        setResults((prev) => ({
          ...prev,
          [code]: json.ok
            ? { status: "done", data: json.data }
            : { status: "error", error: json.error },
        }));
      } catch (err) {
        setResults((prev) => ({
          ...prev,
          [code]: {
            status: "error",
            error: err instanceof Error ? err.message : "Network error.",
          },
        }));
      }
    }

    setGenerating(false);
  }

  function exportCsv() {
    if (doneRows.length === 0) return;
    const handle = slugify(product.name) || "product";
    const csv = buildCsv(handle, doneRows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${handle}-copy.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const promptLang = selectedLangs[0] ?? LANGS[0];
  const hasResults = Object.keys(results).length > 0;

  return (
    <div className="frame">
      {/* ---- cinematic hero (video, photo fallback) ---- */}
      <header className="hero">
        <video
          className="hero-media"
          autoPlay
          muted
          loop
          playsInline
          poster={HERO_IMAGE}
          preload="metadata"
        >
          <source src="/hero.mp4" type="video/mp4" />
        </video>
        <div className="hero-veil" aria-hidden="true" />

        <nav className="nav">
          <span className="nav-logo">
            <span>Pohjoinen</span>
            <span className="lg-light">Catalog Engine</span>
          </span>
          <div className="nav-links">
            <a href="#engine">The engine</a>
            <a href="#pipeline">Content pipeline</a>
            <a href="#scale">How it scales</a>
            <a className="nav-pill" href="#engine">
              AI-powered
            </a>
          </div>
        </nav>

        <div className="hero-inner">
          <div className="hero-text">
            <p className="hero-eyebrow">Catalog Copy Engine · Opportunity 02</p>
            <h1 className="hero-title">
              A few specs in.
              <br />
              Store-ready copy out.
            </h1>
            <p className="hero-lede">
              Turn a few product specs into SEO-ready, multilingual store copy. Built to
              loop over Pohjoinen&rsquo;s full 8,000-SKU Shopify feed — here it runs on one
              product, live.
            </p>
            <a className="hero-scroll" href="#engine">
              Run the engine <span className="arr">↓</span>
            </a>
          </div>

          <a className="hero-card" href="#engine">
            <div className="hero-card-body">
              <span className="label">Live demo</span>
              <span className="title">
                One SKU · four languages <span className="arr">↗</span>
              </span>
            </div>
          </a>
        </div>
      </header>

      <main className="shell">
        {/* ---- the engine ---- */}
        <section id="engine" className="engine">
          <Reveal className="section-head">
            <span className="eyebrow">The engine</span>
            <h2 className="h-xl">Generate the copy.</h2>
            <p className="intro">
              Give it the sparse data a merchandiser already has — name, category, a few
              specs, a price. Pick the markets. The model returns on-brand,
              SEO-structured copy for each language as its own structured-JSON call.
            </p>
          </Reveal>

          <Reveal className="engine-grid">
            {/* input */}
            <div className="panel">
              <div className="panel-head">
                <span className="eyebrow">Input</span>
                <h3 className="h-lg">Merchandiser data</h3>
              </div>

              <div className="samples">
                {SAMPLE_PRODUCTS.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    className="chip"
                    data-active={activeSample === s.key}
                    onClick={() => loadSample(s.key)}
                  >
                    {s.key}
                  </button>
                ))}
              </div>

              <div className="field-group">
                <label className="f">
                  <span>Product name</span>
                  <input
                    value={product.name}
                    onChange={(e) => setField("name", e.target.value)}
                  />
                </label>
                <label className="f">
                  <span>Category</span>
                  <input
                    value={product.category}
                    onChange={(e) => setField("category", e.target.value)}
                  />
                </label>
                <label className="f">
                  <span>Key features / specs</span>
                  <textarea
                    value={product.features}
                    onChange={(e) => setField("features", e.target.value)}
                    rows={6}
                  />
                </label>
                <label className="f">
                  <span>Price</span>
                  <input
                    value={product.price}
                    onChange={(e) => setField("price", e.target.value)}
                  />
                </label>
              </div>

              <div className="langs">
                <span className="eyebrow">Target languages</span>
                <div className="lang-row">
                  {LANGS.map((l) => (
                    <button
                      key={l.code}
                      type="button"
                      className="lang-toggle"
                      data-on={selected.includes(l.code)}
                      onClick={() => toggleLang(l.code)}
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
                onClick={generate}
                disabled={generating || selected.length === 0}
              >
                {generating ? (
                  "Writing copy…"
                ) : (
                  <>
                    Generate copy · {selected.length}{" "}
                    {selected.length === 1 ? "language" : "languages"}{" "}
                    <span className="arr">→</span>
                  </>
                )}
              </button>

              <button
                type="button"
                className="ghost"
                onClick={() => setShowPrompt((v) => !v)}
              >
                {showPrompt ? "Hide the prompt" : "Show the prompt"}
              </button>

              {showPrompt && (
                <div className="prompt-view">
                  <span className="ph">System · brand voice</span>
                  {BRAND_SYSTEM}
                  <span className="ph">User · {promptLang.name}</span>
                  {buildUserPrompt(product, promptLang.full)}
                </div>
              )}
            </div>

            {/* output */}
            <div className="output">
              <div className="out-head">
                <h3 className="h-lg">Generated copy.</h3>
                <button
                  type="button"
                  className="btn-pill"
                  onClick={exportCsv}
                  disabled={doneRows.length === 0}
                >
                  Export Shopify CSV <span className="arr">↗</span>
                </button>
              </div>

              {!hasResults && (
                <div className="empty">
                  <span className="em">Nothing generated yet.</span>
                  Pick a sample SKU or edit the fields, choose your languages, and run the
                  engine. One Claude call per language returns structured JSON.
                </div>
              )}

              {hasResults && (
                <div className="cards">
                  {selectedLangs.map((lang) => {
                    const result = results[lang.code];
                    if (!result) return null;
                    return <ResultCard key={lang.code} lang={lang} result={result} />;
                  })}
                </div>
              )}
            </div>
          </Reveal>
        </section>

        {/* ---- blog / SEO content pipeline ---- */}
        <section id="pipeline" className="engine">
          <Reveal className="section-head">
            <span className="eyebrow">The content pipeline</span>
            <h2 className="h-xl">Draft the blog, too.</h2>
            <p className="intro">
              The second half of the opportunity: turn a keyword into an SEO
              buyer&rsquo;s-guide draft, structured as Q&amp;A so it ranks and surfaces in
              AI assistants. Semrush feeds keywords in; an editor refines; WordPress
              publishes out.
            </p>
          </Reveal>
          <Reveal>
            <ArticleStudio />
          </Reveal>
        </section>

        {/* ---- scale story (Market Snapshot layout) ---- */}
        <section id="scale" className="scale">
          <Reveal className="section-head">
            <span className="eyebrow">How it scales</span>
            <h2 className="h-xl">One call. Then eight thousand.</h2>
          </Reveal>

          <Reveal className="scale-grid">
            <div className="scale-col">
              <p>
                What you see above is a single model call per language. The production
                engine wraps that <strong>exact same call</strong> in a batch that pages
                through the Shopify Admin GraphQL API, generates copy for every SKU in each
                market language, and writes <code>body_html</code> plus SEO metafields back
                per product.
              </p>
              <p>
                A brand-voice style guide stays pinned in the system prompt so all 8,000
                products keep Pohjoinen&rsquo;s understated Nordic tone. A human
                spot-checks before publish, and the batch re-runs each season for new
                catalog.
              </p>
              <a className="btn-pill" href="#engine">
                Run it above <span className="arr">↑</span>
              </a>
            </div>

            <div className="scale-stats">
              <div className="stat">
                <span className="stat-n">8,000</span>
                <span className="stat-l">SKUs in catalog</span>
              </div>
              <div className="stat">
                <span className="stat-n">×4</span>
                <span className="stat-l">FI · EN · ET · LV / LT</span>
              </div>
              <div className="stat">
                <span className="stat-n">1 night</span>
                <span className="stat-l">on Haiku · ~few hundred €</span>
              </div>
              <div className="stat">
                <span className="stat-n">vs weeks</span>
                <span className="stat-l">of manual writing</span>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      {/* ---- cinematic closing band ---- */}
      <footer className="closing">
        <img className="closing-img" src={HERO_IMAGE} alt="" width={2400} height={1500} />
        <div className="closing-veil" aria-hidden="true" />
        <div className="closing-inner">
          <div className="closing-links">
            <a href="#engine">The engine ↗</a>
            <a href="#scale">How it scales ↗</a>
            <span>AI · Next.js · Vercel</span>
          </div>
          <h2 className="closing-mark">Pohjoinen</h2>
          <p className="closing-meta">
            Catalog Copy Engine · Opportunity 02 · Built for Pohjoinen Oy
          </p>
        </div>
      </footer>
    </div>
  );
}
