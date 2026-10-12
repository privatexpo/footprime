import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { deflateSync } from "node:zlib";
import qrcode from "../../qrcode.js";
import { logoPdf } from "./logo-pdf.js";
import { secteurStade } from "../../stades.js";

const SITE = "https://primeleaguepass.com";
const COOKIE_COMPTE = "pf_compte";
const DUREE_SESSION_SEC = 60 * 60 * 24 * 30;

export class ShopError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function env(name) {
  return String(process.env[name] || "").trim();
}

function wcBase() {
  const url = env("WC_URL").replace(/\/+$/, "");
  const key = env("WC_CONSUMER_KEY");
  const secret = env("WC_CONSUMER_SECRET");
  if (!url || !key || !secret) throw new ShopError("WooCommerce n'est pas configuré.", 500);
  return { url, key, secret };
}

export async function wc(chemin, init) {
  const { url, key, secret } = wcBase();
  const cible = new URL(`${url}/wp-json/wc/v3${chemin}`);
  cible.searchParams.set("consumer_key", key);
  cible.searchParams.set("consumer_secret", secret);
  const res = await fetch(cible, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const texte = await res.text();
  const data = texte ? JSON.parse(texte) : {};
  if (!res.ok) {
    const message = data?.message || texte.slice(0, 180);
    throw new ShopError(`WooCommerce : ${message}`, res.status >= 500 ? 502 : 400);
  }
  return data;
}

function meta(liste, cle) {
  const trouve = (liste || []).find((item) => item.key === cle);
  return trouve ? String(trouve.value ?? "") : "";
}

function skuParent(matchId) {
  return String(matchId || "").replace(/:/g, "").replace(/\s+/g, "");
}

function refDe(id) {
  return `PF-${String(id).padStart(6, "0")}`;
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function codeAcces(orderId, email, orderKey) {
  const mac = createHmac("sha256", String(orderKey || ""))
    .update(`retrait|${orderId}|${String(email || "").trim().toLowerCase()}`)
    .digest();
  let brut = "";
  for (let i = 0; i < 8; i += 1) brut += CODE_ALPHABET[mac[i] % CODE_ALPHABET.length];
  return `${brut.slice(0, 4)}-${brut.slice(4)}`;
}

function codesEgaux(saisi, attendu) {
  const a = String(saisi || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const b = String(attendu || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (a.length !== 8 || b.length !== 8) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function normaliserMotDePasse(mot) {
  return String(mot || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function genererMotDePasse() {
  const bytes = randomBytes(8);
  let brut = "";
  for (let i = 0; i < 8; i += 1) brut += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return `${brut.slice(0, 4)}-${brut.slice(4)}`;
}

function hasherMotDePasse(mot) {
  const sel = randomBytes(16);
  const hash = scryptSync(normaliserMotDePasse(mot), sel, 32);
  return `scrypt$${sel.toString("base64url")}$${hash.toString("base64url")}`;
}

function verifierMotDePasse(mot, stocke) {
  const [algo, sel, hash] = String(stocke || "").split("$");
  if (algo !== "scrypt" || !sel || !hash) return false;
  const calc = scryptSync(normaliserMotDePasse(mot), Buffer.from(sel, "base64url"), 32);
  const attendu = Buffer.from(hash, "base64url");
  if (calc.length !== attendu.length) return false;
  return timingSafeEqual(calc, attendu);
}

function secretSession() {
  return env("ACCOUNT_SECRET") || env("BYTEQS_WEBHOOK_SECRET") || env("BYTEQS_SECRET_KEY") || "prime-espace-client";
}

function signerSession(corps) {
  return createHmac("sha256", secretSession()).update(corps).digest("base64url");
}

function creerJeton(email) {
  const exp = Date.now() + DUREE_SESSION_SEC * 1000;
  const corps = Buffer.from(JSON.stringify({ email: String(email).trim().toLowerCase(), exp })).toString("base64url");
  return `${corps}.${signerSession(corps)}`;
}

function lireJeton(jeton) {
  const [corps, sig] = String(jeton || "").split(".");
  if (!corps || !sig) return null;
  const attendu = signerSession(corps);
  const a = Buffer.from(sig);
  const b = Buffer.from(attendu);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(corps, "base64url").toString("utf8"));
    const email = String(data.email || "")
      .trim()
      .toLowerCase();
    const exp = Number(data.exp);
    if (!email.includes("@") || !Number.isFinite(exp) || exp < Date.now()) return null;
    return { email, exp };
  } catch {
    return null;
  }
}

export function cookieCompte(jeton) {
  const base = `${COOKIE_COMPTE}=${jeton}; HttpOnly; Path=/; Max-Age=${DUREE_SESSION_SEC}; SameSite=Lax`;
  return process.env.NODE_ENV === "development" ? base : `${base}; Secure`;
}

export function cookieCompteVide() {
  const base = `${COOKIE_COMPTE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`;
  return process.env.NODE_ENV === "development" ? base : `${base}; Secure`;
}

export function sessionDepuisCookie(header) {
  const brut = String(header || "");
  const m = brut.match(/(?:^|;\s*)pf_compte=([^;]+)/);
  if (!m) return null;
  return lireJeton(decodeURIComponent(m[1]));
}

async function commandesParEmail(email) {
  const mail = String(email || "")
    .trim()
    .toLowerCase();
  if (!mail) return [];
  const qs = new URLSearchParams({
    search: mail,
    status: "any",
    per_page: "40",
    orderby: "date",
    order: "desc",
  });
  let lot = [];
  try {
    lot = await wc(`/orders?${qs}`);
  } catch {
    return [];
  }
  if (!Array.isArray(lot)) return [];
  return lot.filter((wcOrder) => String(wcOrder.billing?.email || "").toLowerCase() === mail);
}

async function lireHashCompte(email) {
  const commandes = await commandesParEmail(email);
  for (const wcOrder of commandes) {
    const hash = meta(wcOrder.meta_data, "_pf_compte_mdp");
    if (hash.startsWith("scrypt$")) return hash;
  }
  return "";
}

async function ecrireHashCompte(email, hash) {
  const mail = String(email || "")
    .trim()
    .toLowerCase();
  if (!mail || !hash.startsWith("scrypt$")) return;
  const commandes = await commandesParEmail(mail);
  const cible = commandes.find((wcOrder) => meta(wcOrder.meta_data, "_pf_compte_coffre") === "oui") || commandes.find((wcOrder) => payee(wcOrder)) || commandes[0];
  if (cible) {
    await wc(`/orders/${cible.id}`, {
      method: "PUT",
      body: JSON.stringify({
        meta_data: [
          { key: "_pf_compte_coffre", value: "oui" },
          { key: "_pf_compte_mdp", value: hash },
        ],
      }),
    });
    return;
  }
  await wc("/orders", {
    method: "POST",
    body: JSON.stringify({
      status: "cancelled",
      set_paid: false,
      currency: "EUR",
      billing: { email: mail },
      fee_lines: [{ name: "Espace client", total: "0.00", tax_status: "none" }],
      meta_data: [
        { key: "_pf_compte_coffre", value: "oui" },
        { key: "_pf_compte_mdp", value: hash },
      ],
    }),
  });
}

async function assurerAcces(email, codeFallback) {
  const mail = emailUtile(email);
  if (!mail) return { email: mail };
  const hash = await lireHashCompte(mail);
  if (hash) return { email: mail };
  const code = codeFallback || genererMotDePasse();
  await ecrireHashCompte(mail, hasherMotDePasse(code));
  return { email: mail, code };
}

export async function billetsDuCompte(email) {
  const lot = await commandesParEmail(email);
  const orders = [];
  for (const wcOrder of lot) {
    const order = commandeDepuis(wcOrder);
    const test = meta(wcOrder.meta_data, "_pf_test") === "1" || order?.test;
    if (!order || (!payee(wcOrder) && !test)) continue;
    if (meta(wcOrder.meta_data, "_pf_compte_coffre") === "oui" && !(order.items || []).length) continue;
    orders.push(avecCode(order, wcOrder));
  }
  return orders;
}

export async function connecterCompte(email, code) {
  const mail = String(email || "")
    .trim()
    .toLowerCase();
  const saisi = String(code || "").trim();
  if (!mail.includes("@") || mail.startsWith("attente@") || normaliserMotDePasse(saisi).length < 8) {
    return { ok: false };
  }
  const hash = await lireHashCompte(mail);
  if (hash && verifierMotDePasse(saisi, hash)) {
    const resume = await resumeCompte(mail);
    return { ...resume, jeton: creerJeton(mail) };
  }
  const trouve = await retrouver(mail, saisi);
  if (trouve?.pending) return { ok: false, pending: true };
  if (!trouve?.order) return { ok: false };
  if (!hash) await ecrireHashCompte(mail, hasherMotDePasse(saisi));
  const resume = await resumeCompte(mail);
  return { ...resume, jeton: creerJeton(mail) };
}

function lireDemandesMeta(wcOrder) {
  const brut = meta(wcOrder.meta_data, "_pf_demandes");
  if (!brut.trim()) return [];
  try {
    const liste = JSON.parse(brut);
    return Array.isArray(liste) ? liste.filter((d) => d && typeof d.id === "string") : [];
  } catch {
    return [];
  }
}

async function ecrireDemandesMeta(wcOrder, liste) {
  await wc(`/orders/${wcOrder.id}`, {
    method: "PUT",
    body: JSON.stringify({
      meta_data: [{ key: "_pf_demandes", value: JSON.stringify(liste.slice(-40)) }],
    }),
  });
}

function libelleDemande(type) {
  return (
    {
      annulation: "Annulation / remboursement",
      echange: "Modification de réservation",
      renvoi: "Billet non reçu",
      message: "Message au support",
      upsell: "Complément de commande",
    }[type] || "Demande"
  );
}

function libelleStatut(status) {
  const map = {
    processing: "Confirmée",
    completed: "Terminée",
    pending: "En attente",
    "on-hold": "En attente",
    cancelled: "Annulée",
    refunded: "Remboursée",
    failed: "Échouée",
  };
  return map[String(status || "").toLowerCase()] || String(status || "—");
}

export async function commandesDuCompte(email) {
  const lot = await commandesParEmail(email);
  const commandes = [];
  for (const wcOrder of lot) {
    if (meta(wcOrder.meta_data, "_pf_compte_coffre") === "oui" && !(commandeDepuis(wcOrder)?.items || []).length) continue;
    const order = commandeDepuis(wcOrder);
    if (!order) continue;
    commandes.push({
      id: wcOrder.id,
      ref: order.ref,
      date: order.created || wcOrder.date_created || "",
      total: order.total,
      statut: libelleStatut(wcOrder.status),
      status: wcOrder.status,
      payee: payee(wcOrder) || meta(wcOrder.meta_data, "_pf_test") === "1",
      items: (order.items || []).map((item) => ({
        title: item.title,
        qty: item.qty,
        category: item.category,
        date: item.date,
      })),
    });
  }
  return commandes;
}

export async function demandesDuCompte(email) {
  const lot = await commandesParEmail(email);
  const out = [];
  for (const wcOrder of lot) {
    const order = commandeDepuis(wcOrder);
    for (const demande of lireDemandesMeta(wcOrder)) {
      out.push({
        ...demande,
        numero: order?.ref || `PF-${wcOrder.id}`,
        typeLabel: libelleDemande(demande.type),
      });
    }
  }
  out.sort((a, b) => String(b.creeLe || "").localeCompare(String(a.creeLe || "")));
  return out;
}

export async function profilDuCompte(email) {
  const mail = String(email || "")
    .trim()
    .toLowerCase();
  const lot = await commandesParEmail(mail);
  const payees = lot.filter((wcOrder) => payee(wcOrder) || meta(wcOrder.meta_data, "_pf_test") === "1");
  const source = payees[0] || lot[0];
  const billing = source?.billing || {};
  const stocke = source ? meta(source.meta_data, "_pf_profil") : "";
  let profil = {};
  if (stocke) {
    try {
      profil = JSON.parse(stocke) || {};
    } catch {
      profil = {};
    }
  }
  return {
    email: mail,
    prenom: String(profil.prenom || billing.first_name || ""),
    nom: String(profil.nom || billing.last_name || ""),
    telephone: String(profil.telephone || billing.phone || ""),
    adresse: String(profil.adresse || billing.address_1 || ""),
    codePostal: String(profil.codePostal || billing.postcode || ""),
    ville: String(profil.ville || billing.city || ""),
    pays: String(profil.pays || billing.country || "FR"),
  };
}

async function avisBoutique({ sujet, html, key }) {
  const to = env("MAIL_SUPPORT") || env("MAIL_FROM")?.match(/<([^>]+)>/)?.[1] || `support@${new URL(SITE).hostname}`;
  const from = env("MAIL_FROM") || `Prime Football <support@${new URL(SITE).hostname}>`;
  await envoyerBrevo({
    to,
    from,
    subject: sujet,
    html,
    key,
  });
}

export async function enregistrerProfil(email, champs) {
  const mail = String(email || "")
    .trim()
    .toLowerCase();
  const lot = await commandesParEmail(mail);
  const cible = lot.find((wcOrder) => payee(wcOrder)) || lot[0];
  if (!cible) return { ok: false, message: "Aucune commande liée à ce compte." };
  const profil = {
    prenom: String(champs.prenom || "").trim().slice(0, 80),
    nom: String(champs.nom || "").trim().slice(0, 80),
    telephone: String(champs.telephone || "").trim().slice(0, 40),
    adresse: String(champs.adresse || "").trim().slice(0, 160),
    codePostal: String(champs.codePostal || "").trim().slice(0, 20),
    ville: String(champs.ville || "").trim().slice(0, 80),
    pays: String(champs.pays || "FR").trim().slice(0, 2).toUpperCase() || "FR",
  };
  await wc(`/orders/${cible.id}`, {
    method: "PUT",
    body: JSON.stringify({
      billing: {
        ...cible.billing,
        email: mail,
        first_name: profil.prenom,
        last_name: profil.nom,
        phone: profil.telephone,
        address_1: profil.adresse,
        postcode: profil.codePostal,
        city: profil.ville,
        country: profil.pays,
      },
      meta_data: [{ key: "_pf_profil", value: JSON.stringify(profil) }],
    }),
  });
  return { ok: true, profil: { email: mail, ...profil } };
}

export async function poserDemandeCompte(email, { type, resume, numero }) {
  const mail = String(email || "")
    .trim()
    .toLowerCase();
  const lot = await commandesParEmail(mail);
  let cible =
    (numero && lot.find((wcOrder) => refDe(wcOrder.id) === String(numero).toUpperCase() || String(wcOrder.id) === String(numero))) ||
    lot.find((wcOrder) => payee(wcOrder)) ||
    lot[0];
  if (!cible) return { ok: false, message: "Aucune commande pour cette demande." };
  const demande = {
    id: `d-${Date.now()}-${Math.floor(Math.random() * 999)}`,
    type: String(type || "message"),
    statut: "en_cours",
    creeLe: new Date().toISOString(),
    resume: String(resume || "").trim().slice(0, 500) || libelleDemande(type),
  };
  await ecrireDemandesMeta(cible, [...lireDemandesMeta(cible), demande]);
  const order = commandeDepuis(cible);
  await avisBoutique({
    sujet: `[Espace client] ${libelleDemande(demande.type)} — ${order?.ref || cible.id}`,
    html: `<p>Client : ${esc(mail)}</p><p>Commande : ${esc(order?.ref || String(cible.id))}</p><p>Type : ${esc(libelleDemande(demande.type))}</p><p>${esc(demande.resume)}</p>`,
    key: `pf-demande-${demande.id}`,
  }).catch(() => undefined);
  return { ok: true, demande: { ...demande, numero: order?.ref || `PF-${cible.id}`, typeLabel: libelleDemande(demande.type) } };
}

export async function renvoyerBilletsCompte(email, numero) {
  const mail = String(email || "")
    .trim()
    .toLowerCase();
  const orders = await billetsDuCompte(mail);
  const order = orders.find((entry) => entry.ref === String(numero || "").toUpperCase()) || orders[0];
  if (!order) return { ok: false, message: "Aucune commande payée." };
  await envoyerMails({ ...order, code: "" });
  await poserDemandeCompte(mail, {
    type: "renvoi",
    resume: `Rappel envoyé pour ${order.ref}`,
    numero: order.ref,
  });
  return { ok: true, ref: order.ref };
}

export async function changerCodeCompte(email, actuel, nouveau) {
  const mail = String(email || "")
    .trim()
    .toLowerCase();
  const a = String(actuel || "").trim();
  const n = String(nouveau || "").trim();
  if (normaliserMotDePasse(n).length < 8) return { ok: false, message: "Le nouveau code doit contenir au moins 8 caractères." };
  const hash = await lireHashCompte(mail);
  let ok = false;
  if (hash && verifierMotDePasse(a, hash)) ok = true;
  else {
    const trouve = await retrouver(mail, a);
    ok = Boolean(trouve?.order);
  }
  if (!ok) return { ok: false, message: "Code actuel incorrect." };
  await ecrireHashCompte(mail, hasherMotDePasse(n));
  return { ok: true };
}

export async function pdfBilletCompte(email, ticketCode) {
  const orders = await billetsDuCompte(email);
  const key = String(ticketCode || "")
    .trim()
    .toUpperCase();
  for (const order of orders) {
    for (const item of order.items || []) {
      const ticket = (item.tickets || []).find((entry) => String(entry.code).toUpperCase() === key);
      if (!ticket) continue;
      const url = ticketUrl(order, item, ticket);
      const pdf = pdfBillet(order, item, ticket, url);
      return { ok: true, filename: `${ticket.code}.pdf`, pdf: Buffer.from(pdf).toString("base64") };
    }
  }
  return { ok: false };
}

function compterBillets(orders) {
  return (orders || []).reduce((sum, order) => sum + (order.items || []).reduce((n, item) => n + (item.tickets || []).length, 0), 0);
}

export async function resumeCompte(email) {
  const mail = String(email || "")
    .trim()
    .toLowerCase();
  const [orders, commandes, demandes, profil] = await Promise.all([
    billetsDuCompte(mail),
    commandesDuCompte(mail),
    demandesDuCompte(mail),
    profilDuCompte(mail),
  ]);
  return {
    ok: true,
    email: mail,
    orders,
    commandes,
    demandes,
    profil,
    stats: {
      billets: compterBillets(orders),
      commandes: commandes.length,
      demandes: demandes.filter((d) => d.statut === "en_cours").length,
    },
  };
}

export async function sessionCompte(header) {
  const session = sessionDepuisCookie(header);
  if (!session) return { ok: false };
  return resumeCompte(session.email);
}

function avecCode(order, wcOrder) {
  const email = emailUtile(order?.email);
  if (!email || !wcOrder?.id || !wcOrder.order_key) return order;
  return { ...order, code: codeAcces(wcOrder.id, email, wcOrder.order_key) };
}

function idDeRef(code) {
  const m = String(code || "").trim().toUpperCase().match(/^PF-(\d+)(?:-(\d+))?$/);
  if (!m) return null;
  return { id: Number(m[1]), ticket: m[2] ? Number(m[2]) : null };
}

function hashPositif(cle) {
  let h = 0;
  const valeur = String(cle);
  for (let i = 0; i < valeur.length; i += 1) h = (h * 33 + valeur.charCodeAt(i)) >>> 0;
  return h;
}

function places(qty, stade, categorie, graine) {
  const n = Math.max(1, qty);
  const h = hashPositif(`${graine}|${stade}|${categorie}`);
  const secteur = secteurStade(stade, categorie) || {
    tribune: "Latérale",
    bloc: "1",
    porte: "1",
    rangMin: 8,
    rangMax: 24,
    siegeMax: 24,
  };
  const row = secteur.rangMin + (h % (secteur.rangMax - secteur.rangMin + 1));
  let start = 1 + (h % Math.max(1, secteur.siegeMax - n));
  if (start + n - 1 > secteur.siegeMax) start = Math.max(1, secteur.siegeMax - n + 1);
  return Array.from({ length: n }, (_, i) => ({
    row,
    seat: start + i,
    tribune: secteur.tribune,
    bloc: secteur.bloc,
    porte: secteur.porte,
  }));
}

function textePlace(ticket) {
  if (!ticket?.tribune) return `Rang ${ticket.row} · Place ${ticket.seat}`;
  return `Tribune ${ticket.tribune} · Bloc ${ticket.bloc} · Rang ${ticket.row} · Place ${ticket.seat} · Porte ${ticket.porte}`;
}

const ATTENTE = "attente@primeleaguepass.com";

function emailUtile(value) {
  const email = String(value || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.startsWith("attente@") || email.includes("{")) return "";
  return email;
}

function nomParts(name) {
  const morceaux = String(name || "").trim().split(/\s+/).filter(Boolean);
  const prenom = morceaux[0] || "Client";
  const nom = morceaux.slice(1).join(" ") || prenom;
  return { prenom: prenom.slice(0, 50), nom: nom.slice(0, 50) };
}

function cheminLogo(src) {
  const value = String(src || "");
  return /^(badges|logos)\/[a-z0-9._-]+$/i.test(value) ? `${SITE}/${value}` : "";
}

async function variationPour(matchId, categoryId) {
  const parentSku = skuParent(matchId);
  const category = String(categoryId || "");
  if (!parentSku || !/^cat[1-5]$/.test(category)) throw new ShopError("Remets ce match dans le panier.");
  const produits = await wc(`/products?sku=${encodeURIComponent(parentSku)}&per_page=5`);
  const parent = (Array.isArray(produits) ? produits : []).find((item) => item.sku === parentSku);
  if (!parent) throw new ShopError("Ce match n'est plus en vente.");
  const variations = await wc(`/products/${parent.id}/variations?per_page=20`);
  const sku = `${parentSku}-${category}`;
  const variation = (Array.isArray(variations) ? variations : []).find((item) => item.sku === sku);
  if (!variation) throw new ShopError("Cette catégorie n'est plus en vente.");
  if (variation.stock_status === "outofstock") throw new ShopError("Cette catégorie est complète.");
  const prix = Number(variation.price || variation.regular_price);
  if (!Number.isFinite(prix) || prix <= 0) throw new ShopError("Prix indisponible.");
  return { parent, variation, prix };
}

function commandeDepuis(wcOrder) {
  const brut = meta(wcOrder.meta_data, "_pf_order");
  if (!brut) return null;
  try {
    return JSON.parse(brut);
  } catch {
    return null;
  }
}

function payee(wcOrder) {
  const statut = String(wcOrder.status || "");
  return meta(wcOrder.meta_data, "_byteqs_status") === "paid" || statut === "processing" || statut === "completed";
}

export async function creerPaiement({ name, email, lines }) {
  const mail = emailUtile(email) || ATTENTE;
  const { prenom, nom } = nomParts(name);
  const panier = Array.isArray(lines) ? lines : [];
  if (!panier.length || panier.length > 8) throw new ShopError("Ton panier est vide.");

  const details = [];
  for (const ligne of panier) {
    const qty = Math.max(1, Math.min(8, Number(ligne.qty) || 1));
    const trouve = await variationPour(ligne.matchId, ligne.categoryId);
    if (trouve.variation.manage_stock && Number(trouve.variation.stock_quantity) < qty) {
      throw new ShopError("Il ne reste pas assez de places.");
    }
    const parentMeta = trouve.parent.meta_data;
    details.push({
      qty,
      prix: trouve.prix,
      productId: trouve.parent.id,
      variationId: trouve.variation.id,
      title: trouve.parent.name,
      category: meta(trouve.variation.meta_data, "_pf_categorie_label") || String(ligne.categoryId),
      categoryId: String(ligne.categoryId),
      date: meta(parentMeta, "_pf_date"),
      kickoff: meta(parentMeta, "_pf_kickoff"),
      competition: meta(parentMeta, "_pf_competition"),
      stadium: meta(parentMeta, "_pf_stade"),
      home: meta(parentMeta, "_pf_home"),
      away: meta(parentMeta, "_pf_away"),
      homeLogo: cheminLogo(ligne.homeLogo),
      awayLogo: cheminLogo(ligne.awayLogo),
    });
  }

  const total = details.reduce((sum, item) => sum + item.prix * item.qty, 0);
  const cree = await wc("/orders", {
    method: "POST",
    body: JSON.stringify({
      status: "pending",
      payment_method: "byteqs",
      payment_method_title: "Carte",
      set_paid: false,
      billing: { first_name: prenom, last_name: nom, email: mail, country: "FR" },
      line_items: details.map((item) => ({
        product_id: item.productId,
        variation_id: item.variationId,
        quantity: item.qty,
        subtotal: (item.prix * item.qty).toFixed(2),
        total: (item.prix * item.qty).toFixed(2),
      })),
    }),
  });

  const ref = refDe(cree.id);
  let n = 1;
  const items = details.map((item, index) => ({
    title: item.title,
    home: item.home,
    away: item.away,
    homeLogo: item.homeLogo,
    awayLogo: item.awayLogo,
    date: item.date,
    competition: item.competition,
    stadium: item.stadium,
    kickoff: item.kickoff,
    category: item.category,
    price: item.prix,
    qty: item.qty,
    together: item.qty > 1,
    tickets: places(item.qty, item.stadium, item.categoryId, `${cree.id}|${index}`).map((place) => ({
      code: `${ref}-${n++}`,
      row: place.row,
      seat: place.seat,
      tribune: place.tribune,
      bloc: place.bloc,
      porte: place.porte,
    })),
  }));
  const order = {
    ref,
    wooId: cree.id,
    name: `${prenom} ${nom}`.trim(),
    email: mail,
    created: new Date().toISOString(),
    total,
    items,
  };

  const session = await sessionByteqs({
    reference: `PF-${cree.id}`,
    email: mail,
    wooId: cree.id,
    orderKey: cree.order_key,
    lignes: details.map((item) => ({
      name: `${item.title} — ${item.category}`,
      amountInCents: Math.round(item.prix * 100),
      quantity: item.qty,
    })),
  });

  await wc(`/orders/${cree.id}`, {
    method: "PUT",
    body: JSON.stringify({
      meta_data: [
        { key: "_pf_order", value: JSON.stringify(order) },
        { key: "_pf_ref", value: ref },
        { key: "_byteqs_status", value: "unpaid" },
        { key: "_byteqs_reference", value: `PF-${cree.id}` },
        { key: "_byteqs_checkout_url", value: session.checkoutUrl },
        ...(session.id ? [{ key: "_byteqs_session_id", value: session.id }] : []),
      ],
    }),
  });

  return { url: session.checkoutUrl, ref };
}

const TEST_TOKEN = "q8Vn3Lr6Wt2Hs9Yb4Dx7Km5Pc";

export async function creerPaiementTest({ token }) {
  if (String(token || "") !== TEST_TOKEN) throw new ShopError("Page introuvable.", 404);
  const mail = ATTENTE;
  const { prenom, nom } = nomParts("");
  const cree = await wc("/orders", {
    method: "POST",
    body: JSON.stringify({
      status: "pending",
      payment_method: "byteqs",
      payment_method_title: "Carte",
      set_paid: false,
      billing: { first_name: prenom, last_name: nom, email: mail, country: "FR" },
      fee_lines: [{ name: "Paiement test", total: "0.10", tax_status: "none" }],
    }),
  });
  const ref = refDe(cree.id);
  const item = {
    title: "Billet test",
    date: "Test",
    competition: "TEST",
    stadium: "Contrôle test",
    kickoff: "",
    category: "TEST",
    price: 0.1,
    qty: 1,
    together: false,
    tickets: [{ code: `${ref}-1`, row: 1, seat: 1 }],
  };
  const order = {
    ref,
    wooId: cree.id,
    test: true,
    name: `${prenom} ${nom}`.trim(),
    email: mail,
    created: new Date().toISOString(),
    total: 0.1,
    items: [item],
  };
  const session = await sessionByteqs({
    reference: `PF-${cree.id}`,
    email: mail,
    wooId: cree.id,
    orderKey: cree.order_key,
    lignes: [{ name: "Paiement test", amountInCents: 10, quantity: 1 }],
  });
  await wc(`/orders/${cree.id}`, {
    method: "PUT",
    body: JSON.stringify({
      meta_data: [
        { key: "_pf_order", value: JSON.stringify(order) },
        { key: "_pf_ref", value: ref },
        { key: "_pf_test", value: "1" },
        { key: "_byteqs_status", value: "unpaid" },
        { key: "_byteqs_reference", value: `PF-${cree.id}` },
        { key: "_byteqs_checkout_url", value: session.checkoutUrl },
        ...(session.id ? [{ key: "_byteqs_session_id", value: session.id }] : []),
      ],
    }),
  });
  return { url: session.checkoutUrl, ref };
}

async function sessionByteqs(input) {
  const secret = env("BYTEQS_SECRET_KEY");
  const publishable = env("BYTEQS_PUBLISHABLE_KEY");
  const origin = (env("BYTEQS_CHECKOUT_ORIGIN") || "https://pay.primeleaguetickets.com").replace(/\/+$/, "");
  const cle = secret || publishable;
  if (!cle) throw new ShopError("Le paiement n'est pas configuré.", 500);
  const corps = {
    successUrl: `${SITE}/thank-you?commande=PF-${input.wooId}&key=${encodeURIComponent(input.orderKey)}`,
    cancelUrl: `${SITE}/panier.html?paiement=annule`,
    currency: "EUR",
    clientReferenceId: input.reference,
    metadata: { wooId: String(input.wooId), reference: input.reference },
    lineItems: input.lignes,
  };
  const mail = emailUtile(input.email);
  if (mail) corps.customer = { email: mail };
  const premier = await posterByteqs(origin, cle, corps);
  if (premier) return premier;
  if (secret && publishable && cle === secret) {
    const second = await posterByteqs(origin, publishable, corps);
    if (second) return second;
  }
  throw new ShopError("La page de paiement n'a pas pu s'ouvrir.");
}

async function posterByteqs(origin, cle, corps) {
  const res = await fetch(`${origin}/api/hosted-checkout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cle}`,
      Origin: SITE,
      Referer: `${SITE}/`,
    },
    body: JSON.stringify(corps),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.success || !data.checkoutUrl) {
    if (res.status === 401 || res.status === 403) return null;
    throw new ShopError(data?.message || data?.error || "La page de paiement n'a pas pu s'ouvrir.");
  }
  return { checkoutUrl: data.checkoutUrl, id: data.id || data.checkoutId || data.sessionId || "" };
}

export async function lireCommande(code, key) {
  const parsed = idDeRef(code);
  if (!parsed) throw new ShopError("Commande introuvable.", 404);
  const wcOrder = await wc(`/orders/${parsed.id}`);
  if (key && wcOrder.order_key !== key) throw new ShopError("Commande introuvable.", 404);
  const order = avecCode(commandeDepuis(wcOrder), wcOrder);
  if (!order) throw new ShopError("Commande introuvable.", 404);
  return { order, paid: payee(wcOrder), status: wcOrder.status };
}

export async function livrerTest(wooId, indices = []) {
  const wcOrder = await wc(`/orders/${wooId}`);
  let order = commandeDepuis(wcOrder);
  if (!order?.test) return;
  if (meta(wcOrder.meta_data, "_pf_mail_brevo") === "oui") return;
  if (!emailUtile(order.email)) {
    const trouve =
      indices.map((valeur) => emailUtile(valeur)).find(Boolean) ||
      (await emailClientByteqs(
        meta(wcOrder.meta_data, "_byteqs_session_id"),
        meta(wcOrder.meta_data, "_byteqs_checkout_url"),
        `PF-${wcOrder.id}`
      ));
    if (!trouve) return;
    order = await ecrireClient(wcOrder, order, trouve);
  }
  if (!emailUtile(order.email)) return;
  order = avecCode(order, wcOrder);
  const acces = await assurerAcces(order.email, order.code);
  if (acces.code) order = { ...order, code: acces.code };
  else order = { ...order, code: "" };
  await envoyerMails(order);
  await wc(`/orders/${wcOrder.id}`, {
    method: "PUT",
    body: JSON.stringify({
      meta_data: [
        { key: "_pf_order", value: JSON.stringify(order) },
        { key: "_pf_mail_brevo", value: "oui" },
        { key: "_pf_mail_brevo_date", value: new Date().toISOString() },
      ],
    }),
  });
}

export async function retrouver(email, code) {
  const mail = String(email || "").trim().toLowerCase();
  const saisi = String(code || "").trim();
  if (!mail || mail.startsWith("attente@") || !saisi) return null;
  if (/^PF-\d+/i.test(saisi)) return retrouverNumero(mail, saisi);
  if (saisi.replace(/[^a-z0-9]/gi, "").length < 8) return null;
  const qs = new URLSearchParams({
    search: mail,
    status: "any",
    per_page: "20",
    orderby: "date",
    order: "desc",
  });
  let lot = [];
  try {
    lot = await wc(`/orders?${qs}`);
  } catch {
    return null;
  }
  if (!Array.isArray(lot)) return null;
  for (const wcOrder of lot) {
    if (String(wcOrder.billing?.email || "").toLowerCase() !== mail || !wcOrder.order_key) continue;
    const order = commandeDepuis(wcOrder);
    const test = meta(wcOrder.meta_data, "_pf_test") === "1" || order?.test;
    if (!payee(wcOrder) && !test) continue;
    if (!codesEgaux(saisi, codeAcces(wcOrder.id, mail, wcOrder.order_key))) continue;
    if (!order) return null;
    return { order: avecCode(order, wcOrder) };
  }
  return null;
}

async function retrouverNumero(mail, code) {
  const parsed = idDeRef(code);
  if (!parsed) return null;
  let wcOrder;
  try {
    wcOrder = await wc(`/orders/${parsed.id}`);
  } catch {
    return null;
  }
  if (String(wcOrder.billing?.email || "").toLowerCase() !== mail) return null;
  if (!payee(wcOrder)) return { pending: true };
  const order = commandeDepuis(wcOrder);
  if (!order) return null;
  if (!parsed.ticket) return { order };
  const item = order.items.find((entry) => entry.tickets.some((ticket) => ticket.code.toUpperCase() === String(code).trim().toUpperCase()));
  const ticket = item?.tickets.find((entry) => entry.code.toUpperCase() === String(code).trim().toUpperCase());
  if (!item || !ticket) return null;
  return { order: { ...order, items: [{ ...item, tickets: [ticket] }] } };
}

function secretWebhook() {
  return env("BYTEQS_WEBHOOK_SECRET") || env("BYTEQS_SECRET_KEY");
}

function egal(a, b) {
  const gauche = Buffer.from(a);
  const droite = Buffer.from(b);
  return gauche.length === droite.length && timingSafeEqual(gauche, droite);
}

export function signatureValide(corps, signature, horodatage) {
  const secret = secretWebhook();
  if (!secret || !signature) return false;
  const recu = signature.trim().replace(/^"+|"+$/g, "");
  const extrait = recu.match(/(?:v1|sha256)=([A-Za-z0-9+/=]+)/i)?.[1] || recu;
  const candidats = [recu, extrait, extrait.toLowerCase()];
  const cles = [secret];
  if (secret.startsWith("whsec_")) {
    const decode = Buffer.from(secret.slice("whsec_".length), "base64");
    if (decode.length >= 8) cles.push(decode);
  }
  const quand = horodatage || recu.match(/(?:^|,)t=(\d+)/)?.[1] || "";
  const messages = [corps];
  if (quand) messages.push(`${quand}.${corps}`, `${quand}${corps}`);
  return cles.some((cle) =>
    messages.some((message) => {
      const mac = createHmac("sha256", cle).update(message, "utf8").digest();
      return candidats.some((candidat) => egal(candidat, mac.toString("hex")) || egal(candidat, mac.toString("base64")));
    })
  );
}

function emailDansPaiement(valeur, profondeur = 0) {
  if (profondeur > 5 || !valeur || typeof valeur !== "object") return "";
  if (Array.isArray(valeur)) {
    for (const item of valeur.slice(0, 8)) {
      const trouve = emailDansPaiement(item, profondeur + 1);
      if (trouve) return trouve;
    }
    return "";
  }
  const objet = valeur;
  for (const cle of ["email", "customer_email", "customerEmail", "receipt_email", "receiptEmail"]) {
    const candidat = emailUtile(objet[cle]);
    if (candidat) return candidat;
  }
  for (const cle of ["customer_details", "customer", "billing_details", "billing", "payer", "object", "data", "checkout", "payment"]) {
    if (!(cle in objet)) continue;
    const trouve = emailDansPaiement(objet[cle], profondeur + 1);
    if (trouve) return trouve;
  }
  return "";
}

function idDansUrl(checkoutUrl) {
  try {
    const url = new URL(checkoutUrl);
    const query = url.searchParams.get("session_id") || url.searchParams.get("checkout_id") || url.searchParams.get("id");
    if (query && query.length >= 6) return query;
    const segment = url.pathname.split("/").filter(Boolean).pop() || "";
    if (segment.length >= 8 && segment !== "hosted-checkout") return segment;
  } catch {
    return "";
  }
  return "";
}

async function lireEmail(url, cle) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${cle}`, Accept: "application/json" },
    signal: AbortSignal.timeout(2500),
  });
  if (!res.ok) return "";
  const texte = await res.text();
  try {
    return emailDansPaiement(JSON.parse(texte));
  } catch {
    const match = texte.match(/"(?:email|customer_email|customerEmail|receipt_email)"\s*:\s*"([^"\\]+@[^"\\]+)"/i);
    return match ? emailUtile(match[1]) : "";
  }
}

async function emailClientByteqs(...pistes) {
  const cle = env("BYTEQS_SECRET_KEY") || env("BYTEQS_PUBLISHABLE_KEY");
  const origin = (env("BYTEQS_CHECKOUT_ORIGIN") || "https://pay.primeleaguetickets.com").replace(/\/+$/, "");
  if (!cle) return "";
  const urls = new Set();
  for (const brut of pistes.map((piste) => String(piste || "").trim()).filter((piste) => piste && !piste.includes("{"))) {
    if (brut.startsWith("http")) urls.add(brut);
    const ref = /^PF-\d+$/.test(brut) ? brut : "";
    const id = ref ? "" : brut.startsWith("http") ? idDansUrl(brut) : brut;
    if (id.length >= 6 && !id.startsWith("http")) {
      urls.add(`${origin}/api/hosted-checkout/${encodeURIComponent(id)}`);
      urls.add(`https://api.byteqs.io/api/checkout-sessions/${encodeURIComponent(id)}`);
    }
    if (ref) urls.add(`${origin}/api/hosted-checkout?clientReferenceId=${encodeURIComponent(ref)}`);
  }
  if (!urls.size) return "";
  const trouves = await Promise.all([...urls].map((url) => lireEmail(url, cle).catch(() => "")));
  return trouves.find(Boolean) || "";
}

async function ecrireClient(wcOrder, order, email, name) {
  const mail = emailUtile(email);
  if (!mail) return order;
  const { prenom, nom } = nomParts(name || order.name);
  const suivant = { ...order, email: mail, name: `${prenom} ${nom}`.trim() };
  const maj = await wc(`/orders/${wcOrder.id}`, {
    method: "PUT",
    body: JSON.stringify({
      billing: {
        first_name: prenom,
        last_name: nom,
        email: mail,
        country: wcOrder.billing?.country || "FR",
      },
      meta_data: [{ key: "_pf_order", value: JSON.stringify(suivant) }],
    }),
  });
  return commandeDepuis(maj) || suivant;
}

export async function paiementRecu(corps) {
  const data = corps.data && typeof corps.data === "object" ? corps.data : corps;
  const objet = data.object && typeof data.object === "object" ? data.object : data;
  const type = String(corps.type || corps.event || data.type || "").toLowerCase();
  const status = String(objet.status || data.status || "").toLowerCase();
  const succes = /succeed|success|completed|paid/.test(type) || ["succeeded", "success", "paid", "completed", "complete"].includes(status);
  if (!succes) return { ignore: type || status || "evenement" };
  const metaBloc = objet.metadata || data.metadata || {};
  const reference = String(objet.clientReferenceId || objet.client_reference_id || metaBloc.reference || "");
  const m = reference.match(/^PF-(\d+)$/i) || String(metaBloc.wooId || "").match(/^(\d+)$/);
  if (!m) return { ignore: "reference" };
  const wcOrder = await wc(`/orders/${Number(m[1])}`);
  if (payee(wcOrder) && meta(wcOrder.meta_data, "_pf_mail_brevo") === "oui") return { ok: true, deja: true };
  const maj = await wc(`/orders/${wcOrder.id}`, {
    method: "PUT",
    body: JSON.stringify({
      status: "processing",
      set_paid: true,
      transaction_id: String(objet.id || reference).slice(0, 120),
      payment_method: "byteqs",
      payment_method_title: "Carte",
      meta_data: [
        { key: "_byteqs_status", value: "paid" },
        { key: "_byteqs_event", value: type || status },
      ],
    }),
  });
  let order = commandeDepuis(maj) || commandeDepuis(wcOrder);
  if (order && !emailUtile(order.email)) {
    const trouve =
      emailDansPaiement(corps) ||
      (await emailClientByteqs(
        meta(wcOrder.meta_data, "_byteqs_session_id"),
        meta(wcOrder.meta_data, "_byteqs_checkout_url"),
        `PF-${wcOrder.id}`
      ));
    if (trouve) order = await ecrireClient(wcOrder, order, trouve);
  }
  if (!order || !emailUtile(order.email)) return { ok: true, mail: "sans-email" };
  if (meta(wcOrder.meta_data, "_pf_mail_brevo") === "oui") return { ok: true, deja: true };
  order = avecCode(order, wcOrder);
  const acces = await assurerAcces(order.email, order.code);
  if (acces.code) order = { ...order, code: acces.code };
  else order = { ...order, code: "" };
  await envoyerMails(order);
  await wc(`/orders/${wcOrder.id}`, {
    method: "PUT",
    body: JSON.stringify({
      meta_data: [
        { key: "_pf_order", value: JSON.stringify(order) },
        { key: "_pf_mail_brevo", value: "oui" },
        { key: "_pf_mail_brevo_date", value: new Date().toISOString() },
      ],
    }),
  });
  return { ok: true, ref: order.ref };
}

function encodeTicket(data) {
  return Buffer.from(JSON.stringify(data), "utf8").toString("base64url");
}

function ticketUrl(order, item, ticket) {
  const payload = {
    c: ticket.code,
    t: item.title,
    d: item.date,
    k: item.competition || "",
    s: item.stadium || "",
    g: item.category || "",
    h: item.kickoff || "",
    r: ticket.row,
    n: ticket.seat,
    u: ticket.tribune || "",
    b: ticket.bloc || "",
    p: ticket.porte || "",
  };
  return `${SITE}/valid.html?d=${encodeTicket(payload)}`;
}

function euro(amount) {
  const cents = Math.round(Number(amount) * 100);
  const whole = Math.trunc(Math.abs(cents) / 100);
  const frac = String(Math.abs(cents) % 100).padStart(2, "0");
  return frac === "00" ? `${whole} €` : `${whole},${frac} €`;
}

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function nomAffiche(name) {
  const value = String(name || "").replace(/\s+/g, " ").trim();
  if (!value || /^client( client)?$/i.test(value)) return "";
  return value;
}

const LOGO = `${SITE}/logos/prime-football.png`;

function bonjour(order) {
  const nom = nomAffiche(order.name);
  return nom ? `Bonjour ${esc(nom)},` : "Bonjour,";
}

function dateLongue(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function coquille({ kicker, title, body }) {
  return `<!DOCTYPE html><html><head>
<meta charset="utf-8">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
</head><body style="margin:0;background:#eceff3;font-family:Arial,Helvetica,sans-serif;color:#1c2230;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#eceff3" style="background:#eceff3;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="max-width:640px;background:#ffffff;border-radius:18px;overflow:hidden;">
  <tr><td bgcolor="#37003c" style="background:#37003c;padding:14px 22px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td><img src="${LOGO}" alt="Prime Football" height="28" style="display:block;height:28px;width:auto;background:#ffffff;border-radius:8px;padding:4px 8px;"></td>
      <td align="right" style="color:#ffffff;font-size:12px;font-weight:800;letter-spacing:1.6px;">${esc(kicker)}</td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:22px 22px 26px;">
    <h1 style="margin:0 0 12px;font-size:28px;line-height:1.15;letter-spacing:-0.4px;">${esc(title)}</h1>
    ${body}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 0;background:#f4f7fb;border:1px solid #e5e7eb;border-radius:12px;"><tr><td style="padding:14px 16px;text-align:center;font-size:13.5px;line-height:1.55;color:#1c2230;">
      Un problème avec votre commande ou vos billets ? Écrivez-nous uniquement à <a href="mailto:support@primeleaguepass.com" style="color:#e10600;font-weight:700;text-decoration:none;">support@primeleaguepass.com</a>. C’est notre seule adresse officielle.<br>
      Conservez vos e-billets pour vous seul. Ne les transmettez à personne, et ignorez toute demande reçue sur une autre adresse.
    </td></tr></table>
    <p style="margin:14px 0 0;color:#8d95a3;font-size:12px;line-height:1.45;">Prime Football · primeleaguepass.com</p>
  </td></tr>
</table>
</td></tr></table></body></html>`;
}

function puce(label, value) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f4f7fb" style="background:#f4f7fb;border-radius:12px;margin:0 0 8px;"><tr><td style="padding:10px 12px;">
    <p style="margin:0;color:#6b7280;font-size:11px;font-weight:700;letter-spacing:0.4px;">${esc(label)}</p>
    <p style="margin:3px 0 0;font-size:16px;font-weight:800;">${esc(value)}</p>
  </td></tr></table>`;
}

function ligneMeta(label, value) {
  return `<tr>
    <td style="padding:8px 0 0;border-top:1px solid #eef0f3;color:#6b7280;font-size:14px;">${esc(label)}</td>
    <td align="right" style="padding:8px 0 0;border-top:1px solid #eef0f3;font-size:14px;font-weight:700;">${esc(value)}</td>
  </tr>`;
}

function equipes(item) {
  if (!item.homeLogo && !item.awayLogo) return "";
  const badge = (src) => src ? `<img src="${esc(src)}" alt="" width="28" height="28" style="display:inline-block;width:28px;height:28px;vertical-align:middle;">` : "";
  return `<p style="margin:8px 0 0;">${badge(item.homeLogo)}<span style="display:inline-block;padding:0 6px;color:#9ca3af;font-size:11px;font-weight:800;">VS</span>${badge(item.awayLogo)}</p>`;
}

function quand(item) {
  return item.kickoff ? `${item.date} · ${item.kickoff}` : item.date || "";
}

function blocMesBillets(order) {
  const url = `${SITE}/billets.html`;
  const code = order.code
    ? `<p style="margin:8px 0 0;color:#ffffff;font-size:15px;line-height:1.45;">Connecte-toi à ton espace client avec l'e-mail de la commande et ce code.</p>
        <p style="margin:10px 0 0;color:#ffffff;font-size:24px;font-weight:800;letter-spacing:3px;font-family:Menlo,Consolas,monospace;">${esc(order.code)}</p>`
    : `<p style="margin:8px 0 0;color:#ffffff;font-size:15px;line-height:1.45;">Tes billets sont dans ton espace client. Connecte-toi avec l'e-mail de la commande et ton code d'accès déjà reçu.</p>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#140018" style="background:#140018;border-radius:14px;margin:0 0 16px;">
      <tr><td style="padding:16px;">
        <p style="margin:0;color:rgba(255,255,255,.7);font-size:11px;font-weight:800;letter-spacing:1px;">ESPACE CLIENT</p>
        ${code}
        <p style="margin:14px 0 0;text-align:center;">
          <a href="${esc(url)}" style="display:inline-block;background:#e10600;color:#ffffff;font-size:14px;font-weight:800;text-decoration:none;padding:10px 16px;border-radius:8px;">Ouvrir mon espace client</a>
        </p>
      </td></tr>
    </table>`;
}

export function htmlFacture(order) {
  const lignes = order.items
    .map((item) => {
      const ou = [item.competition, item.stadium, item.category, quand(item)].filter(Boolean).join(" · ");
      return `<tr>
        <td style="padding:12px 0;border-top:1px solid #eef0f3;vertical-align:top;">
          <strong>${esc(item.title)}</strong>
          <span style="display:block;margin-top:2px;color:#6b7280;font-size:13px;">${esc(ou)}</span>
        </td>
        <td align="right" valign="top" style="padding:12px 0 12px 12px;border-top:1px solid #eef0f3;white-space:nowrap;">×${item.qty}</td>
        <td align="right" valign="top" style="padding:12px 0 12px 12px;border-top:1px solid #eef0f3;white-space:nowrap;">${euro(item.price * item.qty)}</td>
      </tr>`;
    })
    .join("");
  return coquille({
    kicker: "FACTURE",
    title: "Paiement confirmé",
    body: `<p style="margin:0 0 12px;line-height:1.5;">${bonjour(order)}</p>
      <p style="margin:0 0 16px;line-height:1.5;">Le paiement est confirmé. Tes billets sont dans ton espace client.${order.code ? " Le code d'accès est ci-dessous." : " Utilise ton code d'accès déjà reçu."}</p>
      ${blocMesBillets(order)}
      ${puce("N° DE FACTURE", order.ref)}
      ${puce("DATE", dateLongue(order.created) || "—")}
      ${puce("STATUT", "Payée")}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
        <tr>
          <th align="left" style="padding:0 0 8px;color:#6b7280;font-size:11px;letter-spacing:0.4px;">MATCH</th>
          <th align="right" style="padding:0 0 8px;color:#6b7280;font-size:11px;letter-spacing:0.4px;">QTÉ</th>
          <th align="right" style="padding:0 0 8px;color:#6b7280;font-size:11px;letter-spacing:0.4px;">MONTANT</th>
        </tr>
        ${lignes}
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:4px;border-top:2px solid #37003c;">
        <tr>
          <td style="padding-top:12px;font-size:18px;font-weight:800;">Total TTC</td>
          <td align="right" style="padding-top:12px;font-size:18px;font-weight:800;">${euro(order.total)}</td>
        </tr>
      </table>`,
  });
}

function ficheBillet(order, item, ticket) {
  const url = ticketUrl(order, item, ticket);
  const d = new URL(url).searchParams.get("d");
  const place = textePlace(ticket);
  const champs = [
    ["Date", quand(item)],
    item.stadium ? ["Stade", item.stadium] : null,
    ["Place", place],
    ["Catégorie", item.category || ""],
  ].filter((champ) => champ && champ[1]);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="margin-top:14px;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;">
    <tr><td style="padding:16px 16px 14px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td><img src="${LOGO}" alt="Prime Football" height="22" style="display:block;height:22px;width:auto;"></td>
        <td align="right" style="color:#e10600;font-size:12px;font-weight:800;letter-spacing:1px;">E-BILLET PDF</td>
      </tr></table>
      ${equipes(item)}
      <h2 style="margin:10px 0 0;font-size:20px;line-height:1.2;">${esc(item.title)}</h2>
      <p style="margin:4px 0 10px;color:#6b7280;font-size:13px;font-weight:700;letter-spacing:0.6px;">${esc(String(item.competition || "").toUpperCase())}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${champs.map(([label, value]) => ligneMeta(label, value)).join("")}</table>
      <img src="${SITE}/api/qr?d=${encodeURIComponent(d)}" width="132" height="132" alt="QR code" style="display:block;width:132px;height:132px;margin:14px auto 4px;">
      <p style="margin:0;text-align:center;color:#6b7280;font-family:Menlo,Consolas,monospace;font-size:13px;">${esc(ticket.code)}.pdf</p>
    </td></tr>
  </table>`;
}

export function htmlBillets(order) {
  const lead = order.test
    ? "Tes billets sont dans ton espace client. Billet de test : aucune place n'est vendue."
    : "Tes billets sont dans ton espace client. Présente chaque QR code à l'entrée du stade.";
  return coquille({
    kicker: "ESPACE CLIENT",
    title: "Tes billets sont dans ton espace client",
    body: `<p style="margin:0 0 12px;line-height:1.5;">${bonjour(order)}</p>
      <p style="margin:0 0 16px;line-height:1.5;">${lead}</p>
      ${blocMesBillets(order)}
      <p style="margin:0;color:#4b5563;font-size:15px;line-height:1.45;">Ouvre ton espace client pour voir tes QR.</p>`,
  });
}

async function envoyerMails(order) {
  const from = env("MAIL_FROM") || "Prime Football <support@primeleaguepass.com>";
  await envoyerBrevo({
    to: order.email,
    from,
    subject: `Confirmation ${order.ref} — tes billets sont dans ton espace client`,
    html: htmlFacture(order),
    key: `pf-${order.wooId}-facture`,
  });
}

function dossierBillets(order) {
  const fichiers = [];
  for (const item of order.items) {
    for (const ticket of item.tickets || []) {
      const url = ticketUrl(order, item, ticket);
      fichiers.push({ name: `${ticket.code}.pdf`, content: pdfBillet(order, item, ticket, url).toString("base64") });
    }
  }
  return fichiers;
}

function qrModules(text) {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const count = qr.getModuleCount();
  const rows = [];
  for (let y = 0; y < count; y += 1) {
    let row = "";
    for (let x = 0; x < count; x += 1) row += qr.isDark(y, x) ? "1" : "0";
    rows.push(row);
  }
  return rows;
}

function pdfText(value) {
  let out = "";
  for (const ch of String(value)) {
    const code = ch.codePointAt(0);
    if (ch === "\\" || ch === "(" || ch === ")") out += `\\${ch}`;
    else if (code >= 32 && code <= 126) out += ch;
    else if (code <= 255) out += `\\${code.toString(8).padStart(3, "0")}`;
    else if (WINANSI[code]) out += `\\${WINANSI[code].toString(8).padStart(3, "0")}`;
  }
  return out;
}

function qrPixels(text) {
  const matrix = qrModules(text);
  const scale = 6;
  const quiet = 4;
  const modules = matrix.length;
  const dim = (modules + quiet * 2) * scale;
  const pixels = Buffer.alloc(dim * dim, 255);
  for (let y = 0; y < modules; y += 1) {
    for (let x = 0; x < modules; x += 1) {
      if (matrix[y][x] !== "1") continue;
      for (let dy = 0; dy < scale; dy += 1) {
        for (let dx = 0; dx < scale; dx += 1) {
          const px = quiet * scale + x * scale + dx;
          const py = quiet * scale + y * scale + dy;
          pixels[py * dim + px] = 0;
        }
      }
    }
  }
  return { pixels, dim };
}

function crc32(buf) {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let i = 0; i < 8; i += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function pngChunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

export function pngQr(text) {
  const { pixels, dim } = qrPixels(text);
  const raw = Buffer.alloc((dim + 1) * dim);
  for (let y = 0; y < dim; y += 1) {
    pixels.copy(raw, y * (dim + 1) + 1, y * dim, (y + 1) * dim);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(dim, 0);
  ihdr.writeUInt32BE(dim, 4);
  ihdr[8] = 8;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

const WINANSI = {
  0x20ac: 0x80,
  0x2026: 0x85,
  0x2018: 0x91,
  0x2019: 0x92,
  0x201c: 0x93,
  0x201d: 0x94,
  0x2022: 0x95,
  0x2013: 0x96,
  0x2014: 0x97,
  0x0152: 0x8c,
  0x0153: 0x9c,
};

function pdfVisible(value) {
  return [...String(value || "")]
    .filter((ch) => {
      const code = ch.codePointAt(0);
      return (code >= 32 && code <= 255) || WINANSI[code];
    })
    .join("");
}

function pdfDraw(font, size, x, y, value) {
  return `BT /${font} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${pdfText(pdfVisible(value))}) Tj ET`;
}

function pdfLargeur(value, size) {
  return [...pdfVisible(value)].length * size * 0.52;
}

function pdfDroite(font, size, droite, y, value) {
  return pdfDraw(font, size, droite - pdfLargeur(value, size), y, value);
}

function pdfCoupe(value, size, max) {
  const words = pdfVisible(value).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && pdfLargeur(next, size) > max) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

const logoBytes = Buffer.from(logoPdf.z.replace(/\s+/g, ""), "base64");

export function pdfBillet(order, item, ticket, url) {
  const { pixels, dim } = qrPixels(url);
  const when = item.kickoff ? `${item.date} · ${item.kickoff}` : item.date || "";
  const champs = [
    ["Date", when],
    item.stadium ? ["Stade", item.stadium] : null,
    ["Place", textePlace(ticket)],
    ["Catégorie", item.category || ""],
  ].filter((champ) => champ && champ[1]);
  const W = 420;
  const pad = 28;
  const logoH = 22;
  const logoW = logoH * (logoPdf.w / logoPdf.h);
  const titleSize = 18;
  const titles = pdfCoupe(item.title, titleSize, W - pad * 2);
  const qrSize = 148;
  const rowH = 26;
  const topBar = 8;
  const testLine = Boolean(order?.test);
  const H =
    topBar +
    22 +
    logoH +
    20 +
    titles.length * 22 +
    20 +
    (testLine ? 18 : 0) +
    champs.length * rowH +
    22 +
    qrSize +
    18 +
    16 +
    28;
  const ops = [
    "1 1 1 rg",
    `0 0 ${W} ${H} re f`,
    "0.216 0 0.235 rg",
    `0 ${H - topBar} ${W} ${topBar} re f`,
  ];
  let y = H - topBar - 20 - logoH;
  ops.push(`q ${logoW.toFixed(2)} 0 0 ${logoH} ${pad} ${y.toFixed(2)} cm /Im2 Do Q`);
  ops.push("0.882 0.024 0 rg", pdfDroite("F2", 9, W - pad, y + 6, "E-BILLET PDF"));
  y -= 22;
  ops.push("0.07 0.09 0.12 rg");
  for (const line of titles) {
    ops.push(pdfDraw("F2", titleSize, pad, y, line));
    y -= 22;
  }
  y += 2;
  ops.push("0.42 0.45 0.5 rg", pdfDraw("F2", 9, pad, y, String(item.competition || "").toUpperCase()));
  y -= 22;
  if (testLine) {
    ops.push("0.882 0.024 0 rg", pdfDraw("F1", 9, pad, y, "Billet de test : aucune place n'est vendue."));
    y -= 20;
  }
  champs.forEach(([label, value], index) => {
    ops.push("0.93 0.94 0.95 RG", "0.8 w", `${pad} ${y.toFixed(2)} m ${W - pad} ${y.toFixed(2)} l S`);
    const base = y - 16;
    ops.push("0.42 0.45 0.5 rg", pdfDraw("F1", 10, pad, base, label));
    ops.push("0.07 0.09 0.12 rg");
    const valueSize = pdfLargeur(value, 11) > W - pad * 2 - 100 ? 9 : 11;
    ops.push(pdfDroite("F2", valueSize, W - pad, base, value));
    y = base - (index === champs.length - 1 ? 20 : 12);
  });
  const qrX = (W - qrSize) / 2;
  const qrY = y - qrSize;
  ops.push(`q ${qrSize} 0 0 ${qrSize} ${qrX.toFixed(2)} ${qrY.toFixed(2)} cm /Im1 Do Q`);
  const file = `${ticket.code}.pdf`;
  const hint = "Présente ce QR à l'entrée du stade.";
  ops.push(
    "0.42 0.45 0.5 rg",
    pdfDraw("F1", 10, (W - pdfLargeur(file, 10)) / 2, qrY - 18, file),
    pdfDraw("F1", 9, (W - pdfLargeur(hint, 9)) / 2, qrY - 34, hint)
  );
  const draw = ops.join("\n");
  const content = Buffer.from(draw, "latin1");
  const imageDict = Buffer.from(
    `<< /Type /XObject /Subtype /Image /Width ${dim} /Height ${dim} /ColorSpace /DeviceGray /BitsPerComponent 8 /Length ${pixels.length} >>\nstream\n`,
    "latin1"
  );
  const image = Buffer.concat([imageDict, pixels, Buffer.from("\nendstream", "latin1")]);
  const logoDict = Buffer.from(
    `<< /Type /XObject /Subtype /Image /Width ${logoPdf.w} /Height ${logoPdf.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${logoBytes.length} >>\nstream\n`,
    "latin1"
  );
  const logo = Buffer.concat([logoDict, logoBytes, Buffer.from("\nendstream", "latin1")]);
  const objects = [
    Buffer.from("<< /Type /Catalog /Pages 2 0 R >>", "latin1"),
    Buffer.from("<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "latin1"),
    Buffer.from(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 4 0 R /F2 7 0 R >> /XObject << /Im1 5 0 R /Im2 8 0 R >> >> /Contents 6 0 R >>`,
      "latin1"
    ),
    Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>", "latin1"),
    image,
    Buffer.concat([Buffer.from(`<< /Length ${content.length} >>\nstream\n`, "latin1"), content, Buffer.from("\nendstream", "latin1")]),
    Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>", "latin1"),
    logo,
  ];
  const parts = [Buffer.from("%PDF-1.4\n", "latin1")];
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(parts.reduce((sum, part) => sum + part.length, 0));
    parts.push(Buffer.from(`${index + 1} 0 obj\n`, "latin1"), body, Buffer.from("\nendobj\n", "latin1"));
  });
  const startxref = parts.reduce((sum, part) => sum + part.length, 0);
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i += 1) xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  parts.push(
    Buffer.from(
      `${xref}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF`,
      "latin1"
    )
  );
  return Buffer.concat(parts);
}

async function envoyerBrevo({ to, from, subject, html, key, attachment }) {
  const apiKey = env("BREVO_API_KEY");
  if (!apiKey) throw new ShopError("Brevo n'est pas configuré.", 500);
  const match = String(from).match(/^(.*)<([^>]+)>$/);
  const sender = match
    ? { name: match[1].trim(), email: match[2].trim() }
    : { email: String(from).trim() };
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": apiKey, "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender,
      to: [{ email: to }],
      subject,
      htmlContent: html,
      headers: { "Idempotency-Key": key },
      ...(attachment?.length ? { attachment } : {}),
    }),
  });
  if (res.ok || res.status === 201 || res.status === 202) return;
  const secours = env("MAIL_FROM");
  if (secours && from !== secours) {
    return envoyerBrevo({ to, from: secours, subject, html, key, attachment });
  }
  const result = await res.json().catch(() => ({}));
  throw new ShopError(`Brevo : ${result.message || res.status}`, 502);
}
