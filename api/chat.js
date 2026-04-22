// 添加超时函数
const fetchWithTimeout = (url, options, timeout = 10000) => {
    return Promise.race([
        fetch(url, options),
        new Promise((_, reject) => setTimeout(() => reject(new Error('API调用超时')), timeout))
    ]);
};

module.exports = async (req, res) => {
    try {
        // 设置响应超时
        const timeoutId = setTimeout(() => {
            res.status(504).json({ error: '请求超时，请稍后重试' });
        }, 20000);
        
        const { userPrompt, messageHistory } = req.body;
        
        // 构建带历史的消息列表（只保留最近5条消息，减少数据传输）
        const buildMessagesWithHistory = (userMsg, history) => {
            const messages = [];
            if (history && history.length > 0) {
                // 只保留最近5条消息
                const recentHistory = history.slice(-5);
                for (const msg of recentHistory) {
                    const role = msg.role === 'user' ? 'user' : 'assistant';
                    messages.push({
                        role: role,
                        content: msg.content
                    });
                }
            }
            messages.push({
                role: "user",
                content: userMsg
            });
            return messages;
        };
        
        const messages = buildMessagesWithHistory(userPrompt, messageHistory);
        
        // 第1步：意图识别和数据提取（保守温度，确保准确性）
        const analysisPrompt = `你是一个意图识别和数据提取助手，需要完成以下任务：
1. 判断用户输入是否包含训练记录。训练记录包括：明确的训练动作、组数、次数、重量等信息。
2. 如果是训练记录，提取结构化信息。
3. 请以JSON格式返回，不要添加任何其他内容。

训练记录返回格式：
{"intent": "训练记录", "workout": {"exercise": "动作名称", "sets": 组数, "reps": 次数, "weight": "重量", "unit": "单位"}}

闲聊返回格式：
{"intent": "闲聊"}`;
        
        const analysisResponse = await fetchWithTimeout("https://api.minimax.io/anthropic/v1/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": process.env.MINIMAX_API_KEY
            },
            body: JSON.stringify({
                model: "MiniMax-M2.7",
                system: analysisPrompt,
                messages: messages,
                max_tokens: 400,
                temperature: 0.1
            })
        });
        
        if (!analysisResponse.ok) {
            throw new Error(`分析API调用失败: ${analysisResponse.status}`);
        }
        
        const analysisData = await analysisResponse.json();
        let analysisText = '';
        if (analysisData.content && analysisData.content.length > 0) {
            for (const block of analysisData.content) {
                if (block.type === 'text') {
                    analysisText += block.text;
                }
            }
        }
        
        console.log('分析响应:', analysisText);
        
        // 解析分析结果
        let analysisResult;
        try {
            analysisResult = JSON.parse(analysisText);
        } catch (e) {
            analysisResult = { intent: '闲聊' };
        }
        
        // 第2步：生成回复（较高温度，更有创造力）
        let chatPrompt;
        if (analysisResult.intent === '训练记录' && analysisResult.workout) {
            chatPrompt = `你是一个健身助手，用户刚刚记录了以下训练：
${analysisResult.workout.exercise} ${analysisResult.workout.sets}组×${analysisResult.workout.reps}次 ${analysisResult.workout.weight}${analysisResult.workout.unit}

请给出简短的鼓励和确认回复（2-3句话）。`;
        } else {
            chatPrompt = "你是一个健身组间休息助手，专门在用户健身休息期间提供简短、鼓励性的对话和健身相关建议。每条回复控制在1-2句话，不冗长，贴合健身场景，不分散训练注意力。";
        }
        
        const chatResponse = await fetchWithTimeout("https://api.minimax.io/anthropic/v1/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": process.env.MINIMAX_API_KEY
            },
            body: JSON.stringify({
                model: "MiniMax-M2.7",
                system: chatPrompt,
                messages: messages,
                max_tokens: 400,
                temperature: 0.7
            })
        });
        
        if (!chatResponse.ok) {
            throw new Error(`聊天API调用失败: ${chatResponse.status}`);
        }
        
        const chatData = await chatResponse.json();
        let chatMessage = '';
        if (chatData.content && chatData.content.length > 0) {
            for (const block of chatData.content) {
                if (block.type === 'text') {
                    chatMessage += block.text;
                }
            }
        }
        
        // 返回结果
        if (analysisResult.intent === '训练记录' && analysisResult.workout) {
            const workoutRecord = `${analysisResult.workout.exercise} ${analysisResult.workout.sets}组×${analysisResult.workout.reps}次 ${analysisResult.workout.weight}${analysisResult.workout.unit}`;
            res.json({
                content: chatMessage,
                isWorkoutRecord: true,
                extractedWorkout: workoutRecord,
                workoutData: analysisResult.workout
            });
        } else {
            res.json({
                content: chatMessage,
                isWorkoutRecord: false
            });
        }
        
        // 清除超时
        clearTimeout(timeoutId);
        
    } catch (error) {
        console.error('AI API错误:', error);
        res.status(500).json({ error: 'AI服务暂时不可用，请稍后重试' });
    }
};


