@echo off
title Strategic Memory Dashboard
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "%~dp0launch.ps1"
pause
