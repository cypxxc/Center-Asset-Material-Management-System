# Run manually only after choosing a real backup destination and task account.
[CmdletBinding(SupportsShouldProcess)]
param(
    [Parameter(Mandatory = $true)][string]$Destination,
    [string]$At = '02:00',
    [string]$TaskName = 'CAMMS PostgreSQL Daily Backup',
    [PSCredential]$Credential
)
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if (-not [IO.Path]::IsPathFullyQualified($Destination) -or $Destination -match '[\r\n"]') {
    throw 'Destination must be an absolute local or UNC directory path.'
}
$resolvedDestination = [IO.Path]::GetFullPath($Destination)
if ($resolvedDestination.TrimEnd('\') -eq [IO.Path]::GetPathRoot($resolvedDestination).TrimEnd('\')) {
    throw 'Choose a dedicated directory, not a drive or share root.'
}
if (-not (Test-Path -LiteralPath $resolvedDestination -PathType Container)) {
    throw 'The destination must already exist and be accessible. Create and authorize the dedicated backup directory first.'
}
$dailyTime = [datetime]::ParseExact($At, 'HH:mm', [Globalization.CultureInfo]::InvariantCulture)
$nodePath = (Get-Command node.exe -ErrorAction Stop).Source
$npmCli = Join-Path (Split-Path -Parent $nodePath) 'node_modules/npm/bin/npm-cli.js'
if (-not (Test-Path -LiteralPath $npmCli -PathType Leaf)) { throw 'A standard Node.js installation with npm is required.' }
if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) { throw 'This task already exists. Review it before replacing or changing its configuration.' }
$stateDir = Join-Path $projectRoot '.cache/postgres-backup-job'
$configPath = Join-Path $stateDir 'config.json'
$runnerPath = Join-Path $projectRoot 'scripts/postgres-backup-job.ts'
if ($projectRoot -match '[\r\n"]') { throw 'Unsupported project path characters.' }
if ($PSCmdlet.ShouldProcess($TaskName, "Register daily backup at $At to the selected destination")) {
    if (-not $Credential) { $Credential = Get-Credential -Message 'Account with Docker, project and backup-share access; password is stored by Windows Task Scheduler.' }
    if (-not $Credential) { throw 'A task account is required.' }
    New-Item -ItemType Directory -Path $stateDir -Force | Out-Null
    @{ destination = $resolvedDestination } | ConvertTo-Json | Set-Content -LiteralPath $configPath -Encoding utf8NoBOM
    $arguments = '--import tsx "{0}" "{1}"' -f $runnerPath, $configPath
    $action = New-ScheduledTaskAction -Execute $nodePath -Argument $arguments -WorkingDirectory $projectRoot
    $trigger = New-ScheduledTaskTrigger -Daily -At $dailyTime
    $settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 40) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
    # Register via the native API; password is not placed in task arguments, files or logs.
    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -User $Credential.UserName -Password $Credential.GetNetworkCredential().Password -Description 'CAMMS full PostgreSQL + private storage backup; three bounded attempts, no automatic pruning.' | Out-Null
    Write-Output "Registered $TaskName. No backup has run yet. Start and inspect the task to verify account and destination access."
}
