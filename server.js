// server.js
// 这是一个标准的 Node.js Express 服务器

const express = require('express');
const path = require('path');
const app = express();

// 1. 启用 JSON 解析，以便处理 POST 请求数据
app.use(express.json());

// 2. 托管静态文件 (前端网页)
// 将 public 文件夹里的 index.html, style.css 等暴露给浏览器
app.use(express.static(path.join(__dirname, 'public')));

// 3. 后端 API 接口 (隐藏 Key 的核心逻辑)
app.post('/api/chat', async (req, res) => {
    try {
        // const API_KEY = process.env.DEEPSEEK_KEY; // 从环境变量读取 Key
        const API_KEY = "sk-t741Aph1aaXnU9ZUhGV1NjlYbNBGRSuLw23AYgaLGTqmRRz5";
        if (!API_KEY) {
            throw new Error('服务器未配置 API Key');
        }

        // 转发请求给 DeepSeek
        // 注意：这里使用了原生的 fetch (Node.js 18+ 支持)
        const response = await fetch('https://edge.tb.api.mkeai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify(req.body)
        });

        const data = await response.json();
        res.json(data);

    } catch (error) {
        console.error('Proxy Error:', error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});

// 4. 启动服务器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});