import { createHmac, timingSafeEqual } from "node:crypto";
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
  const mail = String(email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) throw new ShopError("Indique un e-mail valide.");
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

export async function creerPaiementTest({ token, name, email }) {
  if (String(token || "") !== TEST_TOKEN) throw new ShopError("Page introuvable.", 404);
  const mail = String(email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) throw new ShopError("Indique un e-mail valide.");
  const { prenom, nom } = nomParts(name);
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
    customer: { email: input.email },
  };
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

export async function livrerTest(wooId) {
  const wcOrder = await wc(`/orders/${wooId}`);
  const order = commandeDepuis(wcOrder);
  if (!order?.test || !order.email) return;
  if (meta(wcOrder.meta_data, "_pf_mail_brevo") === "oui") return;
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
  const order = commandeDepuis(maj) || commandeDepuis(wcOrder);
  if (!order?.email) return { ok: true, mail: "sans-email" };
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

function htmlMail({ kicker, title, intro, rows, footer }) {
  return `<!DOCTYPE html><html><body style="margin:0;background:#f4f1f6;font-family:Arial,sans-serif;color:#1a1020;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1f6;padding:24px 12px;"><tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;">
    <tr><td style="background:#37003c;padding:18px 22px;color:#fff;font-weight:700;">Prime Football · ${esc(kicker)}</td></tr>
    <tr><td style="padding:22px;">
      <h1 style="margin:0 0 8px;font-size:22px;">${esc(title)}</h1>
      <p style="margin:0 0 16px;line-height:1.45;">${intro}</p>
      ${rows}
      <p style="margin:18px 0 0;color:#5c5360;font-size:13px;">${footer}<br>mail@primeworldtickets.com</p>
    </td></tr>
  </table></td></tr></table></body></html>`;
}

async function envoyerMails(order) {
  if (order.test) {
    const item = order.items[0];
    const ticket = item.tickets[0];
    const url = ticketUrl(order, item, ticket);
    const pdf = pdfBillet(order, item, ticket, url);
    await envoyerBrevo({
      to: order.email,
      from: "Prime Football <facturation@primeworldtickets.com>",
      subject: `Facture ${order.ref}`,
      html: htmlMail({
        kicker: "Facture",
        title: "Ta facture",
        intro: `Bonjour ${esc(order.name)}, le paiement test est confirmé. Total TTC <strong>1 €</strong>. Tes e-billets partent dans un second e-mail.`,
        rows: `<p style="margin:0;"><strong>${esc(item.title)}</strong><br>TEST · 1 €</p>`,
        footer: "Prime Football · primeworldtickets.com",
      }),
      key: `pf-${order.wooId}-facture`,
    });
    await envoyerBrevo({
      to: order.email,
      from: env("MAIL_FROM") || "Prime Football <billets@primeworldtickets.com>",
      subject: `E-billets ${order.ref}`,
      html: htmlMail({
        kicker: "E-billets",
        title: "Tes e-billets",
        intro: `Bonjour ${esc(order.name)}, voici ton code <strong>${esc(order.ref)}</strong>. Le QR est dans le PDF joint. Tu peux aussi l'ouvrir ici : <a href="${esc(url)}">${esc(ticket.code)}</a>.`,
        rows: `<p style="margin:0 0 14px;"><strong>${esc(ticket.code)}</strong><br>${esc(item.title)} · TEST<br>Rang ${ticket.row} · Place ${ticket.seat}</p>`,
        footer: "Billet de test. Aucune place n'est vendue.",
      }),
      attachment: [{ name: `${ticket.code}.pdf`, content: pdf.toString("base64") }],
      key: `pf-${order.wooId}-billets`,
    });
    return;
  }
  const lignes = order.items
    .map((item) => {
      const when = item.kickoff ? `${item.date} · ${item.kickoff}` : item.date;
      return `<p style="margin:0 0 10px;"><strong>${esc(item.title)}</strong><br>${esc(item.competition || "")} · ${esc(item.stadium || "")}<br>${esc(when)} · ${esc(item.category)} · ×${item.qty}<br><strong>${item.price * item.qty} €</strong></p>`;
    })
    .join("");
  await envoyerBrevo({
    to: order.email,
    from: "Prime Football <facturation@primeworldtickets.com>",
    subject: `Facture ${order.ref}`,
    html: htmlMail({
      kicker: "Facture",
      title: "Ta facture",
      intro: `Bonjour ${esc(order.name)}, le paiement est confirmé. Total TTC <strong>${order.total} €</strong>.`,
      rows: lignes,
      footer: "Prime Football · primeworldtickets.com",
    }),
    key: `pf-${order.wooId}-facture`,
  });
  const billets = order.items
    .map((item) =>
      item.tickets
        .map((ticket) => {
          const url = ticketUrl(order, item, ticket);
          return `<p style="margin:0 0 14px;"><strong>${esc(ticket.code)}</strong><br>${esc(item.title)} · ${esc(item.category)}<br>Rang ${ticket.row} · Place ${ticket.seat}<br><a href="${esc(url)}">Ouvrir le e-billet</a></p>`;
        })
        .join("")
    )
    .join("");
  await envoyerBrevo({
    to: order.email,
    from: env("MAIL_FROM") || "Prime Football <billets@primeworldtickets.com>",
    subject: `E-billets ${order.ref}`,
    html: htmlMail({
      kicker: "E-billets",
      title: "Tes e-billets",
      intro: `Bonjour ${esc(order.name)}, voici ton code <strong>${esc(order.ref)}</strong>. Avec l'e-mail de la commande, il permet de retrouver tes billets.`,
      rows: billets,
      footer: "Présente chaque billet à l'entrée du stade.",
    }),
    key: `pf-${order.wooId}-billets`,
  });
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

export function pdfBillet(order, item, ticket, url) {
  const matrix = qrModules(url);
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
  const lines = [
    "BILLET TEST",
    "Prime Football",
    ticket.code,
    item.title,
    "Rang 1 · Place 1",
    "TEST · 1 EUR",
    "Scan de controle. Aucune place vendue.",
  ];
  const imgSize = 240;
  const draw = [
    `q ${imgSize} 0 0 ${imgSize} 90 340 cm /Im1 Do Q`,
    ...lines.map((line, index) => `BT /F1 ${index === 0 ? 18 : 12} Tf 48 ${300 - index * 22} Td (${pdfText(line)}) Tj ET`),
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
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 420 640] /Resources << /Font << /F1 4 0 R >> /XObject << /Im1 5 0 R >> >> /Contents 6 0 R >>",
      "latin1"
    ),
    Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", "latin1"),
    image,
    Buffer.concat([Buffer.from(`<< /Length ${content.length} >>\nstream\n`, "latin1"), content, Buffer.from("\nendstream", "latin1")]),
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
