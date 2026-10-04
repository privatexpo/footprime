const params = new URLSearchParams(window.location.search);
const matchId = params.get("id");
const found = matchId ? findMatch(matchId) : null;

let qty = 1;

const ICON_EYE = `<svg class="fff-cat__fact-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M2.5 12S6.5 6.5 12 6.5 21.5 12 21.5 12 17.5 17.5 12 17.5 2.5 12 2.5 12Z" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="2.6" stroke="currentColor" stroke-width="1.8"/></svg>`;
const ICON_ROOF = `<svg class="fff-cat__fact-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 11.5 12 5l8 6.5" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M7 10.8V19h10v-8.2" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
const ICON_SUN = `<svg class="fff-cat__fact-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="3.2" stroke="currentColor" stroke-width="1.8"/><path d="M12 4.5v2.2M12 17.3v2.2M4.5 12h2.2M17.3 12h2.2M6.7 6.7l1.6 1.6M15.7 15.7l1.6 1.6M17.3 6.7l-1.6 1.6M8.3 15.7l-1.6 1.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;

const CATEGORY_DEFS = [
  {
    id: "cat5",
    num: 5,
    label: "CAT 5",
    descKey: "cat.corners",
    color: "#1e3a6e",
    mult: 1,
    seat: "corners",
    view: 1,
    viewLabel: "Limitée",
    covered: false,
  },
  {
    id: "cat4",
    num: 4,
    label: "CAT 4",
    descKey: "cat.goals",
    color: "#e67e22",
    mult: 1.35,
    seat: "goals",
    view: 2,
    viewLabel: "Correcte",
    covered: false,
  },
  {
    id: "cat3",
    num: 3,
    label: "CAT 3",
    descKey: "cat.upper",
    color: "#f1c40f",
    ink: "#1a2744",
    mult: 1.7,
    seat: "upper",
    view: 3,
    viewLabel: "Bonne",
    covered: true,
  },
  {
    id: "cat2",
    num: 2,
    label: "CAT 2",
    descKey: "cat.side",
    color: "#27ae60",
    mult: 2.3,
    seat: "side",
    view: 4,
    viewLabel: "Très bonne",
    covered: true,
  },
  {
    id: "cat1",
    num: 1,
    label: "CAT 1",
    descKey: "cat.pitch",
    color: "#c9a227",
    ink: "#1a2744",
    mult: 2.95,
    seat: "pitch",
    view: 5,
    viewLabel: "Excellente",
    covered: true,
  },
];

const els = {
  eyebrow: document.getElementById("place-eyebrow"),
  match: document.getElementById("place-match"),
  meta: document.getElementById("place-meta"),
  metaDate: document.getElementById("place-meta-date"),
  metaVenue: document.getElementById("place-meta-venue"),
  cats: document.getElementById("fff-cats"),
  total: document.getElementById("ticket-total"),
  qtyInput: document.getElementById("qty"),
  layout: document.getElementById("place-layout"),
  card: document.getElementById("place-card"),
};

function euro(n) {
  return `${Number(n).toFixed(2).replace(".", ",")} €`;
}

function roundPrice(n) {
  return Math.round(n / 5) * 5;
}

function stockFor(catId, baseFrom) {
  const seed = String(matchId || "") + catId + String(baseFrom || 0);
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const r = h % 100;
  if (r < 18) return { kind: "low", left: (h % 3) + 1 };
  if (r < 32) return { kind: "low", left: (h % 5) + 2 };
  return { kind: "ok" };
}

function categoryPrices(from) {
  const base = Math.max(20, Number(from) || 40);
  return CATEGORY_DEFS.map((c) => ({
    ...c,
    price: roundPrice(base * c.mult),
  }));
}

function viewBars(level) {
  return Array.from({ length: 5 }, (_, i) => `<span class="${i < level ? "is-on" : ""}"></span>`).join("");
}

