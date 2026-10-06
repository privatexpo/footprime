function mailWhen(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function mailBadge(src, name) {
  if (!src) return "";
  return `<img src="${esc(src)}" alt="${esc(name || "")}">`;
}

function mailTeams(item) {
  const face = typeof facesOf === "function" ? facesOf(item) : item;
  if (!face.homeLogo && !face.awayLogo) return "";
  return `<div class="mail-teams">${mailBadge(face.homeLogo, face.home)}<span>vs</span>${mailBadge(face.awayLogo, face.away)}</div>`;
}

function invoiceLetter(order) {
  const rows = order.items
    .map((item) => {
      const when = item.kickoff ? `${item.date} · ${item.kickoff}` : item.date;
      const where = [item.stadium, item.category].filter(Boolean).join(" · ");
      return `<tr>
        <td>
          ${mailTeams(item)}
          <strong>${esc(item.title)}</strong>
          <small>${esc(item.competition || "")}${where ? ` · ${esc(where)}` : ""} · ${esc(when)}</small>
        </td>
        <td>×${item.qty}</td>
        <td>${item.price * item.qty} €</td>
      </tr>`;
    })
    .join("");
  return letterShell({
    from: "support@primeleaguetickets.com",
    subject: `${t("mail.invoiceKicker")} ${order.ref}`,
    to: order.email,
    kicker: t("mail.invoiceKicker"),
    title: t("mail.invoiceTitle"),
    body: `
      <p>${esc(t("mail.hello", { name: order.name }))}</p>
      <p>${esc(t("mail.invoiceLead"))}</p>
      <dl class="mail-meta">
        <div><dt>${esc(t("mail.ref"))}</dt><dd>${esc(order.ref)}</dd></div>
        <div><dt>${esc(t("mail.date"))}</dt><dd>${esc(mailWhen(order.created))}</dd></div>
        <div><dt>${esc(t("mail.status"))}</dt><dd>${esc(t("mail.paid"))}</dd></div>
      </dl>
      <table class="mail-table">
        <thead><tr><th>${esc(t("mail.match"))}</th><th>${esc(t("mail.qty"))}</th><th>${esc(t("mail.amount"))}</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="mail-total"><span>${esc(t("mail.total"))}</span><strong>${order.total} €</strong></p>`,
  });
}

function ticketsLetter(order) {
  const sheets = order.items
    .map((item) => item.tickets.map((ticket) => pdfSheet(order, item, ticket)).join(""))
    .join("");
  const count = order.items.reduce((sum, item) => sum + item.tickets.length, 0);
  const attached = count > 1 ? t("mail.attached", { n: count }) : t("mail.attachedOne");
  return letterShell({
    from: "support@primeleaguetickets.com",
    subject: `${t("mail.ticketsKicker")} ${order.ref}`,
    to: order.email,
    kicker: t("mail.ticketsKicker"),
    title: t("mail.ticketsTitle"),
    body: `
      <p>${esc(t("mail.hello", { name: order.name }))}</p>
      <p>${esc(t("mail.ticketsLead"))}</p>
      <p class="mail-code"><span>${esc(t("order.mailCode"))}</span><strong>${esc(order.code || order.ref)}</strong></p>
      <p class="mail-code__help">${esc(t("mail.codeHelp"))}</p>
      <p class="mail-files">${esc(attached)}</p>
      <div class="pdf-stack">${sheets}</div>`,
  });
}

function pdfSheet(order, item, ticket) {
  const face = typeof facesOf === "function" ? facesOf(item) : item;
  const when = typeof pfDate === "function" ? pfDate(item.date) : item.date;
  const kick = item.kickoff ? `${when} · ${item.kickoff}` : when;
  const seat = t("order.seat", { row: ticket.row, seat: ticket.seat });
  return `<article class="pdf-sheet">
    <header>
      <img src="logos/prime-football.png" alt="Prime Football">
      <span>${esc(t("mail.pdf"))}</span>
    </header>
    ${mailTeams(face)}
    <h2>${esc(item.title)}</h2>
    <p class="pdf-sheet__comp">${esc(item.competition || "")}</p>
    <ul>
      <li><span>${esc(t("gate.when"))}</span><strong>${esc(kick)}</strong></li>
      ${item.stadium ? `<li><span>${esc(t("gate.where"))}</span><strong>${esc(item.stadium)}</strong></li>` : ""}
      <li><span>${esc(t("gate.seat"))}</span><strong>${esc(seat)}</strong></li>
      <li><span>${esc(t("gate.cat"))}</span><strong>${esc(item.category || "")}</strong></li>
    </ul>
    <div class="pdf-sheet__qr">${qrSvg(ticketUrl(order, item, ticket))}</div>
    <p class="pdf-sheet__file">${esc(ticket.code)}.pdf</p>
  </article>`;
}

function letterShell({ from, subject, to, kicker, title, body }) {
  return `<article class="letter">
    <header class="letter__inbox">
      <p class="letter__subject">${esc(subject)}</p>
      <p><strong>Prime Football</strong> · ${esc(from)}</p>
      <p>${esc(to)}</p>
    </header>
    <div class="letter__bar">
      <img src="logos/prime-football.png" alt="Prime Football">
      <span>${esc(kicker)}</span>
    </div>
    <div class="letter__body">
      <h1>${esc(title)}</h1>
      ${body}
      <p class="letter__foot">Prime Football · primeleaguetickets.com<br>support@primeleaguetickets.com</p>
    </div>
  </article>`;
}

function paintMail(kind) {
  const root = document.getElementById("mail");
  if (!root) return;
  const ref = new URLSearchParams(window.location.search).get("ref");
  const order = ref ? findOrder(ref) : null;
  root.innerHTML = order
    ? kind === "invoice"
      ? invoiceLetter(order)
      : ticketsLetter(order)
    : `<p class="letter-missing">${esc(t("order.none"))}</p>`;
}
