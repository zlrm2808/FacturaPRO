@echo off
chcp 65001 >nul 2>&1
title FacturaPro - Servidor
color 0A

echo ╔══════════════════════════════════════════════════════════════╗
echo ║           FacturaPro - Iniciando Sistema                    ║
echo ║     © Zeus Rodriguez - Todos los derechos reservados       ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

:: Navegar al directorio del proyecto
cd /d "%~dp0.."

:: Verificar si Bun está instalado
where bun >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Bun no está instalado. Ejecute "installar.bat" primero.
    pause
    exit /b 1
)

:: Verificar si node_modules existe
if not exist "node_modules\" (
    echo [!] Dependencias no encontradas. Ejecutando instalación...
    call bun install
    call bun run db:push
    call bun run db:generate
    echo.
)

:: Verificar si la base de datos existe
if not exist "db\custom.db" (
    echo [!] Base de datos no encontrada. Configurando...
    call bun run db:push
    call bun run db:seed
    echo.
)

echo [*] Iniciando servidor FacturaPro...
echo [*] El navegador se abrirá automáticamente en http://localhost:3000
echo [*] Para detener el servidor, cierre esta ventana o presione Ctrl+C
echo.

:: Abrir el navegador después de 3 segundos
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:3000"

:: Iniciar el servidor
call bun run dev
