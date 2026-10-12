(function () {
  const login = document.getElementById("compte-login");
  const espace = document.getElementById("compte-espace");
  const form = document.getElementById("lookup-form");
  const msg = document.getElementById("lookup-msg");
  const corps = document.getElementById("cp-corps");
  const menu = document.getElementById("cp-menu");
  if (!login || !espace || !form || !corps) return;

  let etat = {
    email: "",
    orders: [],
    commandes: [],
    demandes: [],
    profil: null,
    stats: { billets: 0, commandes: 0, demandes: 0 },
  };

  const PAGES = [
    "accueil",
    "billets",
    "commandes",
    "informations",
    "telecharger",
    "modifier",
    "annuler",
    "renvoi",
    "aide",
    "contact",
    "demandes",
    "securite",
  ];

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function pageCourante() {
    const hash = (location.hash || "#accueil").replace(/^#/, "");
    return PAGES.includes(hash) ? hash : "accueil";
  }

  function nbBilletsLabel(n) {
    return n > 1 ? `${n} billets` : `${n} billet`;
  }

  function dateCourte(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
    return d.toLocaleDateString("fr-FR");
  }

  async function api(body, timeoutMs = 20000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch("/api/billets", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      return await res.json().catch(() => ({}));
    } finally {
      clearTimeout(timer);
    }
  }

  function appliquerResume(payload) {
    etat = {
      email: payload.email || "",
      orders: Array.isArray(payload.orders) ? payload.orders : [],
      commandes: Array.isArray(payload.commandes) ? payload.commandes : [],
      demandes: Array.isArray(payload.demandes) ? payload.demandes : [],
      profil: payload.profil || { email: payload.email || "" },
      stats: payload.stats || {
        billets: (payload.orders || []).reduce(
          (s, o) => s + (o.items || []).reduce((n, i) => n + (i.tickets || []).length, 0),
          0
        ),
        commandes: (payload.commandes || payload.orders || []).length,
        demandes: (payload.demandes || []).filter((d) => d.statut === "en_cours").length,
      },
    };
  }

  function resumeLocal(email, orders) {
    const commandes = orders.map((order) => ({
      id: order.ref,
      ref: order.ref,
      date: order.created,
      total: order.total,
      statut: "Confirmée",
      payee: true,
      items: (order.items || []).map((item) => ({
        title: item.title,
        qty: item.qty,
        category: item.category,
        date: item.date,
      })),
    }));
    return {
      ok: true,
      email,
      orders,
      commandes,
      demandes: JSON.parse(localStorage.getItem(`pf-demandes:${email}`) || "[]"),
      profil: JSON.parse(localStorage.getItem(`pf-profil:${email}`) || "null") || {
        email,
        prenom: "",
        nom: "",
        telephone: "",
        adresse: "",
        codePostal: "",
        ville: "",
        pays: "FR",
      },
      stats: {
        billets: orders.reduce((s, o) => s + (o.items || []).reduce((n, i) => n + (i.tickets || []).length, 0), 0),
        commandes: commandes.length,
        demandes: (JSON.parse(localStorage.getItem(`pf-demandes:${email}`) || "[]") || []).filter((d) => d.statut === "en_cours")
          .length,
      },
    };
  }

  function showLogin(error) {
    login.hidden = false;
    espace.hidden = true;
    document.body.classList.remove("is-compte");
    if (msg) msg.innerHTML = error ? `<p class="legal-note">${esc(error)}</p>` : "";
  }

  function showEspace() {
    login.hidden = true;
    espace.hidden = false;
    document.body.classList.add("is-compte");
    const initiale = (etat.profil?.prenom || etat.email || "C").trim().charAt(0).toUpperCase() || "C";
    const elInit = document.getElementById("cp-initiale");
    const elMail = document.getElementById("cp-email");
    const elNb = document.getElementById("cp-nb-billets");
    if (elInit) elInit.textContent = initiale;
    if (elMail) elMail.textContent = etat.email;
    if (elNb) elNb.textContent = nbBilletsLabel(etat.stats.billets);
    paint();
  }

  function optionsCommandes(payeesSeulement) {
    const liste = payeesSeulement ? etat.commandes.filter((c) => c.payee !== false) : etat.commandes;
    if (!liste.length) return `<option value="">Aucune commande</option>`;
    return liste.map((c) => `<option value="${esc(c.ref)}">${esc(c.ref)} — ${esc(c.statut)}</option>`).join("");
  }

  function vueAccueil() {
    const s = etat.stats;
    return `
      <p class="compte-kicker">Espace client</p>
      <h1>Mon compte</h1>
      <p class="cp-lead">Tes billets, commandes et demandes au même endroit.</p>
      <div class="cp-grille">
        <a class="cp-carte" href="#billets"><strong>${s.billets}</strong><span>Billets</span></a>
        <a class="cp-carte" href="#commandes"><strong>${s.commandes}</strong><span>Commandes</span></a>
        <a class="cp-carte" href="#demandes"><strong>${s.demandes}</strong><span>Demandes en cours</span></a>
      </div>`;
  }

  function vueBillets(telecharger) {
    const html =
      typeof ordersBlock === "function"
        ? ordersBlock(etat.orders)
        : etat.orders.map((order) => orderBlock(order)).join("");
    const boutons = telecharger
      ? `<div class="cp-actions-tickets">${etat.orders
          .flatMap((order) =>
            (order.items || []).flatMap((item) =>
              (item.tickets || []).map(
                (ticket) =>
                  `<button type="button" class="btn-outline" data-pdf="${esc(ticket.code)}">PDF ${esc(ticket.code)}</button>`
              )
            )
          )
          .join("")}</div>`
      : "";
    return `
      <h1>${telecharger ? "Télécharger mon billet" : "Mes billets"}</h1>
      <p class="cp-lead">${
        telecharger
          ? "Télécharge chaque e-billet en PDF. Ils restent aussi visibles dans Mes billets."
          : "Chaque place a son QR. Présente-le à l’entrée."
      }</p>
      ${boutons}
      ${html || `<p class="legal-note">Aucun billet sur ce compte pour le moment.</p>`}`;
  }

  function vueCommandes() {
    if (!etat.commandes.length) return `<h1>Mes commandes</h1><p class="legal-note">Aucune commande.</p>`;
    const rows = etat.commandes
      .map(
        (c) => `<tr>
        <td><strong>${esc(c.ref)}</strong></td>
        <td>${esc(dateCourte(c.date))}</td>
        <td>${esc(c.total)} €</td>
        <td>${esc(c.statut)}</td>
      </tr>`
      )
      .join("");
    return `
      <h1>Mes commandes</h1>
      <div class="cp-table-wrap"><table class="cp-table">
        <thead><tr><th>N°</th><th>Date</th><th>Total</th><th>Statut</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>`;
  }

  function vueInformations() {
    const p = etat.profil || {};
    return `
      <h1>Mes informations</h1>
      <p class="cp-lead">E-mail de compte : <strong>${esc(etat.email)}</strong></p>
      <form class="cp-form" id="form-profil">
        <label><span>Prénom</span><input name="prenom" value="${esc(p.prenom || "")}" /></label>
        <label><span>Nom</span><input name="nom" value="${esc(p.nom || "")}" /></label>
        <label><span>Téléphone</span><input name="telephone" value="${esc(p.telephone || "")}" /></label>
        <label><span>Adresse</span><input name="adresse" value="${esc(p.adresse || "")}" /></label>
        <label><span>Code postal</span><input name="codePostal" value="${esc(p.codePostal || "")}" /></label>
        <label><span>Ville</span><input name="ville" value="${esc(p.ville || "")}" /></label>
        <label><span>Pays</span><input name="pays" value="${esc(p.pays || "FR")}" maxlength="2" /></label>
        <button type="submit" class="btn-primary">Enregistrer</button>
        <p class="cp-flash" id="profil-flash" hidden></p>
      </form>`;
  }

  function vueDemande(titre, type, lead, champsExtra) {
    return `
      <h1>${esc(titre)}</h1>
      <p class="cp-lead">${esc(lead)}</p>
      <form class="cp-form" data-demande="${esc(type)}">
        <label><span>Commande</span><select name="numero" required>${optionsCommandes(true)}</select></label>
        ${champsExtra || ""}
        <label><span>Message</span><textarea name="resume" rows="4" required placeholder="Décris ta demande"></textarea></label>
        <button type="submit" class="btn-primary">Envoyer la demande</button>
        <p class="cp-flash" hidden></p>
      </form>`;
  }

  function vueRenvoi() {
    const cartes = etat.commandes
      .filter((c) => c.payee !== false)
      .map(
        (c) => `<article class="cp-card-soft">
        <p><strong>${esc(c.ref)}</strong> · ${esc(c.statut)}</p>
        <button type="button" class="btn-primary" data-renvoi="${esc(c.ref)}">Renvoyer mes billets</button>
      </article>`
      )
      .join("");
    return `
      <h1>Billet non reçu</h1>
      <p class="cp-lead">On renvoie l’e-mail de confirmation avec ton accès à l’espace client.</p>
      <div class="cp-liste" id="renvoi-liste">${cartes || `<p class="legal-note">Aucune commande payée.</p>`}</div>
      <p class="cp-flash" id="renvoi-flash" hidden></p>`;
  }

  function vueAide() {
    const faq = [
      ["Où sont mes billets ?", "Dans Mes billets, une fois connecté. Le code d’accès arrive par e-mail."],
      ["J’ai perdu mon code d’accès", "Depuis Sécurité & code d’accès, change-le si tu as encore l’ancien. Sinon contacte le support."],
      ["Puis-je modifier une réservation ?", "Oui, depuis Modifier une réservation. Une demande part au support."],
      ["Comment annuler ?", "Depuis Annuler / remboursement. La raison est obligatoire."],
      ["Le match est reporté", "Le billet reste valable pour la nouvelle date, sauf indication contraire."],
    ];
    return `
      <h1>Centre d’aide</h1>
      <div class="cp-liste">${faq
        .map((item) => `<article class="cp-card-soft"><h2>${esc(item[0])}</h2><p>${esc(item[1])}</p></article>`)
        .join("")}</div>`;
  }

  function vueContact() {
    return `
      <h1>Contacter le service client</h1>
      <p class="cp-lead">Une demande est créée et transmise au support.</p>
      <form class="cp-form" data-demande="message">
        <label><span>Sujet</span><input name="sujet" required placeholder="Objet du message" /></label>
        <label><span>Message</span><textarea name="resume" rows="5" required></textarea></label>
        <button type="submit" class="btn-primary">Envoyer</button>
        <p class="cp-flash" hidden></p>
      </form>`;
  }

  function vueDemandes() {
    if (!etat.demandes.length) return `<h1>Suivre ma demande</h1><p class="legal-note">Aucune demande pour le moment.</p>`;
    return `
      <h1>Suivre ma demande</h1>
      <div class="cp-liste">${etat.demandes
        .map(
          (d) => `<article class="cp-card-soft">
          <p class="cp-meta">${esc(d.typeLabel || d.type)} · ${esc(d.numero || "")} · ${esc(dateCourte(d.creeLe))}</p>
          <p><strong>${d.statut === "faite" ? "Traitée" : "En cours"}</strong></p>
          <p>${esc(d.resume || "")}</p>
        </article>`
        )
        .join("")}</div>`;
  }

  function vueSecurite() {
    return `
      <h1>Sécurité & code d’accès</h1>
      <p class="cp-lead">Change le code reçu par e-mail. Il ouvre tout ton espace client.</p>
      <form class="cp-form" id="form-code">
        <label><span>Code actuel</span><input name="actuel" required autocomplete="current-password" /></label>
        <label><span>Nouveau code</span><input name="nouveau" required autocomplete="new-password" minlength="8" /></label>
        <label><span>Confirmer</span><input name="confirm" required autocomplete="new-password" minlength="8" /></label>
        <button type="submit" class="btn-primary">Mettre à jour</button>
        <p class="cp-flash" hidden></p>
      </form>`;
  }

  function htmlPage(id) {
    switch (id) {
      case "accueil":
        return vueAccueil();
      case "billets":
        return vueBillets(false);
      case "telecharger":
        return vueBillets(true);
      case "commandes":
        return vueCommandes();
      case "informations":
        return vueInformations();
      case "modifier":
        return vueDemande(
          "Modifier une réservation",
          "echange",
          "Indique le match ou la catégorie souhaités. Le support traite la demande.",
          `<label><span>Modification souhaitée</span><input name="detail" required placeholder="Ex. Cat. 2 au lieu de Cat. 1" /></label>`
        );
      case "annuler":
        return vueDemande(
          "Annuler / demander un remboursement",
          "annulation",
          "La raison est obligatoire. Les billets pourront être invalidés après traitement."
        );
      case "renvoi":
        return vueRenvoi();
      case "aide":
        return vueAide();
      case "contact":
        return vueContact();
      case "demandes":
        return vueDemandes();
      case "securite":
        return vueSecurite();
      default:
        return vueAccueil();
    }
  }

  function paint() {
    const id = pageCourante();
    corps.innerHTML = htmlPage(id);
    menu?.querySelectorAll("[data-cp]").forEach((lien) => {
      lien.classList.toggle("is-active", lien.getAttribute("data-cp") === id);
    });
    menu?.classList.remove("is-ouvert");
    const bascule = document.getElementById("cp-bascule");
    if (bascule) bascule.setAttribute("aria-expanded", "false");
    bindPage(id);
  }

  function flash(el, texte, ok) {
    if (!el) return;
    el.hidden = false;
    el.textContent = texte;
    el.classList.toggle("is-ok", Boolean(ok));
    el.classList.toggle("is-err", !ok);
  }

  function stockerDemandeLocale(demande) {
    const key = `pf-demandes:${etat.email}`;
    const liste = JSON.parse(localStorage.getItem(key) || "[]");
    liste.unshift(demande);
    localStorage.setItem(key, JSON.stringify(liste.slice(0, 40)));
    etat.demandes = liste;
    etat.stats.demandes = liste.filter((d) => d.statut === "en_cours").length;
  }

  function bindPage(id) {
    const formProfil = document.getElementById("form-profil");
    if (formProfil) {
      formProfil.addEventListener("submit", async (event) => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(formProfil).entries());
        const el = document.getElementById("profil-flash");
        try {
          const payload = await api({ action: "profil", ...data });
          if (payload.ok) {
            etat.profil = payload.profil;
            localStorage.setItem(`pf-profil:${etat.email}`, JSON.stringify(etat.profil));
            flash(el, "Informations enregistrées.", true);
            return;
          }
        } catch {
          /* local */
        }
        etat.profil = { email: etat.email, ...data };
        localStorage.setItem(`pf-profil:${etat.email}`, JSON.stringify(etat.profil));
        flash(el, "Informations enregistrées sur cet appareil.", true);
      });
    }

    corps.querySelectorAll("form[data-demande]").forEach((f) => {
      f.addEventListener("submit", async (event) => {
        event.preventDefault();
        const type = f.getAttribute("data-demande");
        const data = new FormData(f);
        const detail = String(data.get("detail") || data.get("sujet") || "").trim();
        const resume = [detail, String(data.get("resume") || "").trim()].filter(Boolean).join(" — ");
        const numero = String(data.get("numero") || "");
        const el = f.querySelector(".cp-flash");
        try {
          const payload = await api({ action: "demande", type, resume, numero });
          if (payload.ok) {
            etat.demandes = [payload.demande, ...etat.demandes];
            etat.stats.demandes += 1;
            flash(el, "Demande envoyée. Tu peux la suivre dans Suivre ma demande.", true);
            f.reset();
            return;
          }
        } catch {
          /* local */
        }
        const demande = {
          id: `local-${Date.now()}`,
          type,
          typeLabel: type,
          statut: "en_cours",
          creeLe: new Date().toISOString(),
          resume,
          numero: numero || etat.commandes[0]?.ref || "",
        };
        stockerDemandeLocale(demande);
        flash(el, "Demande enregistrée (hors ligne). Elle sera envoyée dès que le serveur répond.", true);
        f.reset();
      });
    });

    corps.querySelectorAll("[data-renvoi]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const el = document.getElementById("renvoi-flash");
        try {
          const payload = await api({ action: "renvoi", numero: btn.getAttribute("data-renvoi") });
          if (payload.ok) {
            flash(el, `E-mail renvoyé pour ${payload.ref}.`, true);
            return;
          }
          flash(el, payload.message || "Envoi impossible pour le moment.", false);
        } catch {
          flash(el, "Hors ligne : impossible de renvoyer l’e-mail maintenant.", false);
        }
      });
    });

    corps.querySelectorAll("[data-pdf]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const code = btn.getAttribute("data-pdf");
        try {
          const payload = await api({ action: "pdf", ticket: code });
          if (payload.ok && payload.pdf) {
            const a = document.createElement("a");
            a.href = `data:application/pdf;base64,${payload.pdf}`;
            a.download = payload.filename || `${code}.pdf`;
            a.click();
            return;
          }
        } catch {
          /* ignore */
        }
        alert("PDF indisponible pour le moment. Tes billets restent visibles dans Mes billets.");
      });
    });

    const formCode = document.getElementById("form-code");
    if (formCode) {
      formCode.addEventListener("submit", async (event) => {
        event.preventDefault();
        const data = new FormData(formCode);
        const el = formCode.querySelector(".cp-flash");
        if (String(data.get("nouveau")) !== String(data.get("confirm"))) {
          flash(el, "La confirmation ne correspond pas.", false);
          return;
        }
        try {
          const payload = await api({
            action: "code",
            actuel: data.get("actuel"),
            nouveau: data.get("nouveau"),
          });
          if (payload.ok) {
            flash(el, "Code d’accès mis à jour.", true);
            formCode.reset();
            return;
          }
          flash(el, payload.message || "Impossible de changer le code.", false);
        } catch {
          flash(el, "Hors ligne : changement de code indisponible.", false);
        }
      });
    }

    if (id === "accueil" || id === "billets" || id === "telecharger") {
      /* already painted */
    }
  }

  async function chargerSession() {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 15000);
      const res = await fetch("/api/billets", { credentials: "same-origin", signal: ctrl.signal });
      clearTimeout(timer);
      const payload = await res.json().catch(() => ({}));
      if (payload.ok && payload.email) {
        appliquerResume(payload);
        showEspace();
        return;
      }
    } catch {
      /* login */
    }
    showLogin();
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const email = String(data.get("email") || "").trim();
    const code = String(data.get("code") || "").trim();
    const btn = form.querySelector('button[type="submit"]');
    const prev = btn ? btn.textContent : "";
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Connexion…";
    }
    try {
      const payload = await api({ email, code });
      if (payload.pending) {
        showLogin("Le paiement de cette commande n'est pas encore confirmé.");
        return;
      }
      if (payload.ok && payload.email) {
        appliquerResume(payload);
        if (!location.hash) location.hash = "#accueil";
        showEspace();
        return;
      }
    } catch {
      /* local */
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = prev || "Se connecter";
      }
    }
    if (typeof findByMailAndCode === "function") {
      const found = findByMailAndCode(email, code);
      if (found) {
        appliquerResume(resumeLocal(email, [found.order]));
        if (!location.hash) location.hash = "#accueil";
        showEspace();
        return;
      }
    }
    showLogin(typeof t === "function" ? t("order.none") : "E-mail ou code d’accès incorrect.");
  });

  document.getElementById("cp-logout")?.addEventListener("click", async () => {
    try {
      await api({ action: "logout" });
    } catch {
      /* ignore */
    }
    form.reset();
    etat = { email: "", orders: [], commandes: [], demandes: [], profil: null, stats: { billets: 0, commandes: 0, demandes: 0 } };
    location.hash = "";
    showLogin();
  });

  document.getElementById("cp-bascule")?.addEventListener("click", () => {
    const ouvert = menu.classList.toggle("is-ouvert");
    document.getElementById("cp-bascule")?.setAttribute("aria-expanded", ouvert ? "true" : "false");
  });

  window.addEventListener("hashchange", () => {
    if (!espace.hidden) paint();
  });

  chargerSession();
})();
