(function () {
  function escHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function badgeImg(src, name) {
    if (!src) return `<span class="basket-badge basket-badge--empty" aria-hidden="true"></span>`;
    return `<img class="basket-badge" src="${escHtml(src)}" alt="${escHtml(name || "")}">`;
  }

  function cartLine(item, index) {
    const face = typeof facesOf === "function" ? facesOf(item) : item;
    const side = item.qty > 1 ? ` · ${t("order.side")}` : "";
    const when = item.kickoff ? `${item.date} · ${item.kickoff}` : item.date;
    const where = [item.competition, item.stadium].filter(Boolean).join(" · ");
    return `<li class="basket-line">
      <div class="basket-match" aria-hidden="true">
        ${badgeImg(face.homeLogo, face.home)}
        <span class="basket-vs">vs</span>
        ${badgeImg(face.awayLogo, face.away)}
      </div>
      <div class="basket-line__body">
        <p class="basket-line__title">${escHtml(item.title)}</p>
        <p class="basket-line__meta">${escHtml(where)}</p>
        <p class="basket-line__meta">${escHtml(when)} · ${escHtml(item.category)} · ×${item.qty}${escHtml(side)}</p>
      </div>
      <div class="basket-line__end">
        <p class="basket-line__price">${item.price * item.qty} €</p>
        ${
          Number.isInteger(index)
            ? `<button type="button" class="basket-remove" data-remove="${index}">${escHtml(t("cart.remove"))}</button>`
            : ""
        }
      </div>
    </li>`;
  }

  function removeLine(index, repaint) {
    const cart = loadCart();
    cart.splice(index, 1);
    saveCart(cart);
    if (typeof bindCartUI === "function") bindCartUI();
    repaint();
  }

  const lines = document.getElementById("checkout-lines");
  const form = document.getElementById("checkout-form");
  if (lines && form) {
    const ready = document.getElementById("checkout-ready");
    const empty = document.getElementById("checkout-empty");
    const totalEl = document.getElementById("checkout-total");

    function paintCart() {
      const cart = loadCart();
      const has = cart.length > 0;
      if (ready) ready.hidden = !has;
      if (empty) empty.hidden = has;
      if (!has) {
        lines.innerHTML = "";
        if (totalEl) totalEl.textContent = "0 €";
        return;
      }
      lines.innerHTML = cart.map((item) => cartLine(item)).join("");
      if (totalEl) totalEl.textContent = `${cart.reduce((sum, item) => sum + item.price * item.qty, 0)} €`;
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const cart = loadCart();
      if (holdDeadline() && holdLeft() <= 0) {
        releaseHold();
        paintCart();
        return;
      }
      if (!cart.length) {
        paintCart();
        return;
      }
      const data = new FormData(form);
      const order = createOrder({
        name: String(data.get("name") || ""),
        email: String(data.get("email") || ""),
        cart,
      });
      saveCart([]);
      localStorage.removeItem(HOLD_KEY);
      if (typeof bindCartUI === "function") bindCartUI();
      window.location.href = `commande.html?ref=${encodeURIComponent(order.ref)}`;
    });

    paintCart();
    window.addEventListener("pf-lang", paintCart);
  }

  const cartLines = document.getElementById("cart-lines");
  const cartReady = document.getElementById("cart-ready");
  if (cartLines && cartReady) {
    const cartEmpty = document.getElementById("cart-empty");
    const cartTotal = document.getElementById("cart-page-total");

    const holdEl = document.getElementById("cart-hold");
    const expiredEl = document.getElementById("cart-expired");
    const emptyNote = document.getElementById("cart-empty-note");
    const checkoutLink = document.getElementById("cart-checkout");
    let holdEnded = false;

    const holdTime = document.getElementById("cart-hold-time");

    function paintHoldTime() {
      if (holdTime) holdTime.textContent = formatHold(holdLeft());
    }

    function paintClock() {
      if (!holdEl || holdEl.hidden) return;
      if (holdDeadline() && holdLeft() <= 0) {
        paintPage();
        return;
      }
      paintHoldTime();
    }

    function paintPage() {
      let cart = loadCart();
      const deadline = holdDeadline();
      if (cart.length && deadline > 0 && holdLeft() <= 0) {
        releaseHold();
        cart = [];
        holdEnded = true;
      } else if (cart.length && !deadline) {
        startHold();
      }
      const has = cart.length > 0;
      cartReady.hidden = !has;
      if (cartEmpty) cartEmpty.hidden = has;
      if (expiredEl) expiredEl.hidden = !holdEnded;
      if (emptyNote) emptyNote.hidden = holdEnded;
      if (!has) {
        cartLines.innerHTML = "";
        if (cartTotal) cartTotal.textContent = "0 €";
        if (holdEl) holdEl.hidden = true;
        return;
      }
      holdEnded = false;
      cartLines.innerHTML = cart.map(cartLine).join("");
      if (cartTotal) cartTotal.textContent = `${cart.reduce((sum, item) => sum + item.price * item.qty, 0)} €`;
      if (holdEl) {
        holdEl.hidden = false;
        paintHoldTime();
      }
    }

    cartLines.addEventListener("click", (event) => {
      const button = event.target.closest("[data-remove]");
      if (!button) return;
      removeLine(Number(button.getAttribute("data-remove")), paintPage);
    });
    checkoutLink?.addEventListener("click", (event) => {
      if (holdDeadline() && holdLeft() <= 0) {
        event.preventDefault();
        paintPage();
      }
    });
    paintPage();
    window.addEventListener("pf-lang", paintPage);
    window.setInterval(paintClock, 1000);
  }

  const lookup = document.getElementById("lookup-form");
  const lookupRoot = document.getElementById("lookup-root");
  if (lookup && lookupRoot) {
    function show(email, code) {
      if (!String(email || "").trim() || !String(code || "").trim()) {
        lookupRoot.innerHTML = "";
        return;
      }
      const found = findByMailAndCode(email, code);
      lookupRoot.innerHTML = found ? orderBlock(found.order) : `<p class="legal-note">${t("order.none")}</p>`;
    }
    lookup.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(lookup);
      show(data.get("email"), data.get("code"));
    });
    window.addEventListener("pf-lang", () => {
      const data = new FormData(lookup);
      if (lookupRoot.innerHTML) show(data.get("email"), data.get("code"));
    });
  }

  const orderRoot = document.getElementById("order-root");
  if (orderRoot && !lookup) {
    const params = new URLSearchParams(window.location.search);
    function paint() {
      const code = params.get("code");
      const ref = params.get("ref");
      if (code) {
        const found = findTicket(code);
        orderRoot.innerHTML = found
          ? `<p class="order-block__head"><span>${t("order.ref")}</span> <strong>${found.order.ref}</strong></p>${ticketCard(found.order, found.item, found.ticket)}`
          : `<p class="legal-note">${t("order.none")}</p>`;
        return;
      }
      const order = ref ? findOrder(ref) : null;
      orderRoot.innerHTML = order ? orderBlock(order) : `<p class="legal-note">${t("order.none")}</p>`;
    }
    paint();
    window.addEventListener("pf-lang", paint);
  }
})();
