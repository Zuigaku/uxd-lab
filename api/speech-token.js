// api/speech-token.js
export default async function handler(req, res) {
  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  if (!key || !region) {
    return res.status(500).json({ error: "AZURE_SPEECH_KEY/REGION missing" });
  }
  try {
    const r = await fetch(`https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
      method: "POST",
      headers: { "Ocp-Apim-Subscription-Key": key, "Content-Length": "0" }
    });
    const token = await r.text();
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(200).json({ token, region, expiresInSec: 540 });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "token fail" });
  }
}
