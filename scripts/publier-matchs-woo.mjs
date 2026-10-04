/**
 * Publie les matchs de data.js dans WooCommerce :
 * un produit variable par match, une variation par catégorie.
 *
 *   node scripts/publier-matchs-woo.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function chargerEnv() {
  const fichier = resolve(process.cwd(), ".env.local");
  if (!existsSync(fichier)) return;
  for (const ligne of readFileSync(fichier, "utf8").split(/\r?\n/)) {
    const m = ligne.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m || process.env[m[1]]) continue;
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

chargerEnv();

const WC_URL = (process.env.WC_URL ?? "").replace(/\/+$/, "");
const WC_KEY = process.env.WC_CONSUMER_KEY ?? "";
const WC_SECRET = process.env.WC_CONSUMER_SECRET ?? "";

if (!WC_URL || !WC_KEY || !WC_SECRET) {
  console.error("WC_URL / WC_CONSUMER_KEY / WC_CONSUMER_SECRET manquants.");
  process.exit(1);
}

const CATEGORIES = [
  { id: "cat5", label: "CAT 5", mult: 1 },
  { id: "cat4", label: "CAT 4", mult: 1.35 },
  { id: "cat3", label: "CAT 3", mult: 1.7 },
  { id: "cat2", label: "CAT 2", mult: 2.3 },
  { id: "cat1", label: "CAT 1", mult: 2.95 },
];

function roundPrice(n) {
  return Math.round(n / 5) * 5;
}

function catalogue() {
  const src = readFileSync(resolve(process.cwd(), "data.js"), "utf8").split("\n").slice(0, 279).join("\n");
  const competitions = new Function(`${src}\nreturn COMPETITIONS;`)();
  const matchs = [];
  for (const competition of Object.values(competitions)) {
    for (const week of competition.weeks) {
      for (const day of week.days) {
        for (const match of day.matches) {
          matchs.push({
            ...match,
            competition: competition.name,
            competitionId: competition.id,
            week: week.title,
            date: day.date,
          });
        }
      }
    }
  }
  return matchs;
}

function stadeDe(homeShort) {
  const src = readFileSync(resolve(process.cwd(), "data.js"), "utf8");
  const block = src.slice(src.indexOf("const STADIUMS"), src.indexOf("function stadiumFor"));
  const STADIUMS = new Function(`${block}\nreturn STADIUMS;`)();
  return STADIUMS[homeShort] || { name: "Stade à confirmer", city: "" };
}

async function wc(chemin, init) {
  const url = new URL(`${WC_URL}/wp-json/wc/v3${chemin}`);
  url.searchParams.set("consumer_key", WC_KEY);
  url.searchParams.set("consumer_secret", WC_SECRET);
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const texte = await res.text();
  if (!res.ok) throw new Error(`Woo ${res.status} ${chemin}: ${texte.slice(0, 400)}`);
  return texte ? JSON.parse(texte) : {};
}

async function existant(sku) {
  const liste = await wc(`/products?sku=${encodeURIComponent(sku)}&per_page=10`);
  return liste.find((p) => p.sku === sku) ?? null;
}

async function main() {
  const matchs = catalogue();
  console.log(`${matchs.length} matchs`);
  for (const match of matchs) {
    const sku = match.id.replace(/:/g, "");
    const stade = stadeDe(match.homeShort);
    const lieu = [stade.name, stade.city].filter(Boolean).join(", ");
    const base = Math.max(20, Number(match.from) || 40);
    const epuise = match.status === "sold";
    const corps = {
      name: `${match.home} — ${match.away}`,
      type: "variable",
      status: "publish",
      catalog_visibility: "hidden",
      sku,
      description: `${match.competition} · ${match.date} · ${match.kickoff} · ${lieu}`,
      virtual: true,
      tax_status: "none",
      attributes: [
        {
          name: "Categorie",
          slug: "categorie",
          visible: true,
          variation: true,
          options: CATEGORIES.map((c) => c.label),
        },
      ],
      meta_data: [
        { key: "_pf_id", value: match.id },
        { key: "_pf_competition", value: match.competition },
        { key: "_pf_competition_id", value: match.competitionId },
        { key: "_pf_week", value: match.week },
        { key: "_pf_date", value: match.date },
        { key: "_pf_kickoff", value: match.kickoff },
        { key: "_pf_stade", value: stade.name },
        { key: "_pf_ville", value: stade.city },
        { key: "_pf_home", value: match.home },
        { key: "_pf_away", value: match.away },
        { key: "_pf_home_short", value: match.homeShort },
        { key: "_pf_away_short", value: match.awayShort },
        { key: "_pf_status", value: match.status },
        { key: "_pf_from", value: String(base) },
      ],
    };

    let produit = await existant(sku);
    if (produit) {
      produit = await wc(`/products/${produit.id}`, { method: "PUT", body: JSON.stringify(corps) });
      console.log("mis à jour", sku, produit.id);
    } else {
      produit = await wc("/products", { method: "POST", body: JSON.stringify(corps) });
      console.log("créé", sku, produit.id);
    }

    const variations = await wc(`/products/${produit.id}/variations?per_page=100`);
    for (const cat of CATEGORIES) {
      const skuVar = `${sku}-${cat.id}`;
      const prix = roundPrice(base * cat.mult);
      const variation = {
        sku: skuVar,
        regular_price: String(prix),
        virtual: true,
        manage_stock: true,
        stock_quantity: epuise ? 0 : 80,
        stock_status: epuise ? "outofstock" : "instock",
        attributes: [{ name: "Categorie", option: cat.label }],
        meta_data: [
          { key: "_pf_categorie_id", value: cat.id },
          { key: "_pf_categorie_label", value: cat.label },
        ],
      };
      const deja = variations.find((v) => v.sku === skuVar);
      if (deja) {
        await wc(`/products/${produit.id}/variations/${deja.id}`, {
          method: "PUT",
          body: JSON.stringify(variation),
        });
        console.log("  variation", skuVar, deja.id, `${prix} €`);
      } else {
        const cree = await wc(`/products/${produit.id}/variations`, {
          method: "POST",
          body: JSON.stringify(variation),
        });
        console.log("  variation", skuVar, cree.id, `${prix} €`);
      }
    }
  }
  console.log("Matchs publiés dans WooCommerce.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
