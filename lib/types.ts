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
