import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SITE = "https://primeworldtickets.com";

const LANG_WORDS = {
  fr: "fr",
  francais: "fr",
  french: "fr",
  en: "en",
  english: "en",
  anglais: "en",
  es: "es",
  espanol: "es",
  spanish: "es",
  espagnol: "es",
  de: "de",
  deutsch: "de",
  german: "de",
  allemand: "de",
  it: "it",
  italiano: "it",
  italian: "it",
  italien: "it",
  pt: "pt",
  portugues: "pt",
  portuguese: "pt",
  portugais: "pt",
  nl: "nl",
  nederlands: "nl",
  dutch: "nl",
  neerlandais: "nl",
};

const LOCALES = {
  fr: "fr_FR",
  en: "en_GB",
  es: "es_ES",
  de: "de_DE",
  it: "it_IT",
  pt: "pt_PT",
  nl: "nl_NL",
};

const COPY = {
  fr: {
    title: "Prime Football — Matchs & Billetterie 2026/27",
    description: "Consulte les matchs et réserve tes places sur Prime Football.",
    championsTitle: "Prime Football — Champions League 2026/27",
    championsDescription: "Consulte les matchs de Champions League et réserve tes places sur Prime Football.",
    premierTitle: "Prime Football — Premier League 2026/27",
    premierDescription: "Consulte les matchs de Premier League et réserve tes places sur Prime Football.",
  },
  en: {
    title: "Prime Football — Matches & Tickets 2026/27",
    description: "See the matches and book your seats on Prime Football.",
    championsTitle: "Prime Football — Champions League tickets 2026/27",
    championsDescription: "See Champions League matches and book your seats on Prime Football.",
    premierTitle: "Prime Football — Premier League tickets 2026/27",
    premierDescription: "See Premier League matches and book your seats on Prime Football.",
  },
  es: {
    title: "Prime Football — Partidos y entradas 2026/27",
    description: "Consulta los partidos y reserva tus entradas en Prime Football.",
    championsTitle: "Prime Football — Entradas Champions League 2026/27",
    championsDescription: "Consulta los partidos de Champions League y reserva tus entradas en Prime Football.",
    premierTitle: "Prime Football — Entradas Premier League 2026/27",
    premierDescription: "Consulta los partidos de Premier League y reserva tus entradas en Prime Football.",
  },
  de: {
    title: "Prime Football — Spiele & Tickets 2026/27",
    description: "Sieh dir die Spiele an und buche deine Plätze auf Prime Football.",
    championsTitle: "Prime Football — Champions-League-Tickets 2026/27",
    championsDescription: "Sieh dir die Champions-League-Spiele an und buche deine Plätze auf Prime Football.",
    premierTitle: "Prime Football — Premier-League-Tickets 2026/27",
    premierDescription: "Sieh dir die Premier-League-Spiele an und buche deine Plätze auf Prime Football.",
  },
  it: {
    title: "Prime Football — Partite e biglietti 2026/27",
    description: "Guarda le partite e prenota i tuoi posti su Prime Football.",
    championsTitle: "Prime Football — Biglietti Champions League 2026/27",
    championsDescription: "Guarda le partite di Champions League e prenota i tuoi posti su Prime Football.",
    premierTitle: "Prime Football — Biglietti Premier League 2026/27",
    premierDescription: "Guarda le partite di Premier League e prenota i tuoi posti su Prime Football.",
  },
  pt: {
    title: "Prime Football — Jogos e bilhetes 2026/27",
    description: "Vê os jogos e reserva os teus lugares na Prime Football.",
    championsTitle: "Prime Football — Bilhetes Champions League 2026/27",
    championsDescription: "Vê os jogos da Champions League e reserva os teus lugares na Prime Football.",
    premierTitle: "Prime Football — Bilhetes Premier League 2026/27",
    premierDescription: "Vê os jogos da Premier League e reserva os teus lugares na Prime Football.",
  },
  nl: {
    title: "Prime Football — Wedstrijden & tickets 2026/27",
    description: "Bekijk de wedstrijden en reserveer je plaatsen op Prime Football.",
    championsTitle: "Prime Football — Champions League-tickets 2026/27",
    championsDescription: "Bekijk de Champions League-wedstrijden en reserveer je plaatsen op Prime Football.",
    premierTitle: "Prime Football — Premier League-tickets 2026/27",
    premierDescription: "Bekijk de Premier League-wedstrijden en reserveer je plaatsen op Prime Football.",
  },
};

function motLangue(value) {
  const key = String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return LANG_WORDS[key] || "";
}

function cheminDemande(event) {
  const raw = event.rawUrl || event.headers?.["x-nf-request-url"] || "";
  if (raw) {
    try {
      return decodeURIComponent(new URL(raw).pathname);
    } catch {
      /* chemin brut */
    }
  }
  return decodeURIComponent(event.path || "/");
}

function texte(path) {
  let lang = "fr";
  for (const part of path.toLowerCase().split(/[/\s-]+/)) {
    const trouve = motLangue(part);
    if (trouve) {
      lang = trouve;
      break;
    }
  }
  const pack = COPY[lang];
  const brut = path.toLowerCase();
  if (brut.includes("premier")) {
    return { lang, title: pack.premierTitle, description: pack.premierDescription };
  }
  if (brut.includes("champions")) {
    return { lang, title: pack.championsTitle, description: pack.championsDescription };
  }
  return { lang, title: pack.title, description: pack.description };
}

function echappe(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function personnaliser(html, path) {
  const { lang, title, description } = texte(path);
  const safeTitle = echappe(title);
  const safeDescription = echappe(description);
  const url = echappe(`${SITE}${path.startsWith("/") ? path : `/${path}`}`);
  return html
    .replace(/<html lang="[^"]*">/, `<html lang="${lang}">`)
    .replace(/<title>[^<]*<\/title>/, `<title>${safeTitle}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${safeDescription}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${safeTitle}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${safeDescription}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${url}$2`)
    .replace(/(<meta property="og:locale" content=")[^"]*(")/, `$1${LOCALES[lang] || "fr_FR"}$2`)
    .replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${safeTitle}$2`)
    .replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${safeDescription}$2`)
    .replace(/(<meta itemprop="name" content=")[^"]*(")/, `$1${safeTitle}$2`)
    .replace(/(<meta itemprop="description" content=")[^"]*(")/, `$1${safeDescription}$2`)
    .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${url}$2`);
}

let modele;

async function lireIndex() {
  if (modele) return modele;
  const chemins = [
    join(process.cwd(), "index.html"),
    join(process.cwd(), "netlify/functions/index.html"),
    "/var/task/index.html",
  ];
  for (const chemin of chemins) {
    if (existsSync(chemin)) {
      modele = readFileSync(chemin, "utf8");
      return modele;
    }
  }
  const res = await fetch(`${SITE}/index.html`);
  if (!res.ok) throw new Error("page");
  modele = await res.text();
  return modele;
}

export async function handler(event) {
  const path = cheminDemande(event);
  try {
    const html = personnaliser(await lireIndex(), path);
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
      body: html,
    };
  } catch {
    return { statusCode: 302, headers: { Location: "/index.html" }, body: "" };
  }
}
