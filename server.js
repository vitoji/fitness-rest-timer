const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// 添加超时函数
const fetchWithTimeout = (url, options, timeout = 10000) => {
    return Promise.race([
        fetch(url, options),
        new Promise((_, reject) => setTimeout(() => reject(new Error('API调用超时')), timeout))
    ]);
};

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// AI API代理路由
app.post('/api/chat', async (req, res) => {
    try {
        // 设置响应超时
        const timeoutId = setTimeout(() => {
            res.status(504).json({ error: '请求超时，请稍后重试' });
        }, 15000);
        
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
        
        // 优化：使用单个API调用完成意图识别和处理
        const systemPrompt = `你是一个健身助手，需要完成以下任务：
1. 首先判断用户输入是否包含训练记录。训练记录包括：明确的训练动作、组数、次数、重量等信息。
2. 如果是训练记录：
   - 提取结构化信息，包括exercise（动作名称）、sets（组数）、reps（次数）、weight（重量）、unit（单位）
   - 生成简短的鼓励和确认回复（2-3句话）
   - 返回格式：{"intent": "训练记录", "workout": {"exercise": "动作", "sets": 组数, "reps": 次数, "weight": "重量", "unit": "单位"}, "response": "回复内容"}
3. 如果是闲聊：
   - 生成简短的健身相关回复（1-2句话）
   - 返回格式：{"intent": "闲聊", "response": "回复内容"}

请严格按照指定格式返回JSON，不要添加任何其他内容。`;
        
        const messages = buildMessagesWithHistory(userPrompt, messageHistory);
        
        const response = await fetchWithTimeout("https://api.minimax.io/anthropic/v1/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": process.env.MINIMAX_API_KEY
            },
            body: JSON.stringify({
                model: "MiniMax-M2.7",
                system: systemPrompt,
                messages: messages,
                max_tokens: 800,
                temperature: 0.7
            })
        });
        
        if (!response.ok) {
            throw new Error(`API调用失败: ${response.status}`);
        }
        
        const data = await response.json();
        let responseText = '';
        if (data.content && data.content.length > 0) {
            for (const block of data.content) {
                if (block.type === 'text') {
                    responseText += block.text;
                }
            }
        }
        
        console.log('API响应:', responseText);
        
        // 解析响应
        let result;
        try {
            result = JSON.parse(responseText);
        } catch (e) {
            throw new Error('API响应格式错误');
        }
        
        if (result.intent === '训练记录' && result.workout) {
            // 构建标准化的训练记录文本
            const workoutRecord = `${result.workout.exercise} ${result.workout.sets}组×${result.workout.reps}次 ${result.workout.weight}${result.workout.unit}`;
            
            res.json({
                content: result.response,
                isWorkoutRecord: true,
                extractedWorkout: workoutRecord,
                workoutData: result.workout
            });
        } else {
            res.json({
                content: result.response,
                isWorkoutRecord: false
            });
        }
        
        // 清除超时
        clearTimeout(timeoutId);
        
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
