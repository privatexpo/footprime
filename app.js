function competitionDepuisUrl() {
  const path = decodeURIComponent(window.location.pathname || "").toLowerCase();
  const query = (new URLSearchParams(window.location.search).get("competition") || "").toLowerCase();
  const cible = `${path} ${query}`;
  if (cible.includes("premier")) return "pl";
  if (cible.includes("champions")) return "ucl";
  return "ucl";
}

let competitionId = competitionDepuisUrl();
let weekIndex = 0;
let clubFilter = "";
let activeFilter = null;

const els = {
  list: document.getElementById("match-list"),
  weekTitle: document.getElementById("week-title"),
  weekRange: document.getElementById("week-range"),
  prev: document.getElementById("week-prev"),
  next: document.getElementById("week-next"),
  headerTitle: document.getElementById("fixtures-heading"),
  competitionLogo: document.getElementById("competition-logo"),
  clubLabel: document.getElementById("filter-club-label"),
  drawer: document.getElementById("filter-drawer"),
  backdrop: document.getElementById("drawer-backdrop"),
  drawerTitle: document.getElementById("drawer-title"),
  drawerOptions: document.getElementById("drawer-options"),
};

function currentCompetition() {
  return COMPETITIONS[competitionId];
}

function currentWeeks() {
  return currentCompetition().weeks;
}

function statusLabel(status) {
  if (status === "hot") return "Forte demande";
  if (status === "sold") return "Complet";
  return "Places dispo";
}

