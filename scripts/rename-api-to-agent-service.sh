#!/bin/bash

# 批量替换 packages/agent-service 为 packages/agent-service 的脚本

echo "开始批量替换 packages/agent-service 为 packages/agent-service..."

# 排除的目录
EXCLUDE_DIRS="node_modules|\.git|\.kiro|dist|build|target"

# 查找并替换所有文件中的引用
find . -type f \( -name "*.md" -o -name "*.ts" -o -name "*.json" -o -name "*.sh" \) \
  | grep -Ev "$EXCLUDE_DIRS" \
  | while read file; do
    if grep -q "packages/agent-service" "$file" 2>/dev/null; then
      echo "处理文件: $file"
      # macOS 使用 sed -i '' 
      if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' 's|packages/agent-service|packages/agent-service|g' "$file"
      else
        sed -i 's|packages/agent-service|packages/agent-service|g' "$file"
      fi
    fi
  done

echo "替换完成！"
echo "请检查以下文件是否需要手动调整："
echo "- package.json"
echo "- README.md"
echo "- CLAUDE.md"
echo "- docs/ 目录下的文档"
