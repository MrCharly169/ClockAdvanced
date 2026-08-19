param(
    [Parameter(Position = 0)]
    [ValidateSet("start", "stop", "restart", "logs", "status", "seed", "schedule-test", "flow-test", "smoke")]
    [string]$Command = "start"
)

$ErrorActionPreference = "Stop"
$RepositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$ComposeFile = Join-Path $RepositoryRoot "compose.dev.yaml"
$StateDirectory = Join-Path $RepositoryRoot ".dev\ha-config"
$DockerExecutable = (Get-Command docker -ErrorAction SilentlyContinue).Source

if (-not $DockerExecutable) {
    $UserDockerExecutable = Join-Path $env:LOCALAPPDATA "Programs\DockerDesktop\resources\bin\docker.exe"
    if (Test-Path $UserDockerExecutable) {
        $DockerExecutable = $UserDockerExecutable
    } else {
        throw "Docker CLI not found. Start Docker Desktop and open a new terminal."
    }
}

if ($Command -eq "start") {
    New-Item -ItemType Directory -Path $StateDirectory -Force | Out-Null
    & $DockerExecutable compose -f $ComposeFile up -d
    $DevPort = if ($env:HA_DEV_PORT) { $env:HA_DEV_PORT } else { "18124" }
    Write-Output "Clock Advanced lab: http://127.0.0.1:$DevPort"
    exit
}

if ($Command -eq "stop") {
    & $DockerExecutable compose -f $ComposeFile down
    exit
}

if ($Command -eq "restart") {
    & $DockerExecutable compose -f $ComposeFile restart homeassistant
    exit
}

if ($Command -eq "logs") {
    & $DockerExecutable compose -f $ComposeFile logs -f homeassistant
    exit
}

if ($Command -eq "smoke") {
    & (Join-Path $RepositoryRoot "scripts\ha_lab_smoke.ps1")
    exit $LASTEXITCODE
}

if ($Command -eq "seed") {
    $NodeExecutable = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
    if (-not (Test-Path $NodeExecutable)) {
        $NodeExecutable = (Get-Command node -ErrorAction Stop).Source
    }
    & $NodeExecutable (Join-Path $RepositoryRoot "scripts\seed_ha_lab.mjs")
    exit $LASTEXITCODE
}

if ($Command -eq "schedule-test") {
    $NodeExecutable = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
    if (-not (Test-Path $NodeExecutable)) {
        $NodeExecutable = (Get-Command node -ErrorAction Stop).Source
    }
    & $NodeExecutable (Join-Path $RepositoryRoot "scripts\test_schedule_helper.mjs")
    exit $LASTEXITCODE
}

if ($Command -eq "flow-test") {
    $NodeExecutable = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
    if (-not (Test-Path $NodeExecutable)) {
        $NodeExecutable = (Get-Command node -ErrorAction Stop).Source
    }
    & $NodeExecutable (Join-Path $RepositoryRoot "scripts\test_options_flow.mjs")
    exit $LASTEXITCODE
}

& $DockerExecutable compose -f $ComposeFile ps
