@echo off
REM Run this after adding an MP3 to music\ or a markdown file to notes\.
REM Photos do not need this — they come in with the _web folder.
cd /d "%~dp0"
node update-lists.mjs
echo.
pause
