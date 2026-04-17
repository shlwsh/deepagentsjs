@echo off
REM PostgreSQL数据库导出脚本
REM 数据库名: personnel_db
REM 用户名: postgres
REM 密码: postgres

setlocal enabledelayedexpansion

REM 设置数据库连接参数
set DB_NAME=personnel_db
set DB_USER=postgres
set DB_PASSWORD=postgres
set DB_HOST=localhost
set DB_PORT=5432

REM 设置导出文件名（带时间戳）
set TIMESTAMP=%date:~0,4%%date:~5,2%%date:~8,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set TIMESTAMP=%TIMESTAMP: =0%
set EXPORT_FILE=%DB_NAME%_export_%TIMESTAMP%.sql

REM 创建备份目录
if not exist "backups" mkdir backups

echo ========================================
echo PostgreSQL数据库导出工具
echo ========================================
echo 数据库名: %DB_NAME%
echo 导出文件: backups\%EXPORT_FILE%
echo ========================================

REM 设置密码环境变量
set PGPASSWORD=%DB_PASSWORD%

REM 执行导出
echo 正在导出数据库...
pg_dump -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -f "backups\%EXPORT_FILE%" --verbose

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo 导出成功！
    echo 文件位置: backups\%EXPORT_FILE%
    echo ========================================
) else (
    echo.
    echo ========================================
    echo 导出失败！请检查连接参数和权限。
    echo ========================================
)

REM 清理环境变量
set PGPASSWORD=

pause
