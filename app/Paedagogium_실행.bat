@echo off
rem Paedagogium launcher. ASCII only inside (batch files are read in the system code page).
rem Starts the local server without a console window, waits until it answers, then opens the app window.
rem Env for testing: PAEDAGOGIUM_PORT (default 8772), PAEDAGOGIUM_NOBROWSER=1.
setlocal
set "HERE=%~dp0"
if not defined PAEDAGOGIUM_PORT set "PAEDAGOGIUM_PORT=8772"
set "PYW="
set "PY="
if exist "%HERE%..\python\pythonw.exe" (
  set "PYW=%HERE%..\python\pythonw.exe"
  set "PY=%HERE%..\python\python.exe"
) else (
  where pythonw >nul 2>nul && set "PYW=pythonw" && set "PY=python"
)
if not defined PYW (
  echo Python 3 was not found. Install Python 3.8+ with Add to PATH.
  pause
  exit /b 1
)
"%PY%" "%HERE%launch_check.py"
"%PY%" -c "import socket,os,sys; s=socket.socket(); s.settimeout(1); sys.exit(0 if s.connect_ex(('127.0.0.1', int(os.environ.get('PAEDAGOGIUM_PORT','8772'))))==0 else 1)" >nul 2>nul
if %errorlevel%==0 goto up
start "" "%PYW%" "%HERE%server.py"
set /a N=0
:waitloop
"%PY%" -c "import socket,os,sys; s=socket.socket(); s.settimeout(1); sys.exit(0 if s.connect_ex(('127.0.0.1', int(os.environ.get('PAEDAGOGIUM_PORT','8772'))))==0 else 1)" >nul 2>nul
if %errorlevel%==0 goto up
set /a N+=1
if %N% geq 12 goto failed
"%PY%" -c "import time; time.sleep(1)"
goto waitloop
:failed
echo The server did not start. Running it in this window to show the error:
echo.
"%PY%" "%HERE%server.py"
pause
exit /b 1
:up
if defined PAEDAGOGIUM_NOBROWSER goto end
where chrome >nul 2>nul
if %errorlevel%==0 (
  start "" chrome --app=http://localhost:%PAEDAGOGIUM_PORT%
) else (
  start "" msedge --app=http://localhost:%PAEDAGOGIUM_PORT%
)
:end
endlocal
