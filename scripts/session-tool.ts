/**
 * 会话管理工具
 * 支持会话总结保存和加载
 */

import { logger, config, getLocalISOTime, llm } from "./shim";
import { HumanMessage } from "@langchain/core/messages";
import * as fs from "fs";
import * as path from "path";

const API_URL = `http://localhost:${config.API_PORT}/api`;
const SESSIONS_DIR = path.join(process.cwd(), "sessions");

if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

async function getLatestSession() {
    const res = await fetch(`${API_URL}/sessions`);
    const { data } = await res.json();
    if (!data.sessions || data.sessions.length === 0) {
        throw new Error("没有活跃的会话");
    }
    // 获取最后活跃的会话
    return data.sessions.sort((a: any, b: any) =>
        new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime()
    )[0];
}

async function getSessionMessages(sessionId: string) {
    const res = await fetch(`${API_URL}/session/${sessionId}`);
    const { data } = await res.json();
    return data.messages;
}

async function summarizeSession(messages: any[]) {
    const chatHistory = messages.map(m => {
        const role = (m.id && m.id[m.id.length - 1] === 'HumanMessage') ? '用户' : 'AI';
        return `${role}: ${m.kwargs.content}`;
    }).join('\n');

    const prompt = `请为以下对话记录做一个简短的总结（约200字以内），突出核心话题和结论：\n\n${chatHistory}`;

    const response = await llm.invoke([new HumanMessage(prompt)]);
    return response.content.toString();
}

async function saveSession() {
    console.log("🔍 正在查找最近的活跃会话...");
    const latest = await getLatestSession();
    const sessionId = latest.id;
    console.log(`✅ 找到会话: ${sessionId}`);

    console.log("📥 正在获取会话消息...");
    const messages = await getSessionMessages(sessionId);
    if (messages.length === 0) {
        console.log("⚠️  会话中没有消息，无需保存");
        return;
    }

    console.log("🤖 正在生成会话总结...");
    const summary = await summarizeSession(messages);

    const timestamp = getLocalISOTime().replace(/[:.]/g, "-").slice(0, 19);
    const filename = `session_${timestamp}.json`;
    const filepath = path.join(SESSIONS_DIR, filename);

    // 转换为简单的保存格式
    const simpleMessages = messages.map(m => ({
        type: (m.id && m.id[m.id.length - 1] === 'HumanMessage') ? 'human' : 'ai',
        content: m.kwargs.content
    }));

    const sessionData = {
        sessionId,
        timestamp: getLocalISOTime(),
        summary,
        messages: simpleMessages
    };

    fs.writeFileSync(filepath, JSON.stringify(sessionData, null, 2));

    // 同时保存一个 md 文件供人类阅读
    const mdFilepath = path.join(SESSIONS_DIR, `summary_${timestamp}.md`);
    const mdContent = `# 会话总结 (${timestamp})\n\n## 总结\n${summary}\n\n## 会话 ID\n\`${sessionId}\`\n\n## 原始消息数\n${messages.length}`;
    fs.writeFileSync(mdFilepath, mdContent);

    console.log(`\n✨ 会话已保存:`);
    console.log(`- 数据文件: sessions/${filename}`);
    console.log(`- 总结文件: sessions/summary_${timestamp}.md`);
    console.log(`\n📋 总结预览:\n${summary}\n`);
}

async function loadLatestSession() {
    console.log("🔍 正在寻找最近保存的会话文件...");
    const files = fs.readdirSync(SESSIONS_DIR)
        .filter(f => f.startsWith("session_") && f.endsWith(".json"))
        .sort()
        .reverse();

    if (files.length === 0) {
        throw new Error("没有找到已保存的会话文件");
    }

    const latestFile = files[0];
    const filepath = path.join(SESSIONS_DIR, latestFile);
    console.log(`📂 加载文件: ${latestFile}`);

    const sessionData = JSON.parse(fs.readFileSync(filepath, "utf-8"));

    // 导入到当前或新会话 (我们可以使用数据中的 sessionId，或者干脆创建一个新的)
    // 为了方便，我们导入到名为 "restored_session" 的会话中，或者由用户指定
    const targetSessionId = "restored_" + Date.now();

    const res = await fetch(`${API_URL}/session/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            sessionId: targetSessionId,
            messages: sessionData.messages
        })
    });

    const result = await res.json();
    if (result.status === "success") {
        console.log(`\n✅ 成功加载会话内容！`);
        console.log(`- 会话 ID: ${targetSessionId}`);
        console.log(`- 导入消息: ${sessionData.messages.length} 条`);
        console.log(`- 原始总结: ${sessionData.summary}`);
        console.log(`\n💡 您现在可以使用会话 ID "${targetSessionId}" 继续之前的对话。`);
    } else {
        throw new Error(`加载失败: ${result.message}`);
    }
}

const command = process.argv[2];
if (command === "save") {
    saveSession().catch(err => {
        console.error("❌ 保存失败:", err.message);
        process.exit(1);
    });
} else if (command === "load") {
    loadLatestSession().catch(err => {
        console.error("❌ 加载失败:", err.message);
        process.exit(1);
    });
} else {
    console.log("使用方法: bun run scripts/session-tool.ts [save|load]");
}
