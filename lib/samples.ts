import type { Product } from "@/lib/prompt";

export type Lang = { code: string; flag: string; name: string; full: string };

export type SampleProduct = Product & { key: string };

// Pohjoinen's actual markets: Finland + the Baltics. The Opportunity #2
// wedge is generating copy in Estonian / Latvian / Lithuanian to unlock the
// Baltic market they already serve. English included as an intl. default.
export const LANGS: Lang[] = [
  { code: "fi", flag: "FI", name: "Suomi", full: "Finnish" },
  { code: "en", flag: "EN", name: "English", full: "English" },
  { code: "et", flag: "ET", name: "Eesti", full: "Estonian" },
  { code: "lv", flag: "LV", name: "Latviešu", full: "Latvian" },
  { code: "lt", flag: "LT", name: "Lietuvių", full: "Lithuanian" },
  { code: "sv", flag: "SV", name: "Svenska", full: "Swedish" },
];

export const SAMPLE_PRODUCTS: SampleProduct[] = [
  {
    key: "Vuokatti shell",
    name: "Vuokatti 3-Layer Shell Jacket",
    category: "Hiking / Hardshell jackets",
    features:
      "20 000 mm waterproof, 20 000 g breathability, fully taped seams, adjustable helmet-compatible hood, pit zips, 2 hand pockets + 1 chest, packs into own pocket, 420 g (size M)",
    price: "€279",
  },
  {
    key: "Kaira merino",
    name: "Kaira Merino Base Layer 200",
    category: "Base layers / Merino wool",
    features:
      "100% merino wool 200 g/m², flatlock seams, natural odour resistance, thumbholes, regular fit, machine washable 30°C",
    price: "€89",
  },
  {
    key: "Routa glove",
    name: "Routa Winter Cycling Glove",
    category: "Cycling / Winter gloves",
    features:
      "Windproof membrane, fleece lining, silicone grip palm, touchscreen-compatible index + thumb, reflective cuff details",
    price: "€49",
  },
  {
    key: "Aalto pack",
    name: "Aalto 60L Trekking Backpack",
    category: "Backpacks / Multi-day",
    features:
      "60 L capacity, adjustable back-length system, ventilated mesh back panel, integrated rain cover, hip-belt pockets, hydration sleeve, 1.9 kg",
    price: "€159",
  },
];
