@echo off
call "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat" >nul 2>&1
set "PATH=C:\Users\USER\.rustup\toolchains\stable-x86_64-pc-windows-msvc\bin;%PATH%"
npm run tauri dev
