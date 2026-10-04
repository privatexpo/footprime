(function () {
  const KEY = "prime-football-lang";
  const LANGS = [
    { id: "fr", label: "Français" },
    { id: "en", label: "English" },
    { id: "es", label: "Español" },
    { id: "de", label: "Deutsch" },
    { id: "it", label: "Italiano" },
    { id: "pt", label: "Português" },
    { id: "nl", label: "Nederlands" },
  ];

  const LANG_WORDS = {
    fr: "fr",
    francais: "fr",
    french: "fr",
    en: "en",
    english: "en",
    anglais: "en",
    es: "es",
    espanol: "es",
    spanish: "es",
    espagnol: "es",
    de: "de",
    deutsch: "de",
    german: "de",
    allemand: "de",
    it: "it",
    italiano: "it",
    italian: "it",
    italien: "it",
    pt: "pt",
    portugues: "pt",
    portuguese: "pt",
    portugais: "pt",
    nl: "nl",
    nederlands: "nl",
    dutch: "nl",
    neerlandais: "nl",
  };

  function motLangue(value) {
    const key = String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    return LANG_WORDS[key] || "";
  }

  function langueDepuisUrl() {
    const path = decodeURIComponent(window.location.pathname || "");
    for (const part of path.split(/[/\s-]+/)) {
      const lang = motLangue(part);
      if (lang) return lang;
    }
    return motLangue(new URLSearchParams(window.location.search).get("lang"));
  }

  function cheminAvecLangue(id) {
    const parts = decodeURIComponent(window.location.pathname || "").split("/").filter(Boolean);
    if (parts.length > 1) return "";
    if (!parts.length || parts[0] === "index.html") return `/${id}`;
    const bits = parts[0].split("-");
    const index = bits.findIndex((bit) => motLangue(bit));
    if (index >= 0) {
      bits[index] = id;
      return `/${bits.join("-")}`;
    }
    const brut = parts[0].toLowerCase();
    if (brut.includes("premier") || brut.includes("champions")) return `/${id}-${parts[0]}`;
    return "";
  }

  const FLAGS = {
    fr: `<svg viewBox="0 0 60 40" aria-hidden="true"><rect width="20" height="40" fill="#0055a4"/><rect x="20" width="20" height="40" fill="#fff"/><rect x="40" width="20" height="40" fill="#ef4135"/></svg>`,
    en: `<svg viewBox="0 0 60 40" aria-hidden="true"><rect width="60" height="40" fill="#012169"/><path d="M0 0l60 40M60 0L0 40" stroke="#fff" stroke-width="8"/><path d="M0 0l60 40M60 0L0 40" stroke="#c8102e" stroke-width="4"/><path d="M30 0v40M0 20h60" stroke="#fff" stroke-width="14"/><path d="M30 0v40M0 20h60" stroke="#c8102e" stroke-width="8"/></svg>`,
    es: `<svg viewBox="0 0 60 40" aria-hidden="true"><rect width="60" height="40" fill="#c60b1e"/><rect y="10" width="60" height="20" fill="#ffc400"/></svg>`,
    de: `<svg viewBox="0 0 60 40" aria-hidden="true"><rect width="60" height="13.4" fill="#000"/><rect y="13.4" width="60" height="13.3" fill="#dd0000"/><rect y="26.7" width="60" height="13.3" fill="#ffce00"/></svg>`,
    it: `<svg viewBox="0 0 60 40" aria-hidden="true"><rect width="20" height="40" fill="#009246"/><rect x="20" width="20" height="40" fill="#fff"/><rect x="40" width="20" height="40" fill="#ce2b37"/></svg>`,
    pt: `<svg viewBox="0 0 60 40" aria-hidden="true"><rect width="24" height="40" fill="#006600"/><rect x="24" width="36" height="40" fill="#ff0000"/><circle cx="24" cy="20" r="7" fill="#ffcc00"/></svg>`,
    nl: `<svg viewBox="0 0 60 40" aria-hidden="true"><rect width="60" height="13.4" fill="#ae1c28"/><rect y="13.4" width="60" height="13.3" fill="#fff"/><rect y="26.7" width="60" height="13.3" fill="#21468b"/></svg>`,
  };

  const DAYS = {
    sam: { fr: "Sam", en: "Sat", es: "Sáb", de: "Sa", it: "Sab", pt: "Sáb", nl: "Za" },
    dim: { fr: "Dim", en: "Sun", es: "Dom", de: "So", it: "Dom", pt: "Dom", nl: "Zo" },
    lun: { fr: "Lun", en: "Mon", es: "Lun", de: "Mo", it: "Lun", pt: "Seg", nl: "Ma" },
    mar: { fr: "Mar", en: "Tue", es: "Mar", de: "Di", it: "Mar", pt: "Ter", nl: "Di" },
    mer: { fr: "Mer", en: "Wed", es: "Mié", de: "Mi", it: "Mer", pt: "Qua", nl: "Wo" },
    jeu: { fr: "Jeu", en: "Thu", es: "Jue", de: "Do", it: "Gio", pt: "Qui", nl: "Do" },
    ven: { fr: "Ven", en: "Fri", es: "Vie", de: "Fr", it: "Ven", pt: "Sex", nl: "Vr" },
  };

  const MONTHS = {
    jan: { fr: "jan", en: "Jan", es: "ene", de: "Jan", it: "gen", pt: "jan", nl: "jan" },
    fev: { fr: "fev", en: "Feb", es: "feb", de: "Feb", it: "feb", pt: "fev", nl: "feb" },
    mar: { fr: "mar", en: "Mar", es: "mar", de: "Mär", it: "mar", pt: "mar", nl: "mrt" },
    avr: { fr: "avr", en: "Apr", es: "abr", de: "Apr", it: "apr", pt: "abr", nl: "apr" },
    mai: { fr: "mai", en: "May", es: "may", de: "Mai", it: "mag", pt: "mai", nl: "mei" },
    jun: { fr: "jun", en: "Jun", es: "jun", de: "Jun", it: "giu", pt: "jun", nl: "jun" },
    jul: { fr: "jul", en: "Jul", es: "jul", de: "Jul", it: "lug", pt: "jul", nl: "jul" },
    aou: { fr: "aoû", en: "Aug", es: "ago", de: "Aug", it: "ago", pt: "ago", nl: "aug" },
    sep: { fr: "sep", en: "Sep", es: "sep", de: "Sep", it: "set", pt: "set", nl: "sep" },
    oct: { fr: "oct", en: "Oct", es: "oct", de: "Okt", it: "ott", pt: "out", nl: "okt" },
    nov: { fr: "nov", en: "Nov", es: "nov", de: "Nov", it: "nov", pt: "nov", nl: "nov" },
    dec: { fr: "déc", en: "Dec", es: "dic", de: "Dez", it: "dic", pt: "dez", nl: "dec" },
  };

  const DICT = {
    fr: {
      "nav.matches": "Matchs",
      "nav.tickets": "Billetterie",
      "nav.cart": "Panier",
      "nav.search": "Rechercher",
      "nav.menu": "Menu",
      "nav.contact": "Contact",
      "nav.back": "Retour",
      "nav.skip": "Aller aux matchs",
      "nav.skipPlace": "Aller au contenu",
      "nav.backMatches": "← Retour aux matchs",
      "nav.weeks": "Sélection de semaine",
      "nav.prev": "Semaine précédente",
      "nav.next": "Semaine suivante",
      "filters.clubs": "Clubs",
      "filters.reset": "Reset",
      "filters.all": "Tous les clubs",
      "filters.close": "Fermer",
      "match.buy": "Acheter",
      "match.from": "À partir de {price}\u00a0€",
      "match.sold": "Complet",
      "match.demand": "Très demandé",
      "match.price": "Prix en hausse bientôt",
      "match.empty": "Aucun match pour ce filtre.",
      "match.weekOf": "Semaine {n} sur {total}",
      week: "Semaine",
      "footer.help": "Aide & infos",
      "footer.faq": "FAQ",
      "footer.cgv": "Conditions générales de vente",
      "footer.mentions": "Mentions légales",
      "footer.privacy": "Confidentialité",
      "footer.cookies": "Cookies",
      "footer.about": "À propos",
      "footer.contact": "Contact",
      "footer.connect": "Contact",
      "footer.support": "Aide",
      "footer.tickets": "Mes billets",
      "footer.copy": "© 2026 Prime Football. Tous droits réservés.",
      "place.eticket": "Présente ton e-billet à l’entrée : un QR code suffit.",
      "place.mail": "Retrouve tes billets avec ton e-mail et le code reçu par e-mail.",
      "place.together": "Plusieurs billets : les places sont côte à côte.",
      "place.togetherNow": "Tes {n} places seront côte à côte.",
      "checkout.title": "Tes coordonnées",
      "checkout.lead": "Un code t’est envoyé par e-mail. C’est lui qui permet de retrouver tes billets.",
      "checkout.name": "Nom",
      "checkout.email": "E-mail",
      "checkout.submit": "Passer au paiement",
      "pay.wait": "Ouverture du paiement",
      "pay.waitLead": "On prépare la page sécurisée.",
      "checkout.empty": "Ton panier est vide.",
      "order.title": "Tes e-billets",
      "order.lead": "Scanne le QR code pour vérifier le billet. Les places d’une même commande sont côte à côte.",
      "order.ref": "Commande",
      "order.sent": "E-billets associés à",
      "order.mailCode": "Code envoyé par e-mail",
      "order.mailOnly": "L’e-mail de la commande et ce code permettent de retrouver tes billets.",
      "order.find": "Retrouver mes billets",
      "order.findLead": "Entre l’e-mail de la commande et le code reçu par e-mail.",
      "order.search": "Retrouver mes billets",
      "order.none": "Aucun billet pour cet e-mail et ce code.",
      "mail.sent": "Deux e-mails envoyés",
      "mail.openInvoice": "E-mail de facturation",
      "mail.openTickets": "E-mail des e-billets",
      "mail.invoiceKicker": "Facture",
      "mail.invoiceTitle": "Ta facture",
      "mail.hello": "Bonjour {name},",
      "mail.invoiceLead": "Le paiement est confirmé. Le récapitulatif est ci-dessous. Tes e-billets partent dans un second e-mail.",
      "mail.match": "Match",
      "mail.ref": "N° de facture",
      "mail.date": "Date",
      "mail.qty": "Qté",
      "mail.amount": "Montant",
      "mail.total": "Total TTC",
      "mail.status": "Statut",
      "mail.paid": "Payée",
      "mail.ticketsKicker": "E-billets",
      "mail.ticketsTitle": "Tes e-billets",
      "mail.ticketsLead": "Voici ton code et tes e-billets en PDF. Présente chaque QR code à l’entrée du stade.",
      "mail.codeHelp": "Avec l’e-mail de cette commande, ce code est le seul moyen de retrouver tes billets.",
      "mail.attached": "{n} PDF joints",
      "mail.attachedOne": "1 PDF joint",
      "mail.pdf": "E-billet PDF",
      "order.gate": "Scanner pour vérifier",
      "gate.kicker": "Contrôle",
      "gate.valid": "Billet valide",
      "gate.invalid": "Billet non reconnu",
      "gate.invalidLead": "Ce QR code ne correspond à aucun e-billet Prime Football.",
      "gate.when": "Date",
      "gate.where": "Stade",
      "gate.seat": "Place",
      "gate.cat": "Catégorie",
      "order.side": "Côte à côte",
      "order.seat": "Rang {row} · Place {seat}",
      "cart.title": "Ton panier",
      "cart.empty": "Ton panier est vide.",
      "cart.checkout": "Valider la commande",
      "cart.remove": "Retirer",
      "cart.hold": "Tes places sont gardées encore",
      "cart.expired": "Le délai de 10 minutes est écoulé. Tes places ont été libérées.",
      "cart.legalBefore": "En payant, tu acceptes les",
      "cart.legalMid": "et la",
      "cart.cgvLink": "conditions générales de vente",
      "cart.privacyLink": "politique de confidentialité",
      "cart.pay": "Moyens de paiement",
      "cart.emptyToast": "Panier vide",
      "cart.confirmed": "Commande confirmée — e-billets envoyés",
      "place.cats": "Catégories",
      "place.qty": "Quantité",
      "place.minus": "Diminuer",
      "place.plus": "Augmenter",
      "place.add": "Ajouter au panier",
      "place.total": "Total",
      "place.available": "Disponible",
      "place.low.one": "Plus que {n} billet dans cette catégorie",
      "place.low.many": "Plus que {n} billets dans cette catégorie",
      "place.covered": "Couvert",
      "place.open": "Découvert",
      "place.missing": "Match introuvable",
      "place.gone": "Ce match n’est plus disponible",
      "place.kick": "Coup d’envoi",
      "place.legend": "Catégories de places",
      "place.when": "Date",
      "place.stadium": "Stade",
      "place.city": "Ville",
      "place.picked": "Catégorie {n}",
      "place.zone": "Ta place",
      "place.also": "D'autres matchs",
      "place.alsoLead": "Fais défiler",
      "place.alsoPrev": "Matchs précédents",
      "place.alsoNext": "Matchs suivants",
      "cat.corners": "Virages · coins et niveau supérieur",
      "cat.goals": "Virages · derrière les buts",
      "cat.upper": "Tribunes hautes · côtés",
      "cat.side": "Tribunes latérales · niveau intermédiaire",
      "cat.pitch": "Tribunes latérales · proche pelouse",
      "view.1": "Limitée",
      "view.2": "Correcte",
      "view.3": "Bonne",
      "view.4": "Très bonne",
      "view.5": "Excellente",
      "cart.added": "Ajouté au panier",
      "lang.menu": "Choisir la langue",
    },
    en: {
      "nav.matches": "Matches",
      "nav.tickets": "Tickets",
      "nav.cart": "Basket",
      "nav.search": "Search",
      "nav.menu": "Menu",
      "nav.contact": "Contact",
      "nav.back": "Back",
      "nav.skip": "Skip to matches",
      "nav.skipPlace": "Skip to content",
      "nav.backMatches": "← Back to matches",
      "nav.weeks": "Week selection",
      "nav.prev": "Previous week",
      "nav.next": "Next week",
      "filters.clubs": "Clubs",
      "filters.reset": "Reset",
      "filters.all": "All clubs",
      "filters.close": "Close",
      "match.buy": "Buy",
      "match.from": "From {price}\u00a0€",
      "match.sold": "Sold out",
      "match.demand": "In demand",
      "match.price": "Prices rising soon",
      "match.empty": "No matches for this filter.",
      "match.weekOf": "Week {n} of {total}",
      week: "Week",
      "footer.help": "Help & info",
      "footer.faq": "FAQ",
      "footer.cgv": "Terms of sale",
      "footer.mentions": "Legal notice",
      "footer.privacy": "Privacy",
      "footer.cookies": "Cookies",
      "footer.about": "About",
      "footer.contact": "Contact",
      "footer.connect": "Contact",
      "footer.support": "Help",
      "footer.tickets": "My tickets",
      "footer.copy": "© 2026 Prime Football. All rights reserved.",
      "place.eticket": "Show your e-ticket at the gate: the QR code is enough.",
      "place.mail": "Find your tickets with your email and the code sent by email.",
      "place.together": "Several tickets: the seats are side by side.",
      "place.togetherNow": "Your {n} seats will be side by side.",
      "checkout.title": "Your details",
      "checkout.lead": "A code is sent by email. That code is how you find your tickets again.",
      "checkout.name": "Name",
      "checkout.email": "Email",
      "checkout.submit": "Continue to payment",
      "pay.wait": "Opening checkout",
      "pay.waitLead": "Preparing the secure page.",
      "checkout.empty": "Your basket is empty.",
      "order.title": "Your e-tickets",
      "order.lead": "Scan the QR code to check the ticket. Seats in the same order are side by side.",
      "order.ref": "Order",
      "order.sent": "E-tickets linked to",
      "order.mailCode": "Code sent by email",
      "order.mailOnly": "The order email and this code are how you find your tickets.",
      "order.find": "Find my tickets",
      "order.findLead": "Enter the order email and the code from the email.",
      "order.search": "Find my tickets",
      "order.none": "No ticket for this email and code.",
      "mail.sent": "Two emails sent",
      "mail.openInvoice": "Billing email",
      "mail.openTickets": "E-ticket email",
      "mail.invoiceKicker": "Invoice",
      "mail.invoiceTitle": "Your invoice",
      "mail.hello": "Hello {name},",
      "mail.invoiceLead": "Payment is confirmed. The summary is below. Your e-tickets leave in a second email.",
      "mail.match": "Match",
      "mail.ref": "Invoice no.",
      "mail.date": "Date",
      "mail.qty": "Qty",
      "mail.amount": "Amount",
      "mail.total": "Total incl. tax",
      "mail.status": "Status",
      "mail.paid": "Paid",
      "mail.ticketsKicker": "E-tickets",
      "mail.ticketsTitle": "Your e-tickets",
      "mail.ticketsLead": "Here is your code and your e-tickets as PDF. Show each QR code at the stadium entrance.",
      "mail.codeHelp": "With the email from this order, this code is the only way to find your tickets.",
      "mail.attached": "{n} PDFs attached",
      "mail.attachedOne": "1 PDF attached",
      "mail.pdf": "E-ticket PDF",
      "order.gate": "Scan to check",
      "gate.kicker": "Check",
      "gate.valid": "Ticket valid",
      "gate.invalid": "Ticket not recognised",
      "gate.invalidLead": "This QR code does not match a Prime Football e-ticket.",
      "gate.when": "Date",
      "gate.where": "Stadium",
      "gate.seat": "Seat",
      "gate.cat": "Category",
      "order.side": "Side by side",
      "order.seat": "Row {row} · Seat {seat}",
      "cart.title": "Your basket",
      "cart.empty": "Your basket is empty.",
      "cart.checkout": "Place order",
      "cart.remove": "Remove",
      "cart.hold": "Your seats are held for another",
      "cart.expired": "The 10-minute window has ended. Your seats have been released.",
      "cart.legalBefore": "By paying, you accept the",
      "cart.legalMid": "and the",
      "cart.cgvLink": "terms of sale",
      "cart.privacyLink": "privacy policy",
      "cart.pay": "Payment methods",
      "cart.emptyToast": "Basket empty",
      "cart.confirmed": "Order confirmed — e-tickets sent",
      "place.cats": "Categories",
      "place.qty": "Quantity",
      "place.minus": "Decrease",
      "place.plus": "Increase",
      "place.add": "Add to basket",
      "place.total": "Total",
      "place.available": "Available",
      "place.low.one": "Only {n} ticket left in this category",
      "place.low.many": "Only {n} tickets left in this category",
      "place.covered": "Covered",
      "place.open": "Uncovered",
      "place.missing": "Match not found",
      "place.gone": "This match is no longer available",
      "place.kick": "Kick-off",
      "place.legend": "Seat categories",
      "place.when": "Date",
      "place.stadium": "Stadium",
      "place.city": "City",
      "place.picked": "Category {n}",
      "place.zone": "Your seat",
      "place.also": "Other matches",
      "place.alsoLead": "Swipe to browse",
      "place.alsoPrev": "Previous matches",
      "place.alsoNext": "Next matches",
      "cat.corners": "Corners · upper tier",
      "cat.goals": "Behind the goals",
      "cat.upper": "Upper side stands",
      "cat.side": "Side stands · mid tier",
      "cat.pitch": "Side stands · near the pitch",
      "view.1": "Limited",
      "view.2": "Fair",
      "view.3": "Good",
      "view.4": "Very good",
      "view.5": "Excellent",
      "cart.added": "Added to basket",
      "lang.menu": "Choose language",
    },
    es: {
      "nav.matches": "Partidos",
      "nav.tickets": "Entradas",
      "nav.cart": "Cesta",
      "nav.search": "Buscar",
      "nav.menu": "Menú",
      "nav.contact": "Contacto",
      "nav.back": "Volver",
      "nav.skip": "Ir a los partidos",
      "nav.skipPlace": "Ir al contenido",
      "nav.backMatches": "← Volver a los partidos",
      "nav.weeks": "Selección de semana",
      "nav.prev": "Semana anterior",
      "nav.next": "Semana siguiente",
      "filters.clubs": "Clubes",
      "filters.reset": "Reset",
      "filters.all": "Todos los clubes",
      "filters.close": "Cerrar",
      "match.buy": "Comprar",
      "match.from": "Desde {price}\u00a0€",
      "match.sold": "Agotado",
      "match.demand": "Muy solicitado",
      "match.price": "Precios al alza pronto",
      "match.empty": "Ningún partido para este filtro.",
      "match.weekOf": "Semana {n} de {total}",
      week: "Semana",
      "footer.help": "Ayuda e info",
      "footer.faq": "FAQ",
      "footer.cgv": "Condiciones de venta",
      "footer.mentions": "Aviso legal",
      "footer.privacy": "Privacidad",
      "footer.cookies": "Cookies",
      "footer.about": "Acerca de",
      "footer.contact": "Contacto",
      "footer.connect": "Contacto",
      "footer.support": "Ayuda",
      "footer.comps": "Competiciones",
      "footer.clubs": "Clubes",
      "footer.copy": "© 2026 Prime Football. Todos los derechos reservados.",
      "cart.title": "Tu cesta",
      "cart.empty": "Tu cesta está vacía.",
      "cart.checkout": "Confirmar pedido",
      "pay.wait": "Abriendo el pago",
      "pay.waitLead": "Preparando la página segura.",
      "cart.emptyToast": "Cesta vacía",
      "cart.confirmed": "Pedido confirmado — entradas enviadas",
      "place.cats": "Categorías",
      "place.qty": "Cantidad",
      "place.minus": "Reducir",
      "place.plus": "Aumentar",
      "place.add": "Añadir a la cesta",
      "place.total": "Total",
      "place.available": "Disponible",
      "place.low.one": "Solo queda {n} entrada en esta categoría",
      "place.low.many": "Solo quedan {n} entradas en esta categoría",
      "place.covered": "Cubierto",
      "place.open": "Descubierto",
      "place.missing": "Partido no encontrado",
      "place.gone": "Este partido ya no está disponible",
      "place.kick": "Inicio",
      "place.legend": "Categorías de asiento",
      "place.when": "Fecha",
      "place.stadium": "Estadio",
      "place.city": "Ciudad",
      "place.picked": "Categoría {n}",
      "place.zone": "Tu sitio",
      "place.also": "Otros partidos",
      "place.alsoLead": "Desliza para ver",
      "place.alsoPrev": "Partidos anteriores",
      "place.alsoNext": "Partidos siguientes",
      "cat.corners": "Esquinas · nivel superior",
      "cat.goals": "Detrás de las porterías",
      "cat.upper": "Tribunas altas · laterales",
      "cat.side": "Tribunas laterales · nivel medio",
      "cat.pitch": "Tribunas laterales · cerca del césped",
      "view.1": "Limitada",
      "view.2": "Correcta",
      "view.3": "Buena",
      "view.4": "Muy buena",
      "view.5": "Excelente",
      "cart.added": "Añadido a la cesta",
      "lang.menu": "Elegir idioma",
    },
    de: {
      "nav.matches": "Spiele",
      "nav.tickets": "Tickets",
      "nav.cart": "Warenkorb",
      "nav.search": "Suchen",
      "nav.menu": "Menü",
      "nav.contact": "Kontakt",
      "nav.back": "Zurück",
      "nav.skip": "Zu den Spielen",
      "nav.skipPlace": "Zum Inhalt",
      "nav.backMatches": "← Zurück zu den Spielen",
      "nav.weeks": "Spieltag wählen",
      "nav.prev": "Vorheriger Spieltag",
      "nav.next": "Nächster Spieltag",
      "filters.clubs": "Clubs",
      "filters.reset": "Reset",
      "filters.all": "Alle Clubs",
      "filters.close": "Schließen",
      "match.buy": "Kaufen",
      "match.from": "Ab {price}\u00a0€",
      "match.sold": "Ausverkauft",
      "match.demand": "Sehr gefragt",
      "match.price": "Preise steigen bald",
      "match.empty": "Keine Spiele für diesen Filter.",
      "match.weekOf": "Spieltag {n} von {total}",
      week: "Spieltag",
      "footer.help": "Hilfe & Infos",
      "footer.faq": "FAQ",
      "footer.cgv": "Verkaufsbedingungen",
      "footer.mentions": "Impressum",
      "footer.privacy": "Datenschutz",
      "footer.cookies": "Cookies",
      "footer.about": "Über uns",
      "footer.contact": "Kontakt",
      "footer.connect": "Kontakt",
      "footer.support": "Hilfe",
      "footer.comps": "Wettbewerbe",
      "footer.clubs": "Clubs",
      "footer.copy": "© 2026 Prime Football. Alle Rechte vorbehalten.",
      "cart.title": "Dein Warenkorb",
      "cart.empty": "Dein Warenkorb ist leer.",
      "cart.checkout": "Bestellung abschließen",
      "pay.wait": "Zahlung wird geöffnet",
      "pay.waitLead": "Die sichere Seite wird vorbereitet.",
      "cart.emptyToast": "Warenkorb leer",
      "cart.confirmed": "Bestellung bestätigt — E-Tickets gesendet",
      "place.cats": "Kategorien",
      "place.qty": "Anzahl",
      "place.minus": "Verringern",
      "place.plus": "Erhöhen",
      "place.add": "In den Warenkorb",
      "place.total": "Summe",
      "place.available": "Verfügbar",
      "place.low.one": "Nur noch {n} Ticket in dieser Kategorie",
      "place.low.many": "Nur noch {n} Tickets in dieser Kategorie",
      "place.covered": "Überdacht",
      "place.open": "Offen",
      "place.missing": "Spiel nicht gefunden",
      "place.gone": "Dieses Spiel ist nicht mehr verfügbar",
      "place.kick": "Anpfiff",
      "place.legend": "Platzkategorien",
      "place.when": "Datum",
      "place.stadium": "Stadion",
      "place.city": "Stadt",
      "place.picked": "Kategorie {n}",
      "place.zone": "Dein Platz",
      "place.also": "Weitere Spiele",
      "place.alsoLead": "Zum Blättern wischen",
      "place.alsoPrev": "Vorherige Spiele",
      "place.alsoNext": "Nächste Spiele",
      "cat.corners": "Ecken · Oberrang",
      "cat.goals": "Hinter den Toren",
      "cat.upper": "Obere Seitenränge",
      "cat.side": "Seitenränge · Mittelrang",
      "cat.pitch": "Seitenränge · nah am Platz",
      "view.1": "Eingeschränkt",
      "view.2": "Ordentlich",
      "view.3": "Gut",
      "view.4": "Sehr gut",
      "view.5": "Ausgezeichnet",
      "cart.added": "In den Warenkorb gelegt",
      "lang.menu": "Sprache wählen",
    },
    it: {
      "nav.matches": "Partite",
      "nav.tickets": "Biglietti",
      "nav.cart": "Carrello",
      "nav.search": "Cerca",
      "nav.menu": "Menu",
      "nav.contact": "Contatto",
      "nav.back": "Indietro",
      "nav.skip": "Vai alle partite",
      "nav.skipPlace": "Vai al contenuto",
      "nav.backMatches": "← Torna alle partite",
      "nav.weeks": "Scelta della giornata",
      "nav.prev": "Giornata precedente",
      "nav.next": "Giornata successiva",
      "filters.clubs": "Club",
      "filters.reset": "Reset",
      "filters.all": "Tutti i club",
      "filters.close": "Chiudi",
      "match.buy": "Acquista",
      "match.from": "Da {price}\u00a0€",
      "match.sold": "Esaurito",
      "match.demand": "Molto richiesto",
      "match.price": "Prezzi in aumento a breve",
      "match.empty": "Nessuna partita per questo filtro.",
      "match.weekOf": "Giornata {n} di {total}",
      week: "Giornata",
      "footer.help": "Aiuto e info",
      "footer.faq": "FAQ",
      "footer.cgv": "Condizioni di vendita",
      "footer.mentions": "Note legali",
      "footer.privacy": "Privacy",
      "footer.cookies": "Cookie",
      "footer.about": "Chi siamo",
      "footer.contact": "Contatto",
      "footer.connect": "Contatto",
      "footer.support": "Aiuto",
      "footer.comps": "Competizioni",
      "footer.clubs": "Club",
      "footer.copy": "© 2026 Prime Football. Tutti i diritti riservati.",
      "cart.title": "Il tuo carrello",
      "cart.empty": "Il tuo carrello è vuoto.",
      "cart.checkout": "Conferma ordine",
      "pay.wait": "Apertura del pagamento",
      "pay.waitLead": "Prepariamo la pagina sicura.",
      "cart.emptyToast": "Carrello vuoto",
      "cart.confirmed": "Ordine confermato — e-ticket inviati",
      "place.cats": "Categorie",
      "place.qty": "Quantità",
      "place.minus": "Diminuisci",
      "place.plus": "Aumenta",
      "place.add": "Aggiungi al carrello",
      "place.total": "Totale",
      "place.available": "Disponibile",
      "place.low.one": "Solo {n} biglietto rimasto in questa categoria",
      "place.low.many": "Solo {n} biglietti rimasti in questa categoria",
      "place.covered": "Coperto",
      "place.open": "Scoperto",
      "place.missing": "Partita non trovata",
      "place.gone": "Questa partita non è più disponibile",
      "place.kick": "Calcio d’inizio",
      "place.legend": "Categorie di posto",
      "place.when": "Data",
      "place.stadium": "Stadio",
      "place.city": "Città",
      "place.picked": "Categoria {n}",
      "place.zone": "Il tuo posto",
      "place.also": "Altre partite",
      "place.alsoLead": "Scorri per vedere",
      "place.alsoPrev": "Partite precedenti",
      "place.alsoNext": "Partite successive",
      "cat.corners": "Angoli · livello superiore",
      "cat.goals": "Dietro le porte",
      "cat.upper": "Tribune alte · lati",
      "cat.side": "Tribune laterali · livello intermedio",
      "cat.pitch": "Tribune laterali · vicino al campo",
      "view.1": "Limitata",
      "view.2": "Discreta",
      "view.3": "Buona",
      "view.4": "Molto buona",
      "view.5": "Eccellente",
      "cart.added": "Aggiunto al carrello",
      "lang.menu": "Scegli la lingua",
    },
    pt: {
      "nav.matches": "Jogos",
      "nav.tickets": "Bilhetes",
      "nav.cart": "Cesto",
      "nav.search": "Pesquisar",
      "nav.menu": "Menu",
      "nav.contact": "Contacto",
      "nav.back": "Voltar",
      "nav.skip": "Ir para os jogos",
      "nav.skipPlace": "Ir para o conteúdo",
      "nav.backMatches": "← Voltar aos jogos",
      "nav.weeks": "Escolha da jornada",
      "nav.prev": "Jornada anterior",
      "nav.next": "Jornada seguinte",
      "filters.clubs": "Clubes",
      "filters.reset": "Reset",
      "filters.all": "Todos os clubes",
      "filters.close": "Fechar",
      "match.buy": "Comprar",
      "match.from": "A partir de {price}\u00a0€",
      "match.sold": "Esgotado",
      "match.demand": "Muito pedido",
      "match.price": "Preços a subir em breve",
      "match.empty": "Nenhum jogo para este filtro.",
      "match.weekOf": "Jornada {n} de {total}",
      week: "Jornada",
      "footer.help": "Ajuda e info",
      "footer.faq": "FAQ",
      "footer.cgv": "Condições de venda",
      "footer.mentions": "Aviso legal",
      "footer.privacy": "Privacidade",
      "footer.cookies": "Cookies",
      "footer.about": "Sobre",
      "footer.contact": "Contacto",
      "footer.connect": "Contacto",
      "footer.support": "Ajuda",
      "footer.comps": "Competições",
      "footer.clubs": "Clubes",
      "footer.copy": "© 2026 Prime Football. Todos os direitos reservados.",
      "cart.title": "O teu cesto",
      "cart.empty": "O teu cesto está vazio.",
      "cart.checkout": "Confirmar encomenda",
      "pay.wait": "A abrir o pagamento",
      "pay.waitLead": "A preparar a página segura.",
      "cart.emptyToast": "Cesto vazio",
      "cart.confirmed": "Encomenda confirmada — bilhetes enviados",
      "place.cats": "Categorias",
      "place.qty": "Quantidade",
      "place.minus": "Diminuir",
      "place.plus": "Aumentar",
      "place.add": "Adicionar ao cesto",
      "place.total": "Total",
      "place.available": "Disponível",
      "place.low.one": "Só resta {n} bilhete nesta categoria",
      "place.low.many": "Só restam {n} bilhetes nesta categoria",
      "place.covered": "Coberto",
      "place.open": "Descoberto",
      "place.missing": "Jogo não encontrado",
      "place.gone": "Este jogo já não está disponível",
      "place.kick": "Início",
      "place.legend": "Categorias de lugar",
      "place.when": "Data",
      "place.stadium": "Estádio",
      "place.city": "Cidade",
      "place.picked": "Categoria {n}",
      "place.zone": "O teu lugar",
      "place.also": "Outros jogos",
      "place.alsoLead": "Desliza para ver",
      "place.alsoPrev": "Jogos anteriores",
      "place.alsoNext": "Jogos seguintes",
      "cat.corners": "Cantos · nível superior",
      "cat.goals": "Atrás das balizas",
      "cat.upper": "Bancadas altas · laterais",
      "cat.side": "Bancadas laterais · nível intermédio",
      "cat.pitch": "Bancadas laterais · junto ao relvado",
      "view.1": "Limitada",
      "view.2": "Razoável",
      "view.3": "Boa",
      "view.4": "Muito boa",
      "view.5": "Excelente",
      "cart.added": "Adicionado ao cesto",
      "lang.menu": "Escolher idioma",
    },
    nl: {
      "nav.matches": "Wedstrijden",
      "nav.tickets": "Tickets",
      "nav.cart": "Mandje",
      "nav.search": "Zoeken",
      "nav.menu": "Menu",
      "nav.contact": "Contact",
      "nav.back": "Terug",
      "nav.skip": "Naar de wedstrijden",
      "nav.skipPlace": "Naar de inhoud",
      "nav.backMatches": "← Terug naar wedstrijden",
      "nav.weeks": "Speelronde kiezen",
      "nav.prev": "Vorige speelronde",
      "nav.next": "Volgende speelronde",
      "filters.clubs": "Clubs",
      "filters.reset": "Reset",
      "filters.all": "Alle clubs",
      "filters.close": "Sluiten",
      "match.buy": "Kopen",
      "match.from": "Vanaf {price}\u00a0€",
      "match.sold": "Uitverkocht",
      "match.demand": "Erg gevraagd",
      "match.price": "Prijzen stijgen binnenkort",
      "match.empty": "Geen wedstrijden voor dit filter.",
      "match.weekOf": "Speelronde {n} van {total}",
      week: "Speelronde",
      "footer.help": "Hulp & info",
      "footer.faq": "FAQ",
      "footer.cgv": "Verkoopvoorwaarden",
      "footer.mentions": "Juridische info",
      "footer.privacy": "Privacy",
      "footer.cookies": "Cookies",
      "footer.about": "Over ons",
      "footer.contact": "Contact",
      "footer.connect": "Contact",
      "footer.support": "Hulp",
      "footer.comps": "Competities",
      "footer.clubs": "Clubs",
      "footer.copy": "© 2026 Prime Football. Alle rechten voorbehouden.",
      "cart.title": "Je mandje",
      "cart.empty": "Je mandje is leeg.",
      "cart.checkout": "Bestelling plaatsen",
      "pay.wait": "Betaling openen",
      "pay.waitLead": "De beveiligde pagina wordt voorbereid.",
      "cart.emptyToast": "Mandje leeg",
      "cart.confirmed": "Bestelling bevestigd — e-tickets verstuurd",
      "place.cats": "Categorieën",
      "place.qty": "Aantal",
      "place.minus": "Minder",
      "place.plus": "Meer",
      "place.add": "In het mandje",
      "place.total": "Totaal",
      "place.available": "Beschikbaar",
      "place.low.one": "Nog {n} ticket in deze categorie",
      "place.low.many": "Nog {n} tickets in deze categorie",
      "place.covered": "Overdekt",
      "place.open": "Open",
      "place.missing": "Wedstrijd niet gevonden",
      "place.gone": "Deze wedstrijd is niet meer beschikbaar",
      "place.kick": "Aftrap",
      "place.legend": "Plaatscategorieën",
      "place.when": "Datum",
      "place.stadium": "Stadion",
      "place.city": "Stad",
      "place.picked": "Categorie {n}",
      "place.zone": "Jouw plaats",
      "place.also": "Andere wedstrijden",
      "place.alsoLead": "Veeg om te zien",
      "place.alsoPrev": "Vorige wedstrijden",
      "place.alsoNext": "Volgende wedstrijden",
      "cat.corners": "Hoeken · bovenring",
      "cat.goals": "Achter de doelen",
      "cat.upper": "Hoge zijtribunes",
      "cat.side": "Zijtribunes · middenring",
      "cat.pitch": "Zijtribunes · dicht bij het veld",
      "view.1": "Beperkt",
      "view.2": "Redelijk",
      "view.3": "Goed",
      "view.4": "Zeer goed",
      "view.5": "Uitstekend",
      "cart.added": "In het mandje gezet",
      "lang.menu": "Taal kiezen",
    },
  };

  let current = "fr";

  function fill(template, vars) {
    if (!vars) return template;
    return Object.entries(vars).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, String(v)), template);
  }

  function t(key, vars) {
    const pack = DICT[current] || DICT.fr;
    const raw = pack[key] || DICT.fr[key] || key;
    return fill(raw, vars);
  }

  function oneDate(part) {
    const m = String(part).trim().match(/^(\S+)\s+(\d+)\s+(\S+)$/);
    if (!m) return part;
    const day = DAYS[m[1].toLowerCase().normalize("NFD").replace(/\p{M}/gu, "")];
    const monKey = m[3].toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
    const mon = MONTHS[monKey];
    if (!day || !mon) return part;
    return `${day[current] || day.fr} ${m[2]} ${mon[current] || mon.fr}`;
  }

  function pfDate(label) {
    return String(label || "")
      .split(/\s+—\s+/)
      .map(oneDate)
      .join(" — ");
  }

  function pfWeek(title) {
    const n = String(title || "").match(/(\d+)/);
    return n ? `${t("week")} ${n[1]}` : title;
  }

  function applyStatic() {
    document.documentElement.lang = current;
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
      el.setAttribute("aria-label", t(el.getAttribute("data-i18n-aria")));
    });
  }

  function flagHtml(id) {
    return `<span class="lang-flag">${FLAGS[id] || FLAGS.fr}</span>`;
  }

  function paint() {
    const lang = LANGS.find((l) => l.id === current) || LANGS[0];
    document.querySelectorAll("[data-lang]").forEach((root) => {
      const btn = root.querySelector(".lang-btn");
      const menu = root.querySelector(".lang-menu");
      if (!btn || !menu) return;
      btn.innerHTML = flagHtml(current);
      btn.setAttribute("aria-label", lang.label);
      menu.setAttribute("aria-label", t("lang.menu"));
      menu.querySelectorAll("[data-lang-id]").forEach((item) => {
        item.classList.toggle("is-active", item.getAttribute("data-lang-id") === current);
        item.setAttribute("aria-selected", item.getAttribute("data-lang-id") === current ? "true" : "false");
      });
    });
  }

  function closeMenus() {
    document.querySelectorAll(".lang-menu").forEach((menu) => {
      menu.hidden = true;
    });
    document.querySelectorAll(".lang-btn").forEach((btn) => btn.setAttribute("aria-expanded", "false"));
  }

  function setLang(id, options) {
    current = LANGS.some((l) => l.id === id) ? id : "fr";
    try {
      localStorage.setItem(KEY, current);
    } catch (e) {
      /* ignore */
    }
    if (!options?.silent) {
      const next = cheminAvecLangue(current);
      if (next && next !== window.location.pathname) history.pushState({ lang: current }, "", next);
    }
    applyStatic();
    paint();
    closeMenus();
    window.dispatchEvent(new CustomEvent("pf-lang"));
  }

  function mount() {
    document.querySelectorAll("[data-lang]").forEach((root) => {
      const btn = root.querySelector(".lang-btn");
      const menu = root.querySelector(".lang-menu");
      if (!btn || !menu || root.dataset.ready) return;
      root.dataset.ready = "1";
      menu.innerHTML = LANGS.map(
        (lang) =>
          `<li><button type="button" data-lang-id="${lang.id}" role="option" aria-label="${lang.label}">${flagHtml(lang.id)}<span class="sr-only">${lang.label}</span></button></li>`
      ).join("");
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const willOpen = menu.hidden;
        closeMenus();
        if (willOpen) {
          menu.hidden = false;
          btn.setAttribute("aria-expanded", "true");
        }
      });
      menu.addEventListener("click", (e) => {
        const item = e.target.closest("[data-lang-id]");
        if (!item) return;
        setLang(item.getAttribute("data-lang-id"));
      });
    });
    document.addEventListener("click", closeMenus);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeMenus();
    });
    paint();
    applyStatic();
  }

  const langueUrl = langueDepuisUrl();
  if (langueUrl) {
    current = langueUrl;
    try {
      localStorage.setItem(KEY, current);
    } catch (e) {
      /* ignore */
    }
  } else {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved && LANGS.some((l) => l.id === saved)) current = saved;
    } catch (e) {
      /* ignore */
    }
  }

  window.t = t;
  window.pfDate = pfDate;
  window.pfWeek = pfWeek;
  window.pfLang = () => current;

  window.addEventListener("popstate", () => {
    const depuisUrl = langueDepuisUrl();
    if (depuisUrl && depuisUrl !== current) setLang(depuisUrl, { silent: true });
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
