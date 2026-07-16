@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ============================================
echo    FORESEE - Descargar cambios (pull)
echo ============================================
echo.

:: 0. Comprueba que Git este instalado
git --version >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Git no esta instalado o no esta en el PATH.
  pause & exit /b 1
)

:: 1. La carpeta debe ser ya un repositorio
if not exist ".git" (
  echo [ERROR] Esta carpeta aun no es un repositorio Git.
  echo Ejecuta primero el .bat de SUBIR (push).
  pause & exit /b 1
)

:: 2. Conecta con GitHub solo si aun no esta conectado
git remote get-url origin >nul 2>&1
if errorlevel 1 git remote add origin https://github.com/Alberthoma/Foresee.git

:: 3. Descarga y combina lo ultimo de GitHub
echo Descargando los ultimos cambios desde GitHub...
git pull origin main --no-edit
if errorlevel 1 (
  echo.
  echo [ATENCION] No se pudo combinar automaticamente.
  echo Causas comunes:
  echo   - Tienes cambios locales sin guardar: usa primero el .bat de SUBIR.
  echo   - Hay un conflicto: arregla los archivos marcados y reintenta.
  pause & exit /b 1
)

echo.
echo ============================================
echo    LISTO. Tu carpeta local esta al dia.
echo ============================================
echo.
pause
