@echo off
cd /d "%~dp0"
echo Iniciando Servidores de Pajabrava...
echo.

echo Limpiando proceso antiguo en puerto 3001...
powershell -Command "Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }"

echo.
echo Iniciando Backend (Node.js)...
start cmd /k "cd /d "%~dp0backend" && npm run dev"

echo.
echo Iniciando Frontend (React/Vite)...
start cmd /k "cd /d "%~dp0frontend" && npm run dev -- --host"

echo.
echo =======================================================
echo  Servidores iniciados en ventanas separadas.
echo  Backend  -> http://localhost:3001
echo  Frontend -> http://localhost:5173
echo  (Si estas en VPS, usa la IP publica del servidor)
echo =======================================================
echo.
pause
