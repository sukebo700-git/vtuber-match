@echo off
cd /d "%~dp0"
set "npm_config_cache=%CD%\.npm-cache"
set "XDG_DATA_HOME=%CD%\.vercel-data"
set "LOCALAPPDATA=%CD%\.localappdata"
set "APPDATA=%CD%\.appdata"
set "VERCEL_TELEMETRY_DISABLED=1"
".npm-cache\_npx\69f9afb961c37556\node_modules\.bin\vercel.cmd" deploy --prod --yes > "%CD%\vercel-deploy.combined.log" 2>&1
