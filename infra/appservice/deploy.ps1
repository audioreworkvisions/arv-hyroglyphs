[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ResourceGroupName,

    [Parameter(Mandatory = $true)]
    [string]$AppName,

    [string]$TemplateFile = 'infra/appservice/main.bicep',
    [string]$ParametersFile = 'infra/appservice/main.parameters.example.json',
    [string]$AppSettingsFile = 'infra/appservice/appsettings.example.json',
    [string]$PackagePath = (Join-Path $env:TEMP 'hyroglyphis-appservice.zip'),
    [switch]$SkipInfra,
    [switch]$SkipAppSettings,
    [switch]$SkipDeploy
)

$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$templatePath = (Resolve-Path (Join-Path $repoRoot $TemplateFile)).Path
$parametersPath = (Resolve-Path (Join-Path $repoRoot $ParametersFile)).Path

if (-not $SkipInfra) {
    az deployment group create -g $ResourceGroupName --template-file $templatePath --parameters @$parametersPath appName=$AppName | Out-Null
}

if (-not $SkipAppSettings) {
    $settingsPath = (Resolve-Path (Join-Path $repoRoot $AppSettingsFile)).Path
    az webapp config appsettings set -g $ResourceGroupName -n $AppName --settings @$settingsPath | Out-Null
}

if (-not $SkipDeploy) {
    if (Test-Path $PackagePath) {
        Remove-Item $PackagePath -Force
    }

    $items = Get-ChildItem $repoRoot -Force | Where-Object {
        $_.Name -notin @('.git', '.venv', 'node_modules', 'dist')
    }

    Compress-Archive -Path $items.FullName -DestinationPath $PackagePath -Force
    az webapp deploy -g $ResourceGroupName -n $AppName --src-path $PackagePath --type zip | Out-Null
}

[pscustomobject]@{
    resourceGroup = $ResourceGroupName
    appName = $AppName
    packagePath = $PackagePath
    infraDeployed = -not $SkipInfra
    appSettingsApplied = -not $SkipAppSettings
    appDeployed = -not $SkipDeploy
} | ConvertTo-Json -Depth 5