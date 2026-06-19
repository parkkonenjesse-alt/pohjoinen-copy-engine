export type Product = {
  name: string;
  category: string;
  features: string;
  price: string;
};

export const BRAND_SYSTEM =
  "You are a senior ecommerce copywriter for Pohjoinen, a Finnish retailer of outdoor, " +
  "hiking, cycling and winter-sports gear. You write accurate, SEO-optimised product copy " +
  "in a knowledgeable, understated Nordic voice: concrete and benefit-led, no hype, no empty " +
  "superlatives, never inventing specs. Output ONLY a single valid JSON object. No markdown, " +
  "no code fences, no commentary.";

export function buildUserPrompt(p: Product, fullLang: string): string {
  return `Product data:
Name: ${p.name}
Category: ${p.category}
Key features / specs:
${p.features}
Price: ${p.price}

Write all text values in ${fullLang}.
Return a JSON object with exactly these keys:
{
  "seo_title": string, max 60 characters, product name + main benefit,
  "meta_description": string, max 155 characters, compelling, ends with a reason to browse,
  "description": string, 60-90 words, two short paragraphs separated by \\n\\n, benefit-led, mention the relevant season or use case,
  "bullets": array of 3-5 short feature bullets, each max 8 words,
  "keywords": array of 5-8 SEO keyword phrases in ${fullLang}
}`;
}

// Blog / SEO half of Opportunity #2: keyword -> brief + first draft. The model
// drafts; a human editor (Sofia) refines for E-E-A-T before publishing.
export const BLOG_SYSTEM =
  "You are an SEO content strategist and writer for Pohjoinen, a Finnish retailer of " +
  "outdoor, hiking, cycling and winter-sports gear. You produce genuinely useful, " +
  "accurate buyer's-guide content in a knowledgeable, understated Nordic voice. You " +
  "structure articles as clear questions and answers so they rank in search AND surface " +
  "in AI assistants, where gear buyers increasingly research. No hype, no fabricated facts. " +
  "Output ONLY a single valid JSON object. No markdown, no code fences, no commentary.";

export function buildArticlePrompt(topic: string, fullLang: string): string {
  return `Target keyword / topic: ${topic}

Write all text values in ${fullLang}. Draft an SEO buyer's-guide article for Pohjoinen.
Return a JSON object with exactly these keys:
{
  "title": string, compelling H1, max 65 characters,
  "meta_title": string, max 60 characters,
  "meta_description": string, max 155 characters,
  "target_keywords": array of 5-8 SEO keyword phrases in ${fullLang},
  "outline": array of 4-6 H2 section headings in ${fullLang},
  "intro": string, 40-70 words, hooks the reader and states who the guide is for,
  "faq": array of 3-5 objects {"q": question string, "a": answer string 30-60 words}, real buyer questions phrased naturally for AI-assistant search,
  "internal_link_ideas": array of 3-5 short Pohjoinen category/product link suggestions
}`;
}
