# PowerShell script to bump version across all project files
param(
    [Parameter(Mandatory=$true)]
    [string]$NewVersion
)

# Validate version format (basic semver check)
if ($NewVersion -notmatch '^\d+\.\d+\.\d+$') {
    Write-Host "Error: Version must be in format x.y.z (e.g., 0.1.3)" -ForegroundColor Red
    exit 1
}

Write-Host "Bumping version to: $NewVersion" -ForegroundColor Cyan
Write-Host ""

# Update UI package.json
$uiPackageJsonPath = "ui/package.json"
if (Test-Path $uiPackageJsonPath) {
    Write-Host "Updating UI package.json..." -ForegroundColor Yellow
    $packageJson = Get-Content $uiPackageJsonPath | ConvertFrom-Json
    $oldVersion = $packageJson.version
    $packageJson.version = $NewVersion
    $packageJson | ConvertTo-Json -Depth 32 | Set-Content $uiPackageJsonPath
    Write-Host "  $oldVersion → $NewVersion" -ForegroundColor Green
} else {
    Write-Host "Warning: UI package.json not found" -ForegroundColor Yellow
}

# Update Tauri Cargo.toml
$tauriCargoPath = "ui/src-tauri/Cargo.toml"
if (Test-Path $tauriCargoPath) {
    Write-Host "Updating Tauri Cargo.toml..." -ForegroundColor Yellow
    $cargoContent = Get-Content $tauriCargoPath
    $oldVersion = ""
    $updatedContent = $cargoContent | ForEach-Object {
        if ($_ -match '^version = "(\d+\.\d+\.\d+)"') {
            $oldVersion = $matches[1]
            'version = "' + $NewVersion + '"'
        } else {
            $_
        }
    }
    $updatedContent | Set-Content $tauriCargoPath
    if ($oldVersion) {
        Write-Host "  $oldVersion → $NewVersion" -ForegroundColor Green
    }
} else {
    Write-Host "Warning: Tauri Cargo.toml not found" -ForegroundColor Yellow
}

# Update Tauri config
$tauriConfigPath = "ui/src-tauri/tauri.conf.json"
if (Test-Path $tauriConfigPath) {
    Write-Host "Updating Tauri config..." -ForegroundColor Yellow
    $tauriConfig = Get-Content $tauriConfigPath | ConvertFrom-Json
    $oldVersion = $tauriConfig.version
    $tauriConfig.version = $NewVersion
    $tauriConfig | ConvertTo-Json -Depth 32 | Set-Content $tauriConfigPath
    Write-Host "  $oldVersion → $NewVersion" -ForegroundColor Green
} else {
    Write-Host "Warning: Tauri config not found" -ForegroundColor Yellow
}

# Update Server Cargo.toml
$serverCargoPath = "server/Cargo.toml"
if (Test-Path $serverCargoPath) {
    Write-Host "Updating Server Cargo.toml..." -ForegroundColor Yellow
    $cargoContent = Get-Content $serverCargoPath
    $oldVersion = ""
    $updatedContent = $cargoContent | ForEach-Object {
        if ($_ -match '^version = "(\d+\.\d+\.\d+)"') {
            $oldVersion = $matches[1]
            'version = "' + $NewVersion + '"'
        } else {
            $_
        }
    }
    $updatedContent | Set-Content $serverCargoPath
    if ($oldVersion) {
        Write-Host "  $oldVersion → $NewVersion" -ForegroundColor Green
    }
} else {
    Write-Host "Warning: Server Cargo.toml not found" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "✅ Version bump complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Review the changes: git diff" -ForegroundColor White
Write-Host "2. Test the build: cd ui && npm run build" -ForegroundColor White
Write-Host "3. Commit the changes: git add . && git commit -m 'bump: version $NewVersion'" -ForegroundColor White
Write-Host "4. Tag the release: git tag v$NewVersion" -ForegroundColor White
Write-Host "5. Push: git push && git push --tags" -ForegroundColor White