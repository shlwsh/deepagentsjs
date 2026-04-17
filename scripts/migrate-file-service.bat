@echo off
REM ==========================================
REM 文件服务数据库迁移脚本 (Windows Batch)
REM 
REM 用法:
REM   migrate-file-service.bat up    # 向上迁移（创建表）
REM   migrate-file-service.bat down  # 向下迁移（删除表）
REM ==========================================

if "%1"=="" (
    echo ❌ 缺少参数
    echo.
    echo 用法:
    echo   migrate-file-service.bat up    # 向上迁移（创建表）
    echo   migrate-file-service.bat down  # 向下迁移（删除表）
    exit /b 1
)

if not "%1"=="up" if not "%1"=="down" (
    echo ❌ 无效的命令: %1
    echo.
    echo 用法:
    echo   migrate-file-service.bat up    # 向上迁移（创建表）
    echo   migrate-file-service.bat down  # 向下迁移（删除表）
    exit /b 1
)

echo ========================================
echo 文件服务数据库迁移
echo ========================================
echo.

bun run scripts/migrate-file-service.ts %1

if %errorlevel% neq 0 (
    echo.
    echo ❌ 迁移失败
    pause
    exit /b 1
)

echo.
echo ✅ 迁移成功
pause
