@echo off
REM Double-click me. I live in your full-resolution photo folder and build an
REM "images" folder you can copy straight into the website repo.
cd /d "%~dp0"
node make-web.mjs
echo.
pause
