@echo off
rem Imprime un ticket de PRUEBA para verificar que la impresora responde.
cd /d "%~dp0"
node index.js --test
pause