function seatIcon(seat) {
  const zones = {
    corners: `<rect x="2" y="2" width="9" height="7" rx="1.6"/><rect x="37" y="2" width="9" height="7" rx="1.6"/><rect x="2" y="23" width="9" height="7" rx="1.6"/><rect x="37" y="23" width="9" height="7" rx="1.6"/>`,
    goals: `<rect x="2" y="10" width="8.5" height="12" rx="1.6"/><rect x="37.5" y="10" width="8.5" height="12" rx="1.6"/>`,
    upper: `<rect x="8" y="2" width="32" height="4.2" rx="1.3"/><rect x="8" y="25.8" width="32" height="4.2" rx="1.3"/>`,
    side: `<rect x="14" y="4.6" width="20" height="3.6" rx="1.1"/><rect x="14" y="23.8" width="20" height="3.6" rx="1.1"/>`,
    pitch: `<rect x="16.5" y="7.4" width="15" height="2.8" rx="0.8"/><rect x="16.5" y="21.8" width="15" height="2.8" rx="0.8"/>`,
  };
  return `<svg class="fff-cat__seat" viewBox="0 0 48 32" fill="currentColor" aria-hidden="true"><rect x="1.4" y="1.4" width="45.2" height="29.2" rx="9" fill="none" stroke="currentColor" stroke-width="1.7" opacity="0.45"/><rect x="17" y="10" width="14" height="12" rx="1" opacity="0.22"/>${zones[seat] || ""}</svg>`;
}

function renderCategories(from) {
  if (!els.cats) return;
  const cats = categoryPrices(from);
  const selected = document.querySelector('input[name="category"]:checked')?.value;
  els.cats.innerHTML = cats
    .map((c, i) => {
      const stock = stockFor(c.id, from);
      const stockHtml =
        stock.kind === "low"
          ? `<span class="fff-cat__stock fff-cat__stock--low">${t(stock.left > 1 ? "place.low.many" : "place.low.one", { n: stock.left })}</span>`
          : `<span class="fff-cat__stock fff-cat__stock--ok">${t("place.available")}</span>`;
      const coverLabel = c.covered ? t("place.covered") : t("place.open");
      const desc = t(c.descKey);
      const viewLabel = t("view." + c.view);
      return `
        <label class="fff-cat" style="--i:${i}">
          <input type="radio" name="category" value="${c.id}" data-price="${c.price}" ${(selected ? c.id === selected : i === 0) ? "checked" : ""} />
          <span class="fff-cat__row">
            <span class="fff-cat__badge" style="--cat-color:${c.color};--cat-ink:${c.ink || "#fff"}" aria-label="Catégorie ${c.num}">
              ${seatIcon(c.seat)}
              <span class="fff-cat__num">${c.num}</span>
            </span>
            <span class="fff-cat__info">
              <span class="fff-cat__desc">${desc}</span>
              <span class="fff-cat__facts">
                <span class="fff-cat__fact" aria-label="${viewLabel}, ${c.view} / 5">
                  ${ICON_EYE}
                  <span class="fff-cat__bars" aria-hidden="true">${viewBars(c.view)}</span>
                  <span class="fff-cat__fact-label">${viewLabel}</span>
                </span>
                <span class="fff-cat__fact" aria-label="${coverLabel}">
                  ${c.covered ? ICON_ROOF : ICON_SUN}
                  <span class="fff-cat__fact-label">${coverLabel}</span>
                </span>
              </span>
              ${stockHtml}
            </span>
            <span class="fff-cat__price">${euro(c.price)}</span>
            <span class="fff-cat__radio" aria-hidden="true"></span>
          </span>
        </label>
      `;
    })
    .join("");

  els.cats.querySelectorAll('input[name="category"]').forEach((input) => {
    input.addEventListener("change", updateTotal);
  });
}

