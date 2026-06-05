@echo off
chcp 65001 >nul 2>&1
title FacturaPro - Instalación
color 0A

echo ╔══════════════════════════════════════════════════════════════╗
echo ║           FacturaPro - Instalación Inicial                 ║
echo ║     Sistema de Facturación e Inventario                    ║
echo ║     © Zeus Rodriguez - Todos los derechos reservados       ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

:: Verificar si Bun está instalado
where bun >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Bun no está instalado. Instalando Bun...
    echo.
    powershell -Command "irm bun.sh/install.ps1 | iex"
    if %errorlevel% neq 0 (
        echo [ERROR] No se pudo instalar Bun automáticamente.
        echo Por favor instale Bun desde: https://bun.sh
        echo Luego ejecute este script nuevamente.
        pause
        exit /b 1
    )
    :: Refrescar PATH
    set "PATH=%USERPROFILE%\.bun\bin;%PATH%"
)

echo [✓] Bun encontrado
echo.

:: Navegar al directorio del proyecto
cd /d "%~dp0.."

echo [*] Instalando dependencias...
call bun install
if %errorlevel% neq 0 (
    echo [ERROR] Error al instalar dependencias.
    pause
    exit /b 1
)
echo [✓] Dependencias instaladas
echo.

echo [*] Configurando base de datos...
call bun run db:push
if %errorlevel% neq 0 (
    echo [ERROR] Error al configurar la base de datos.
    pause
    exit /b 1
)
echo [✓] Base de datos configurada
echo.

echo [*] Generando cliente Prisma...
call bun run db:generate
if %errorlevel% neq 0 (
    echo [ERROR] Error al generar cliente Prisma.
    pause
    exit /b 1
)
echo [✓] Cliente Prisma generado
echo.

echo [*] Cargando datos iniciales...
call bun run db:seed
if %errorlevel% neq 0 (
    echo [!] No se pudieron cargar los datos iniciales (puede que ya existan)
) else (
    echo [✓] Datos iniciales cargados
)
echo.

echo ╔══════════════════════════════════════════════════════════════╗
echo ║              ✓ INSTALACIÓN COMPLETADA                      ║
echo ║                                                              ║
echo ║  Credenciales por defecto:                                   ║
echo ║    Usuario: admin                                            ║
echo ║    Contraseña: admin123                                      ║
echo ║                                                              ║
echo ║  Ejecute "iniciar.bat" para arrancar el sistema.            ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.
pause
