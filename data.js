function m(home, homeShort, homeColor, away, awayShort, awayColor, kickoff, from, status, inkHome) {
  return {
    home,
    homeShort,
    homeColor,
    homeLogo: BADGES[homeShort],
    away,
    awayShort,
    awayColor,
    awayLogo: BADGES[awayShort],
    kickoff,
    from,
    status,
    inkHome: Boolean(inkHome),
  };
}

const BADGES = {
  ARS: "badges/arsenal.svg",
  AVL: "badges/aston-villa.svg",
  BOU: "badges/bournemouth.svg",
  BRE: "badges/brentford.svg",
  BHA: "badges/brighton.svg",
  CHE: "badges/chelsea.png",
  CRY: "badges/crystal-palace.svg",
  EVE: "badges/everton.svg",
  FUL: "badges/fulham.svg",
  LEE: "badges/leeds.svg",
  LIV: "badges/liverpool.png?v=2",
  MCI: "badges/man-city.svg",
  MUN: "badges/man-united.svg",
  NEW: "badges/newcastle.svg",
  NFO: "badges/nottingham-forest.svg",
  SUN: "badges/sunderland.svg",
  TOT: "badges/tottenham.png?v=5",
  WHU: "badges/west-ham.svg",
  BUR: "badges/burnley.svg",
  WOL: "badges/wolves.svg",
  RMA: "badges/real-madrid.png",
  BAR: "badges/barcelona.png",
  BAY: "badges/bayern.png",
  BVB: "badges/dortmund.png",
  INT: "badges/inter.png",
  NAP: "badges/napoli.png",
  PSG: "badges/psg.png",
  ATM: "badges/atletico.png",
};

/* Stades officiels (domicile) — saison 2026/27 */
const STADIUMS = {
  ARS: { name: "Emirates Stadium", city: "Londres" },
  AVL: { name: "Villa Park", city: "Birmingham" },
  BOU: { name: "Vitality Stadium", city: "Bournemouth" },
  BRE: { name: "Gtech Community Stadium", city: "Londres" },
  BHA: { name: "American Express Stadium", city: "Brighton" },
  CHE: { name: "Stamford Bridge", city: "Londres" },
  CRY: { name: "Selhurst Park", city: "Londres" },
  EVE: { name: "Hill Dickinson Stadium", city: "Liverpool" },
  FUL: { name: "Craven Cottage", city: "Londres" },
  LEE: { name: "Elland Road", city: "Leeds" },
  LIV: { name: "Anfield", city: "Liverpool" },
  MCI: { name: "Etihad Stadium", city: "Manchester" },
  MUN: { name: "Old Trafford", city: "Manchester" },
  NEW: { name: "St James' Park", city: "Newcastle" },
  NFO: { name: "City Ground", city: "Nottingham" },
  SUN: { name: "Stadium of Light", city: "Sunderland" },
  TOT: { name: "Tottenham Hotspur Stadium", city: "Londres" },
  WHU: { name: "London Stadium", city: "Londres" },
  BUR: { name: "Turf Moor", city: "Burnley" },
  WOL: { name: "Molineux Stadium", city: "Wolverhampton" },
  RMA: { name: "Santiago Bernabéu", city: "Madrid" },
  BAR: { name: "Spotify Camp Nou", city: "Barcelone" },
  BAY: { name: "Allianz Arena", city: "Munich" },
  BVB: { name: "Signal Iduna Park", city: "Dortmund" },
  INT: { name: "San Siro", city: "Milan" },
  NAP: { name: "Stadio Diego Armando Maradona", city: "Naples" },
  PSG: { name: "Parc des Princes", city: "Paris" },
  ATM: { name: "Riyadh Air Metropolitano", city: "Madrid" },
};

function stadiumFor(homeShort) {
  return STADIUMS[homeShort] || { name: "Stade à confirmer", city: "" };
}

function withIds(competitions) {
  for (const competition of Object.values(competitions)) {
    for (const week of competition.weeks) {
      for (const day of week.days) {
        for (const match of day.matches) {
          match.id = `${competition.id}-${week.id}-${match.homeShort}-${match.awayShort}-${match.kickoff}`.replace(
            /\s+/g,
            ""
          );
        }
      }
    }
  }
  return competitions;
}