function renderPlace() {
  if (!found || found.match.status === "sold") {
    if (els.meta) els.meta.hidden = false;
    if (els.eyebrow) els.eyebrow.textContent = t("place.missing");
    if (els.match) {
      els.match.innerHTML = `<div class="place-card__empty"><h2>${t("place.gone")}</h2><a href="index.html#matchs">${t("nav.backMatches")}</a></div>`;
    }
    document.querySelector(".place-cats")?.remove();
    return;
  }

  const { match, date, week, competition, stadium } = found;
  document.title = `${match.home} — ${match.away} · Prime Football`;

  const homeInk = inkFor(match.homeColor, match.inkHome);
  const awayInk = inkFor(match.awayColor);

  if (els.meta) els.meta.hidden = false;
  if (els.eyebrow) els.eyebrow.textContent = `${competition} · ${pfWeek(week)}`;
  if (els.metaDate) {
    const when = pfDate(date);
    els.metaDate.textContent = stadium?.name ? `${when} · ${stadium.name}` : when;
  }
  if (els.metaVenue) {
    els.metaVenue.textContent = stadium?.city || "";
    els.metaVenue.hidden = !stadium?.city;
  }

  if (els.match) {
    els.match.innerHTML = `
      <div class="place-card__side place-card__side--home" style="--side:${match.homeColor};--ink:${homeInk}">
        <span class="place-card__crest"><img src="${match.homeLogo}" alt="" width="96" height="96" /></span>
        <span class="place-card__name">${match.home}</span>
      </div>
      <div class="place-card__kick" aria-label="${t("place.kick")}">${match.kickoff}</div>
      <div class="place-card__side place-card__side--away" style="--side:${match.awayColor};--ink:${awayInk}">
        <span class="place-card__crest"><img src="${match.awayLogo}" alt="" width="96" height="96" /></span>
        <span class="place-card__name">${match.away}</span>
      </div>
    `;
  }

  renderCategories(match.from);
  updateTotal();
}

renderPlace();
window.addEventListener("pf-lang", renderPlace);

function selectedPrice() {
  const checked = document.querySelector('input[name="category"]:checked');
  return Number(checked?.dataset.price || 0);
}

function updateTotal() {
  if (!els.total) return;
  els.total.textContent = euro(selectedPrice() * qty);
  if (els.qtyInput) els.qtyInput.value = String(qty);
  const note = document.getElementById("place-together");
  if (note) note.textContent = qty > 1 ? t("place.togetherNow", { n: qty }) : t("place.together");
}

document.getElementById("qty-minus")?.addEventListener("click", () => {
  qty = Math.max(1, qty - 1);
  updateTotal();
});

document.getElementById("qty-plus")?.addEventListener("click", () => {
  qty = Math.min(8, qty + 1);
  updateTotal();
});

document.getElementById("add-to-cart")?.addEventListener("click", () => {
  if (!found) return;
  const input = document.querySelector('input[name="category"]:checked');
  const category = input?.value;
  const def = CATEGORY_DEFS.find((c) => c.id === category);
  const cart = loadCart();
  cart.push({
    title: `${found.match.home} — ${found.match.away}`,
    home: found.match.home,
    away: found.match.away,
    homeLogo: found.match.homeLogo || "",
    awayLogo: found.match.awayLogo || "",
    date: found.date,
    competition: found.competition,
    stadium: found.stadium?.name || "",
    kickoff: found.match.kickoff || "",
    category: def?.label || CATEGORY_NAMES[category] || category,
    price: selectedPrice(),
    qty,
    together: qty > 1,
  });
  saveCart(cart);
  startHold();
  window.location.href = "panier.html";
});

bindCartUI();
updateTotal();

(function setupMobileNav() {
  const nav = document.querySelector(".main-nav");
  const btn = document.getElementById("nav-menu-btn");
  const panel = document.getElementById("mobile-nav");
  if (!nav || !btn || !panel) return;

  const close = () => {
    panel.hidden = true;
    nav.classList.remove("is-open");
    btn.setAttribute("aria-expanded", "false");
  };

  btn.addEventListener("click", () => {
    const open = panel.hidden;
    panel.hidden = !open;
    nav.classList.toggle("is-open", open);
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  });

  panel.querySelectorAll("a").forEach((link) => link.addEventListener("click", close));
  window.addEventListener("resize", () => {
    if (window.matchMedia("(min-width: 900px)").matches) close();
  });
})();
