import {
  changerCodeCompte,
  connecterCompte,
  cookieCompte,
  cookieCompteVide,
  enregistrerProfil,
  pdfBilletCompte,
  poserDemandeCompte,
  renvoyerBilletsCompte,
  sessionCompte,
} from "../lib/shop.js";

function reponse(body, status = 200, headers = {}) {
  return {
    statusCode: status,
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  };
}

async function avecSession(event) {
  const cookieHeader = event.headers?.cookie || event.headers?.Cookie || "";
  const session = await sessionCompte(cookieHeader);
  if (!session.ok) return null;
  return session;
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, body: "" };
  const cookieHeader = event.headers?.cookie || event.headers?.Cookie || "";

  if (event.httpMethod === "GET") {
    try {
      const session = await sessionCompte(cookieHeader);
      if (!session.ok) return reponse({ ok: false });
      return reponse(session);
    } catch {
      return reponse({ ok: false });
    }
  }

  if (event.httpMethod !== "POST") return reponse({ error: "Méthode refusée." }, 405);

  try {
    const body = JSON.parse(event.body || "{}");
    const action = String(body.action || "");

    if (action === "logout") {
      return reponse({ ok: true }, 200, { "Set-Cookie": cookieCompteVide() });
    }

    if (!action || action === "login") {
      const result = await connecterCompte(body.email, body.code);
      if (result.pending) return reponse({ ok: false, pending: true });
      if (!result.ok) return reponse({ ok: false });
      const { jeton, ...payload } = result;
      return reponse(payload, 200, { "Set-Cookie": cookieCompte(jeton) });
    }

    const session = await avecSession(event);
    if (!session) return reponse({ ok: false, error: "session" }, 401);

    if (action === "profil") {
      const result = await enregistrerProfil(session.email, body);
      return reponse(result);
    }
    if (action === "demande") {
      const result = await poserDemandeCompte(session.email, body);
      return reponse(result);
    }
    if (action === "renvoi") {
      const result = await renvoyerBilletsCompte(session.email, body.numero);
      return reponse(result);
    }
    if (action === "code") {
      const result = await changerCodeCompte(session.email, body.actuel, body.nouveau);
      return reponse(result);
    }
    if (action === "pdf") {
      const result = await pdfBilletCompte(session.email, body.ticket);
      if (!result.ok) return reponse({ ok: false }, 404);
      return reponse(result);
    }

    return reponse({ ok: false, error: "action" }, 400);
  } catch {
    return reponse({ ok: false }, 200);
  }
}