const COMPETITIONS = withIds({
  pl: {
    id: "pl",
    name: "Premier League",
    shortName: "PL",
    headerTitle: "Premier League Matches 2026/27",
    logo: "logos/pl-lion.png",
    weekLabel: "Semaine",
    weekShort: "S",
    weeks: [
      {
        id: 5,
        title: "Semaine 5",
        short: "S5",
        range: "Dim 4 oct",
        days: [
          {
            date: "Dim 4 oct",
            matches: [
              /* Prix CAT 5 ≈ 60 % des tarifs officiels club (Ticket-Compare / sites clubs) */
              m("Man United", "MUN", "#da291c", "Chelsea", "CHE", "#034694", "15:30", 45, "hot"),
              m("Newcastle", "NEW", "#241f20", "Tottenham", "TOT", "#132257", "17:00", 30, "available"),
            ],
          },
        ],
      },
      {
        id: 6,
        title: "Semaine 6",
        short: "S6",
        range: "Sam 10 oct — Lun 12 oct",
        days: [
          {
            date: "Sam 10 oct",
            matches: [
              m("Arsenal", "ARS", "#ef0107", "Leeds", "LEE", "#1d428a", "11:30", 20, "hot"),
              m("Aston Villa", "AVL", "#95bfe5", "Brentford", "BRE", "#e30613", "14:00", 30, "available"),
              m("Bournemouth", "BOU", "#da291c", "Crystal Palace", "CRY", "#1b458f", "14:00", 25, "available"),
              m("Brighton", "BHA", "#0057b8", "Wolves", "WOL", "#fdb913", "14:00", 20, "available", true),
              m("Sunderland", "SUN", "#eb172b", "Man City", "MCI", "#6cabdd", "16:30", 25, "hot"),
            ],
          },
          {
            date: "Dim 11 oct",
            matches: [
              m("Fulham", "FUL", "#000000", "Liverpool", "LIV", "#c8102e", "13:00", 60, "hot"),
              m("Man United", "MUN", "#da291c", "Chelsea", "CHE", "#034694", "15:30", 45, "hot"),
              m("Newcastle", "NEW", "#241f20", "Tottenham", "TOT", "#132257", "15:30", 30, "available"),
              m("West Ham", "WHU", "#7a263a", "Burnley", "BUR", "#6c1d45", "15:30", 20, "sold"),
            ],
          },
          {
            date: "Lun 12 oct",
            matches: [
              m("Everton", "EVE", "#003399", "Nott'm Forest", "NFO", "#dd0000", "19:00", 35, "available"),
            ],
          },
        ],
      },
      {
        id: 7,
        title: "Semaine 7",
        short: "S7",
        range: "Sam 17 oct — Dim 18 oct",
        days: [
          {
            date: "Sam 17 oct",
            matches: [
              m("Chelsea", "CHE", "#034694", "Arsenal", "ARS", "#ef0107", "12:30", 40, "hot"),
              m("Liverpool", "LIV", "#c8102e", "Man United", "MUN", "#da291c", "17:30", 40, "hot"),
              m("Man City", "MCI", "#6cabdd", "Tottenham", "TOT", "#132257", "15:00", 25, "available"),
            ],
          },
          {
            date: "Dim 18 oct",
            matches: [
              m("Brentford", "BRE", "#e30613", "Newcastle", "NEW", "#241f20", "14:00", 25, "available"),
              m("Crystal Palace", "CRY", "#1b458f", "Aston Villa", "AVL", "#95bfe5", "16:30", 30, "available"),
            ],
          },
        ],
      },
    ],
  },
  ucl: {
    id: "ucl",
    name: "Champions League",
    shortName: "UCL",
    headerTitle: "Champions League 2026/27",
    logo: "logos/ucl.png?v=5",
    weekLabel: "Semaine",
    weekShort: "S",
    weeks: [
      {
        id: 3,
        title: "Semaine 3",
        short: "S3",
        range: "Mar 21 oct — Mer 22 oct",
        days: [
          {
            date: "Mar 21 oct",
            matches: [
              m("PSG", "PSG", "#004170", "Bayern", "BAY", "#dc052d", "21:00", 70, "hot"),
              m("Liverpool", "LIV", "#c8102e", "Real Madrid", "RMA", "#febe10", "21:00", 55, "hot", true),
              m("Arsenal", "ARS", "#ef0107", "Inter", "INT", "#010e80", "18:45", 50, "available"),
            ],
          },
          {
            date: "Mer 22 oct",
            matches: [
              m("Dortmund", "BVB", "#fde100", "Barcelona", "BAR", "#a50044", "21:00", 50, "hot", true),
              m("Chelsea", "CHE", "#034694", "Man City", "MCI", "#6cabdd", "21:00", 50, "hot"),
              m("Napoli", "NAP", "#12a0d7", "Atlético", "ATM", "#cb3524", "18:45", 35, "available"),
            ],
          },
        ],
      },
      {
        id: 4,
        title: "Semaine 4",
        short: "S4",
        range: "Mar 4 nov — Mer 5 nov",
        days: [
          {
            date: "Mar 4 nov",
            matches: [
              m("Barcelona", "BAR", "#a50044", "Chelsea", "CHE", "#034694", "21:00", 80, "hot"),
              m("Bayern", "BAY", "#dc052d", "Liverpool", "LIV", "#c8102e", "21:00", 65, "hot"),
              m("Real Madrid", "RMA", "#febe10", "Man City", "MCI", "#6cabdd", "18:45", 110, "hot", true),
            ],
          },
          {
            date: "Mer 5 nov",
            matches: [
              m("Inter", "INT", "#010e80", "PSG", "PSG", "#004170", "21:00", 55, "available"),
              m("Atlético", "ATM", "#cb3524", "Dortmund", "BVB", "#fde100", "21:00", 45, "available", true),
              m("Arsenal", "ARS", "#ef0107", "Napoli", "NAP", "#12a0d7", "18:45", 45, "sold"),
            ],
          },
        ],
      },
    ],
  },
});

