(function () {
  const root = document.getElementById("aide");
  if (!root) return;

  const buttons = [...root.querySelectorAll("[data-aide]")];
  const panels = [...root.querySelectorAll("[data-aide-panel]")];
  const panelsWrap = root.querySelector(".aide-panels");

  function activeKey() {
    const btn = buttons.find((b) => b.classList.contains("is-active"));
    return btn ? btn.getAttribute("data-aide") : null;
  }

  function show(key, scroll) {
    const k = key || null;

    buttons.forEach((btn) => {
      const on = Boolean(k) && btn.getAttribute("data-aide") === k;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
      btn.setAttribute("aria-expanded", on ? "true" : "false");
    });

    panels.forEach((panel) => {
      panel.hidden = !k || panel.getAttribute("data-aide-panel") !== k;
    });

    root.classList.toggle("is-open", Boolean(k));
    if (panelsWrap) panelsWrap.hidden = !k;

    if (scroll && k) root.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function close() {
    show(null, false);
    history.replaceState(null, "", "#aide");
  }

  function open(key, scroll) {
    show(key, scroll);
    history.replaceState(null, "", "#aide-" + key);
  }

  function toggle(key, scroll) {
    if (!key) return;
    if (activeKey() === key) close();
    else open(key, scroll);
  }

  function keyFromHash() {
    const h = (location.hash || "").replace(/^#/, "");
    if (!h || h === "aide") return null;
    if (h.startsWith("aide-")) return h.slice(5);
    return null;
  }

  buttons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      toggle(btn.getAttribute("data-aide"), false);
    });
  });

  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#aide"]');
    if (!a) return;
    const href = a.getAttribute("href") || "";
    const key = href === "#aide" ? null : href.startsWith("#aide-") ? href.slice(6) : null;
    e.preventDefault();
    if (!key) {
      history.pushState(null, "", "#aide");
      show(null, true);
      root.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (activeKey() === key) {
      close();
      root.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      history.pushState(null, "", "#aide-" + key);
      show(key, true);
    }
  });

  window.addEventListener("hashchange", () => {
    const key = keyFromHash();
    show(key, Boolean(key) || (location.hash || "") === "#aide");
    if ((location.hash || "") === "#aide") {
      root.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  // Start closed unless a specific panel is in the URL
  const initial = keyFromHash();
  show(initial, Boolean(initial));
})();
