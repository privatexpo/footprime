(function () {
  const header = `
  <a class="skip-link" href="#page-main" data-i18n="nav.skipPlace">Aller au contenu</a>
  <header class="main-nav">
    <div class="shell main-nav__inner">
      <button type="button" class="icon-btn main-nav__menu" id="nav-menu-btn" data-i18n-aria="nav.menu" aria-label="Menu" aria-expanded="false" aria-controls="mobile-nav">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </button>
      <a class="logo" href="index.html" aria-label="Prime Football">
        <img class="logo__img" src="logos/prime-football.png" alt="" width="1000" height="293" />
      </a>
      <nav class="main-nav__links" aria-label="Navigation principale">
        <a href="index.html#matchs" data-i18n="nav.matches">Matchs</a>
        <a href="index.html#matchs" data-i18n="nav.tickets">Billetterie</a>
      </nav>
      <div class="main-nav__actions">
        <div class="lang" data-lang>
          <button type="button" class="lang-btn" aria-haspopup="listbox" aria-expanded="false" aria-label="Français"></button>
          <ul class="lang-menu" role="listbox" hidden></ul>
        </div>
        <button type="button" class="btn-outline" id="cart-btn">
          <span class="btn-outline__label" data-i18n="nav.cart">Panier</span> <span id="cart-count">0</span>
        </button>
      </div>
    </div>
    <nav class="mobile-nav" id="mobile-nav" hidden>
      <a href="index.html#matchs">
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 3.5v3M16 3.5v3M4 9.5h16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        <span data-i18n="nav.matches">Matchs</span>
      </a>
      <a href="billets.html">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 8.5A2 2 0 0 1 6.5 6.5h11a2 2 0 0 1 2 2v1.8a1.7 1.7 0 0 0 0 3.4v1.8a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-1.8a1.7 1.7 0 0 0 0-3.4V8.5z" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>
        <span data-i18n="footer.tickets">Mes billets</span>
      </a>
      <a href="contact.html">
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="6" width="17" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M4 7.5 12 13l8-5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span data-i18n="nav.contact">Contact</span>
      </a>
    </nav>
  </header>`;

  const footer = `
  <footer class="site-footer">
    <div class="shell">
      <div class="pl-footer">
        <div class="footer-cols">
          <section>
            <h2 data-i18n="footer.connect">Contact</h2>
            <ul>
              <li><a class="footer-link" href="contact.html" data-i18n="footer.contact">Contact</a></li>
              <li><a class="footer-link" href="billets.html" data-i18n="footer.tickets">Mes billets</a></li>
            </ul>
          </section>
          <section>
            <h2>Prime Football</h2>
            <ul>
              <li><a class="footer-link" href="a-propos.html" data-i18n="footer.about">À propos</a></li>
              <li><a class="footer-link" href="mentions-legales.html" data-i18n="footer.mentions">Mentions légales</a></li>
              <li><a class="footer-link" href="cookies.html" data-i18n="footer.cookies">Cookies</a></li>
            </ul>
          </section>
          <section>
            <h2 data-i18n="footer.support">Aide</h2>
            <ul>
              <li><a class="footer-link" href="faq.html" data-i18n="footer.faq">FAQ</a></li>
              <li><a class="footer-link" href="cgv.html" data-i18n="footer.cgv">Conditions générales de vente</a></li>
              <li><a class="footer-link" href="confidentialite.html" data-i18n="footer.privacy">Confidentialité</a></li>
            </ul>
          </section>
        </div>
        <div class="pl-footer__bar">
          <a class="pl-footer__brand" href="index.html" aria-label="Prime Football">
            <img src="logos/prime-football.png" alt="" width="1000" height="293" />
          </a>
          <p class="pl-footer__copy" data-i18n="footer.copy">© 2026 Prime Football. Tous droits réservés.</p>
        </div>
      </div>
    </div>
  </footer>
  <dialog class="dialog" id="cart-dialog" aria-labelledby="cart-dialog-title">
    <div class="dialog__panel">
      <button type="button" class="dialog__close" id="cart-close" data-i18n-aria="filters.close" aria-label="Fermer">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M3 3l8 8M11 3L3 11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </button>
      <h2 id="cart-dialog-title" data-i18n="cart.title">Ton panier</h2>
      <ul class="cart-list" id="cart-list"></ul>
      <div class="dialog__footer">
        <p><span data-i18n="place.total">Total</span> <strong id="cart-total">0 €</strong></p>
        <button type="button" class="btn-primary" id="checkout-btn" data-i18n="cart.checkout">Valider la commande</button>
      </div>
    </div>
  </dialog>
  <div class="toast" id="toast" role="status" aria-live="polite" hidden></div>`;

  const top = document.getElementById("chrome-top");
  const bottom = document.getElementById("chrome-bottom");
  if (top) top.outerHTML = header;
  if (bottom) bottom.outerHTML = footer;

  const nav = document.querySelector(".main-nav");
  const btn = document.getElementById("nav-menu-btn");
  const panel = document.getElementById("mobile-nav");
  if (nav && btn && panel) {
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
  }

  if (typeof bindCartUI === "function") bindCartUI();
})();
