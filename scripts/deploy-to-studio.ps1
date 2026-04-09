param(
  [string]$HostName = "pyan.kr",
  [string]$RemoteUser = "studio",
  [string]$KeyPath = "C:\SSAFY\personal\keys\ssh-key-2025-08-13.key",
  [string]$RemoteAppDir = "/home/studio/apps/Free-D103-Frontend",
  [string]$RemoteRestartScript = "/home/studio/deploy/restart-frontend.sh",
  [string]$RemoteFrontendPm2Name = "studio-pyan-frontend",
  [string]$RemoteSidecarPm2Name = "aig-ai-edit-sidecar",
  [switch]$SkipFrontendRestart,
  [switch]$SkipSidecarRestart
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$sshTarget = "$RemoteUser@$HostName"

if (-not (Test-Path $KeyPath)) {
  throw "SSH key not found: $KeyPath"
}

$remoteCommands = New-Object System.Collections.Generic.List[string]
$remoteCommands.Add("set -euo pipefail")
$remoteCommands.Add("cd '$RemoteAppDir'")
$remoteCommands.Add("git fetch --all --prune")
$remoteCommands.Add("git pull --ff-only origin main")
$remoteCommands.Add("yarn install --frozen-lockfile")
$remoteCommands.Add("yarn build")

if (-not $SkipSidecarRestart) {
  $remoteCommands.Add("yarn build:sidecar")
  $remoteCommands.Add("env HOME=/home/studio PM2_HOME=/home/studio/.pm2 pm2 describe '$RemoteSidecarPm2Name' >/dev/null 2>&1 && env HOME=/home/studio PM2_HOME=/home/studio/.pm2 pm2 restart '$RemoteSidecarPm2Name' || env HOME=/home/studio PM2_HOME=/home/studio/.pm2 pm2 start '$RemoteAppDir/services/ai-edit-sidecar/dist/server.cjs' --name '$RemoteSidecarPm2Name' --cwd '$RemoteAppDir'")
  $remoteCommands.Add("env HOME=/home/studio PM2_HOME=/home/studio/.pm2 pm2 save >/dev/null")
}

if (-not $SkipFrontendRestart) {
  $remoteCommands.Add("'$RemoteRestartScript'")
  $remoteCommands.Add("for i in 1 2 3 4 5 6 7 8 9 10; do curl -fsSI http://127.0.0.1:3002/login >/dev/null && break; sleep 1; done")
  $remoteCommands.Add("curl -I http://127.0.0.1:3002/login | sed -n '1,10p'")
} else {
  $remoteCommands.Add("env HOME=/home/studio PM2_HOME=/home/studio/.pm2 pm2 restart '$RemoteFrontendPm2Name'")
  $remoteCommands.Add("env HOME=/home/studio PM2_HOME=/home/studio/.pm2 pm2 save >/dev/null")
}

$joinedCommand = $remoteCommands -join "; "

Write-Host "Deploying to $sshTarget..."
ssh.exe -i $KeyPath $sshTarget $joinedCommand

Write-Host ""
Write-Host "Deploy complete."
Write-Host "Frontend: https://studio.pyan.kr/login"
if (-not $SkipSidecarRestart) {
  Write-Host "Sidecar: https://studio-ai.pyan.kr"
}
