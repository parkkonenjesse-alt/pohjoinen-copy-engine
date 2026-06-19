# Pohjoinen Catalog Copy Engine

Pohjoinen Oy runs an 8,000-SKU Shopify catalog with thin or missing product descriptions, and serves ~180k customers across Finland and the Baltics. This app is the product-pages half of **Opportunity #2**: an AI content engine that generates SEO-optimised, multilingual product copy for the whole catalog, so the Baltic market can be unlocked without hiring a copy team per language. It is live on one SKU as a working proof of concept; the same generation call is built to loop over all 8,000 products.

## Features

- **Spec in, store copy out.** Give it the sparse data a merchandiser already has (name, category, a few specs, a price) and it returns store-ready copy.
- **Six languages.** Finnish, English, Estonian, Latvian, Lithuanian, Swedish. Each language is its own structured-JSON model call, so one slow or failed language never blocks the others.
- **Structured output.** Each call returns `seo_title`, `meta_description`, `description`, `bullets`, and `keywords`, validated server-side before it reaches the UI.
- **Brand voice.** A pinned system prompt keeps Pohjoinen's understated Nordic tone (concrete, benefit-led, no hype, never inventing specs) consistent across every language.
- **Shopify-ready CSV export.** Generated copy exports to a CSV with `Handle`, `Language`, `SEO Title`, `Meta Description`, `Body (HTML)`, and `Keywords` columns, with HTML-escaping and spreadsheet formula-injection guarding.
- **Transparency.** A "Show the prompt" toggle reveals the exact system and user prompts sent to the model.
- **Key never touches the browser.** The model is called server-side only, in a Node-runtime route handler, with the API key read from an environment variable.

## Tech stack

- **Next.js (App Router) + TypeScript**, deployed on **Vercel**.
- **Groq** (free tier, no credit card), model **Llama 3.3 70B** (`llama-3.3-70b-versatile`), called server-side in `app/api/generate/route.ts` (`runtime = "nodejs"`) via a `fetch` to Groq's OpenAI-compatible endpoint.
- One structured-JSON model call per language; payloads validated at the request boundary.
- CSV export built in `lib/csv.ts`.

### Why a free model

The architecture is provider-agnostic: the same brand-voice system prompt and the same per-language structured-JSON call work against any chat-completions endpoint. Groq's free tier was chosen so the live demo stays zero-cost to evaluate, with no key spend every time it is tested. For production, swapping to Claude or OpenAI is a change of endpoint and key only; the prompts and output contract stay identical.

## Local run

```bash
npm i
```

Create a `.env.local` file in the project root:

```bash
GROQ_API_KEY=gsk_...
```

Get a free key at [console.groq.com](https://console.groq.com) (no credit card required).

Then start the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Pick a sample SKU or edit the fields, choose your languages, and run the engine.

## Project structure

```
app/
  layout.tsx              Root layout; self-hosted ABC Diatype font via @font-face
  page.tsx                Single-page UI: input, language picker, results, CSV export
  globals.css             Cinematic monochrome styling (Wolverine Worldwide reference)
  api/generate/route.ts   Server-side Groq call (one language per request)
components/
  ResultCard.tsx          Renders one language's generated copy (loading/done/error)
  Reveal.tsx              Scroll-reveal wrapper
hooks/
  useReveal.ts            IntersectionObserver reveal hook
lib/
  prompt.ts               Brand-voice system prompt + per-language user prompt builder
  samples.ts              Language list (FI/EN/ET/LV/LT/SV) + sample products
  csv.ts                  Shopify-ready CSV builder + slugify
  types.ts                CopyResult / GenerateResponse types
public/fonts/             Self-hosted ABC Diatype (Medium, Bold, Mono)
```

## Deploy

1. Push this repo to GitHub.
2. In Vercel, **Import** the GitHub repo.
3. Add an environment variable: `GROQ_API_KEY` (your free Groq key).
4. Deploy. Vercel auto-detects Next.js; no extra config is needed.

### Repo access note

If the GitHub repo is private, add **reetta.jarvelin@intentio.fi** as a viewer so the submission can be reviewed: GitHub → repo **Settings** → **Collaborators** → add by email.

## How it scales to 8,000 SKUs

The demo above is a single model call per language. The production path wraps that **exact same call** in a batch job (`scripts/batch.ts`) that:

1. Pages through Pohjoinen's catalog via the **Shopify Admin GraphQL API** to pull every SKU's specs.
2. Loops the same structured-JSON call across each market language (8,000 SKUs x ~5 languages). The batch is model-agnostic: it can run on Groq's free tier, or point at a stronger provider (Claude, OpenAI) in production by changing the endpoint and key. The full run is an overnight job.
3. Writes the result back per product (`body_html` plus SEO metafields), or exports the same Shopify CSV the demo produces.

The brand-voice style guide stays pinned in the system prompt across the whole run, so all 8,000 products keep one tone. A human spot-checks a sample before publish, and the batch re-runs each season for new catalog.

## A note on the font

The interface uses **ABC Diatype** (self-hosted as `@font-face`) to match the cinematic Wolverine Worldwide design reference. It is included here for the proof of concept; a production deployment would need a proper **Dinamo** license for ABC Diatype, or a substitute typeface.
