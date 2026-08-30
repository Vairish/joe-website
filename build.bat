@echo off
REM Double-click this after adding files to images\, music\ or notes\
REM to refresh data.js for local previewing.
cd /d "%~dp0"
node build.mjs
echo.
pause
