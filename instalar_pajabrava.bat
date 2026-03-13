@echo off
cd /d "%~dp0"
echo ================================================
echo  Instalando dependencias de Pajabrava...
echo ================================================
echo.

echo [1/2] Instalando dependencias del Backend...
cd backend
call npm install
echo Backend: OK
cd ..

echo.
echo [2/2] Instalando dependencias del Frontend...
cd frontend
call npm install
echo Frontend: OK
cd ..

echo.
echo ================================================
echo  Instalacion completa!
echo  Ahora ejecuta: iniciar_pajabrava.bat
echo ================================================
pause
