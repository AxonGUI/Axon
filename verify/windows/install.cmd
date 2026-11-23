@echo off
setlocal
set SHARE=\\host.lan\Data
set PYDIR=%LOCALAPPDATA%\Programs\Python\Python312
set PY=%PYDIR%\python.exe
echo -- step1 copy installer
if not exist C:\Temp mkdir C:\Temp
copy /y "%SHARE%\python-3.12.10-amd64.exe" C:\Temp\py312.exe
echo -- step2 install per-user
start "" /wait C:\Temp\py312.exe /quiet InstallAllUsers=0 PrependPath=1 Include_test=0 Include_launcher=0 Include_pip=1 TargetDir=%PYDIR%
echo -- install exit=%ERRORLEVEL%
if not exist "%PY%" (echo -- NO PYTHON at %PY% & exit /b 2)
"%PY%" --version
echo -- step3 wheels
if not exist C:\Temp\wheels mkdir C:\Temp\wheels
xcopy /y /q "%SHARE%\wheels\*.whl" C:\Temp\wheels\
echo -- step4 pip install pyside6
"%PY%" -m pip install --no-index --find-links C:\Temp\wheels "pyside6==6.11.1"
echo -- pip exit=%ERRORLEVEL%
"%PY%" -c "import PySide6;print('pyside6',PySide6.__version__)"
echo -- step5 harness
cd /d C:\axon-test\core-py\tests
set QT_QPA_PLATFORM=offscreen
set QTWEBENGINE_CHROMIUM_FLAGS=--no-sandbox --disable-gpu --disable-dev-shm-usage
"%PY%" run_web_tests.py --no-build
echo -- harness exit=%ERRORLEVEL%
