const params = new URLSearchParams(window.location.search);
const matchId = params.get("id");
const found = matchId ? findMatch(matchId) : null;

let qty = 1;

const CATEGORY_DEFS = [
  {
    id: "cat5",
    label: "CAT 5",
    desc: "Virages · coins et niveau supérieur",
    color: "#1e3a6e",
    mult: 1,
  },
  {
    id: "cat4",
    label: "CAT 4",
    desc: "Virages · derrière les buts",
    color: "#e67e22",
    mult: 1.35,
  },
  {
    id: "cat3",
    label: "CAT 3",
    desc: "Tribunes hautes · côtés",
    color: "#f1c40f",
    ink: "#1a2744",
    mult: 1.7,
  },
  {
    id: "cat2",
    label: "CAT 2",
    desc: "Tribunes latérales · niveau intermédiaire",
    color: "#27ae60",
    mult: 2.3,
  },
  {
    id: "cat1",
    label: "CAT 1",
    desc: "Tribunes latérales · proche pelouse",
    color: "#c9a227",
    ink: "#1a2744",
    mult: 2.95,
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

function renderCategories(from) {
  if (!els.cats) return;
  const cats = categoryPrices(from);
  els.cats.innerHTML = cats
    .map((c, i) => {
      const stock = stockFor(c.id, from);
      const stockHtml =
        stock.kind === "low"
          ? `<span class="fff-cat__stock fff-cat__stock--low">Plus que ${stock.left} billet${stock.left > 1 ? "s" : ""} dans cette catégorie</span>`
          : `<span class="fff-cat__stock fff-cat__stock--ok">Disponible</span>`;
      return `
        <label class="fff-cat">
          <input type="radio" name="category" value="${c.id}" data-price="${c.price}" ${i === 0 ? "checked" : ""} />
          <span class="fff-cat__row">
            <span class="fff-cat__badge" style="--cat-color:${c.color};--cat-ink:${c.ink || "#fff"}">${c.label}</span>
            <span class="fff-cat__info">
              <span class="fff-cat__desc">${c.desc}</span>
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

if (!found || found.match.status === "sold") {
  if (els.meta) els.meta.hidden = false;
  if (els.eyebrow) els.eyebrow.textContent = "Match introuvable";
  if (els.match) {
    els.match.innerHTML = `<div class="place-card__empty"><h2>Ce match n’est plus disponible</h2><a href="index.html#matchs">Retour aux matchs</a></div>`;
  }
  document.querySelector(".place-cats")?.remove();
} else {
  const { match, date, week, competition, stadium } = found;
  document.title = `${match.home} — ${match.away} · Prime Football`;

  const homeInk = inkFor(match.homeColor, match.inkHome);
  const awayInk = inkFor(match.awayColor);

  if (els.meta) els.meta.hidden = false;
  if (els.eyebrow) els.eyebrow.textContent = `${competition} · ${week}`;
  if (els.metaDate) {
    els.metaDate.textContent = stadium?.name ? `${date} · ${stadium.name}` : date;
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
      <div class="place-card__kick" aria-label="Coup d’envoi">${match.kickoff}</div>
      <div class="place-card__side place-card__side--away" style="--side:${match.awayColor};--ink:${awayInk}">
        <span class="place-card__crest"><img src="${match.awayLogo}" alt="" width="96" height="96" /></span>
        <span class="place-card__name">${match.away}</span>
      </div>
    `;
  }

  renderCategories(match.from);
}

function selectedPrice() {
  const checked = document.querySelector('input[name="category"]:checked');
  return Number(checked?.dataset.price || 0);
}

function updateTotal() {
  if (!els.total) return;
  els.total.textContent = euro(selectedPrice() * qty);
  if (els.qtyInput) els.qtyInput.value = String(qty);
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
    date: found.date,
    competition: found.competition,
    stadium: found.stadium?.name || "",
    category: def?.label || CATEGORY_NAMES[category] || category,
    price: selectedPrice(),
    qty,
  });
  saveCart(cart);
  showToast("Ajouté au panier");
  bindCartUI();
  setTimeout(() => {
    window.location.href = "index.html#matchs";
  }, 700);
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
