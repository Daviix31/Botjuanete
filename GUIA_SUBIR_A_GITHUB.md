# Subir NOXIS BOT v0.2 a GitHub

Este ZIP contiene los archivos del proyecto, listos para versionarse. **No subas el archivo ZIP como si fuera el código del repositorio:** descomprímelo y publica los archivos y carpetas de su interior, incluidas las carpetas ocultas `.github` y los archivos `.gitignore` y `.env.example`.

## Método recomendado: Git desde PowerShell (Windows)

1. Descomprime `NOXIS-BOT-v0.2-GitHub.zip` en una carpeta llamada `NOXIS-BOT`.
2. En [github.com/new](https://github.com/new), crea un repositorio llamado `NOXIS-BOT`. Si es un bot privado, marca **Private**. No actives `Add a README file`, `.gitignore` ni `license`, porque ya existen archivos en el proyecto.
3. Abre PowerShell **dentro de la carpeta descomprimida**, donde está `package.json`.
4. Copia los siguientes comandos **uno por uno**, cambiando `TU_USUARIO` por tu nombre de usuario de GitHub:

```powershell
git init
git branch -M main
git add .
git commit -m "NOXIS BOT v0.2"
git remote add origin https://github.com/TU_USUARIO/NOXIS-BOT.git
git push -u origin main
```

Si `git` no se reconoce, instala Git para Windows desde <https://git-scm.com/downloads/win> y abre una terminal nueva. Si Git pide tu identidad, configura `git config --global user.name "Tu nombre"` y `git config --global user.email "tu-correo@example.com"`, y repite el commit. GitHub puede pedirte iniciar sesión por navegador o usar un método de autenticación admitido.

## Alternativa sin comandos

Usa [GitHub Desktop](https://desktop.github.com/): **File > Add local repository** (o **Create a new repository from local files**), selecciona la carpeta descomprimida, realiza el primer commit y pulsa **Publish repository**. Marca **Keep this code private** si corresponde.

## Importante: seguridad y ejecución

- **Nunca** publiques `.env`, el token del bot, el secreto de OAuth2 ni contraseñas. `.gitignore` excluye los archivos locales de secretos; `.env.example` solo contiene campos vacíos para que los completes localmente.
- No subas `node_modules`, `.next`, `dist`, bases de datos, copias de seguridad ni archivos de sesión.
- **GitHub no ejecuta el bot automáticamente.** Para usar el bot necesitas Node.js 24.17+, PostgreSQL 17 y credenciales de Discord. Sigue el `README.md` para instalarlo y ejecutarlo en tu computadora o servidor.
- El proyecto tiene un workflow en `.github/workflows/ci.yml` para ejecutar comprobaciones cuando hagas `push`, pero eso no sustituye el despliegue ni las pruebas con tu Discord real.
