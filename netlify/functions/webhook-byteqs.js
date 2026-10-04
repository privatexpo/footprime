import { ShopError, paiementRecu, signatureValide } from "../lib/shop.js";

function reponse(body, status = 200) {
  return {
    statusCode: status,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function brut(event) {
  if (!event.body) return "";
  if (event.isBase64Encoded) return Buffer.from(event.body, "base64").toString("utf8");
  return event.body;
}

export async function handler(event) {
  if (event.httpMethod !== "POST") return reponse({ ok: false }, 405);
  const corps = brut(event);
  const headers = event.headers || {};
  const signature = headers["x-webhook-signature"] || headers["x-byteqs-signature"] || headers["stripe-signature"] || "";
  const quand = headers["x-webhook-timestamp"] || "";
  if (!signatureValide(corps, signature, quand)) return reponse({ ok: false }, 401);
  try {
    const json = JSON.parse(corps);
    const result = await paiementRecu(json);
    return reponse({ ok: true, ...result });
  } catch (error) {
    const status = error instanceof ShopError ? error.status : 500;
    return reponse({ ok: false }, status);
  }
}
