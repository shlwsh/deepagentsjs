#!/bin/bash
# PostgreSQL数据库导入脚本
# 数据库名: personnel_db
# 用户名: postgres
# 密码: postgres

# 设置数据库连接参数
DB_NAME="personnel_db"
DB_USER="postgres"
DB_PASSWORD="postgres"
DB_HOST="localhost"
DB_PORT="5432"

# 检查是否提供了SQL文件参数
if [ -z "$1" ]; then
    echo "========================================"
    echo "PostgreSQL数据库导入工具"
    echo "========================================"
    echo "用法: ./import-db.sh [SQL文件路径]"
    echo ""
    echo "示例: ./import-db.sh backups/personnel_db_export_20260129_123456.sql"
    echo "========================================"
    exit 1
fi

SQL_FILE="$1"

# 检查文件是否存在
if [ ! -f "$SQL_FILE" ]; then
    echo "========================================"
    echo "错误: 文件不存在！"
    echo "文件路径: $SQL_FILE"
    echo "========================================"
    exit 1
fi

echo "========================================"
echo "PostgreSQL数据库导入工具"
echo "========================================"
echo "数据库名: $DB_NAME"
echo "导入文件: $SQL_FILE"
echo "========================================"

# 设置密码环境变量
export PGPASSWORD=$DB_PASSWORD

# 询问是否删除现有数据库
echo ""
echo "警告: 导入前需要删除现有数据库！"
read -p "确认继续？(Y/N): " CONFIRM

if [ "$CONFIRM" != "Y" ] && [ "$CONFIRM" != "y" ]; then
    echo "操作已取消。"
    exit 0
fi

echo ""
echo "正在删除现有数据库..."
dropdb -h $DB_HOST -p $DB_PORT -U $DB_USER $DB_NAME --if-exists

if [ $? -ne 0 ]; then
    echo "删除数据库失败！"
    unset PGPASSWORD
    exit 1
fi

echo "正在创建新数据库..."
createdb -h $DB_HOST -p $DB_PORT -U $DB_USER $DB_NAME

if [ $? -ne 0 ]; then
    echo "创建数据库失败！"
    unset PGPASSWORD
    exit 1
fi

echo "正在导入数据..."
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$SQL_FILE"

if [ $? -eq 0 ]; then
    echo ""
    echo "========================================"
    echo "导入成功！"
    echo "数据库: $DB_NAME"
    echo "========================================"
else
    echo ""
    echo "========================================"
    echo "导入失败！请检查SQL文件格式。"
    echo "========================================"
fi

# 清理环境变量
unset PGPASSWORD
