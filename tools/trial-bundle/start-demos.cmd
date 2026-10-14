@echo off
rem Opens the SvGrid demo browser. Needs Node.js 18 or newer (https://nodejs.org).
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install it from https://nodejs.org and run this again.
  pause
  exit /b 1
)
node serve.mjs