function daysUntilMatch(label) {
  const parts = String(label || "")
    .trim()
    .toLowerCase()
    .replace("é", "e")
    .replace("û", "u")
    .replace("ô", "o")
    .split(/\s+/);
  const day = Number(parts[1]);
  const months = { jan: 0, fev: 1, mar: 2, avr: 3, mai: 4, jun: 5, jul: 6, aou: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  const month = months[parts[2]];
  if (!day || month == null) return null;
  const year = month <= 5 ? 2027 : 2026;
  const date = new Date(year, month, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((date - today) / 86400000);
}

const ICON_DEMAND = `<svg class="match-signal__icon" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path fill="none" stroke="#e10600" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M2.5 11.5 6.2 7.8l2.2 2.2L13.5 4.2"/><path fill="none" stroke="#e10600" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M9.4 4.2h4.1V8.3"/></svg>`;
const ICON_PRICE = `<svg class="match-signal__icon" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="1" y="9" width="3.2" height="6" rx="0.7" fill="#d97706"/><rect x="6.4" y="5.2" width="3.2" height="9.8" rx="0.7" fill="#ea580c"/><rect x="11.8" y="1.6" width="3.2" height="13.4" rx="0.7" fill="#e10600"/></svg>`;

function matchSignals(match, dateLabel) {
  if (match.status === "sold") return "";
  const soon = daysUntilMatch(dateLabel);
  const chips = [];
  if (match.status === "hot") {
    chips.push(`<span class="match-signal match-signal--demand">${ICON_DEMAND}<span>${t("match.demand")}</span></span>`);
  }
  if (soon != null && soon >= 0 && soon <= 2) {
    chips.push(`<span class="match-signal match-signal--price">${ICON_PRICE}<span>${t("match.price")}</span></span>`);
  }
  if (!chips.length) return "";
  return `<div class="match-signals">${chips.join("")}</div>`;
}

function allClubs() {
  const set = new Map();
  currentWeeks().forEach((w) =>
    w.days.forEach((d) =>
      d.matches.forEach((match) => {
        set.set(match.home, { name: match.home, logo: match.homeLogo, short: match.homeShort });
        set.set(match.away, { name: match.away, logo: match.awayLogo, short: match.awayShort });
      })
    )
  );
  return [...set.values()].sort((a, b) => a.name.localeCompare(b.name, window.pfLang ? pfLang() : "fr"));
}

function updateFilterLabels() {
  els.clubLabel.textContent = clubFilter || t("filters.clubs");
  document.getElementById("filter-club-btn").classList.toggle("is-active-value", Boolean(clubFilter));
}

function matchesClub(match) {
  if (!clubFilter) return true;
  return match.home === clubFilter || match.away === clubFilter;
}

function openDrawer(type) {
  if (type !== "club") return;
  activeFilter = type;
  els.drawerTitle.textContent = t("filters.clubs");

  const options = [
    { value: "", label: t("filters.all"), selected: !clubFilter },
    ...allClubs().map((c) => ({
      value: c.name,
      label: c.name,
      logo: c.logo,
      selected: c.name === clubFilter,
    })),
  ];

  els.drawerOptions.innerHTML = options
    .map(
      (opt) => `
      <button type="button" class="drawer-option ${opt.selected ? "is-selected" : ""}" data-value="${opt.value}">
        <span class="drawer-option__main">
          ${opt.logo ? `<img class="drawer-option__logo" src="${opt.logo}" alt="" width="28" height="28" loading="lazy" />` : ""}
          <span>${opt.label}</span>
        </span>
      </button>`
    )
    .join("");

  els.backdrop.hidden = false;
  requestAnimationFrame(() => {
    els.backdrop.classList.add("is-open");
    els.drawer.classList.add("is-open");
    els.drawer.setAttribute("aria-hidden", "false");
  });

  document.querySelectorAll(".filter-trigger").forEach((btn) => {
    btn.classList.toggle("is-open", btn.dataset.filter === type);
  });
  document.body.style.overflow = "hidden";
}

function closeDrawer() {
  els.drawer.classList.remove("is-open");
  els.backdrop.classList.remove("is-open");
  els.drawer.setAttribute("aria-hidden", "true");
  document.querySelectorAll(".filter-trigger").forEach((btn) => btn.classList.remove("is-open"));
  document.body.style.overflow = "";
  activeFilter = null;
  setTimeout(() => {
    if (!els.drawer.classList.contains("is-open")) els.backdrop.hidden = true;
  }, 320);
}

function applyDrawerValue(value) {
  if (activeFilter === "club") {
    clubFilter = value;
  }
  closeDrawer();
  render();
}

function setCompetition(id, club) {
  if (!COMPETITIONS[id]) return;
  if (competitionId === id) {
    if (typeof club === "string") {
      clubFilter = club;
      weekIndex = 0;
      render();
    }
    return;
  }

  if (weekBusy) resetWeekSlider();

  const header = document.querySelector(".page-header");
  const fixtures = document.querySelector(".fixtures");
  const swap = id === "pl" ? "to-pl" : "to-ucl";

  weekIndex = 0;
  clubFilter = "";
  const pendingClub = typeof club === "string" ? club : "";

  document.querySelectorAll(".sub-tabs__tab").forEach((tab) => {
    const active = tab.dataset.competition === id;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", active ? "true" : "false");
  });

  if (header) {
    header.dataset.swap = swap;
    header.classList.remove("is-swapping-in");
    header.classList.add("is-swapping-out");
  }

  if (fixtures) fixtures.classList.add("is-switching");

  window.setTimeout(() => {
    competitionId = id;
    clubFilter = pendingClub;
    document.body.dataset.competition = id;
    render();

    if (header) {
      header.classList.remove("is-swapping-out");
      header.classList.add("is-swapping-in");
      void header.offsetWidth;
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (header) {
          header.classList.remove("is-swapping-in");
          delete header.dataset.swap;
        }
        if (fixtures) fixtures.classList.remove("is-switching");
      });
    });
  }, 320);
}

function render() {
  const competition = currentCompetition();
  const weeks = currentWeeks();
  if (weekIndex >= weeks.length) weekIndex = 0;
  const week = weeks[weekIndex];

  document.body.dataset.competition = competitionId;
  document.querySelectorAll(".sub-tabs__tab").forEach((tab) => {
    const active = tab.dataset.competition === competitionId;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", active ? "true" : "false");
  });

  els.headerTitle.textContent = competition.headerTitle;
  if (els.competitionLogo && competition.logo) {
    els.competitionLogo.src = competition.logo;
    els.competitionLogo.alt = competition.name;
  }
  const titleEl = document.getElementById("competition-title");
  const subtitleEl = document.getElementById("competition-subtitle");
  if (titleEl) titleEl.textContent = competition.name;
  if (subtitleEl) {
    subtitleEl.textContent = competitionId === "pl" ? "Matches 2026/27" : "2026/27";
  }

  resetWeekSlider();
  els.weekTitle.textContent = pfWeek(week.title);
  els.weekRange.textContent = pfDate(week.range);
  els.prev.disabled = weekIndex === 0;
  els.next.disabled = weekIndex === weeks.length - 1;
  updateWeekProgress(weeks.length);
  updateFilterLabels();
  els.list.innerHTML = buildMatchListHtml(weekIndex);
  els.list.classList.add("is-entering");
}

