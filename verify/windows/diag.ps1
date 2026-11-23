$share = "\\host.lan\Data"
$log = Join-Path $share "axon-diag.log"
function Log($m) { ("[{0}] {1}" -f (Get-Date -Format "HH:mm:ss"), $m) | Out-File -FilePath $log -Append -Encoding utf8 }
Log "=== DIAG START ==="
Log ("whoami: " + (whoami))
Log ("LOCALAPPDATA: " + $env:LOCALAPPDATA)
foreach ($p in @("C:\Python312\python.exe", "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe", "C:\Program Files\Python312\python.exe")) {
  Log ("exists[$p]: " + (Test-Path $p))
}
$where = (where.exe python 2>&1) -join "; "
Log ("where python: " + $where)
try { Log ("cmd python --version: " + ((& cmd /c "python --version 2>&1") -join " ")) } catch { Log ("cmd python failed: " + $_) }
foreach ($p in @("C:\Python312\python.exe", "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe")) {
  if (Test-Path $p) {
    try { Log ("[$p] --version: " + ((& $p --version 2>&1) -join " ")) } catch { Log ("[$p] failed: " + $_) }
    try { Log ("[$p] -c import PySide6 ok") ; & $p -c "import PySide6; print(PySide6.__version__)" 2>&1 | ForEach-Object { Log ("  ver: " + $_) } } catch { Log ("[$p] PySide6 missing: " + $_) }
  }
}
Log "=== DIAG END ==="