// remove old duplicate function m and COMPETITIONS below if present

function inkFor(hex, forceDark) {
  if (forceDark) return "#0b1220";
  const raw = String(hex || "#333").replace("#", "").trim();
  if (raw.length < 6) return "#fff";
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? "#0b1220" : "#ffffff";
}

const CATEGORY_NAMES = {
  cat1: "Cat 1",
  cat2: "Cat 2",
  cat3: "Cat 3",
  cat4: "Cat 4",
  cat5: "Cat 5",
};
const CART_KEY = "prime-football-cart";
const HOLD_KEY = "prime-football-hold";
const HOLD_MS = 10 * 60 * 1000;

function findMatch(id) {
  for (const competition of Object.values(COMPETITIONS)) {
    for (const week of competition.weeks) {
      for (const day of week.days) {
        const found = day.matches.find((x) => x.id === id);
        if (found) {
          const stadium = stadiumFor(found.homeShort);
          return {
            match: found,
            date: day.date,
            week: week.title,
            competition: competition.name,
            stadium,
          };
        }
      }
    }
  }
  return null;
}

function loadCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  if (!cart.length) localStorage.removeItem(HOLD_KEY);
}

function holdDeadline() {
  const raw = Number(localStorage.getItem(HOLD_KEY) || 0);
  return Number.isFinite(raw) ? raw : 0;
}

function startHold() {
  const current = holdDeadline();
  if (current > Date.now()) return current;
  const next = Date.now() + HOLD_MS;
  localStorage.setItem(HOLD_KEY, String(next));
  return next;
}

function holdLeft() {
  const deadline = holdDeadline();
  return deadline ? deadline - Date.now() : 0;
}

function formatHold(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = String(Math.floor(total / 60)).padStart(2, "0");
  const seconds = String(total % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function releaseHold() {
  saveCart([]);
  if (typeof bindCartUI === "function") bindCartUI();
}

function cartCount(cart) {
  return cart.reduce((n, i) => n + i.qty, 0);
}

function matchFaces(title) {
  const parts = String(title || "").split(" — ");
  if (parts.length < 2 || typeof COMPETITIONS === "undefined") return null;
  const home = parts[0].trim();
  const away = parts.slice(1).join(" — ").trim();
  for (const competition of Object.values(COMPETITIONS)) {
    for (const week of competition.weeks) {
      for (const day of week.days) {
        const match = day.matches.find((entry) => entry.home === home && entry.away === away);
        if (match) {
          return {
            home: match.home,
            away: match.away,
            homeLogo: match.homeLogo,
            awayLogo: match.awayLogo,
          };
        }
      }
    }
  }
  return null;
}

function facesOf(item) {
  if (item.homeLogo && item.awayLogo) return item;
  const faces = matchFaces(item.title);
  return faces ? { ...item, ...faces } : item;
}

function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.hidden = false;
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove("is-visible"), 2200);
}