function buildMatchListHtml(index) {
  const competition = currentCompetition();
  const week = currentWeeks()[index];
  if (!week) return `<p class="empty">Aucun match pour ce filtre.</p>`;

  const days = week.days
    .map((day) => ({ ...day, matches: day.matches.filter(matchesClub) }))
    .filter((d) => d.matches.length);

  if (!days.length) return `<p class="empty">${t("match.empty")}</p>`;

  let cardIndex = 0;

  return days
    .map(
      (day) => `
      <section class="match-day">
        ${day.matches
          .map((match) => {
            const i = cardIndex++;
            const sold = match.status === "sold";
            const stadium = stadiumFor(match.homeShort);
            const venue = stadium
              ? `${stadium.name}${stadium.city ? ` · ${stadium.city}` : ""}`
              : "";
            const accent = match.homeColor || "#37003c";
            const badgeLabel = competition.shortName || competition.name;
            return `
            <article class="match-card" style="--accent:${accent};--i:${i}">
              <div class="match-card__stripes" aria-hidden="true"></div>
              <span class="match-card__tag">${badgeLabel}</span>
              <div class="match-card__left">
                <img class="match-card__comp-logo" src="${competition.logo}" alt="" width="48" height="48" decoding="async" />
                <div class="match-card__meta">
                  <p class="match-card__comp-name">${competition.name}</p>
                  <p class="match-card__datetime">${pfDate(day.date)} · ${match.kickoff}</p>
                  <p class="match-card__venue">${venue}</p>
                </div>
              </div>

              <div class="match-card__center">
                <div class="match-card__duel">
                  <span class="match-card__hex">
                    <img src="${match.homeLogo}" alt="" width="56" height="56" decoding="async" />
                  </span>
                  <span class="match-card__vs" aria-hidden="true">VS</span>
                  <span class="match-card__hex">
                    <img src="${match.awayLogo}" alt="" width="56" height="56" decoding="async" />
                  </span>
                  <span class="match-card__club-name">${match.home}</span>
                  <span class="match-card__duel-gap" aria-hidden="true"></span>
                  <span class="match-card__club-name">${match.away}</span>
                </div>
              </div>

              <div class="match-card__right">
                ${matchSignals(match, day.date)}
                ${
                  sold
                    ? `<button type="button" class="btn-buy" disabled>
                        <span class="btn-buy__main">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 8a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 000 4v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2a2 2 0 000-4V8z" stroke="currentColor" stroke-width="1.8"/></svg>
                          ${t("match.sold")}
                        </span>
                      </button>`
                    : `<a class="btn-buy" href="place.html?id=${encodeURIComponent(match.id)}">
                        <span class="btn-buy__main">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 8a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 000 4v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2a2 2 0 000-4V8z" stroke="currentColor" stroke-width="1.8"/></svg>
                          ${t("match.buy")}
                        </span>
                        <span class="btn-buy__from">${t("match.from", { price: Number(match.from) || 20 })}</span>
                      </a>`
                }
              </div>
            </article>`;
          })
          .join("")}
      </section>`
    )
    .join("");
}

function updateWeekProgress(count, index = weekIndex) {
  const progress = document.getElementById("week-progress");
  if (!progress) return;
  const total = Math.max(1, Number(count) || 1);
  const clamped = Math.min(Math.max(index, 0), total - 1);
  progress.style.setProperty("--count", String(total));
  progress.style.setProperty("--index", String(clamped));
  progress.setAttribute("aria-valuemax", String(total));
  progress.setAttribute("aria-valuenow", String(Math.round(clamped) + 1));
  progress.setAttribute("aria-valuetext", t("match.weekOf", { n: Math.round(clamped) + 1, total }));
}

let weekBusy = false;

