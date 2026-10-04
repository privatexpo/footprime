import { ShopError, lireCommande, livrerTest } from "../lib/shop.js";

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
    if (!result.paid && !result.order.test) return reponse({ paid: false, ref: result.order.ref });
    if (result.order.test) {
      await livrerTest(result.order.wooId, Object.values(params)).catch(() => {});
      const frais = await lireCommande(params.commande, params.key);
      return reponse({ paid: true, order: frais.order });
    }
    return reponse({ paid: true, order: result.order });
  } catch (error) {
    const status = error instanceof ShopError ? error.status : 500;
    return reponse({ error: "Commande introuvable." }, status);
  }
}
