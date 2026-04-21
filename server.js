const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// AI API代理路由
app.post('/api/chat', async (req, res) => {
    try {
        const { systemPrompt, userPrompt, messageHistory } = req.body;
        
        const messages = [
            { role: "system", content: systemPrompt },
            ...(messageHistory || []),
            { role: "user", content: userPrompt }
        ];
        
        const response = await fetch("https://api.minimax.chat/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.MINIMAX_API_KEY}`
            },
            body: JSON.stringify({
                model: "MiniMax-M2.7",
                messages: messages,
                temperature: 1.0
            })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('API错误响应:', errorText);
            if (response.status === 529) {
                res.status(429).json({ error: 'API调用频率过高，请稍后重试' });
                return;
            }
            throw new Error(`API调用失败: ${response.status}`);
        }
        
        const data = await response.json();
        if (data.choices && data.choices[0] && data.choices[0].message) {
            res.json({ content: data.choices[0].message.content });
        } else {
            console.error('API响应格式错误:', JSON.stringify(data));
            throw new Error('API响应格式错误');
        }
        
    } catch (error) {
        console.error('AI API错误:', error);
        res.status(500).json({ error: 'AI服务暂时不可用，请稍后重试' });
    }
});



// 启动服务器
app.listen(PORT, () => {
    console.log(`🚀 服务器运行在 http://localhost:${PORT}`);
    console.log(`📱 访问地址：http://localhost:${PORT}/index.html`);
});
