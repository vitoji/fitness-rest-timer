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
        const { userPrompt, messageHistory } = req.body;
        
        // 构建带历史的消息列表
        const buildMessagesWithHistory = (userMsg, history) => {
            const messages = [];
            if (history && history.length > 0) {
                for (const msg of history) {
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
        
        // 步骤1：意图识别 - 判断用户输入是闲聊还是训练记录
        const intentSystemPrompt = "你是一个意图识别助手，专门判断用户输入是否包含训练记录。训练记录包括：1. 明确的训练动作（如深蹲、卧推、哑铃划船、肩部助推等）2. 训练组数、次数、重量等信息 3. 与训练相关的描述（如'做了'、'完成了'、'练了'等） 请只返回'训练记录'或'闲聊'，不要返回其他任何内容。注意要结合对话历史上下文来判断，特别是当用户在多轮对话中补充训练信息时。即使有拼写错误，也要尝试理解用户的意图。";
        
        const intentResponse = await fetch("https://api.minimax.io/anthropic/v1/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": process.env.MINIMAX_API_KEY
            },
            body: JSON.stringify({
                model: "MiniMax-M2.7",
                system: intentSystemPrompt,
                messages: buildMessagesWithHistory(userPrompt, messageHistory),
                max_tokens: 100,
                temperature: 0.1
            })
        });
        
        if (!intentResponse.ok) {
            throw new Error(`意图识别API调用失败: ${intentResponse.status}`);
        }
        
        const intentData = await intentResponse.json();
        let intent = '';
        if (intentData.content && intentData.content.length > 0) {
            for (const block of intentData.content) {
                if (block.type === 'text') {
                    intent += block.text;
                }
            }
        }
        
        intent = intent.trim();
        console.log('意图识别结果:', intent);
        
        if (intent === '训练记录') {
            // 步骤2：如果是训练记录，提取结构化数据
            const extractSystemPrompt = "你是一个训练记录提取助手，请从用户输入和对话历史中提取训练记录的结构化信息。注意要结合上下文，从多轮对话中提取完整的训练信息。例如：如果用户先说白'我做了深蹲'，然后说'做了10组'，最后说'每组10公斤'，你应该提取出完整的训练记录。只返回JSON格式，包含exercise（动作名称）、sets（组数）、reps（次数）、weight（重量）、unit（单位）字段。只返回JSON，不要返回其他任何内容。即使信息不完整，也要尽可能提取你能识别的信息。";
            
            const extractResponse = await fetch("https://api.minimax.io/anthropic/v1/messages", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": process.env.MINIMAX_API_KEY
                },
                body: JSON.stringify({
                    model: "MiniMax-M2.7",
                    system: extractSystemPrompt,
                    messages: buildMessagesWithHistory(userPrompt, messageHistory),
                    max_tokens: 500,
                    temperature: 0.1
                })
            });
            
            if (!extractResponse.ok) {
                throw new Error(`训练记录提取API调用失败: ${extractResponse.status}`);
            }
            
            const extractData = await extractResponse.json();
            let extractedData = '';
            if (extractData.content && extractData.content.length > 0) {
                for (const block of extractData.content) {
                    if (block.type === 'text') {
                        extractedData += block.text;
                    }
                }
            }
            
            console.log('提取的训练记录数据:', extractedData);
            
            let workoutData;
            try {
                workoutData = JSON.parse(extractedData);
            } catch (e) {
                workoutData = {
                    exercise: "未知动作",
                    sets: 1,
                    reps: 10,
                    weight: "未知",
                    unit: "kg"
                };
            }
            
            // 构建标准化的训练记录文本
            const workoutRecord = `${workoutData.exercise} ${workoutData.sets}组×${workoutData.reps}次 ${workoutData.weight}${workoutData.unit}`;
            
            // 步骤3：生成训练记录确认回复
            const confirmSystemPrompt = "你是一个健身助手，当用户记录训练时，给出简短的鼓励和确认。回复要积极、专业，控制在2-3句话。注意要结合对话历史上下文，了解用户的训练情况。";
            
            const confirmResponse = await fetch("https://api.minimax.io/anthropic/v1/messages", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": process.env.MINIMAX_API_KEY
                },
                body: JSON.stringify({
                    model: "MiniMax-M2.7",
                    system: confirmSystemPrompt,
                    messages: buildMessagesWithHistory(userPrompt, messageHistory),
                    max_tokens: 300,
                    temperature: 0.7
                })
            });
            
            if (!confirmResponse.ok) {
                throw new Error(`确认回复API调用失败: ${confirmResponse.status}`);
            }
            
            const confirmData = await confirmResponse.json();
            let confirmMessage = '';
            if (confirmData.content && confirmData.content.length > 0) {
                for (const block of confirmData.content) {
                    if (block.type === 'text') {
                        confirmMessage += block.text;
                    }
                }
            }
            
            res.json({
                content: confirmMessage,
                isWorkoutRecord: true,
                extractedWorkout: workoutRecord,
                workoutData: workoutData
            });
            
        } else {
            // 步骤2：如果是闲聊，进行正常对话
            const chatSystemPrompt = "你是一个健身组间休息助手，专门在用户健身休息期间提供简短、鼓励性的对话和健身相关建议。每条回复控制在1-2句话，不冗长，贴合健身场景，不分散训练注意力。";
            
            // 构建符合Anthropic格式的messages
            const anthropicMessages = [];
            
            // 添加消息历史
            if (messageHistory && messageHistory.length > 0) {
                for (const msg of messageHistory) {
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
            
            const chatResponse = await fetch("https://api.minimax.io/anthropic/v1/messages", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": process.env.MINIMAX_API_KEY
                },
                body: JSON.stringify({
                    model: "MiniMax-M2.7",
                    system: chatSystemPrompt,
                    messages: anthropicMessages,
                    max_tokens: 500,
                    temperature: 0.7
                })
            });
            
            if (!chatResponse.ok) {
                throw new Error(`闲聊回复API调用失败: ${chatResponse.status}`);
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
            
            res.json({
                content: chatMessage,
                isWorkoutRecord: false
            });
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
