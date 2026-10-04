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

function htmlMail({ kicker, title, intro, rows, footer }) {
  return `<!DOCTYPE html><html><head>
<meta charset="utf-8">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
</head><body style="margin:0;background:#f4f1f6;color:#1a1020;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f4f1f6" style="background:#f4f1f6;padding:28px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="max-width:560px;background:#ffffff;border-radius:22px;overflow:hidden;">
  <tr><td bgcolor="#37003c" style="background:#37003c;padding:22px 24px 18px;">
    <p style="margin:0;color:#00ff85;font-size:11px;font-weight:700;letter-spacing:2px;">PRIME FOOTBALL</p>
    <p style="margin:8px 0 0;color:#ffffff;font-size:26px;font-weight:800;line-height:1.15;">${esc(title)}</p>
    <p style="margin:6px 0 0;color:rgba(255,255,255,.72);font-size:13px;">${esc(kicker)}</p>
  </td></tr>
  <tr><td style="height:4px;background:#00ff85;font-size:0;line-height:0;">&nbsp;</td></tr>
  <tr><td style="padding:22px 24px 8px;font-size:15px;line-height:1.5;color:#1a1020;">${intro}</td></tr>
  <tr><td style="padding:8px 24px 22px;">${rows}
    <p style="margin:18px 0 0;color:#6b7280;font-size:13px;line-height:1.45;">${footer}<br>mail@primeworldtickets.com</p>
  </td></tr>
</table>
</td></tr></table></body></html>`;
}

function bonjour(order) {
  const nom = nomAffiche(order.name);
  return nom ? `Bonjour ${esc(nom)},` : "Bonjour,";
}

