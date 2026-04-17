# ==========================================
# 增强版端口清理脚本 (Windows PowerShell)
# 作用: 自动查找并强制关闭占用指定端口的进程
# 会优先从根目录 .env 中读取 API_PORT 和 WEB_PORT
# ==========================================

Write-Host "🔍 正在检查端口占用情况..." -ForegroundColor Cyan

# 尝试从 .env 获取端口，如果失败则使用默认值
$API_PORT = 3000
$WEB_PORT = 5173
$KNOWLEDGE_PORT = 3100
$MCP_PERSONNEL_PORT = 3001

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
    }
}

Write-Host "检查端口: API_PORT=$API_PORT, WEB_PORT=$WEB_PORT, KNOWLEDGE_PORT=$KNOWLEDGE_PORT, MCP_PERSONNEL_PORT=$MCP_PERSONNEL_PORT" -ForegroundColor Gray

$PORTS = @($API_PORT, $WEB_PORT, $KNOWLEDGE_PORT, $MCP_PERSONNEL_PORT)

function Kill-ProcessOnPort {
    param([int]$Port)
    
    Write-Host "`n检查端口 $Port..." -ForegroundColor Cyan
    
    # 使用 Get-NetTCPConnection (Windows 8+) 获取更准确的信息
    try {
        $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
        
        if ($connections) {
            foreach ($conn in $connections) {
                $processId = $conn.OwningProcess
                if ($processId -and $processId -ne 0) {
                    try {
                        $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
                        if ($process) {
                            Write-Host "发现进程 $processId ($($process.ProcessName)) 占用端口 $Port. 正在强制清理..." -ForegroundColor Yellow
                            
                            # 强制终止进程及其子进程
                            & taskkill /PID $processId /F /T 2>$null
                            
                            if ($LASTEXITCODE -eq 0) {
                                Write-Host "✅ 成功清理端口 $Port (PID: $processId)" -ForegroundColor Green
                            } else {
                                Write-Host "❌ 清理端口 $Port (PID: $processId) 失败" -ForegroundColor Red
                            }
                        }
                    }
                    catch {
                        Write-Host "❌ 处理进程 $processId 时出错: $($_.Exception.Message)" -ForegroundColor Red
                    }
                }
            }
        } else {
            Write-Host "稳定: 端口 $Port 已经空闲" -ForegroundColor Green
        }
    }
    catch {
        # 如果 Get-NetTCPConnection 不可用，回退到 netstat
        Write-Host "回退到 netstat 方式..." -ForegroundColor Yellow
        
        $netstatOutput = & netstat -ano | Select-String ":$Port\s.*LISTENING"
        
        if ($netstatOutput) {
            foreach ($line in $netstatOutput) {
                $parts = $line.ToString().Split() | Where-Object { $_ -ne "" }
                if ($parts.Length -ge 5) {
                    $processId = $parts[-1]
                    if ($processId -match "^\d+$" -and $processId -ne "0") {
                        try {
                            $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
                            if ($process) {
                                Write-Host "发现进程 $processId ($($process.ProcessName)) 占用端口 $Port. 正在强制清理..." -ForegroundColor Yellow
                                
                                # 强制终止进程及其子进程
                                & taskkill /PID $processId /F /T 2>$null
                                
                                if ($LASTEXITCODE -eq 0) {
                                    Write-Host "✅ 成功清理端口 $Port (PID: $processId)" -ForegroundColor Green
                                } else {
                                    Write-Host "❌ 清理端口 $Port (PID: $processId) 失败" -ForegroundColor Red
                                }
                            }
                        }
                        catch {
                            Write-Host "❌ 处理进程 $processId 时出错: $($_.Exception.Message)" -ForegroundColor Red
                        }
                    }
                }
            }
        } else {
            Write-Host "稳定: 端口 $Port 已经空闲" -ForegroundColor Green
        }
    }
}

# 清理每个端口
foreach ($PORT in $PORTS) {
    Kill-ProcessOnPort -Port $PORT
}

Write-Host "`n✨ 所有清理操作已完成" -ForegroundColor Magenta