import { ShopError, lireCommande } from "../lib/shop.js";

function reponse(body, status = 200) {
  return {
    statusCode: status,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export async function handler(event) {
  if (event.httpMethod !== "GET") return reponse({ error: "Méthode refusée." }, 405);
  const params = event.queryStringParameters || {};
  try {
    const result = await lireCommande(params.commande, params.key);
    if (!result.paid) return reponse({ paid: false, ref: result.order.ref });
    return reponse({ paid: true, order: result.order });
  } catch (error) {
    const status = error instanceof ShopError ? error.status : 500;
    return reponse({ error: "Commande introuvable." }, status);
  }
}