function lignesFacture(order) {
  const lignes = order.items
    .map((item) => {
      const when = item.kickoff ? `${item.date} · ${item.kickoff}` : item.date;
      const ou = [item.competition, item.stadium, item.category, when].filter(Boolean).join(" · ");
      return `<tr>
        <td style="padding:12px 0;border-bottom:1px solid #efe8f2;">
          <strong style="color:#1a1020;">${esc(item.title)}</strong><br>
          <span style="color:#6b7280;font-size:13px;">${esc(ou)} · ×${item.qty}</span>
        </td>
        <td align="right" valign="top" style="padding:12px 0;border-bottom:1px solid #efe8f2;font-weight:800;color:#37003c;">${item.price * item.qty} €</td>
      </tr>`;
    })
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${lignes}</table>
    <p style="margin:14px 0 0;text-align:right;font-size:18px;"><span style="color:#6b7280;font-size:13px;">Total TTC</span><br><strong style="color:#37003c;">${order.total} €</strong></p>`;
}

async function envoyerMails(order) {
  const hello = bonjour(order);
  if (order.test) {
    await envoyerBrevo({
      to: order.email,
      from: "Prime Football <facturation@primeworldtickets.com>",
      subject: `Facture ${order.ref}`,
      html: htmlMail({
        kicker: order.ref,
        title: "Ta facture",
        intro: `${hello} le paiement test est confirmé. Tes e-billets partent dans un second e-mail.`,
        rows: lignesFacture(order),
        footer: "Prime Football · primeworldtickets.com",
      }),
      key: `pf-${order.wooId}-facture`,
    });
    const billets = dossierBillets(order);
    await envoyerBrevo({
      to: order.email,
      from: env("MAIL_FROM") || "Prime Football <billets@primeworldtickets.com>",
      subject: `E-billets ${order.ref}`,
      html: htmlMail({
        kicker: order.ref,
        title: "Tes e-billets",
        intro: `${hello} le paiement test est confirmé.`,
        rows: billets.rows,
        footer: "Billet de test. Aucune place n'est vendue.",
      }),
      attachment: billets.fichiers,
      key: `pf-${order.wooId}-billets`,
    });
    return;
  }
  await envoyerBrevo({
    to: order.email,
    from: "Prime Football <facturation@primeworldtickets.com>",
    subject: `Facture ${order.ref}`,
    html: htmlMail({
      kicker: order.ref,
      title: "Ta facture",
      intro: `${hello} le paiement est confirmé.`,
      rows: lignesFacture(order),
      footer: "Prime Football · primeworldtickets.com",
    }),
    key: `pf-${order.wooId}-facture`,
  });
  const billets = dossierBillets(order);
  await envoyerBrevo({
    to: order.email,
    from: env("MAIL_FROM") || "Prime Football <billets@primeworldtickets.com>",
    subject: `E-billets ${order.ref}`,
    html: htmlMail({
      kicker: order.ref,
      title: "Tes e-billets",
      intro: `${hello}`,
      rows: billets.rows,
      footer: "Présente chaque QR code à l'entrée du stade.",
    }),
    attachment: billets.fichiers,
    key: `pf-${order.wooId}-billets`,
  });
}

function dossierBillets(order) {
  const fichiers = [];
  const cartes = [];
  for (const item of order.items) {
    for (const ticket of item.tickets || []) {
      const url = ticketUrl(order, item, ticket);
      const d = new URL(url).searchParams.get("d");
      fichiers.push({ name: `${ticket.code}.pdf`, content: pdfBillet(order, item, ticket, url).toString("base64") });
      const ou = [item.stadium, item.date, item.kickoff].filter(Boolean).join(" · ");
      cartes.push(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="margin-top:16px;background:#ffffff;border:1px solid #eadff0;border-radius:16px;overflow:hidden;">
        <tr><td bgcolor="#37003c" style="background:#37003c;padding:14px 16px;">
          <p style="margin:0;color:#00ff85;font-size:11px;font-weight:700;letter-spacing:1.4px;">${esc(item.competition === "TEST" ? "BILLET TEST" : item.competition || "E-BILLET")}</p>
          <p style="margin:4px 0 0;color:#ffffff;font-size:18px;font-weight:800;">${esc(item.title)}</p>
          <p style="margin:4px 0 0;color:rgba(255,255,255,.75);font-size:13px;">${esc(ou)}</p>
        </td></tr>
        <tr><td align="center" bgcolor="#ffffff" style="padding:18px 16px 8px;background:#ffffff;">
          <img src="${SITE}/api/qr?d=${encodeURIComponent(d)}" width="220" height="220" alt="QR code" style="display:block;border:0;">
        </td></tr>
        <tr><td bgcolor="#ffffff" style="padding:0 16px 16px;background:#ffffff;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td width="33%" style="padding-top:12px;border-top:1px dashed #d8cfe0;">
              <p style="margin:0;color:#9ca3af;font-size:11px;font-weight:700;letter-spacing:1px;">RANG</p>
              <p style="margin:3px 0 0;color:#1a1020;font-size:18px;font-weight:800;">${ticket.row}</p>
            </td>
            <td width="33%" style="padding-top:12px;border-top:1px dashed #d8cfe0;">
              <p style="margin:0;color:#9ca3af;font-size:11px;font-weight:700;letter-spacing:1px;">PLACE</p>
              <p style="margin:3px 0 0;color:#1a1020;font-size:18px;font-weight:800;">${ticket.seat}</p>
            </td>
            <td width="34%" style="padding-top:12px;border-top:1px dashed #d8cfe0;">
              <p style="margin:0;color:#9ca3af;font-size:11px;font-weight:700;letter-spacing:1px;">PDF</p>
              <p style="margin:3px 0 0;color:#37003c;font-size:13px;font-weight:800;">${esc(ticket.code)}.pdf</p>
            </td>
          </tr></table>
          <p style="margin:10px 0 0;color:#374151;font-family:Menlo,Consolas,monospace;font-size:13px;">${esc(ticket.code)}</p>
        </td></tr>
      </table>`);
    }
  }
  return {
    fichiers,
    rows: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f7f2f8" style="background:#f7f2f8;border-radius:14px;">
      <tr><td style="padding:16px 18px;">
        <p style="margin:0;color:#6b7280;font-size:11px;font-weight:700;letter-spacing:1.4px;">CODE POUR RETROUVER TES BILLETS</p>
        <p style="margin:4px 0 0;color:#37003c;font-size:28px;font-weight:800;letter-spacing:1px;">${esc(order.ref)}</p>
        <p style="margin:6px 0 0;color:#4b5563;font-size:13px;">Entre ce code avec l'e-mail de la commande.</p>
      </td></tr>
    </table>
    ${cartes.join("")}`,
  };
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
    .replace(/[·•]/g, "-")
    .replace(/[^\x20-\x7E]/g, "");
}

function pdfDraw(font, size, x, y, value) {
  return `BT /${font} ${size} Tf 1 0 0 1 ${x} ${y} Tm (${pdfText(pdfPlain(value).slice(0, 64))}) Tj ET`;
}

export function pdfBillet(order, item, ticket, url) {
  const { pixels, dim } = qrPixels(url);
  const test = item.competition === "TEST";
  const kind = test ? "BILLET TEST" : "E-BILLET";
  const where = [item.competition, item.stadium].filter(Boolean).join(" · ");
  const when = [item.date, item.kickoff].filter(Boolean).join(" · ");
  const note = test ? "Scan de controle. Aucune place vendue." : "Presente ce QR a l'entree du stade.";
  const qrSize = 210;
  const qrX = (595 - qrSize) / 2;
  const qrY = 318;
  const draw = [
    "0.957 0.945 0.965 rg",
    "0 0 595 842 re f",
    "1 1 1 rg",
    "36 150 523 618 re f",
    "0.216 0 0.235 rg",
    "36 668 523 100 re f",
    "0 1 0.522 rg",
    "36 664 523 4 re f",
    "1 1 1 rg",
    pdfDraw("F2", 11, 58, 738, "PRIME FOOTBALL"),
    pdfDraw("F2", 22, 58, 706, kind),
    pdfDraw("F1", 12, 58, 684, order.ref),
    "0.102 0.063 0.125 rg",
    pdfDraw("F2", 18, 58, 620, item.title),
    "0.35 0.32 0.4 rg",
    pdfDraw("F1", 11, 58, 598, where),
    pdfDraw("F1", 11, 58, 582, when || item.category || ""),
    "0.965 0.953 0.973 rg",
    `${qrX - 18} ${qrY - 18} ${qrSize + 36} ${qrSize + 36} re f`,
    `q ${qrSize} 0 0 ${qrSize} ${qrX} ${qrY} cm /Im1 Do Q`,
    "0.42 0.38 0.46 rg",
    pdfDraw("F1", 9, 58, 272, "RANG"),
    pdfDraw("F1", 9, 168, 272, "PLACE"),
    pdfDraw("F1", 9, 278, 272, "CATEGORIE"),
    "0.102 0.063 0.125 rg",
    pdfDraw("F2", 16, 58, 252, String(ticket.row)),
    pdfDraw("F2", 16, 168, 252, String(ticket.seat)),
    pdfDraw("F2", 16, 278, 252, item.category || ""),
    pdfDraw("F1", 11, 58, 214, ticket.code),
    "0.42 0.38 0.46 rg",
    pdfDraw("F1", 10, 58, 188, note),
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
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 7 0 R >> /XObject << /Im1 5 0 R >> >> /Contents 6 0 R >>",
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
