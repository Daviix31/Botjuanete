# Instrucciones para Codex — NOXIS BOT

## Objetivo
Construir un bot privado y multipropósito para Discord con identidad NOXIS STUDIOS. El proyecto incluye bot Discord, API privada, panel web y PostgreSQL.

## Reglas obligatorias
- Mantén TypeScript estricto y módulos pequeños por dominio.
- Nunca escribas tokens, contraseñas ni secretos en el código, logs o commits.
- Nunca solicites ni uses un token de cuenta de usuario (self-bot). Solo bot oficial de Discord.
- Respeta permisos, jerarquía de roles, rate limits y términos de Discord.
- No concedas `Administrator` automáticamente a roles creados.
- Las operaciones de plantilla solo crean recursos; no borres ni sobrescribas canales/roles existentes sin confirmación explícita.
- No castigues automáticamente a usuarios por una sola señal débil. Registra eventos, aplica límites conservadores y deja las medidas destructivas detrás de confirmación del OWNER.
- El panel web debe estar protegido por OAuth2 de Discord y allowlist `OWNER_USER_IDS`.
- Toda acción administrativa sensible debe comprobar permisos en el servidor y registrar auditoría.
- Música: soporta únicamente fuentes HTTPS de audio directo en dominios incluidos en `MUSIC_ALLOWED_HOSTS`. No extraigas audio de Spotify, YouTube u otros servicios sin autorización. DAVE debe mantenerse compatible mediante una versión estable actual de `@discordjs/voice`.
- No uses endpoints privados ni automatización de cuentas de usuario.
- No afirmes que el bot puede crear nuevos servidores Discord. Puede configurar servidores existentes donde haya sido invitado.

## Flujo de trabajo
1. Lee `docs/ARCHITECTURE.md` y `README.md`.
2. Antes de cambiar arquitectura, explica el impacto.
3. Añade pruebas para validaciones, permisos y servicios críticos.
4. Ejecuta `npm run typecheck` y las pruebas disponibles.
5. Actualiza `docs/STATUS.md` con lo terminado, pendiente y riesgos.
6. No declares un módulo terminado si solo existe una interfaz o un placeholder.

## Prioridades
P0: bot inicia, comandos, DB, OAuth2 OWNER-only, logging y despliegue seguro.
P1: configuración, bienvenida/salida, plantillas no destructivas, anuncios/embeds.
P2: seguridad configurable y auditoría.
P3: música con fuentes autorizadas, cola y controles.
P4: tickets, sorteos, niveles, encuestas y estadísticas avanzadas.
