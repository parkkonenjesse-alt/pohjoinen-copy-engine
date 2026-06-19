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
