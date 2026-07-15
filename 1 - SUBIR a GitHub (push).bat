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

:: 3. PROTECCION (correccion de esta sesion):
::    Si la carpeta Proyecto-Anterior tiene su propia .git interna, Git
::    la sube como "submodulo roto" y ROMPE la publicacion de la web.
::    Aqui se elimina esa .git interna y cualquier puntero de submodulo.
if exist "Proyecto-Anterior\.git" (
  echo [AVISO] Proyecto-Anterior tenia una .git interna. Eliminandola...
  rmdir /s /q "Proyecto-Anterior\.git"
)
git rm --cached Proyecto-Anterior >nul 2>&1

:: 4. Agrega todos los cambios
git add .

:: 5. Pide un mensaje para este cambio
set "msg="
set /p "msg=Escribe un mensaje para este cambio (Enter = Actualizacion): "
if "%msg%"=="" set "msg=Actualizacion del sitio"

:: 6. Guarda el cambio (si no hay nada nuevo, continua igual)
git commit -m "%msg%"
if errorlevel 1 echo (No habia cambios nuevos que guardar, continuo...)

:: 7. Trae primero lo ultimo de GitHub y lo combina (evita rechazos si
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

:: 8. Sube a GitHub
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
