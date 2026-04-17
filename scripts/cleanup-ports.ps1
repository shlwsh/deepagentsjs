# ==========================================
# 端口清理脚本 (Windows PowerShell)
# 作用: 自动查找并关闭占用指定端口的进程
# 会优先从根目录 .env 中读取 API_PORT 和 WEB_PORT
# ==========================================

Write-Host "🔍 正在检查端口占用情况..." -ForegroundColor Cyan

# 尝试从 .env 获取端口，如果失败则使用默认值
$API_PORT = 8910
$WEB_PORT = 8911
$KNOWLEDGE_PORT = 8912
$MCP_PERSONNEL_PORT = 8913
$FILE_SERVICE_PORT = 8914

if (Test-Path ".env") {
    $envContent = Get-Content ".env"
    foreach ($line in $envContent) {
        if ($line -match "^API_PORT=(.+)$") {
            $API_PORT = [int]$matches[1]
        }
        if ($line -match "^WEB_PORT=(.+)$") {
            $WEB_PORT = [int]$matches[1]
        }
        if ($line -match "^KNOWLEDGE_PORT=(.+)$") {
            $KNOWLEDGE_PORT = [int]$matches[1]
        }
        if ($line -match "^MCP_PERSONNEL_PORT=(.+)$") {
            $MCP_PERSONNEL_PORT = [int]$matches[1]
        }
        if ($line -match "^FILE_SERVICE_PORT=(.+)$") {
            $FILE_SERVICE_PORT = [int]$matches[1]
        }
    }
}

$PORTS = @($API_PORT, $WEB_PORT, $KNOWLEDGE_PORT, $MCP_PERSONNEL_PORT, $FILE_SERVICE_PORT)

foreach ($PORT in $PORTS) {
    # 查找占用端口的进程
    $connections = netstat -ano | Select-String ":$PORT\s"
    
    if ($connections) {
        $ProcessIDs = @()
        foreach ($connection in $connections) {
            $parts = $connection.ToString().Split() | Where-Object { $_ -ne "" }
            if ($parts.Length -ge 5) {
                $ProcessID = $parts[-1]
                if ($ProcessID -match "^\d+$" -and $ProcessIDs -notcontains $ProcessID) {
                    $ProcessIDs += $ProcessID
                }
            }
        }
        
        foreach ($ProcessID in $ProcessIDs) {
            try {
                $process = Get-Process -Id $ProcessID -ErrorAction SilentlyContinue
                if ($process) {
                    Write-Host "发现进程 $ProcessID ($($process.ProcessName)) 占用端口 $PORT. 正在强制清理..." -ForegroundColor Yellow
                    
                    # 首先尝试正常终止
                    Stop-Process -Id $ProcessID -Force -ErrorAction Stop
                    Start-Sleep -Milliseconds 500
                    
                    # 验证进程是否已终止
                    $stillRunning = Get-Process -Id $ProcessID -ErrorAction SilentlyContinue
                    if ($stillRunning) {
                        Write-Host "进程仍在运行，尝试强制终止..." -ForegroundColor Yellow
                        # 使用 taskkill 强制终止
                        & taskkill /PID $ProcessID /F /T 2>$null
                    }
                    
                    Write-Host "✅ 成功清理端口 $PORT (PID: $ProcessID)" -ForegroundColor Green
                } else {
                    Write-Host "进程 $ProcessID 已不存在" -ForegroundColor Gray
                }
            }
            catch {
                Write-Host "尝试使用 taskkill 强制终止进程 $ProcessID..." -ForegroundColor Yellow
                try {
                    & taskkill /PID $ProcessID /F /T 2>$null
                    if ($LASTEXITCODE -eq 0) {
                        Write-Host "✅ 强制清理端口 $PORT (PID: $ProcessID) 成功" -ForegroundColor Green
                    } else {
                        Write-Host "❌ 无法清理端口 $PORT (PID: $ProcessID)" -ForegroundColor Red
                    }
                }
                catch {
                    Write-Host "❌ 清理端口 $PORT (PID: $ProcessID) 失败: $($_.Exception.Message)" -ForegroundColor Red
                }
            }
        }
    } else {
        Write-Host "稳定: 端口 $PORT 已经空闲" -ForegroundColor Green
    }
}

Write-Host "✨ 所有清理操作已完成" -ForegroundColor Magenta