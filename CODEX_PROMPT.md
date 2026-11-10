# Prompt inicial para Codex

Abre el repositorio `NOXIS-BOT`, lee `AGENTS.md`, `README.md`, `docs/ARCHITECTURE.md` y `docs/STATUS.md` completos.

Continúa el desarrollo de NOXIS BOT como plataforma privada para un único servidor Discord al inicio, con bot Discord + API + dashboard web + PostgreSQL. Mantén el estilo visual negro/grafito con acentos rojos NOXIS.

Primero revisa el estado real del código y corrige errores de TypeScript sin borrar funcionalidades. Después implementa, por fases y con pruebas:
1. Autenticación OAuth2 Discord del panel con allowlist OWNER_USER_IDS, cookies HttpOnly/Secure/SameSite, CSRF state, rate limit y logout.
2. Configuración web de bienvenida, despedida, logs, autorol y módulos de seguridad.
3. Constructor de plantillas de servidor con vista previa y confirmación; nunca borrar ni modificar canales existentes por defecto.
4. Sistema de anuncios/embeds con plantillas, programación, preview y registro de quién envió cada anuncio.
5. Seguridad: anti-spam, anti-raid, anti-phishing y detección de acciones masivas usando audit log; modo observación por defecto, umbrales configurables y cuarentena/lockdown solo con reglas explícitas.
6. Música con DAVE, cola por servidor, controles y proveedores autorizados. No implementar extracción de Spotify/YouTube ni saltarse restricciones de proveedores.
7. Tickets, sorteos, encuestas, niveles y métricas.

No inventes credenciales ni IDs. Si falta configuración externa, deja un paso claro en `.env.example` y en README. Al final ejecuta typecheck/tests y actualiza `docs/STATUS.md`.
