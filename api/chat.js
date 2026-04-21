module.exports = async (req, res) => {
    try {
        const { systemPrompt, userPrompt, messageHistory } = req.body;
        
        // 构建符合Anthropic格式的messages
        const anthropicMessages = [];
        
        // 添加消息历史（注意Anthropic格式中system是顶级参数，不在messages里）
        if (messageHistory && messageHistory.length > 0) {
            for (const msg of messageHistory) {
                // 确保role是user或assistant
                const role = msg.role === 'user' ? 'user' : 'assistant';
                anthropicMessages.push({
                    role: role,
                    content: msg.content
                });
            }
        }
        
        // 添加当前用户消息
        anthropicMessages.push({
            role: "user",
            content: userPrompt
        });
        
        // 调用Minimax的Anthropic兼容API
        const response = await fetch("https://api.minimax.io/anthropic/v1/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": process.env.MINIMAX_API_KEY
            },
            body: JSON.stringify({
                model: "MiniMax-M2.7",
                system: systemPrompt,
                messages: anthropicMessages,
                max_tokens: 1000,
                temperature: 1.0
            })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('API错误响应:', errorText);
            if (response.status === 529 || response.status === 429) {
                res.status(429).json({ error: 'API调用频率过高，请稍后重试' });
                return;
            }
            throw new Error(`API调用失败: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('API响应数据:', JSON.stringify(data));
        
        // 解析Anthropic格式的响应
        if (data.content && data.content.length > 0) {
            let aiResponse = '';
            for (const block of data.content) {
                if (block.type === 'text') {
                    aiResponse += block.text;
                }
            }
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


