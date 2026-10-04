import { createHmac, timingSafeEqual } from "node:crypto";
import { deflateSync } from "node:zlib";
import qrcode from "../../qrcode.js";

const SITE = "https://primeworldtickets.com";

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

function idDeRef(code) {
  const m = String(code || "").trim().toUpperCase().match(/^PF-(\d+)(?:-(\d+))?$/);
  if (!m) return null;
  return { id: Number(m[1]), ticket: m[2] ? Number(m[2]) : null };
}

function places(qty) {
  const row = 4 + Math.floor(Math.random() * 22);
  const start = 1 + Math.floor(Math.random() * Math.max(1, 28 - qty));
  return Array.from({ length: qty }, (_, i) => ({ row, seat: start + i }));
}

const ATTENTE = "attente@primeworldtickets.com";

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
  const items = details.map((item) => ({
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
    tickets: places(item.qty).map((place) => ({
      code: `${ref}-${n++}`,
      row: place.row,
      seat: place.seat,
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

const TEST_TOKEN = "7kQ9mN2pLx4vW8dR3hFs6bYt";

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
      fee_lines: [{ name: "Paiement test", total: "1.00", tax_status: "none" }],
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
    price: 1,
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
    total: 1,
    items: [item],
  };
  const session = await sessionByteqs({
    reference: `PF-${cree.id}`,
    email: mail,
    wooId: cree.id,
    orderKey: cree.order_key,
    lignes: [{ name: "Paiement test", amountInCents: 100, quantity: 1 }],
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
  const origin = (env("BYTEQS_CHECKOUT_ORIGIN") || "https://pay.primeworldtickets.com").replace(/\/+$/, "");
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
  const order = commandeDepuis(wcOrder);
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
  await envoyerMails(order);
  await wc(`/orders/${wcOrder.id}`, {
    method: "PUT",
    body: JSON.stringify({
      meta_data: [
        { key: "_pf_mail_brevo", value: "oui" },
        { key: "_pf_mail_brevo_date", value: new Date().toISOString() },
      ],
    }),
  });
}

export async function retrouver(email, code) {
  const mail = String(email || "").trim().toLowerCase();
  const parsed = idDeRef(code);
  if (!mail || !parsed) return null;
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
  const origin = (env("BYTEQS_CHECKOUT_ORIGIN") || "https://pay.primeworldtickets.com").replace(/\/+$/, "");
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
  await envoyerMails(order);
  await wc(`/orders/${wcOrder.id}`, {
    method: "PUT",
    body: JSON.stringify({
      meta_data: [
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
  };
  return `${SITE}/valid.html?d=${encodeTicket(payload)}`;
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
    <p style="margin:22px 0 0;color:#8d95a3;font-size:12px;line-height:1.45;">Prime Football · primeworldtickets.com<br>mail@primeworldtickets.com</p>
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
        <td align="right" valign="top" style="padding:12px 0 12px 12px;border-top:1px solid #eef0f3;white-space:nowrap;">${item.price * item.qty} €</td>
      </tr>`;
    })
    .join("");
  return coquille({
    kicker: "FACTURE",
    title: "Ta facture",
    body: `<p style="margin:0 0 12px;line-height:1.5;">${bonjour(order)}</p>
      <p style="margin:0 0 16px;line-height:1.5;">Le paiement est confirmé. Le récapitulatif est ci-dessous. Tes e-billets partent dans un second e-mail.</p>
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
          <td align="right" style="padding-top:12px;font-size:18px;font-weight:800;">${order.total} €</td>
        </tr>
      </table>`,
  });
}

function ficheBillet(order, item, ticket) {
  const url = ticketUrl(order, item, ticket);
  const d = new URL(url).searchParams.get("d");
  const place = `Rang ${ticket.row} · Place ${ticket.seat}`;
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
  const count = order.items.reduce((sum, item) => sum + (item.tickets || []).length, 0);
  const joints = count > 1 ? `${count} PDF joints` : "1 PDF joint";
  const lead = order.test
    ? "Voici ton code et ton e-billet en PDF. Billet de test : aucune place n'est vendue."
    : "Voici ton code et tes e-billets en PDF. Présente chaque QR code à l'entrée du stade.";
  const fiches = [];
  for (const item of order.items) {
    for (const ticket of item.tickets || []) fiches.push(ficheBillet(order, item, ticket));
  }
  return coquille({
    kicker: "E-BILLETS",
    title: "Tes e-billets",
    body: `<p style="margin:0 0 12px;line-height:1.5;">${bonjour(order)}</p>
      <p style="margin:0 0 16px;line-height:1.5;">${lead}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#140018" style="background:#140018;border-radius:14px;">
        <tr><td style="padding:14px 16px;">
          <p style="margin:0;color:rgba(255,255,255,.7);font-size:11px;font-weight:800;letter-spacing:1px;">CODE ENVOYÉ PAR E-MAIL</p>
          <p style="margin:4px 0 0;color:#ffffff;font-size:24px;font-weight:800;letter-spacing:1px;font-family:Menlo,Consolas,monospace;">${esc(order.ref)}</p>
        </td></tr>
      </table>
      <p style="margin:10px 0 0;color:#4b5563;font-size:15px;line-height:1.45;">Avec l'e-mail de cette commande, ce code est le seul moyen de retrouver tes billets.</p>
      <p style="margin:12px 0 0;color:#37003c;font-size:16px;font-weight:800;">${joints}</p>
      ${fiches.join("")}`,
  });
}

async function envoyerMails(order) {
  const billets = dossierBillets(order);
  await envoyerBrevo({
    to: order.email,
    from: "Prime Football <facturation@primeworldtickets.com>",
    subject: `Facture ${order.ref}`,
    html: htmlFacture(order),
    key: `pf-${order.wooId}-facture`,
  });
  await envoyerBrevo({
    to: order.email,
    from: env("MAIL_FROM") || "Prime Football <billets@primeworldtickets.com>",
    subject: `E-billets ${order.ref}`,
    html: htmlBillets(order),
    attachment: billets,
    key: `pf-${order.wooId}-billets`,
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
    else out += "?";
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

function pdfPlain(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[—–]/g, " - ")
    .replace(/[·•]/g, " - ")
    .replace(/[^\x20-\x7E]/g, "");
}

function pdfDraw(font, size, x, y, value) {
  return `BT /${font} ${size} Tf 1 0 0 1 ${x} ${y} Tm (${pdfText(pdfPlain(value).slice(0, 72))}) Tj ET`;
}

function pdfLargeur(value, size) {
  return pdfPlain(value).slice(0, 72).length * size * 0.5;
}

function pdfDroite(font, size, droite, y, value) {
  return pdfDraw(font, size, droite - pdfLargeur(value, size), y, value);
}

export function pdfBillet(order, item, ticket, url) {
  const { pixels, dim } = qrPixels(url);
  const when = item.kickoff ? `${item.date} - ${item.kickoff}` : item.date || "";
  const champs = [
    ["Date", when],
    item.stadium ? ["Stade", item.stadium] : null,
    ["Place", `Rang ${ticket.row} - Place ${ticket.seat}`],
    ["Categorie", item.category || ""],
  ].filter((champ) => champ && champ[1]);
  const gauche = 36;
  const droite = 384;
  const qrSize = 132;
  const qrX = (420 - qrSize) / 2;
  let y = 428;
  const lignes = [];
  for (const [label, value] of champs) {
    lignes.push("0.93 0.94 0.95 RG", "0.8 w", `${gauche} ${y + 16} m ${droite} ${y + 16} l S`);
    lignes.push("0.42 0.45 0.5 rg", pdfDraw("F1", 11, gauche, y, label));
    lignes.push("0.11 0.13 0.18 rg", pdfDroite("F2", 11, droite, y, value));
    y -= 28;
  }
  const qrY = y - qrSize - 8;
  const draw = [
    "1 1 1 rg",
    "0 0 420 560 re f",
    "0.216 0 0.235 rg",
    pdfDraw("F2", 11, gauche, 516, "PRIME FOOTBALL"),
    "0.882 0.024 0 rg",
    pdfDroite("F2", 10, droite, 516, "E-BILLET PDF"),
    "0.11 0.13 0.18 rg",
    pdfDraw("F2", 16, gauche, 484, item.title),
    "0.42 0.45 0.5 rg",
    pdfDraw("F2", 9, gauche, 466, String(item.competition || "").toUpperCase()),
    ...lignes,
    `q ${qrSize} 0 0 ${qrSize} ${qrX} ${qrY} cm /Im1 Do Q`,
    "0.42 0.45 0.5 rg",
    pdfDraw("F1", 10, (420 - pdfLargeur(`${ticket.code}.pdf`, 10)) / 2, qrY - 18, `${ticket.code}.pdf`),
  ].join("\n");
  const content = Buffer.from(draw, "latin1");
  const imageDict = Buffer.from(
    `<< /Type /XObject /Subtype /Image /Width ${dim} /Height ${dim} /ColorSpace /DeviceGray /BitsPerComponent 8 /Length ${pixels.length} >>\nstream\n`,
    "latin1"
  );
  const image = Buffer.concat([imageDict, pixels, Buffer.from("\nendstream", "latin1")]);
  const objects = [
    Buffer.from("<< /Type /Catalog /Pages 2 0 R >>", "latin1"),
    Buffer.from("<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "latin1"),
    Buffer.from(
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 420 560] /Resources << /Font << /F1 4 0 R /F2 7 0 R >> /XObject << /Im1 5 0 R >> >> /Contents 6 0 R >>",
      "latin1"
    ),
    Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", "latin1"),
    image,
    Buffer.concat([Buffer.from(`<< /Length ${content.length} >>\nstream\n`, "latin1"), content, Buffer.from("\nendstream", "latin1")]),
    Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>", "latin1"),
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
