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
        const { systemPrompt, userPrompt, messageHistory, type = 'chat' } = req.body;
        
        // 构建消息数组
        const messages = [
            { role: "system", content: systemPrompt },
            ...(messageHistory || []),
            { role: "user", content: userPrompt }
        ];
        
        let aiResponse;
        
        // 根据类型选择不同的处理逻辑
        if (type === 'workout') {
            // 训练记录处理
            aiResponse = await processWorkoutRecord(userPrompt);
        } else {
            // 普通聊天处理
            const response = await fetch("https://api.minimax.io/v1/chat/completions", {
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
                throw new Error(`API调用失败: ${response.status} - ${errorText}`);
            }
            
            const data = await response.json();
            if (data.choices && data.choices[0] && data.choices[0].message) {
                aiResponse = data.choices[0].message.content;
            } else {
                throw new Error('API响应格式错误');
            }
        }
        
        res.json({ content: aiResponse });
        
    } catch (error) {
        console.error('AI API错误:', error);
        res.status(500).json({ error: 'AI服务暂时不可用，请稍后重试' });
    }
});

// 处理训练记录
async function processWorkoutRecord(userInput) {
    const systemPrompt = "你是一个健身训练记录助手，专门从用户的自然语言输入中提取训练记录信息。请从用户的输入中提取以下信息：\n1. 动作名称\n2. 重量（如果有）\n3. 组数（如果有）\n4. 次数（如果有）\n\n请以结构化的格式返回，例如：\n动作：深蹲\n重量：50公斤\n组数：3\n次数：10\n\n如果某些信息不存在，请留空。";
    
    const response = await fetch("https://api.minimax.io/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.MINIMAX_API_KEY}`
        },
        body: JSON.stringify({
            model: "MiniMax-M2.7",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userInput }
            ],
            temperature: 0.3
        })
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        console.error('训练记录API错误响应:', errorText);
        throw new Error(`训练记录API调用失败: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    return data.choices[0].message.content;
}

// 启动服务器
app.listen(PORT, () => {
    console.log(`🚀 服务器运行在 http://localhost:${PORT}`);
    console.log(`📱 访问地址：http://localhost:${PORT}/index.html`);
});
