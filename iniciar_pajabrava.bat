@echo off
cd /d "%~dp0"
echo Iniciando Servidores de Pajabrava (Single Server)...
echo.

echo Limpiando procesos antiguos en puerto 3001...
powershell -Command "Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }"

echo.
:: Iniciar Backend en una nueva ventana de comandos
echo Iniciando Backend (Node.js)...
start cmd /k "cd backend && npm run dev"

:: Iniciar Frontend en otra ventana de comandos
echo Iniciando Frontend (React/Vite)...
start cmd /k "cd frontend && npm run dev -- --host"

echo.
echo =======================================================
echo Todo se esta iniciando en ventanas separadas.
echo Backend  -> http://localhost:3001
echo Frontend -> http://192.168.1.34:5173 (Abre esto en tu navegador)
echo =======================================================
echo.
pause
