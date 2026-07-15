@echo off
echo Preparando los archivos para subirlos a GitHub...

:: 1. Inicializa el control de versiones en tu carpeta
git init

:: 2. Agrega todos los archivos actuales
git add .

:: 3. Crea el punto de guardado (commit)
git commit -m "Primera publicacion de Foresee"

:: 4. Asegura que la rama principal se llame 'main'
git branch -M main

:: 5. Conecta tu carpeta local con el repositorio de GitHub
git remote add origin https://github.com/Alberthoma/Foresee.git

:: 6. Sube los archivos a internet
git push -u origin main

echo.
echo ¡Proceso terminado! Ya puedes revisar tu GitHub.
pause