@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ============================================
echo    FORESEE - Subir cambios a GitHub (push)
echo ============================================
echo.

:: 0. Comprueba que Git este instalado
git --version >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Git no esta instalado o no esta en el PATH.
  pause & exit /b 1
)

:: 1. Inicializa el repo SOLO la primera vez (nunca lo reinicia despues)
if not exist ".git" (
  echo Configurando el repositorio por primera vez...
  git init
  git branch -M main
)

:: 2. Conecta con GitHub solo si aun no esta conectado
git remote get-url origin >nul 2>&1
if errorlevel 1 git remote add origin https://github.com/Alberthoma/Foresee.git

:: 3. PROTECCION: si Proyecto-Anterior tiene su propia .git interna, Git la
::    sube como "submodulo roto" y ROMPE la publicacion de la web. Chequeo
::    barato, solo actua si hace falta (no toca nada en el caso normal).
if exist "Proyecto-Anterior\.git" (
  echo [AVISO] Proyecto-Anterior tenia una .git interna. Eliminandola...
  rmdir /s /q "Proyecto-Anterior\.git"
)

:: 4. Muestra un resumen de lo que va a subir
echo Cambios detectados:
git add -A
git status --short
echo.

:: 5. Guarda el cambio con un mensaje automatico (fecha y hora) - sin pedir
::    nada por teclado. Se usa PowerShell para la fecha porque el formato
::    de "date /t" cambia segun la configuracion regional de Windows.
for /f "delims=" %%i in ('powershell -NoProfile -Command "Get-Date -Format \"yyyy-MM-dd HH:mm\""') do set "marca=%%i"
git commit -m "Actualizacion automatica - %marca%" >nul 2>&1
if errorlevel 1 echo (No habia cambios nuevos que guardar, continuo...)

:: 6. Trae primero lo ultimo de GitHub y lo combina (evita rechazos si
::    editaste algo desde el movil)
echo.
echo Sincronizando con GitHub antes de subir...
git pull origin main --no-edit
if errorlevel 1 (
  echo.
  echo [ATENCION] Hubo un conflicto al combinar con GitHub.
  echo Arregla los archivos marcados y vuelve a ejecutar este .bat.
  pause & exit /b 1
)

:: 7. Sube a GitHub
git push -u origin main
if errorlevel 1 (
  echo.
  echo [ERROR] No se pudo subir. Revisa tu conexion o inicia sesion en GitHub.
  pause & exit /b 1
)

echo.
echo ============================================
echo    LISTO. La web se actualiza en ~1 minuto:
echo    https://alberthoma.github.io/Foresee/
echo ============================================
echo.
pause
