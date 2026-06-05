@echo off
chcp 65001 >nul 2>&1
title FacturaPro - Crear Acceso Directo
color 0A

echo ╔══════════════════════════════════════════════════════════════╗
echo ║       FacturaPro - Crear Acceso Directo en Escritorio      ║
echo ║     © Zeus Rodriguez - Todos los derechos reservados       ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

:: Obtener la ruta del escritorio del usuario
set "DESKTOP=%USERPROFILE%\Desktop"
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"

:: Obtener la ruta del proyecto (directorio padre de scripts)
set "PROJECT_DIR=%~dp0.."

:: Crear el VBS para el acceso directo silencioso (sin ventana de CMD visible)
echo Set WshShell = CreateObject("WScript.Shell") > "%PROJECT_DIR%\scripts\iniciar_silencioso.vbs"
echo WshShell.Run chr(34) ^& "%PROJECT_DIR%\scripts\iniciar.bat" ^& Chr(34), 1 >> "%PROJECT_DIR%\scripts\iniciar_silencioso.vbs"

:: Crear acceso directo en el escritorio usando PowerShell
echo [*] Creando acceso directo en el escritorio...
powershell -Command "$WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%DESKTOP%\FacturaPro.lnk'); $Shortcut.TargetPath = '%PROJECT_DIR%\scripts\iniciar.bat'; $Shortcut.WorkingDirectory = '%PROJECT_DIR%'; $Shortcut.Description = 'FacturaPro - Sistema de Facturación e Inventario'; $Shortcut.IconLocation = 'shell32.dll,13'; $Shortcut.Save()"

if %errorlevel% equ 0 (
    echo [✓] Acceso directo creado en el escritorio: FacturaPro.lnk
) else (
    echo [ERROR] No se pudo crear el acceso directo en el escritorio.
)

echo.

:: Preguntar si desea iniciar con Windows
echo ¿Desea que FacturaPro se inicie automáticamente con Windows? (S/N)
set /p AUTOSTART="> "

if /i "%AUTOSTART%"=="S" (
    echo [*] Creando acceso directo en Inicio de Windows...
    powershell -Command "$WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%STARTUP%\FacturaPro.lnk'); $Shortcut.TargetPath = '%PROJECT_DIR%\scripts\iniciar.bat'; $Shortcut.WorkingDirectory = '%PROJECT_DIR%'; $Shortcut.Description = 'FacturaPro - Inicio Automático'; $Shortcut.IconLocation = 'shell32.dll,13'; $Shortcut.Save()"

    if %errorlevel% equ 0 (
        echo [✓] FacturaPro se iniciará automáticamente con Windows
    ) else (
        echo [ERROR] No se pudo crear el acceso directo de inicio automático.
    )
) else (
    echo [!] Inicio automático omitido.
)

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║                 ✓ PROCESO COMPLETADO                        ║
echo ║                                                              ║
echo ║  Puede iniciar FacturaPro dando doble click en:             ║
echo ║    📂 %DESKTOP%\FacturaPro.lnk                             ║
echo ║                                                              ║
echo ║  O ejecutando directamente:                                 ║
echo ║    📂 scripts\iniciar.bat                                   ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.
pause
