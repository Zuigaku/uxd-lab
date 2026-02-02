// api/dify-talk.js
const allow = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
};

function difyRunUrl() {
  const id = process.env.DIFY_WORKFLOW_ID;
  return id
    ? `https://api.dify.ai/v1/workflows/${id}/run`
    : `https://api.dify.ai/v1/workflows/run`;
}

async function fwt(url, opts = {}, ms = 25000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ac.signal }); }
  finally { clearTimeout(t); }
}

async function getLineDisplayName(userId) {
  try {
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN || "";
    if (!token) return "";
    const r = await fwt(`https://api.line.me/v2/bot/profile/${encodeURIComponent(userId)}`, {
      headers: { Authorization: `Bearer ${token}` }
    }, 4000);
    if (!r.ok) return "";
    const j = await r.json().catch(() => ({}));
    return (j?.displayName || "").trim();
  } catch { return ""; }
}

export default async function handler(req, res) {
  allow(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const { userId, userName: fromClientName, current_talk, history } = req.body || {};

  if (!userId || !current_talk) {
      return res.status(400).json({ error: "userId/current_talk required" });
  }

  let userName = (fromClientName || "").trim();
  if (!userName) userName = await getLineDisplayName(userId);

  let prefs = { level_cog: 0.4, level_circ: 0.5, speech_rate: 1.0, ob_old: "80", ob_hobby: "編み物" };
  try {
    const base = `${req.headers["x-forwarded-proto"] || "https"}://${req.headers["x-forwarded-host"] || req.headers.host}`;
    const r = await fwt(`${base}/api/prefs?userId=${encodeURIComponent(userId)}`, {}, 4000);
    const j = await r.json().catch(() => ({}));
    if (j?.prefs) prefs = { ...prefs, ...j.prefs };
  } catch(e) {
      console.log("[dify-talk] prefs load fail:", e.message);
  }

  const inputs = {
    user_id: userId,
    user_name: userName || userId,
    current_talk: current_talk,
    history: history || "",
    level_cog: prefs.level_cog,
    level_circ: prefs.level_circ,
    speech_rate: prefs.speech_rate,
    ob_old: prefs.ob_old || "80",
    ob_hobby: prefs.ob_hobby || "編み物",
    replyToken: "",
  };

  try {
    const resp = await fwt(difyRunUrl(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.DIFY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs,
        response_mode: "blocking",
        user: userId || "line-user",
      }),
    }, 25000);

    const t = await resp.text();
    if (!resp.ok) {
      return res.status(500).json({ error: `dify ${resp.status}`, body: t.slice(0, 500) });
    }
    const j = JSON.parse(t);
    const reply = j?.data?.outputs?.text || "";
    if (!reply) {
      return res.status(500).json({ error: "no text in outputs", raw: j?.data?.outputs || {} });
    }

    return res.status(200).json({ reply, prefs, userName: inputs.user_name });

  } catch (e) {
    return res.status(500).json({ error: e?.message || "dify-talk fail" });
  }
}