function ecranPaiement(actif) {
  const existant = document.getElementById("pay-wait");
  if (!actif) {
    existant?.remove();
    document.body.classList.remove("is-paying");
    return;
  }
  if (existant) return;
  const el = document.createElement("div");
  el.id = "pay-wait";
  el.className = "pay-wait";
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");
  el.innerHTML = `
    <div class="pay-wait__orbit" aria-hidden="true"><span></span><span></span></div>
    <p class="pay-wait__brand">PRIME FOOTBALL</p>
    <h1>${t("pay.wait")}</h1>
    <p>${t("pay.waitLead")}</p>
    <div class="pay-wait__bar" aria-hidden="true"><i></i></div>`;
  document.body.appendChild(el);
  document.body.classList.add("is-paying");
}

async function lancerPaiement() {
  const cart = loadCart();
  if (holdDeadline() && holdLeft() <= 0) {
    releaseHold();
    throw new Error("Le délai de 10 minutes est écoulé. Tes places ont été libérées.");
  }
  if (!cart.length) throw new Error(t("cart.empty"));
  if (cart.some((item) => !item.matchId || !item.categoryId)) {
    throw new Error("Remets les matchs dans le panier, puis valide à nouveau.");
  }
  ecranPaiement(true);
  try {
    const res = await fetch("/api/commande", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lines: cart.map((item) => ({
          matchId: item.matchId,
          categoryId: item.categoryId,
          qty: item.qty,
          homeLogo: item.homeLogo || "",
          awayLogo: item.awayLogo || "",
        })),
      }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok || !payload.url) throw new Error(payload.error || "Le paiement n'a pas pu démarrer.");
    window.location.href = payload.url;
  } catch (error) {
    ecranPaiement(false);
    throw error;
  }
}

async function lancerPaiementTest(token) {
  ecranPaiement(true);
  try {
    const res = await fetch("/api/commande-test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok || !payload.url) throw new Error(payload.error || "Le paiement n'a pas pu démarrer.");
    window.location.href = payload.url;
  } catch (error) {
    ecranPaiement(false);
    throw error;
  }
}

function bindCartUI() {
  const cartBtn = document.getElementById("cart-btn");
  const cartCountEl = document.getElementById("cart-count");
  const cartDialog = document.getElementById("cart-dialog");
  const cartList = document.getElementById("cart-list");
  const cartTotal = document.getElementById("cart-total");
  const cartClose = document.getElementById("cart-close");
  const checkoutBtn = document.getElementById("checkout-btn");
  if (!cartBtn || !cartDialog) return;

  let lastCount = null;

  function renderCart() {
    const cart = loadCart();
    const nextCount = cartCount(cart);
    if (cartCountEl) {
      cartCountEl.textContent = String(nextCount);
      if (lastCount !== null && nextCount !== lastCount) {
        cartCountEl.classList.remove("is-bump");
        void cartCountEl.offsetWidth;
        cartCountEl.classList.add("is-bump");
      }
      lastCount = nextCount;
    }
    if (!cart.length) {
      cartList.innerHTML = `<p class="empty">${t("cart.empty")}</p>`;
      cartTotal.textContent = "0 €";
      return;
    }
    cartList.innerHTML = cart
      .map(
        (item) => `
      <li>
        <span class="cart-list__title">${item.title}</span>
        <span class="cart-list__price">${item.price * item.qty} €</span>
        <span class="cart-list__meta">${item.competition}${item.stadium ? ` · ${item.stadium}` : ""} · ${item.category} · ×${item.qty} · ${item.date}</span>
      </li>`
      )
      .join("");
    cartTotal.textContent = `${cart.reduce((s, i) => s + i.price * i.qty, 0)} €`;
  }

  if (!cartBtn.dataset.bound) {
    cartBtn.dataset.bound = "1";
    cartBtn.addEventListener("click", () => {
      window.location.href = "panier.html";
    });
    cartClose?.addEventListener("click", () => cartDialog.close());
    checkoutBtn?.addEventListener("click", () => {
      lancerPaiement().catch((err) => showToast(err.message));
    });
  }

  window.addEventListener("pf-lang", renderCart);
  renderCart();
  return renderCart;
}
