@echo off
rem Inicia el agente de impresion de Burger Point.
rem Si se cae (error, internet, etc.) vuelve a arrancar solo a los 10 segundos.
cd /d "%~dp0"
title Agente de impresion - Burger Point
:inicio
node index.js
echo.
echo El agente se detuvo. Se reinicia en 10 segundos... (cierra esta ventana para apagarlo)
timeout /t 10 /nobreak >nul
goto inicio
