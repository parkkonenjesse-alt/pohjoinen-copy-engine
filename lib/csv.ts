import type { Lang } from "@/lib/samples";
import type { CopyResult } from "@/lib/types";

// Shopify-friendly URL handle from a product name (diacritics stripped).
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Body (HTML) cell: description paragraphs + a feature <ul>, ready for Shopify.
function bodyHtml(data: CopyResult): string {
  const paras = data.description
    .split(/\n\n+/)
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join("");
  const bullets = data.bullets
    .map((b) => `<li>${escapeHtml(b)}</li>`)
    .join("");
  return `${paras}<ul>${bullets}</ul>`;
}

function csvCell(value: string): string {
  // Neutralise spreadsheet formula injection (=, +, -, @ lead) before Excel
  // or Sheets interprets a cell as a formula, then RFC 4180-quote.
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export type CsvRow = { lang: Lang; data: CopyResult };

export function buildCsv(handle: string, rows: CsvRow[]): string {
  const header = [
    "Handle",
    "Language",
    "SEO Title",
    "Meta Description",
    "Body (HTML)",
    "Keywords",
  ];

  const lines = rows.map(({ lang, data }) =>
    [
      handle,
      lang.name,
      data.seo_title,
      data.meta_description,
      bodyHtml(data),
      data.keywords.join(", "),
    ]
      .map(csvCell)
      .join(","),
  );

  return [header.map(csvCell).join(","), ...lines].join("\r\n");
}
