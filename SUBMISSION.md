# Intentio Level 02 PoC submission

Ready-to-paste answers for the submission form.

---

**Which opportunity did you choose?**

Opportunity #2: the AI content engine. Specifically the product-pages half, generating SEO-optimised, multilingual product descriptions for Pohjoinen's 8,000-SKU Shopify catalog.

---

**GitHub repo URL**

https://github.com/parkkonenjesse-alt/pohjoinen-copy-engine

The repo is private. Add reetta.jarvelin@intentio.fi as a collaborator (GitHub repo → Settings → Collaborators and teams → Add people), or make the repo public.

---

**Deployed URL**

https://pohjoinen-copy-engine.vercel.app

---

**Tools & stack**

Next.js (App Router) + TypeScript, deployed on Vercel. Groq's free tier (Llama 3.3 70B, `llama-3.3-70b-versatile`), called server-side via an API route so the API key never reaches the browser. One structured-JSON call per language returns `seo_title`, `meta_description`, `description`, `bullets`, and `keywords`, validated at the request boundary. Generated copy exports to a Shopify-ready CSV. The design matches the cinematic Wolverine Worldwide reference with self-hosted ABC Diatype.

---

**Describe what you built**

Pohjoinen has 8,000 Shopify SKUs with thin or missing descriptions, and serves about 180k customers across Finland and the Baltics. Writing accurate, on-brand, SEO product copy by hand in five-plus languages is the bottleneck blocking the Baltic expansion: it would mean weeks of work and a copy team per market. The CMO's directive is to grow 30% on the same headcount using AI, so the obvious wedge is to generate that catalog copy automatically.

I built the Catalog Copy Engine, the product-pages half of that content engine. A merchandiser enters the sparse data they already have (name, category, a few specs, a price), picks the target markets, and gets store-ready copy back for each one: SEO title, meta description, a two-paragraph description, feature bullets, and keyword phrases. A large language model is the core building block. A pinned brand-voice system prompt keeps Pohjoinen's understated Nordic tone consistent (concrete, benefit-led, no hype, never inventing specs), and each language runs as its own structured-JSON call, so the six supported languages (FI, EN, ET, LV, LT, SV) generate independently and one failed language never blocks the rest. Output exports straight to a Shopify-ready CSV, and a "Show the prompt" toggle keeps the whole thing transparent. The PoC is live and runs on one real SKU end to end.

A note on the model choice, to be upfront. I switched the live demo to Groq's free tier so testing it costs nothing. The design is model-agnostic, and the same prompts run on Claude or any provider in production. The engine calls an OpenAI-compatible chat endpoint server-side with the same brand-voice system prompt and the same per-language structured-JSON contract, so moving to a stronger production model is a change of endpoint and key only. I made this choice so you can evaluate the live demo freely without any spend on my account or yours.

It scales by wrapping that exact same call in a batch job over the Shopify Admin GraphQL API: page through all 8,000 SKUs, loop the call across each market language, and write the copy back per product. The batch is model-agnostic, so it can run on the free tier for a trial pass or on a stronger production model for the real run, with a human spot-check before publish, versus weeks of manual writing. Next I would build the full Shopify read/write integration, a review-and-approve queue so a human signs off on each batch before it goes live, and the second half of Opportunity #2: the blog/SEO content pipeline (Semrush for keyword and topic discovery, into the model for drafting, out to WordPress for publishing).
