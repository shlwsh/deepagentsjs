@echo off
setlocal enabledelayedexpansion
REM ==========================================
REM 端口清理脚本 (Windows Batch)
REM 作用: 自动查找并关闭占用指定端口的进程
REM 会优先从根目录 .env 中读取端口配置
REM ==========================================

echo 🔍 正在检查端口占用情况...

REM 设置默认端口
set API_PORT=8910
set WEB_PORT=8911
set KNOWLEDGE_PORT=8912
set MCP_PERSONNEL_PORT=8913
set FILE_SERVICE_PORT=8914
set VECTOR_STORE_PORT=8915

REM 尝试从 .env 文件读取端口配置
if exist .env (
    for /f "tokens=1,2 delims==" %%a in (.env) do (
        if "%%a"=="API_PORT" set API_PORT=%%b
        if "%%a"=="WEB_PORT" set WEB_PORT=%%b
        if "%%a"=="KNOWLEDGE_PORT" set KNOWLEDGE_PORT=%%b
        if "%%a"=="MCP_PERSONNEL_PORT" set MCP_PERSONNEL_PORT=%%b
        if "%%a"=="FILE_SERVICE_PORT" set FILE_SERVICE_PORT=%%b
        if "%%a"=="VECTOR_STORE_PORT" set VECTOR_STORE_PORT=%%b
    )
)

echo 检查端口: API=%API_PORT%, WEB=%WEB_PORT%, KNOWLEDGE=%KNOWLEDGE_PORT%, MCP=%MCP_PERSONNEL_PORT%, FILE=%FILE_SERVICE_PORT%, VECTOR=%VECTOR_STORE_PORT%

REM 清理 Agent 服务端口
call :cleanup_port %API_PORT% "Agent 服务"

REM 清理 WEB 端口
call :cleanup_port %WEB_PORT% "Web 前端"

REM 清理知识库服务端口
call :cleanup_port %KNOWLEDGE_PORT% "知识库服务"

REM 清理 MCP Personnel 服务端口
call :cleanup_port %MCP_PERSONNEL_PORT% "MCP 服务"

REM 清理文件服务端口
call :cleanup_port %FILE_SERVICE_PORT% "文件服务"

REM 清理向量库服务端口
call :cleanup_port %VECTOR_STORE_PORT% "向量库服务"

echo.
echo ✨ 所有清理操作已完成
pause
exit /b

:cleanup_port
set PORT=%~1
set SERVICE_NAME=%~2
echo.
echo 检查端口 %PORT% ^(%SERVICE_NAME%^)...
set "found=false"
for /f "tokens=1,2,3,4,5" %%a in ('netstat -ano ^| findstr ":%PORT% " ^| findstr "LISTENING"') do (
    if not "%%e"=="0" (
        set "found=true"
        echo 发现进程 %%e 占用端口 %PORT%. 正在强制清理...
        taskkill /PID %%e /F /T >nul 2>&1
        if !errorlevel! equ 0 (
            echo ✅ 成功清理端口 %PORT% ^(PID: %%e^)
        ) else (
            echo ❌ 清理端口 %PORT% ^(PID: %%e^) 失败，尝试强制终止...
            wmic process where "ProcessId=%%e" delete >nul 2>&1
            if !errorlevel! equ 0 (
                echo ✅ 强制清理端口 %PORT% ^(PID: %%e^) 成功
            ) else (
                echo ❌ 无法清理端口 %PORT% ^(PID: %%e^)
            )
        )
    )
)
if "%found%"=="false" (
    echo ✓ 端口 %PORT% 已经空闲
)
exit /b