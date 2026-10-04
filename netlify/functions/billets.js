import { retrouver } from "../lib/shop.js";

function reponse(body, status = 200) {
  return {
    statusCode: status,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, body: "" };
  if (event.httpMethod !== "POST") return reponse({ error: "Méthode refusée." }, 405);
  try {
    const body = JSON.parse(event.body || "{}");
    const result = await retrouver(body.email, body.code);
    if (!result) return reponse({ order: null });
    if (result.pending) return reponse({ order: null, pending: true });
    return reponse({ order: result.order });
  } catch {
    return reponse({ order: null }, 200);
  }
}
