# DPAPI-backed token store for the GitHub scripts in tools/.
#
# Typing `$env:GH_TOKEN_X = 'ghp_...'` at a prompt writes the token straight
# into PSReadLine's plaintext history file, where it stays. This reads tokens
# through Read-Host -AsSecureString (never echoed, never in history) and stores
# them DPAPI-encrypted under %APPDATA%, scoped to the current Windows user - the
# file cannot be decrypted by another account or on another machine.
#
#   .\tools\gh-secrets.ps1 -Set jqwidgets          # prompts, stores encrypted
#   .\tools\gh-secrets.ps1 -List                   # names + when stored, no values
#   .\tools\gh-secrets.ps1 -Remove jqwidgets
#   .\tools\gh-secrets.ps1 -Run 'node tools/simulate-issues.mjs --dir drafts'
#
# -Run decrypts every stored token into GH_TOKEN_<NAME> for that child process
# only. The values never touch your interactive shell, so they cannot leak into
# history, and they are gone when the command exits.
[CmdletBinding(DefaultParameterSetName = 'List')]
param(
  [Parameter(ParameterSetName = 'Set', Mandatory)][string]$Set,
  [Parameter(ParameterSetName = 'Remove', Mandatory)][string]$Remove,
  [Parameter(ParameterSetName = 'Run', Mandatory)][string]$Run,
  [Parameter(ParameterSetName = 'List')][switch]$List
)

$ErrorActionPreference = 'Stop'
$Store = Join-Path $env:APPDATA 'svgrid\tokens'

function Get-Slug([string]$name) {
  # Same shape simulate-issues.mjs expects: GH_TOKEN_PETER_STOEV
  ($name.ToUpper() -replace '[^A-Z0-9]+', '_')
}

function Unprotect-Token([string]$path) {
  $sec = ConvertTo-SecureString (Get-Content $path -Raw).Trim()
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
  try { [Runtime.InteropServices.Marshal]::PtrToStringAuto($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

if (-not (Test-Path $Store)) { New-Item -ItemType Directory -Force $Store | Out-Null }

switch ($PSCmdlet.ParameterSetName) {
  'Set' {
    $slug = Get-Slug $Set
    $sec = Read-Host -Prompt "Paste the PAT for '$Set' (input hidden)" -AsSecureString
    if ($sec.Length -eq 0) { Write-Error 'Nothing entered.'; exit 1 }
    # ConvertFrom-SecureString applies DPAPI with the current user's key.
    ConvertFrom-SecureString $sec | Set-Content (Join-Path $Store "$slug.dpapi") -Encoding utf8
    Write-Host "Stored GH_TOKEN_$slug (encrypted, user-scoped)."
    Write-Host 'Verify it belongs to the right account before using it:'
    Write-Host "  .\tools\gh-secrets.ps1 -Run 'node tools/simulate-issues.mjs --dir <drafts>'"
  }

  'Remove' {
    $f = Join-Path $Store ((Get-Slug $Remove) + '.dpapi')
    if (Test-Path $f) { Remove-Item $f -Confirm:$false; Write-Host "Removed $Remove." }
    else { Write-Host "No stored token for '$Remove'." }
  }

  'Run' {
    $loaded = @()
    Get-ChildItem $Store -Filter '*.dpapi' -ErrorAction SilentlyContinue | ForEach-Object {
      $slug = $_.BaseName
      Set-Item -Path "env:GH_TOKEN_$slug" -Value (Unprotect-Token $_.FullName)
      $loaded += $slug
    }
    if (-not $loaded) { Write-Error "No tokens stored yet. Use -Set <account> first."; exit 1 }
    Write-Host "Loaded: $($loaded -join ', ')`n"
    try {
      # Child process inherits the vars; this shell's copy is cleared after.
      & cmd /c $Run
      exit $LASTEXITCODE
    } finally {
      foreach ($slug in $loaded) { Remove-Item "env:GH_TOKEN_$slug" -ErrorAction SilentlyContinue }
    }
  }

  default {
    $files = Get-ChildItem $Store -Filter '*.dpapi' -ErrorAction SilentlyContinue
    if (-not $files) { Write-Host "No tokens stored in $Store"; break }
    Write-Host "Stored in $Store (values not shown):"
    $files | ForEach-Object { Write-Host ("  GH_TOKEN_{0,-18} stored {1:yyyy-MM-dd HH:mm}" -f $_.BaseName, $_.LastWriteTime) }
  }
}
