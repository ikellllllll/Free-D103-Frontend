param(
  [string]$HostName = "pyan.kr",
  [string]$RemoteUser = "studio",
  [string]$KeyPath = "C:\SSAFY\personal\keys\ssh-key-2025-08-13.key",
  [string]$RemoteAppDir = "/home/studio/apps/Free-D103-Frontend",
  [string]$RemoteArchivePath = "/home/studio/deploy/frontend-deploy.tar.gz",
  [string]$RemoteRestartScript = "/home/studio/deploy/restart-frontend.sh"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$archivePath = Join-Path ([System.IO.Path]::GetTempPath()) "frontend-deploy.tar.gz"
$sshTarget = "$RemoteUser@$HostName"

if (-not (Test-Path $KeyPath)) {
  throw "SSH key not found: $KeyPath"
}

if (Test-Path $archivePath) {
  Remove-Item $archivePath -Force
}

Write-Host "Creating deployment archive..."
tar.exe `
  --exclude=.git `
  --exclude=.next `
  --exclude=node_modules `
  --exclude=*.log `
  --exclude=*.png `
  -czf $archivePath `
  -C $repoRoot `
  .

Write-Host "Uploading archive to $sshTarget..."
scp.exe -i $KeyPath $archivePath "${sshTarget}:${RemoteArchivePath}" | Out-Null

$remoteCommands = @(
  "set -euo pipefail",
  "rm -rf '$RemoteAppDir'",
  "mkdir -p '$RemoteAppDir'",
  "tar -xzf '$RemoteArchivePath' -C '$RemoteAppDir'",
  "'$RemoteRestartScript'",
  "for i in 1 2 3 4 5 6 7 8 9 10; do curl -fsSI http://127.0.0.1:3002/login >/dev/null && break; sleep 1; done",
  "curl -I http://127.0.0.1:3002/login | sed -n '1,10p'"
) -join "; "

Write-Host "Restarting remote app..."
ssh.exe -i $KeyPath $sshTarget $remoteCommands

Remove-Item $archivePath -Force

Write-Host ""
Write-Host "Deploy complete."
Write-Host "Preview: https://studio.pyan.kr/login"
