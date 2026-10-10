import { pngQr } from "../lib/shop.js";

const SITE = "https://primeleaguepass.com";

export async function handler(event) {
  const d = String(event.queryStringParameters?.d || "");
  if (!/^[A-Za-z0-9_-]{8,1200}$/.test(d)) return { statusCode: 404, body: "" };
  const png = pngQr(`${SITE}/valid.html?d=${d}`);
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400",
    },
    body: png.toString("base64"),
    isBase64Encoded: true,
  };
}
