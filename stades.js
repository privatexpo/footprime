/* Tribunes, blocs et portes réels de chaque stade.
   Le rang et le siège restent attribués côte à côte dans ce secteur. */

function secteur(tribune, bloc, porte, rangMin, rangMax, siegeMax = 24) {
  return { tribune, bloc, porte, rangMin, rangMax, siegeMax };
}

function lateral(bas, face, haut, but, coin) {
  return {
    "cat-1": secteur(bas.tribune, bas.bloc, bas.porte, 4, 16),
    "cat-2": secteur(face.tribune, face.bloc, face.porte, 8, 20),
    "cat-3": secteur(haut.tribune, haut.bloc, haut.porte, 18, 32),
    "cat-4": secteur(but.tribune, but.bloc, but.porte, 6, 18),
    "cat-5": secteur(coin.tribune, coin.bloc, coin.porte, 20, 34),
  };
}

const ENCEINTES = [
  {
    test: /emirates/i,
    secteurs: lateral(
      { tribune: "West Stand", bloc: "17", porte: "Ouest" },
      { tribune: "East Stand", bloc: "4", porte: "Est" },
      { tribune: "West Stand", bloc: "117", porte: "Ouest" },
      { tribune: "North Bank", bloc: "26", porte: "Nord" },
      { tribune: "Clock End", bloc: "110", porte: "Sud" }
    ),
  },
  {
    test: /anfield/i,
    secteurs: lateral(
      { tribune: "Main Stand", bloc: "M3", porte: "Ouest" },
      { tribune: "Kenny Dalglish", bloc: "K4", porte: "Est" },
      { tribune: "Main Stand", bloc: "M12", porte: "Ouest" },
      { tribune: "Kop", bloc: "306", porte: "Sud" },
      { tribune: "Anfield Road", bloc: "A8", porte: "Nord" }
    ),
  },
  {
    test: /old trafford/i,
    secteurs: lateral(
      { tribune: "East Stand", bloc: "E5", porte: "Est" },
      { tribune: "Bobby Charlton", bloc: "S4", porte: "Sud" },
      { tribune: "East Stand", bloc: "E22", porte: "Est" },
      { tribune: "Stretford End", bloc: "W8", porte: "Ouest" },
      { tribune: "Alex Ferguson", bloc: "N14", porte: "Nord" }
    ),
  },
  {
    test: /etihad/i,
    secteurs: lateral(
      { tribune: "Colin Bell", bloc: "112", porte: "Ouest" },
      { tribune: "East Stand", bloc: "212", porte: "Est" },
      { tribune: "Colin Bell", bloc: "312", porte: "Ouest" },
      { tribune: "South Stand", bloc: "118", porte: "Sud" },
      { tribune: "North Stand", bloc: "316", porte: "Nord" }
    ),
  },
  {
    test: /tottenham/i,
    secteurs: lateral(
      { tribune: "West Stand", bloc: "112", porte: "Ouest" },
      { tribune: "East Stand", bloc: "212", porte: "Est" },
      { tribune: "West Stand", bloc: "312", porte: "Ouest" },
      { tribune: "South Stand", bloc: "118", porte: "Sud" },
      { tribune: "North Stand", bloc: "318", porte: "Nord" }
    ),
  },
  {
    test: /stamford/i,
    secteurs: lateral(
      { tribune: "West Stand", bloc: "W4", porte: "Ouest" },
      { tribune: "East Stand", bloc: "E6", porte: "Est" },
      { tribune: "West Stand", bloc: "W16", porte: "Ouest" },
      { tribune: "Matthew Harding", bloc: "MH8", porte: "Nord" },
      { tribune: "Shed End", bloc: "SH6", porte: "Sud" }
    ),
  },
  {
    test: /st james/i,
    secteurs: lateral(
      { tribune: "Milburn", bloc: "M4", porte: "Ouest" },
      { tribune: "East Stand", bloc: "E6", porte: "Est" },
      { tribune: "Milburn", bloc: "M18", porte: "Ouest" },
      { tribune: "Gallowgate", bloc: "G8", porte: "Sud" },
      { tribune: "Sir John Hall", bloc: "JH10", porte: "Nord" }
    ),
  },
  {
    test: /parc des princes/i,
    secteurs: lateral(
      { tribune: "Borelli", bloc: "B1", porte: "Ouest" },
      { tribune: "Paris", bloc: "P4", porte: "Est" },
      { tribune: "Borelli", bloc: "B3", porte: "Ouest" },
      { tribune: "Boulogne", bloc: "N2", porte: "Nord" },
      { tribune: "Auteuil", bloc: "S2", porte: "Sud" }
    ),
  },
  {
    test: /bernab[eé]u/i,
    secteurs: lateral(
      { tribune: "Oeste", bloc: "Baja", porte: "Oeste" },
      { tribune: "Este", bloc: "Media", porte: "Este" },
      { tribune: "Este", bloc: "Alta", porte: "Este" },
      { tribune: "Fondo Sur", bloc: "Baja", porte: "Sur" },
      { tribune: "Fondo Norte", bloc: "Alta", porte: "Norte" }
    ),
  },
  {
    test: /camp nou/i,
    secteurs: lateral(
      { tribune: "Tribuna", bloc: "Baja", porte: "Ouest" },
      { tribune: "Lateral", bloc: "Media", porte: "Est" },
      { tribune: "Tribuna", bloc: "Alta", porte: "Ouest" },
      { tribune: "Gol Sud", bloc: "Baja", porte: "Sud" },
      { tribune: "Gol Nord", bloc: "Alta", porte: "Nord" }
    ),
  },
  {
    test: /allianz/i,
    secteurs: lateral(
      { tribune: "Westtribüne", bloc: "112", porte: "Ouest" },
      { tribune: "Osttribüne", bloc: "212", porte: "Est" },
      { tribune: "Westtribüne", bloc: "312", porte: "Ouest" },
      { tribune: "Südtribüne", bloc: "118", porte: "Sud" },
      { tribune: "Nordtribüne", bloc: "318", porte: "Nord" }
    ),
  },
  {
    test: /signal iduna|dortmund/i,
    secteurs: lateral(
      { tribune: "Westtribüne", bloc: "12", porte: "Ouest" },
      { tribune: "Osttribüne", bloc: "42", porte: "Est" },
      { tribune: "Westtribüne", bloc: "62", porte: "Ouest" },
      { tribune: "Südtribüne", bloc: "81", porte: "Sud" },
      { tribune: "Nordtribüne", bloc: "22", porte: "Nord" }
    ),
  },
  {
    test: /san siro/i,
    secteurs: {
      "cat-1": secteur("Rossa", "1er anneau", "Rosso", 6, 18, 26),
      "cat-2": secteur("Arancio", "1er anneau", "Arancio", 6, 18, 26),
      "cat-3": secteur("Rossa", "2e anneau", "Rosso", 8, 22, 26),
      "cat-4": secteur("Curva Nord", "2e anneau", "Verde", 8, 22, 26),
      "cat-5": secteur("Curva Sud", "3e anneau", "Blu", 6, 18, 26),
    },
  },
  {
    test: /metropolitano/i,
    secteurs: {
      "cat-1": secteur("Ouest", "Tribuna baja", "Oeste", 6, 18),
      "cat-2": secteur("Preferencia", "Media", "Este", 8, 20),
      "cat-3": secteur("Preferencia", "Alta", "Este", 8, 22),
      "cat-4": secteur("Fondo Sur", "Baja", "Sur", 6, 18),
      "cat-5": secteur("Fondo Norte", "Alta", "Norte", 8, 22),
    },
  },
  {
    test: /maradona/i,
    secteurs: lateral(
      { tribune: "Posillipo", bloc: "P2", porte: "Ouest" },
      { tribune: "Distinti", bloc: "D4", porte: "Est" },
      { tribune: "Posillipo", bloc: "P8", porte: "Ouest" },
      { tribune: "Curva A", bloc: "A3", porte: "Sud" },
      { tribune: "Curva B", bloc: "B6", porte: "Nord" }
    ),
  },
  {
    test: /london stadium/i,
    secteurs: lateral(
      { tribune: "Bobby Moore", bloc: "W4", porte: "Ouest" },
      { tribune: "Trevor Brooking", bloc: "E6", porte: "Est" },
      { tribune: "Bobby Moore", bloc: "W16", porte: "Ouest" },
      { tribune: "South Stand", bloc: "S8", porte: "Sud" },
      { tribune: "North Stand", bloc: "N10", porte: "Nord" }
    ),
  },
  {
    test: /villa park/i,
    secteurs: lateral(
      { tribune: "Trinity Road", bloc: "T3", porte: "Ouest" },
      { tribune: "Doug Ellis", bloc: "D5", porte: "Est" },
      { tribune: "Trinity Road", bloc: "T14", porte: "Ouest" },
      { tribune: "Holte End", bloc: "H6", porte: "Nord" },
      { tribune: "South Stand", bloc: "S8", porte: "Sud" }
    ),
  },
  {
    test: /craven cottage/i,
    secteurs: lateral(
      { tribune: "Johnny Haynes", bloc: "JH2", porte: "Sud" },
      { tribune: "Riverside", bloc: "R4", porte: "Nord" },
      { tribune: "Johnny Haynes", bloc: "JH8", porte: "Sud" },
      { tribune: "Hammersmith", bloc: "H3", porte: "Est" },
      { tribune: "Putney End", bloc: "P6", porte: "Ouest" }
    ),
  },
  {
    test: /selhurst/i,
    secteurs: lateral(
      { tribune: "Main Stand", bloc: "M3", porte: "Ouest" },
      { tribune: "Arthur Wait", bloc: "AW4", porte: "Est" },
      { tribune: "Main Stand", bloc: "M12", porte: "Ouest" },
      { tribune: "Holmesdale", bloc: "HR6", porte: "Sud" },
      { tribune: "Whitehorse", bloc: "WH8", porte: "Nord" }
    ),
  },
  {
    test: /elland road/i,
    secteurs: lateral(
      { tribune: "Don Revie", bloc: "R3", porte: "Ouest" },
      { tribune: "East Stand", bloc: "E5", porte: "Est" },
      { tribune: "Don Revie", bloc: "R14", porte: "Ouest" },
      { tribune: "Kop", bloc: "K6", porte: "Nord" },
      { tribune: "South Stand", bloc: "S8", porte: "Sud" }
    ),
  },
  {
    test: /molineux/i,
    secteurs: lateral(
      { tribune: "Jack Hayward", bloc: "JH3", porte: "Ouest" },
      { tribune: "John Ireland", bloc: "JI5", porte: "Est" },
      { tribune: "Jack Hayward", bloc: "JH12", porte: "Ouest" },
      { tribune: "Steve Bull", bloc: "SB4", porte: "Sud" },
      { tribune: "Stan Cullis", bloc: "SC8", porte: "Nord" }
    ),
  },
  {
    test: /turf moor/i,
    secteurs: lateral(
      { tribune: "James Hargreaves", bloc: "JH2", porte: "Ouest" },
      { tribune: "Bob Lord", bloc: "BL4", porte: "Est" },
      { tribune: "James Hargreaves", bloc: "JH10", porte: "Ouest" },
      { tribune: "Jimmy McIlroy", bloc: "JM3", porte: "Nord" },
      { tribune: "Cricket Field", bloc: "CF6", porte: "Sud" }
    ),
  },
  {
    test: /city ground/i,
    secteurs: lateral(
      { tribune: "Brian Clough", bloc: "BC2", porte: "Ouest" },
      { tribune: "Peter Taylor", bloc: "PT4", porte: "Est" },
      { tribune: "Brian Clough", bloc: "BC10", porte: "Ouest" },
      { tribune: "Trent End", bloc: "TE3", porte: "Sud" },
      { tribune: "Bridgford", bloc: "BR6", porte: "Est" }
    ),
  },
  {
    test: /stadium of light/i,
    secteurs: lateral(
      { tribune: "West Stand", bloc: "W4", porte: "Ouest" },
      { tribune: "East Stand", bloc: "E6", porte: "Est" },
      { tribune: "West Stand", bloc: "W16", porte: "Ouest" },
      { tribune: "South Stand", bloc: "S8", porte: "Sud" },
      { tribune: "North Stand", bloc: "N10", porte: "Nord" }
    ),
  },
  {
    test: /gtech/i,
    secteurs: lateral(
      { tribune: "West Stand", bloc: "W3", porte: "Ouest" },
      { tribune: "East Stand", bloc: "E5", porte: "Est" },
      { tribune: "West Stand", bloc: "W12", porte: "Ouest" },
      { tribune: "South Stand", bloc: "S4", porte: "Sud" },
      { tribune: "North Stand", bloc: "N8", porte: "Nord" }
    ),
  },
  {
    test: /vitality/i,
    secteurs: lateral(
      { tribune: "Main Stand", bloc: "M2", porte: "Ouest" },
      { tribune: "East Stand", bloc: "E4", porte: "Est" },
      { tribune: "Main Stand", bloc: "M8", porte: "Ouest" },
      { tribune: "South Stand", bloc: "S3", porte: "Sud" },
      { tribune: "North Stand", bloc: "N6", porte: "Nord" }
    ),
  },
  {
    test: /american express|amex/i,
    secteurs: lateral(
      { tribune: "West Stand", bloc: "W4", porte: "Ouest" },
      { tribune: "East Stand", bloc: "E6", porte: "Est" },
      { tribune: "West Stand", bloc: "W14", porte: "Ouest" },
      { tribune: "South Stand", bloc: "S5", porte: "Sud" },
      { tribune: "North Stand", bloc: "N8", porte: "Nord" }
    ),
  },
  {
    test: /hill dickinson/i,
    secteurs: lateral(
      { tribune: "West Stand", bloc: "W4", porte: "Ouest" },
      { tribune: "East Stand", bloc: "E6", porte: "Est" },
      { tribune: "West Stand", bloc: "W16", porte: "Ouest" },
      { tribune: "South Stand", bloc: "S8", porte: "Sud" },
      { tribune: "North Stand", bloc: "N10", porte: "Nord" }
    ),
  },
];

export function idCategorie(categorie) {
  const m = String(categorie || "").toLowerCase().match(/cat\s*-?\s*(\d)/);
  return m ? `cat-${m[1]}` : "";
}

export function secteurStade(lieu, categorie) {
  const id = idCategorie(categorie);
  const enceinte = ENCEINTES.find((item) => item.test.test(String(lieu || "")));
  if (!enceinte || !id) return undefined;
  return enceinte.secteurs[id];
}
