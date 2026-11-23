@echo off
rem one-shot command channel used by oem/worker.bat (SYSTEM, runs once per minute)
set SHARE=\\host.lan\Data
set LOG=%SHARE%\axon-diag.log
set PY=C:\Python312\python.exe
echo === %DATE% %TIME% install+verify === > "%LOG%"
if not exist C:\Temp mkdir C:\Temp
echo -- copy installer >> "%LOG%"
copy /y "%SHARE%\python-3.12.10-amd64.exe" C:\Temp\py312.exe >> "%LOG%" 2>&1
echo -- copy=%ERRORLEVEL% >> "%LOG%"
echo -- install (all users, quiet) >> "%LOG%"
start "" /wait C:\Temp\py312.exe /quiet InstallAllUsers=1 PrependPath=1 Include_test=0 Include_launcher=0 TargetDir=C:\Python312 >> "%LOG%" 2>&1
echo -- install exit=%ERRORLEVEL% >> "%LOG%"
if not exist "%PY%" (echo -- NO PYTHON after install >> "%LOG%" & echo === end === >> "%LOG%" & exit /b 2)
"%PY%" --version >> "%LOG%" 2>&1
echo -- copy wheels >> "%LOG%"
xcopy /y /q "%SHARE%\wheels\*.whl" C:\Temp\wheels\ >> "%LOG%" 2>&1
"%PY%" -m pip install --no-index --find-links C:\Temp\wheels "pyside6==6.11.1" >> "%LOG%" 2>&1
echo -- pip exit=%ERRORLEVEL% >> "%LOG%"
"%PY%" -c "import PySide6;print('pyside6',PySide6.__version__)" >> "%LOG%" 2>&1
echo === end === >> "%LOG%"
