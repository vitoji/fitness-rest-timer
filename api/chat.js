module.exports = async (req, res) => {
    try {
        const { systemPrompt, userPrompt, messageHistory } = req.body;
        
        // 构建消息数组
        const messages = [
            { role: "system", content: systemPrompt },
            ...(messageHistory || []),
            { role: "user", content: userPrompt }
        ];
        
        let aiResponse;
        let isWorkoutRecord = false;
        let extractedWorkout = null;
        
        // 首先检测用户输入是否是训练记录
        const detectionResult = await detectAndProcess(userPrompt);
        
        if (detectionResult.isWorkout) {
            isWorkoutRecord = true;
            extractedWorkout = detectionResult.data;
            aiResponse = `已为您保存训练记录：\n${extractedWorkout}\n\n继续加油！`;
        } else {
            // 普通聊天处理
            // 调用minimax API (使用OpenAI兼容格式)
            const response = await fetch("https://api.minimax.chat/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${process.env.MINIMAX_API_KEY}`
                },
                body: JSON.stringify({
                    model: "minimax-m2.7",
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
        
        res.json({ 
            content: aiResponse,
            isWorkoutRecord: isWorkoutRecord,
            extractedWorkout: extractedWorkout
        });
        
    } catch (error) {
        console.error('AI API错误:', error);
        res.status(500).json({ error: 'AI服务暂时不可用，请稍后重试' });
    }
};

// 检测并处理用户输入
async function detectAndProcess(userInput) {
    const systemPrompt = "你是一个智能助手，请分析用户的输入是否是健身训练记录。\n\n如果是训练记录，请提取结构化信息并按以下格式返回JSON：\n{\n  \"isWorkout\": true,\n  \"data\": \"动作：[动作名称]\\n重量：[重量]\\n组数：[组数]\\n次数：[次数]\"\n}\n\n如果不是训练记录，返回：\n{\n  \"isWorkout\": false,\n  \"data\": null\n}\n\n注意：只返回JSON，不要添加其他内容。";
    
    const response = await fetch("https://api.minimax.chat/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.MINIMAX_API_KEY}`
        },
        body: JSON.stringify({
            model: "minimax-m2.7",
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
    const content = data.choices[0].message.content;
    
    try {
        return JSON.parse(content);
    } catch (e) {
        console.error('解析JSON失败:', content);
        return { isWorkout: false, data: null };
    }
}
