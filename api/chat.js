// /api/chat.js
// 这是一个运行在 Vercel 服务器端的 Node.js 函数
// 用户看不到这里的代码，也看不到环境变量中的 Key

export default async function handler(req, res) {
    // 1. 安全限制：仅允许 POST 请求
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // 2. 从环境变量获取 Key (稍后在 Vercel 后台配置)
        const API_KEY = process.env.DEEPSEEK_KEY;
        if (!API_KEY) {
            throw new Error('Server Configuration Error: API Key missing');
        }

        // 3. 转发请求给 DeepSeek (或者是你用的那个 mkeai 代理)
        const response = await fetch('https://edge.tb.api.mkeai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}` // Key 在这里注入，用户看不见
            },
            body: JSON.stringify(req.body) // 透传前端发来的数据 (messages, model 等)
        });

        const data = await response.json();

        // 4. 将结果返回给前端
        return res.status(200).json(data);

    } catch (error) {
        console.error('Proxy Error:', error);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}