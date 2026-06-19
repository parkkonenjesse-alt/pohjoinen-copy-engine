// The structured copy Claude returns for a single product, in a single language.
export type CopyResult = {
  seo_title: string;
  meta_description: string;
  description: string;
  bullets: string[];
  keywords: string[];
};

export type GenerateResponse =
  | { ok: true; data: CopyResult }
  | { ok: false; error: string };

// The blog/SEO drafter output (Opportunity #2, content-pipeline half).
export type FaqItem = { q: string; a: string };

export type ArticleResult = {
  title: string;
  meta_title: string;
  meta_description: string;
  target_keywords: string[];
  outline: string[];
  intro: string;
  faq: FaqItem[];
  internal_link_ideas: string[];
};

export type ArticleResponse =
  | { ok: true; data: ArticleResult }
  | { ok: false; error: string };
