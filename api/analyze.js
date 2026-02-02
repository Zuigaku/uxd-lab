// api/analyze.js

export default async function handler(req, res) {
  // POSTメソッド以外は拒否
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const API_KEY = process.env.DIFY_ANALYSIS_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'Server Error: DIFY_ANALYSIS_KEY is missing.' });

  const { inputs, userId } = req.body;

  // ガード: 必須項目が空の場合のデフォルト値を設定
  const safeInputs = {
    selected_quotes: inputs?.selected_quotes || "（特になし）",
    parameters: inputs?.parameters || "設定なし",
    scenario: inputs?.scenario || "不明",
    // 数値型は必ず数値として送る
    stress_count: Number(inputs?.stress_count ?? 0),
    pause_count: Number(inputs?.pause_count ?? 0),
    vas_value: Number(inputs?.vas_value ?? 50),
    emotion_tags: inputs?.emotion_tags || "なし",
    // ユーザー名もinputsに含める
    user_name: inputs?.user_name || "あなた"
  };

  try {
    const endpoint = 'https://api.dify.ai/v1/workflows/run';

    // ワークフロー型APIの厳密なペイロード
    // textやqueryをトップレベルに含めるとエラーになる場合があるため除外
    const payload = {
      inputs: safeInputs,
      response_mode: "blocking",
      user: userId || "analysis-user"
    };

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
      console.error("Dify Analysis Error:", data);
      return res.status(response.status).json({ 
        error: "Dify API Error", 
        details: data.message 
      });
    }

    // ワークフローの出力変数を取得 (通常は result または text)
    const outputs = data.data.outputs;
    const resultText = outputs.result || outputs.text || outputs.answer || JSON.stringify(outputs);

    return res.status(200).json({ answer: resultText });

  } catch (error) {
    console.error("Analyze API Internal Error:", error);
    return res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
}