function resetWeekSlider() {
  const listViewport = document.getElementById("match-list-viewport");
  const navViewport = document.querySelector(".week-nav__viewport");
  const zone = document.querySelector(".fixtures__swipe");
  zone?.classList.remove("is-dragging");

  if (listViewport) {
    let list = listViewport.querySelector("#match-list");
    if (!list || list.parentElement !== listViewport) {
      list = document.createElement("div");
      list.id = "match-list";
      list.className = "match-list";
      list.setAttribute("aria-live", "polite");
      listViewport.replaceChildren(list);
    } else {
      list.style.transition = "";
      list.style.transform = "";
    }
    els.list = list;
  }

  if (navViewport) {
    let panel = navViewport.querySelector("#week-nav-panel");
    if (!panel || panel.parentElement !== navViewport) {
      panel = document.createElement("div");
      panel.className = "week-nav__panel";
      panel.id = "week-nav-panel";
      panel.innerHTML = `<h2 id="week-title"></h2><p id="week-range"></p>`;
      navViewport.replaceChildren(panel);
    } else {
      panel.style.transition = "";
      panel.style.transform = "";
    }
    els.weekTitle = panel.querySelector("#week-title");
    els.weekRange = panel.querySelector("#week-range");
  }

  weekBusy = false;
}

function applyWeekChrome(index) {
  const weeks = currentWeeks();
  const week = weeks[index];
  if (!week) return;
  if (els.weekTitle) els.weekTitle.textContent = pfWeek(week.title);
  if (els.weekRange) els.weekRange.textContent = pfDate(week.range);
  els.prev.disabled = index === 0;
  els.next.disabled = index === weeks.length - 1;
  updateWeekProgress(weeks.length, index);
}

function createWeekSlideSession(dir, targetIndex) {
  const listViewport = document.getElementById("match-list-viewport");
  const navViewport = document.querySelector(".week-nav__viewport");
  if (!listViewport || !els.list || !navViewport) return null;

  const weeks = currentWeeks();
  const currentWeek = weeks[weekIndex];
  const targetWeek = weeks[targetIndex];
  if (!currentWeek || !targetWeek) return null;

  const width = listViewport.clientWidth || window.innerWidth;
  const navW = navViewport.clientWidth || width;
  const gap = 16;
  const step = width + gap;
  const navStep = navW + gap;

  const listTrack = document.createElement("div");
  listTrack.className = "week-slide-track";
  listTrack.style.setProperty("--slide-w", `${width}px`);
  listTrack.style.setProperty("--slide-gap", `${gap}px`);

  const currentList = els.list;
  currentList.classList.remove("is-entering");
  currentList.removeAttribute("id");
  currentList.removeAttribute("aria-live");
  currentList.style.transition = "none";
  currentList.style.transform = "";

  const currentListWrap = document.createElement("div");
  currentListWrap.className = "week-slide-panel";
  currentListWrap.appendChild(currentList);

  const nextList = document.createElement("div");
  nextList.className = "match-list";
  nextList.innerHTML = buildMatchListHtml(targetIndex);
  const nextListWrap = document.createElement("div");
  nextListWrap.className = "week-slide-panel";
  nextListWrap.appendChild(nextList);

  if (dir > 0) listTrack.append(currentListWrap, nextListWrap);
  else listTrack.append(nextListWrap, currentListWrap);
  listViewport.replaceChildren(listTrack);

  const navTrack = document.createElement("div");
  navTrack.className = "week-slide-track week-slide-track--nav";
  navTrack.style.setProperty("--slide-w", `${navW}px`);
  navTrack.style.setProperty("--slide-gap", `${gap}px`);

  const currentNav = document.createElement("div");
  currentNav.className = "week-nav__panel";
  currentNav.innerHTML = `<h2>${pfWeek(currentWeek.title)}</h2><p>${pfDate(currentWeek.range)}</p>`;

  const nextNav = document.createElement("div");
  nextNav.className = "week-nav__panel";
  nextNav.innerHTML = `<h2>${pfWeek(targetWeek.title)}</h2><p>${pfDate(targetWeek.range)}</p>`;

  if (dir > 0) navTrack.append(currentNav, nextNav);
  else navTrack.append(nextNav, currentNav);
  navViewport.replaceChildren(navTrack);

  return {
    dir,
    width,
    navW,
    gap,
    step,
    navStep,
    targetIndex,
    listTrack,
    navTrack,
    currentList,
    nextList,
    currentNav,
    nextNav,
    listViewport,
    navViewport,
  };
}

