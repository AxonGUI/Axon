$ErrorActionPreference = "Continue"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$share = "\\host.lan\Data"
$log = Join-Path $share "axon-win.log"
function Log($m) { ("[{0}] {1}" -f (Get-Date -Format "HH:mm:ss"), $m) | Tee-Object -FilePath $log -Append | Out-Null }
Log "=== AXON WIN TEST START (offline payload) ==="
Log ("OS: " + (Get-CimInstance Win32_OperatingSystem).Caption + " build " + [Environment]::OSVersion.Version)

# 当前用户级安装（不需要管理员/UAC）
$pythonDir = Join-Path $env:LOCALAPPDATA "Programs\Python\Python312"
$python = Join-Path $pythonDir "python.exe"
$installer = Join-Path $share "python-3.12.10-amd64.exe"
if (-not (Test-Path $python)) {
  if (Test-Path $installer) {
    Log "installing python (per-user) from shared installer"
    Start-Process -FilePath $installer -ArgumentList "/quiet","InstallAllUsers=0","PrependPath=1","Include_test=0","Include_launcher=0","TargetDir=$pythonDir" -Wait
  } else { Log "MISSING shared python installer: $installer" }
}
if (-not (Test-Path $python)) { Log "PYTHON INSTALL FAILED"; Log "=== DONE ==="; exit 1 }
Log ((& $python --version) 2>&1)

$wheels = Join-Path $share "wheels"
Log "pip install pyside6 6.11.1 from shared wheels (no internet)"
& $python -m pip install --no-warn-script-location --disable-pip-version-check --no-index --find-links $wheels "pyside6==6.11.1" 2>&1 | ForEach-Object { Log $_ }
Log ("pyside6 version: " + (& $python -c "import PySide6; print(PySide6.__version__)" 2>&1))

$dst = "C:\axon-test"
if (Test-Path $dst) { Remove-Item -Recurse -Force $dst }
New-Item -ItemType Directory -Path $dst | Out-Null
Log "unpacking payload"
tar -xzf (Join-Path $share "axon-win-payload.tar.gz") -C $dst 2>&1 | ForEach-Object { Log $_ }
Log ("payload files: " + ((Get-ChildItem -Recurse $dst -File | Measure-Object).Count))

Log "running harness (offscreen)"
Push-Location "$dst\core-py\tests"
$env:QT_QPA_PLATFORM = "offscreen"
$env:QTWEBENGINE_DISABLE_SANDBOX = "1"
$env:QTWEBENGINE_CHROMIUM_FLAGS = "--no-sandbox --disable-gpu --disable-dev-shm-usage --disable-software-rasterizer"
& $python run_web_tests.py --no-build 2>&1 | ForEach-Object { Log $_ }
$code = $LASTEXITCODE
Pop-Location
Log ("exit code: " + $code)
if (Test-Path "$dst\core-py\tests\last_report.json") {
  Copy-Item "$dst\core-py\tests\last_report.json" (Join-Path $share "axon-win-report.json") -Force
  Log "report copied to shared\\axon-win-report.json"
}
Log "=== DONE ==="
