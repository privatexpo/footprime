import {
  connecterCompte,
  cookieCompte,
  cookieCompteVide,
  sessionCompte,
} from "../lib/shop.js";

function reponse(body, status = 200, headers = {}) {
  return {
    statusCode: status,
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  };
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, body: "" };
  const cookieHeader = event.headers?.cookie || event.headers?.Cookie || "";

  if (event.httpMethod === "GET") {
    try {
      const session = await sessionCompte(cookieHeader);
      if (!session.ok) return reponse({ ok: false, orders: [] });
      return reponse({ ok: true, email: session.email, orders: session.orders });
    } catch {
      return reponse({ ok: false, orders: [] });
    }
  }

  if (event.httpMethod !== "POST") return reponse({ error: "Méthode refusée." }, 405);

  try {
    const body = JSON.parse(event.body || "{}");
    if (body.action === "logout") {
      return reponse({ ok: true }, 200, { "Set-Cookie": cookieCompteVide() });
    }
    const result = await connecterCompte(body.email, body.code);
    if (result.pending) return reponse({ ok: false, pending: true });
    if (!result.ok) return reponse({ ok: false, orders: [] });
    return reponse(
      { ok: true, email: result.email, orders: result.orders },
      200,
      { "Set-Cookie": cookieCompte(result.jeton) }
    );
  } catch {
    return reponse({ ok: false, orders: [] }, 200);
  }
}