function setSessionX(session, listX, animate) {
  const ease = "transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)";
  session.listTrack.style.transition = animate ? ease : "none";
  session.listTrack.style.transform = `translate3d(${listX}px, 0, 0)`;
  const navX = listX * (session.navStep / session.step);
  session.navTrack.style.transition = animate ? ease : "none";
  session.navTrack.style.transform = `translate3d(${navX}px, 0, 0)`;
}

function finishSession(session, commit) {
  if (commit) {
    weekIndex = session.targetIndex;
    session.nextList.id = "match-list";
    session.nextList.setAttribute("aria-live", "polite");
    session.listViewport.replaceChildren(session.nextList);
    els.list = session.nextList;

    session.nextNav.id = "week-nav-panel";
    const title = session.nextNav.querySelector("h2");
    const range = session.nextNav.querySelector("p");
    if (title) title.id = "week-title";
    if (range) range.id = "week-range";
    session.navViewport.replaceChildren(session.nextNav);
    els.weekTitle = title;
    els.weekRange = range;
  } else {
    session.currentList.id = "match-list";
    session.currentList.setAttribute("aria-live", "polite");
    session.listViewport.replaceChildren(session.currentList);
    els.list = session.currentList;

    session.currentNav.id = "week-nav-panel";
    const title = session.currentNav.querySelector("h2");
    const range = session.currentNav.querySelector("p");
    if (title) title.id = "week-title";
    if (range) range.id = "week-range";
    session.navViewport.replaceChildren(session.currentNav);
    els.weekTitle = title;
    els.weekRange = range;
  }
  applyWeekChrome(weekIndex);
  weekBusy = false;
}

function animateSession(session, commit) {
  weekBusy = true;
  const restX = session.dir > 0 ? 0 : -session.step;
  const doneX = session.dir > 0 ? -session.step : 0;
  const endX = commit ? doneX : restX;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      setSessionX(session, endX, true);
      updateWeekProgress(currentWeeks().length, commit ? session.targetIndex : weekIndex);
    });
  });

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    finishSession(session, commit);
  };
  session.listTrack.addEventListener(
    "transitionend",
    (e) => {
      if (e.target === session.listTrack && e.propertyName === "transform") finish();
    },
    { once: true }
  );
  window.setTimeout(finish, 400);
}

function setWeek(i) {
  const weeks = currentWeeks();
  if (weekBusy || i === weekIndex || i < 0 || i >= weeks.length) return;
  const dir = i > weekIndex ? 1 : -1;
  const session = createWeekSlideSession(dir, i);
  if (!session) return;
  setSessionX(session, dir > 0 ? 0 : -session.step, false);
  animateSession(session, true);
}

els.prev.addEventListener("click", () => weekIndex > 0 && setWeek(weekIndex - 1));
els.next.addEventListener("click", () => weekIndex < currentWeeks().length - 1 && setWeek(weekIndex + 1));

