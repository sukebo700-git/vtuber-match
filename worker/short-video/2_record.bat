@echo off
chcp 65001 >nul
cd /d "%~dp0"
python -X utf8 record.py --seconds 200 --out work/bench/voice.wav
echo.
pause
