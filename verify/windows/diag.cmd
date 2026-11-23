@echo off
set SHARE=\\host.lan\Data
set LOG=%SHARE%\axon-diag.log
set PY=C:\Users\trader\AppData\Local\Programs\Python\Python312\python.exe
echo === start %DATE% %TIME% === > "%LOG%" 2>&1
if not exist C:\Temp mkdir C:\Temp
echo -- copy installer local >> "%LOG%" 2>&1
copy /y "%SHARE%\python-3.12.10-amd64.exe" C:\Temp\py312.exe >> "%LOG%" 2>&1
echo -- run installer (per-user) >> "%LOG%" 2>&1
start /wait "" C:\Temp\py312.exe /quiet InstallAllUsers=0 PrependPath=1 Include_test=0 Include_launcher=0 TargetDir=C:\Users\trader\AppData\Local\Programs\Python\Python312 >> "%LOG%" 2>&1
echo -- installer exit=%ERRORLEVEL% >> "%LOG%" 2>&1
if not exist "%PY%" (echo -- PYTHON MISSING "%PY%" >> "%LOG%" 2>&1 & echo === end === >> "%LOG%" 2>&1 & exit /b 2)
"%PY%" --version >> "%LOG%" 2>&1
echo -- copy wheels local >> "%LOG%" 2>&1
if not exist C:\Temp\wheels mkdir C:\Temp\wheels
xcopy /y /q "%SHARE%\wheels\*.whl" C:\Temp\wheels\ >> "%LOG%" 2>&1
echo -- pip install pyside6 >> "%LOG%" 2>&1
"%PY%" -m pip install --no-index --find-links C:\Temp\wheels "pyside6==6.11.1" >> "%LOG%" 2>&1
echo -- pip exit=%ERRORLEVEL% >> "%LOG%" 2>&1
"%PY%" -c "import PySide6; print('pyside6', PySide6.__version__)" >> "%LOG%" 2>&1
echo === end === >> "%LOG%" 2>&1
