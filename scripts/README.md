# Scripts Directory

This directory contains utility scripts for managing the development environment and project operations.

## Port Cleanup Scripts

These scripts help clean up processes that are occupying development ports, which is useful when you need to restart the development servers.

### Available Scripts

1. **cleanup-ports.sh** - Original bash script for Unix/Linux/macOS
2. **cleanup-ports.ps1** - PowerShell script for Windows
3. **cleanup-ports-enhanced.ps1** - Enhanced PowerShell script with better process detection
4. **cleanup-ports.bat** - Batch script for Windows CMD

### Usage

#### Enhanced PowerShell (Recommended for Windows)
```powershell
# Run from project root - Most robust option
powershell -ExecutionPolicy Bypass -File scripts/cleanup-ports-enhanced.ps1
```

#### Standard PowerShell
```powershell
# Run from project root
powershell -ExecutionPolicy Bypass -File scripts/cleanup-ports.ps1
```

#### Batch File (Windows CMD)
```cmd
# Run from project root
scripts\cleanup-ports.bat
```

#### Bash (Unix/Linux/macOS)
```bash
# Run from project root
chmod +x scripts/cleanup-ports.sh
./scripts/cleanup-ports.sh
```

### Features

- Automatically reads port configuration from `.env` file
- Falls back to default ports (3000 for API, 5173 for Web) if `.env` is not found
- Shows process names and PIDs before terminating
- Provides colored output for better visibility
- Handles errors gracefully

### Default Ports

- **API_PORT**: 3000
- **WEB_PORT**: 5173

These can be overridden by setting the corresponding values in your `.env` file.

### Script Comparison

| Script | Platform | Robustness | Process Detection | Force Kill |
|--------|----------|------------|-------------------|------------|
| cleanup-ports.sh | Unix/Linux/macOS | ⭐⭐⭐ | lsof | kill -9 |
| cleanup-ports.ps1 | Windows | ⭐⭐⭐ | netstat + parsing | Stop-Process + taskkill |
| cleanup-ports-enhanced.ps1 | Windows | ⭐⭐⭐⭐⭐ | Get-NetTCPConnection + netstat fallback | taskkill /F /T |
| cleanup-ports.bat | Windows CMD | ⭐⭐⭐ | netstat + improved parsing | taskkill /F /T + wmic |

**Recommendation**: Use `cleanup-ports-enhanced.ps1` for the most reliable port cleanup on Windows systems.

## Version Management Scripts

These scripts help manage project version numbers according to the project's version management rules.

### Available Scripts

1. **upgrade-version.ts** - Upgrade project version through API
2. **adjust-version.ts** - Manually adjust or reset version information

### Version Format

The project uses the format: `主版本.日期.序号` (e.g., `10.20260126.001`)
- **主版本**: Fixed at `10`
- **日期**: `YYYYMMDD` format (current date)
- **序号**: `001-999` (incremental sequence number for the same day)

### Version Upgrade Script

Upgrades the project version through the API interface.

```bash
# Basic upgrade (auto-increment sequence number)
bun run scripts/upgrade-version.ts

# Upgrade with description
bun run scripts/upgrade-version.ts --description "New feature release"

# Force upgrade (for special cases)
bun run scripts/upgrade-version.ts --force --description "Emergency fix"

# Specify API URL
bun run scripts/upgrade-version.ts --api-url "http://localhost:8080"
```

#### Options
- `--description, -d TEXT`: Version upgrade description
- `--force, -f`: Force upgrade
- `--api-url URL`: API service address (default: http://localhost:3000)
- `--help, -h`: Show help information

### Version Adjustment Script

Manually adjust or reset version information.

```bash
# Show current version
bun run scripts/adjust-version.ts --current

# Adjust to specific version
bun run scripts/adjust-version.ts 10.20260126.005 "Manual version adjustment"

# Generate next version number
bun run scripts/adjust-version.ts --next

# Reset version system
bun run scripts/adjust-version.ts --reset
```

#### Options
- `--current, -c`: Show current version information
- `--next, -n`: Generate next version number
- `--reset`: Reset version system (creates backup)
- `--help, -h`: Show help information

### Version Upgrade Rules

#### Same-day Upgrade
- Current: `10.20260126.001`
- After upgrade: `10.20260126.002` (sequence increments)
- Next upgrade: `10.20260126.003`
- Maximum sequence: `10.20260126.999`

#### Cross-day Upgrade
- Current: `10.20260126.005`
- Next day upgrade: `10.20260127.001` (sequence resets to 001)

### Version Management API Endpoints

- **GET /api/version** - Get current version information
- **POST /api/version/upgrade** - Upgrade version
- **GET /api/version/history** - Get version history
- **GET /api/version/stats** - Get version statistics
- **GET /api/version/health** - Health check

### Manual Version Adjustment Methods

#### Method 1: API Interface (Recommended)
```bash
# PowerShell
Invoke-RestMethod -Uri "http://localhost:3000/api/version/upgrade" -Method POST -ContentType "application/json" -Body '{"description":"Version update"}'

# curl
curl -X POST http://localhost:3000/api/version/upgrade -H "Content-Type: application/json" -d '{"description":"Version update"}'
```

#### Method 2: Direct File Modification (Emergency only)
Edit `version.json` directly:
```json
{
  "version": "10.20260126.002",
  "majorVersion": 10,
  "date": "20260126",
  "sequence": 2,
  "timestamp": "2026-01-26T14:30:00.000Z",
  "description": "Manual adjustment"
}
```

#### Method 3: Reset and Reinitialize
```bash
# Delete version files
rm version.json version-history.json

# Restart API service - system will auto-initialize new version
```

### Version Files

- **version.json** - Current version information
- **version-history.json** - Version history records
- **version-config.json** - Version configuration parameters
- **version-backups/** - Backup directory for version files

### Best Practices

1. **Use API interface** for version upgrades whenever possible
2. **Add meaningful descriptions** when upgrading versions
3. **Backup version files** before manual adjustments
4. **Test version system** after any manual changes
5. **Follow version rules** strictly to maintain consistency