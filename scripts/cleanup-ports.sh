#!/bin/bash

# ==========================================
# 端口清理脚本
# 作用: 自动查找并关闭占用指定端口的进程
# 会优先从根目录 .env 中读取 API_PORT 和 WEB_PORT
# ==========================================

echo "🔍 正在检查端口占用情况..."

# 尝试从 .env 获取端口，如果失败则使用默认值
if [ -f .env ]; then
    API_PORT=$(grep API_PORT .env | cut -d '=' -f2)
    WEB_PORT=$(grep WEB_PORT .env | cut -d '=' -f2)
    KNOWLEDGE_PORT=$(grep KNOWLEDGE_PORT .env | cut -d '=' -f2)
    MCP_PERSONNEL_PORT=$(grep MCP_PERSONNEL_PORT .env | cut -d '=' -f2)
    FILE_SERVICE_PORT=$(grep FILE_SERVICE_PORT .env | cut -d '=' -f2)
fi

# 设置默认值
API_PORT=${API_PORT:-8910}
WEB_PORT=${WEB_PORT:-8911}
KNOWLEDGE_PORT=${KNOWLEDGE_PORT:-8912}
MCP_PERSONNEL_PORT=${MCP_PERSONNEL_PORT:-8913}
FILE_SERVICE_PORT=${FILE_SERVICE_PORT:-8914}

PORTS=($API_PORT $WEB_PORT $KNOWLEDGE_PORT $MCP_PERSONNEL_PORT $FILE_SERVICE_PORT)

for PORT in "${PORTS[@]}"
do
    PID=$(lsof -t -i:$PORT)
    if [ -n "$PID" ]; then
        echo "发现进程 $PID 占用端口 $PORT. 正在清理..."
        kill -9 $PID
        if [ $? -eq 0 ]; then
            echo "✅ 成功清理端口 $PORT"
        else
            echo "❌ 清理端口 $PORT 失败"
        fi
    else
        echo "稳定: 端口 $PORT 已经空闲"
    fi
done

echo "✨ 所有清理操作已完成"
