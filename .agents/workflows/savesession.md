---
description: 将当前会话总结并保存到 sessions 目录中
---

这个工作流会自动完成以下操作:
1. 通过后端 API 获取当前最活跃的会话消息
2. 使用 AI 对会话内容进行总结
3. 将总结和原始消息以 JSON 格式保存到 `sessions/session_时间戳.json`
4. 将易读的 Markdown 总结保存到 `sessions/summary_时间戳.md`

## 使用方法

```bash
/savesession
```

## 工作流程

// turbo
1. **执行保存脚本** - 执行 `bun run savesession`

## 输出示例

```
🔍 正在查找最近的活跃会话...
✅ 找到会话: session_1737704892014_ynsf2uc
📥 正在获取会话消息...
🤖 正在生成会话总结...

✨ 会话已保存:
- 数据文件: sessions/session_2026-01-24T06-08-30.json
- 总结文件: sessions/summary_2026-01-24T06-08-30.md

📋 总结预览:
本次会话主要讨论了 LangGraph 监控集成方案，实现了全链路追踪和监控仪表盘。
```
