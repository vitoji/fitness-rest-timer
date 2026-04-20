module.exports = async (req, res) => {
    try {
        const { systemPrompt, userPrompt, messageHistory } = req.body;
        
        // 构建消息数组
        const messages = [
            { role: "system", content: systemPrompt },
            ...(messageHistory || []),
            { role: "user", content: userPrompt }
        ];
        
        // 调用minimax API (使用OpenAI兼容格式)
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
            throw new Error(`API调用失败: ${response.status}`);
        }
        
        const data = await response.json();
        // 处理OpenAI兼容格式的响应
        if (data.choices && data.choices[0] && data.choices[0].message) {
            const aiResponse = data.choices[0].message.content;
            res.json({ content: aiResponse });
        } else {
            console.error('API响应格式错误:', JSON.stringify(data));
            throw new Error('API响应格式错误');
        }
        
    } catch (error) {
        console.error('AI API错误:', error);
        res.status(500).json({ error: 'AI服务暂时不可用，请稍后重试' });
    }
};
