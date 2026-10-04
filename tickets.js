const SITE_ORIGIN = "https://primeworldtickets.com";
const ORDERS_KEY = "prime-football-orders";

function loadOrders() {
  try {
    return JSON.parse(localStorage.getItem(ORDERS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveOrders(orders) {
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
}

function orderRef() {
  const n = Math.floor(100000 + Math.random() * 900000);
  return `PF-${n}`;
}

function seatsFor(qty) {
  const row = 4 + Math.floor(Math.random() * 22);
  const start = 1 + Math.floor(Math.random() * Math.max(1, 28 - qty));
  return Array.from({ length: qty }, (_, i) => ({ row, seat: start + i }));
}

function createOrder({ name, email, cart }) {
  const ref = orderRef();
  let n = 1;
  const items = cart.map((item) => {
    const qty = Math.max(1, Number(item.qty) || 1);
    const seats = seatsFor(qty);
    return {
      title: item.title,
      home: item.home || "",
      away: item.away || "",
      homeLogo: item.homeLogo || "",
      awayLogo: item.awayLogo || "",
      date: item.date,
      competition: item.competition,
      stadium: item.stadium || "",
      kickoff: item.kickoff || "",
      category: item.category,
      price: item.price,
      qty,
      together: qty > 1,
      tickets: seats.map((seat) => ({
        code: `${ref}-${n++}`,
        row: seat.row,
        seat: seat.seat,
      })),
    };
  });
  const order = {
    ref,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    created: new Date().toISOString(),
    total: items.reduce((sum, item) => sum + item.price * item.qty, 0),
    items,
  };
  const orders = loadOrders();
  orders.unshift(order);
  saveOrders(orders);
  return order;
}

function findOrder(ref) {
  const key = String(ref || "").trim().toUpperCase();
  if (!key) return null;
  return loadOrders().find((order) => order.ref.toUpperCase() === key) || null;
}

function findByMailAndCode(email, code) {
  const mail = String(email || "").trim().toLowerCase();
  const key = String(code || "").trim().toUpperCase();
  if (!mail || !key) return null;
  const order = findOrder(key);
  if (order) return order.email === mail ? { order } : null;
  const found = findTicket(key);
  if (!found || found.order.email !== mail) return null;
  return {
    order: {
      ...found.order,
      items: [{ ...found.item, tickets: [found.ticket] }],
    },
  };
}

function findTicket(code) {
  const key = String(code || "").trim().toUpperCase();
  if (!key) return null;
  for (const order of loadOrders()) {
    for (const item of order.items) {
      const ticket = item.tickets.find((entry) => entry.code.toUpperCase() === key);
      if (ticket) return { order, item, ticket };
    }
  }
  return null;
}

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function clip(value, max) {
  const text = String(value ?? "").trim();
  return text.length > max ? text.slice(0, max) : text;
}

function encodeTicket(data) {
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  let bin = "";
  bytes.forEach((byte) => {
    bin += String.fromCharCode(byte);
  });
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeTicket(raw) {
  try {
    let b64 = String(raw || "").replace(/-/g, "+").replace(/_/g, "/");
    if (!b64 || b64.length > 1200) return null;
    while (b64.length % 4) b64 += "=";
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (char) => char.charCodeAt(0));
    const data = JSON.parse(new TextDecoder().decode(bytes));
    const ticket = {
      c: clip(data.c, 24),
      t: clip(data.t, 80),
      d: clip(data.d, 40),
      k: clip(data.k, 48),
      s: clip(data.s, 80),
      g: clip(data.g, 40),
      h: clip(data.h, 12),
      r: Number(data.r),
      n: Number(data.n),
    };
    if (!/^PF-\d{6}-\d+$/i.test(ticket.c) || !ticket.t || !ticket.d) return null;
    if (!Number.isInteger(ticket.r) || !Number.isInteger(ticket.n)) return null;
    return ticket;
  } catch {
    return null;
  }
}

function ticketRecord(order, item, ticket) {
  return {
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
}

function ticketUrl(order, item, ticket) {
  return `${SITE_ORIGIN}/valid.html?d=${encodeTicket(ticketRecord(order, item, ticket))}`;
}

function qrSvg(text) {
  if (typeof qrcode !== "function") return "";
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  return qr.createSvgTag({ cellSize: 4, margin: 1, scalable: true });
}

function ticketCard(order, item, ticket) {
  const seat = t("order.seat", { row: ticket.row, seat: ticket.seat });
  const where = [item.competition, item.stadium].filter(Boolean).join(" · ");
  const when = [item.date, item.kickoff].filter(Boolean).join(" · ");
  const test = item.competition === "TEST";
  const side = item.together ? `<p class="pass__side">${esc(t("order.side"))}</p>` : "";
  return `
    <article class="pass">
      <header class="pass__head">
        <p class="pass__brand">Prime Football</p>
        <p class="pass__kind">${test ? "Billet test" : "E-billet"}</p>
        <h2>${esc(item.title)}</h2>
        <p>${esc(where)}</p>
        <p>${esc(when)}${item.category ? ` · ${esc(item.category)}` : ""}</p>
      </header>
      <div class="pass__qr" aria-hidden="true">${qrSvg(ticketUrl(order, item, ticket))}</div>
      <p class="pass__scan">${esc(t("order.gate"))}</p>
      <div class="pass__tear">
        <p class="pass__seat">${esc(seat)}</p>
        ${side}
        <p class="pass__code">${esc(ticket.code)}</p>
      </div>
    </article>`;
}

function orderBlock(order) {
  const cards = order.items
    .map((item) => item.tickets.map((ticket) => ticketCard(order, item, ticket)).join(""))
    .join("");
  return `
    <section class="order-block">
      <header class="order-block__head">
        <p class="order-code"><span>${esc(t("order.mailCode"))}</span><strong>${esc(order.ref)}</strong></p>
        <p class="order-code__note">${esc(t("order.mailOnly"))}</p>
        <p class="order-meta">${esc(t("order.sent"))} <strong>${esc(order.email)}</strong> · ${esc(order.total)} €</p>
      </header>
      <div class="ticket-grid">${cards}</div>
    </section>`;
}

function paintGate(root) {
  if (!root) return;
  const params = new URLSearchParams(window.location.search);
  let data = params.get("d") ? decodeTicket(params.get("d")) : null;
  if (!data) {
    const found = findTicket(params.get("code"));
    if (found) data = ticketRecord(found.order, found.item, found.ticket);
  }

  root.className = "gate";
  if (!data) {
    root.innerHTML = `
      <div class="gate-glow" aria-hidden="true"></div>
      <div class="gate-badge" aria-hidden="true">
        <svg viewBox="0 0 72 72">
          <circle class="gate-check__ring" cx="36" cy="36" r="26"></circle>
          <path class="gate-check__mark" d="M27 27l18 18M45 27 27 45"></path>
        </svg>
      </div>
      <p class="gate-kicker">${esc(t("gate.kicker"))}</p>
      <h1 class="gate-status">${esc(t("gate.invalid"))}</h1>
      <p class="gate-lead">${esc(t("gate.invalidLead"))}</p>`;
    requestAnimationFrame(() => root.classList.add("is-on", "is-bad"));
    return;
  }

  const date = typeof pfDate === "function" ? pfDate(data.d) : data.d;
  const when = data.h ? `${date} · ${data.h}` : date;
  const seat = t("order.seat", { row: data.r, seat: data.n });
  root.innerHTML = `
    <div class="gate-glow" aria-hidden="true"></div>
    <div class="gate-badge" aria-hidden="true">
      <svg viewBox="0 0 72 72">
        <circle class="gate-check__ring" cx="36" cy="36" r="26"></circle>
        <path class="gate-check__mark" d="M24 37.5 32.2 46 49 27.5"></path>
      </svg>
    </div>
    <p class="gate-kicker">${esc(t("gate.kicker"))}</p>
    ${data.k === "TEST" || data.g === "TEST" ? `<p class="gate-kicker">TEST</p>` : ""}
    <h1 class="gate-status">${esc(t("gate.valid"))}</h1>
    <article class="gate-card">
      ${data.k ? `<p class="gate-card__comp">${esc(data.k)}</p>` : ""}
      <h2>${esc(data.t)}</h2>
      <ul>
        <li><span>${esc(t("gate.when"))}</span><strong>${esc(when)}</strong></li>
        ${data.s ? `<li><span>${esc(t("gate.where"))}</span><strong>${esc(data.s)}</strong></li>` : ""}
        <li><span>${esc(t("gate.seat"))}</span><strong>${esc(seat)}</strong></li>
        ${data.g ? `<li><span>${esc(t("gate.cat"))}</span><strong>${esc(data.g)}</strong></li>` : ""}
      </ul>
      <p class="gate-card__code">${esc(data.c)}</p>
    </article>`;
  requestAnimationFrame(() => root.classList.add("is-on"));
}