(function bindWeekSwipe() {
  const zone = document.querySelector(".fixtures__swipe");
  const listViewport = document.getElementById("match-list-viewport");
  if (!zone || !listViewport) return;

  let startX = 0;
  let startY = 0;
  let startT = 0;
  let dx = 0;
  let dragging = false;
  let locked = false;
  let session = null;

  zone.addEventListener(
    "touchstart",
    (e) => {
      if (weekBusy || e.touches.length !== 1) return;
      dragging = true;
      locked = false;
      session = null;
      dx = 0;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startT = performance.now();
    },
    { passive: true }
  );

  zone.addEventListener(
    "touchmove",
    (e) => {
      if (!dragging || weekBusy || e.touches.length !== 1) return;
      const x = e.touches[0].clientX;
      const y = e.touches[0].clientY;
      const rawX = x - startX;
      const rawY = y - startY;

      if (!locked) {
        if (Math.abs(rawX) < 10 && Math.abs(rawY) < 10) return;
        if (Math.abs(rawY) >= Math.abs(rawX)) {
          dragging = false;
          return;
        }

        const weeks = currentWeeks();
        const dir = rawX < 0 ? 1 : -1;
        const targetIndex = weekIndex + dir;

        locked = true;
        zone.classList.add("is-dragging");

        if (targetIndex < 0 || targetIndex >= weeks.length) {
          session = { edge: true };
        } else {
          /* Dès le début du geste : page suivante déjà montée à côté */
          session = createWeekSlideSession(dir, targetIndex);
          if (!session) {
            dragging = false;
            locked = false;
            zone.classList.remove("is-dragging");
            return;
          }
          const pos = dir > 0 ? rawX : -session.step + rawX;
          setSessionX(session, pos, false);
        }
      }

      if (e.cancelable) e.preventDefault();
      dx = rawX;

      if (session?.edge) {
        const resisted = dx * 0.28;
        if (els.list) {
          els.list.style.transition = "none";
          els.list.style.transform = `translate3d(${resisted}px, 0, 0)`;
        }
        const panel = document.getElementById("week-nav-panel");
        if (panel) {
          panel.style.transition = "none";
          panel.style.transform = `translate3d(${resisted * 0.45}px, 0, 0)`;
        }
        return;
      }

      if (!session) return;
      const pos = session.dir > 0 ? dx : -session.step + dx;
      setSessionX(session, pos, false);
      updateWeekProgress(currentWeeks().length, weekIndex - dx / session.step);
    },
    { passive: false }
  );

  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    zone.classList.remove("is-dragging");

    if (!locked) {
      updateWeekProgress(currentWeeks().length, weekIndex);
      return;
    }
    locked = false;

    if (session?.edge) {
      if (els.list) {
        els.list.style.transition = "transform 0.22s cubic-bezier(0.22, 1, 0.36, 1)";
        els.list.style.transform = "translate3d(0,0,0)";
      }
      const panel = document.getElementById("week-nav-panel");
      if (panel) {
        panel.style.transition = "transform 0.22s cubic-bezier(0.22, 1, 0.36, 1)";
        panel.style.transform = "translate3d(0,0,0)";
      }
      session = null;
      updateWeekProgress(currentWeeks().length, weekIndex);
      return;
    }

    if (!session) return;

    const dt = Math.max(16, performance.now() - startT);
    const vx = dx / dt;
    const pass = session.width * 0.2;
    const commit =
      session.dir > 0 ? dx < -pass || vx < -0.45 : dx > pass || vx > 0.45;

    animateSession(session, commit);
    session = null;
  };

  zone.addEventListener("touchend", endDrag, { passive: true });
  zone.addEventListener("touchcancel", endDrag, { passive: true });
})();

document.querySelectorAll(".filter-trigger").forEach((btn) => {
  btn.addEventListener("click", () => openDrawer(btn.dataset.filter));
});

els.drawerOptions.addEventListener("click", (e) => {
  const opt = e.target.closest(".drawer-option");
  if (opt) applyDrawerValue(opt.dataset.value);
});

document.getElementById("drawer-close").addEventListener("click", closeDrawer);
els.backdrop.addEventListener("click", closeDrawer);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && els.drawer.classList.contains("is-open")) closeDrawer();
});

document.getElementById("filters-reset").addEventListener("click", () => {
  clubFilter = "";
  weekIndex = 0;
  render();
});

document.querySelectorAll(".sub-tabs__tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    const id = tab.dataset.competition;
    const comp = id === "pl" ? "premier-league" : "champions-league";
    const lang = typeof pfLang === "function" ? pfLang() : "fr";
    const ici = decodeURIComponent(window.location.pathname || "").toLowerCase();
    const avecLangue = lang && lang !== "fr" || /(?:^|\/|-)(en|es|de|it|pt|nl|english|anglais|espanol|deutsch|italiano|portugues|nederlands)(?:-|$)/.test(ici);
    const path = avecLangue ? `/${lang}-${comp}` : `/${comp}`;
    if (window.location.pathname.replace(/\/+$/, "") !== path) {
      history.pushState({ competition: id }, "", path);
    }
    setCompetition(id);
  });
});

window.addEventListener("popstate", () => setCompetition(competitionDepuisUrl()));

bindCartUI();
render();

window.addEventListener("pf-lang", () => {
  render();
});

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

  panel.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", close);
  });

  window.addEventListener("resize", () => {
    if (window.matchMedia("(min-width: 900px)").matches) close();
  });
})();

(function bindReveals() {
  const nodes = document.querySelectorAll(".partners, .aide-section, .pl-footer");
  if (!nodes.length) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        io.unobserve(entry.target);
      });
    },
    { threshold: 0.18, rootMargin: "0px 0px -8% 0px" }
  );
  nodes.forEach((el) => {
    el.classList.add("reveal");
    io.observe(el);
  });
})();
