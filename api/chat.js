module.exports = async (req, res) => {
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
            // 使用火山引擎doubao模型进行训练记录抽取
            aiResponse = await processWorkoutRecord(userPrompt);
        } else {
            // 普通聊天处理
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
                const errorText = await response.text();
                console.error('API错误响应:', errorText);
                if (response.status === 529) {
                    // 处理速率限制错误
                    res.status(429).json({ error: 'API调用频率过高，请稍后重试' });
                    return;
                }
                throw new Error(`API调用失败: ${response.status} - ${errorText}`);
            }
            
            const data = await response.json();
            // 处理OpenAI兼容格式的响应
            if (data.choices && data.choices[0] && data.choices[0].message) {
                aiResponse = data.choices[0].message.content;
            } else {
                console.error('API响应格式错误:', JSON.stringify(data));
                throw new Error('API响应格式错误');
            }
        }
        
        res.json({ content: aiResponse });
        
    } catch (error) {
        console.error('AI API错误:', error);
        res.status(500).json({ error: 'AI服务暂时不可用，请稍后重试' });
    }
};

// 处理训练记录
async function processWorkoutRecord(userInput) {
    // 这里可以集成火山引擎的doubao语音大模型
    // 目前使用minimax模型作为替代
    
    const systemPrompt = "你是一个健身训练记录助手，专门从用户的自然语言输入中提取训练记录信息。请从用户的输入中提取以下信息：
1. 动作名称
2. 重量（如果有）
3. 组数（如果有）
4. 次数（如果有）

请以结构化的格式返回，例如：
动作：深蹲
重量：50公斤
组数：3
次数：10

如果某些信息不存在，请留空。";
    
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
        throw new Error(`API调用失败: ${response.status}`);
    }
    
    const data = await response.json();
    return data.choices[0].message.content;
}
