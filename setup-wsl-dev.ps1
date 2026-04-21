# PWAP WSL Dev Environment Setup
# Run in PowerShell as Administrator

Write-Host "=== PWAP Dev Setup ===" -ForegroundColor Cyan

# 1. Fix .wslconfig - enable mirrored networking
$wslconfig = @"
[wsl2]
memory=48GB
swap=16GB
networkingMode=mirrored
"@
Set-Content -Path "$env:USERPROFILE\.wslconfig" -Value $wslconfig
Write-Host "[OK] .wslconfig updated (mirrored networking)" -ForegroundColor Green

# 2. Restart ADB on default port
$adbPath = "C:\Users\satos\Desktop\platform-tools\adb.exe"
& $adbPath kill-server 2>$null
Start-Sleep -Seconds 1
& $adbPath start-server
Write-Host "[OK] ADB server restarted on port 5037" -ForegroundColor Green
& $adbPath devices

# 3. Shutdown WSL so new config takes effect
Write-Host "`nShutting down WSL..." -ForegroundColor Yellow
wsl --shutdown
Start-Sleep -Seconds 3
Write-Host "[OK] WSL shutdown complete" -ForegroundColor Green

Write-Host "`n=== Done! ===" -ForegroundColor Cyan
Write-Host "Now open WSL again and run: cd pwap && claude" -ForegroundColor White
