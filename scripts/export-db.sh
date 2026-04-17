#!/bin/bash
# PostgreSQL数据库导出脚本
# 数据库名: personnel_db
# 用户名: postgres
# 密码: postgres

# 设置数据库连接参数
DB_NAME="personnel_db"
DB_USER="postgres"
DB_PASSWORD="postgres"
DB_HOST="localhost"
DB_PORT="5432"

# 设置导出文件名（带时间戳）
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
EXPORT_FILE="${DB_NAME}_export_${TIMESTAMP}.sql"

# 创建备份目录
mkdir -p backups

echo "========================================"
echo "PostgreSQL数据库导出工具"
echo "========================================"
echo "数据库名: $DB_NAME"
echo "导出文件: backups/$EXPORT_FILE"
echo "========================================"

# 设置密码环境变量
export PGPASSWORD=$DB_PASSWORD

# 执行导出
echo "正在导出数据库..."
pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "backups/$EXPORT_FILE" --verbose

if [ $? -eq 0 ]; then
    echo ""
    echo "========================================"
    echo "导出成功！"
    echo "文件位置: backups/$EXPORT_FILE"
    echo "========================================"
else
    echo ""
    echo "========================================"
    echo "导出失败！请检查连接参数和权限。"
    echo "========================================"
fi

# 清理环境变量
unset PGPASSWORD
