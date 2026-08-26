@echo off
chcp 65001 >nul
cd /d "%~dp0"
start "" cmd /k "echo Working dir: %CD% & echo Try: python record.py --test"
