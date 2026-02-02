// api/chat.js

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const API_KEY = process.env.DIFY_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'Server Error: DIFY_API_KEY is missing.' });

  const { text, inputs, userId, history } = req.body;

  try {
    // --- 1. 会話履歴の構築 ---
    let contextHistory = "";
    if (history && Array.isArray(history)) {
      const recentHistory = history.slice(-10);
      contextHistory = recentHistory.map(h => `${h.role === 'user' ? '若者' : '高齢者'}: ${h.text}`).join("\n");
    }

    // --- 2. データの整理 (ここが修正ポイント) ---
    const userText = text || "（無言）";
    const userName = String(inputs.user_name || "あなた");

    // Difyの「開始ノード」で定義されている変数名に合わせる
    const safeInputs = {
      ...inputs,
      user_name: userName,
      // ★重要: ここで 'current_talk' にユーザーの入力を入れる
      current_talk: userText,
      // 履歴も変数として渡す（Dify側で変数 'history' を作っておくことを推奨）
      history: contextHistory,
      // 念のため query にも入れておく
      query: userText
    };

    const payload = {
      inputs: safeInputs,
      response_mode: "blocking",
      user: userId || "user-123"
    };

    // --- 3. 送信 (Workflow APIとして送信) ---
    // 変数(current_talk等)を確実に渡すため、Workflow APIを使用
    const endpoint = 'https://api.dify.ai/v1/workflows/run';
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Dify API Error:", data);
      return res.status(response.status).json({ 
        error: "Dify API Error", 
        details: data.message 
      });
    }

    // レスポンス抽出
    const outputs = data.data.outputs;
    const answer = outputs.text || outputs.result || outputs.answer || JSON.stringify(outputs);

    return res.status(200).json({ answer: answer });

  } catch (error) {
    console.error("Server Internal Error:", error);
    return res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
}
