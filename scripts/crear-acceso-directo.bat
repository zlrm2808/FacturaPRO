@echo off
chcp 65001 >nul 2>&1
title FacturaPro - Crear Acceso Directo
color 0A

echo ==============================================================
echo   FacturaPro - Crear Acceso Directo en Escritorio
echo   (c) Zeus Rodriguez - Todos los derechos reservados
echo ==============================================================
echo.

:: Obtener rutas del usuario de forma robusta
for /f "usebackq delims=" %%I in (`powershell -NoProfile -Command "[Environment]::GetFolderPath('Desktop')"`) do set "DESKTOP=%%I"
if not defined DESKTOP set "DESKTOP=%USERPROFILE%\Desktop"
if not exist "%DESKTOP%\" mkdir "%DESKTOP%" >nul 2>&1

set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
if not exist "%STARTUP%\" mkdir "%STARTUP%" >nul 2>&1

:: Obtener la ruta del proyecto (directorio padre de scripts) normalizada
for %%I in ("%~dp0..") do set "PROJECT_DIR=%%~fI"

:: Crear el VBS para el acceso directo silencioso (sin ventana de CMD visible)
echo Set WshShell = CreateObject("WScript.Shell") > "%PROJECT_DIR%\scripts\iniciar_silencioso.vbs"
echo WshShell.Run chr(34) ^& "%PROJECT_DIR%\scripts\iniciar.bat" ^& Chr(34), 1 >> "%PROJECT_DIR%\scripts\iniciar_silencioso.vbs"

:: Crear acceso directo en el escritorio usando PowerShell
echo [*] Creando acceso directo en el escritorio...
powershell -NoProfile -Command "$WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%DESKTOP%\FacturaPro.lnk'); $Shortcut.TargetPath = '%PROJECT_DIR%\scripts\iniciar.bat'; $Shortcut.WorkingDirectory = '%PROJECT_DIR%'; $Shortcut.Description = 'FacturaPro - Sistema de Facturacion e Inventario'; $Shortcut.IconLocation = 'shell32.dll,13'; $Shortcut.Save()"

if %errorlevel% equ 0 (
    echo [OK] Acceso directo creado en el escritorio: FacturaPro.lnk
) else (
    echo [ERROR] No se pudo crear el acceso directo en el escritorio.
)

echo.

:: Preguntar si desea iniciar con Windows
echo Desea que FacturaPro se inicie automaticamente con Windows? (S/N)
set /p AUTOSTART="> "

if /i "%AUTOSTART%"=="S" (
    echo [*] Creando acceso directo en Inicio de Windows...
    powershell -NoProfile -Command "$WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%STARTUP%\FacturaPro.lnk'); $Shortcut.TargetPath = '%PROJECT_DIR%\scripts\iniciar.bat'; $Shortcut.WorkingDirectory = '%PROJECT_DIR%'; $Shortcut.Description = 'FacturaPro - Inicio Automatico'; $Shortcut.IconLocation = 'shell32.dll,13'; $Shortcut.Save()"

    if %errorlevel% equ 0 (
        echo [OK] FacturaPro se iniciara automaticamente con Windows
    ) else (
        echo [ERROR] No se pudo crear el acceso directo de inicio automatico.
    )
) else (
    echo [!] Inicio automatico omitido.
)

echo.
echo ==============================================================
echo   [OK] PROCESO COMPLETADO
echo.
echo   Puede iniciar FacturaPro dando doble click en:
echo     %DESKTOP%\FacturaPro.lnk
echo.
echo   O ejecutando directamente:
echo     scripts\iniciar.bat
echo ==============================================================
echo.
pause
