@echo off
REM PostgreSQL数据库导入脚本
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

REM 检查是否提供了SQL文件参数
if "%~1"=="" (
    echo ========================================
    echo PostgreSQL数据库导入工具
    echo ========================================
    echo 用法: import-db.bat [SQL文件路径]
    echo.
    echo 示例: import-db.bat backups\personnel_db_export_20260129_123456.sql
    echo ========================================
    pause
    exit /b 1
)

set SQL_FILE=%~1

REM 检查文件是否存在
if not exist "%SQL_FILE%" (
    echo ========================================
    echo 错误: 文件不存在！
    echo 文件路径: %SQL_FILE%
    echo ========================================
    pause
    exit /b 1
)

echo ========================================
echo PostgreSQL数据库导入工具
echo ========================================
echo 数据库名: %DB_NAME%
echo 导入文件: %SQL_FILE%
echo ========================================

REM 设置密码环境变量
set PGPASSWORD=%DB_PASSWORD%

REM 询问是否删除现有数据库
echo.
echo 警告: 导入前需要删除现有数据库！
set /p CONFIRM=确认继续？(Y/N): 

if /i not "%CONFIRM%"=="Y" (
    echo 操作已取消。
    pause
    exit /b 0
)

echo.
echo 正在删除现有数据库...
dropdb -h %DB_HOST% -p %DB_PORT% -U %DB_USER% %DB_NAME% --if-exists

if %errorlevel% neq 0 (
    echo 删除数据库失败！
    set PGPASSWORD=
    pause
    exit /b 1
)

echo 正在创建新数据库...
createdb -h %DB_HOST% -p %DB_PORT% -U %DB_USER% %DB_NAME%

if %errorlevel% neq 0 (
    echo 创建数据库失败！
    set PGPASSWORD=
    pause
    exit /b 1
)

echo 正在导入数据...
psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -f "%SQL_FILE%"

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo 导入成功！
    echo 数据库: %DB_NAME%
    echo ========================================
) else (
    echo.
    echo ========================================
    echo 导入失败！请检查SQL文件格式。
    echo ========================================
)

REM 清理环境变量
set PGPASSWORD=

pause
