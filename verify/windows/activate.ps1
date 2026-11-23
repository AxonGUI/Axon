$share = '\\host.lan\Data'
$log = Join-Path $share 'axon-diag.log'
try {
  if (-not (Test-Path 'C:\Temp')) { New-Item -ItemType Directory -Path 'C:\Temp' -Force | Out-Null }
  Copy-Item (Join-Path $share 'install.cmd') 'C:\Temp\install.cmd' -Force
  cmd /c "C:\Temp\install.cmd > `"$log`" 2>&1"
  Add-Content -Path $log -Value ("=== exit=" + $LASTEXITCODE + " ===")
} catch {
  Add-Content -Path $log -Value ("=== ERROR: " + $_.Exception.Message)
}
