# Verificación de NOXIS BOT v0.2

Fecha de revisión: 8 de noviembre de 2026, zona America/Bogota.

Resultado: **comprobaciones locales aprobadas; integración real pendiente**. No se declara el producto terminado ni desplegado.

## Entorno y resultados

| Comprobación ejecutada      | Resultado                                                                      | Evidencia                                       |
| --------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------- |
| `npm ci`                    | Correcto, instalación reproducible desde el lockfile                           | `verification/install.txt`                      |
| `npm run typecheck`         | Correcto en los cinco workspaces, scripts y tests                              | `verification/check.txt`                        |
| `npm test`                  | **29 pruebas aprobadas, 0 fallidas, 0 omitidas**                               | `verification/check.txt`                        |
| `npm run build`             | Compilación de producción correcta con Next.js 16.4.5                          | `verification/check.txt`                        |
| Pruebas de navegador        | **2 escenarios aprobados**, escritorio y móvil                                 | `verification/e2e.txt`                          |
| `npm audit --omit=dev`      | **0 vulnerabilidades conocidas** al ejecutar la comprobación                   | `verification/audit-production.json`            |
| FFmpeg, Opus y DAVE         | Dependencias presentes; audio sintético generado y codificado por el player    | Test `music.test.ts` y registro de comprobación |
| Diagnóstico sin `.env` real | Detecta de forma esperada los datos externos que faltan, sin imprimir secretos | `npm run doctor`                                |

Node.js 24.22.1 y npm 11.9.0. Navegador de pruebas Chromium 153 mediante Playwright, con comprobación de seguridad web activa. El binario normal de Playwright no pudo descargarse en este entorno; se utilizó un ejecutable alternativo local para ejecutar las mismas pruebas. El proyecto admite `CHROMIUM_EXECUTABLE_PATH`; el workflow normal instala Chromium con Playwright.

## Cobertura efectiva

- Rechazo de accesos anónimos y JWT alterado; allowlist de propietarios.
- OAuth con estado inválido, usuario no autorizado y respuesta autorizada mediante doble del proveedor.
- Cookies HttpOnly/SameSite y logout que invalida reutilización del JWT.
- Rechazo de CSRF, origen incorrecto, servidor fuera de allowlist y datos inválidos.
- Permisos retirados antes de una modificación y jerarquía del bot/actor en roles.
- Idempotencia de trabajos, reclamación única, persistencia de éxito/fallo y auditoría.
- Migraciones repetibles, conexión SQL, merge profundo de configuración y rollback.
- Anuncios programados/cancelados y plantillas de embed persistentes.
- Plantillas concurrentes sin duplicación de recursos y conservación de ajustes existentes.
- Tickets únicos, voto modificable, cierre de encuesta, ganador persistido y cooldown de XP.
- Exportación sin sesiones ni datos de otros servidores.
- Antispam en observación, reincidencia, ventanas configurables y memoria acotada.
- Coincidencia de dominios bloqueados, validación de fuentes y rechazo de destinos privados.
- Audio sintético procesado por FFmpeg y codificado mediante Opus; dependencias DAVE detectadas.
- Error de fuente, cancelación durante descarga y conservación de la siguiente pista tras un fallo.
- Navegador: acceso privado, guardado y persistencia tras recargar, preview de anuncio, trabajo en cola, confirmación de plantilla, playlist, comunidad y logout.
- Inspección visual de escritorio/móvil y comprobación de ausencia de desbordamiento horizontal a 390 px.

## Qué significa la prueba de PostgreSQL

Se levantó **PostgreSQL WASM mediante PGlite**, se abrió un servidor TCP y se conectó el driver real `pg`. Se ejecutaron las migraciones y las consultas SQL de la aplicación; la API y las pruebas de navegador utilizaron esa base.

No se conectó a un clúster PostgreSQL 17 nativo ni a la base del usuario. El modo local usa una conexión y no acredita por sí solo concurrencia multiconexión, TLS, latencias, copias físicas ni recuperación de producción. La misma batería admite `TEST_DATABASE_URL` para una base dedicada terminada en `_test`; el workflow incluido configura PostgreSQL 17, pero **no se ejecutó ese workflow en una cuenta remota**.

## Qué significa la prueba de Discord

Las pruebas utilizan respuestas controladas del proveedor OAuth y un doble del servidor Discord para verificar servicios. No hay login de prueba en la API de producción. La capa de datos, sesión, API y panel se ejecutan realmente; los efectos externos de Discord se sustituyen en los tests.

No se realizó login al Gateway, registro remoto de comandos, asignación real de roles, entrega de anuncios a Discord ni negociación DAVE con audio audible. No se proporcionaron tokens o IDs reales. `doctor` señala correctamente esa configuración pendiente.

## Pendiente para cerrar la validación

1. Configurar `.env` con la aplicación oficial del usuario, IDs y conexión de base real.
2. Pasar la batería con PostgreSQL 17 nativo y revisar TLS/operación del destino.
3. Ejecutar `LIVE_CHECKLIST.md` en un servidor Discord de desarrollo, incluido OAuth y voz.
4. Construir y probar Docker/Compose en un host con Docker. No estaba disponible en este entorno.
5. Probar una copia completa y su restauración antes de activar producción.

Las comprobaciones locales aprobadas no sustituyen estos pasos externos. `STATUS.md` conserva esa distinción.

## Corrección de diagnóstico del registro — 2026-11-09

La captura de la instalación real confirma autenticación REST y migraciones PostgreSQL correctas, pero el registro de comandos aún falla. El mensaje anterior ocultaba la causa: el resultado de registro real sigue pendiente.

- `npm run typecheck`: pasó en los cinco workspaces y herramientas.
- `npm test`: 32 pruebas pasaron, 0 fallos y 0 omitidas, con PostgreSQL WASM aislado por TCP. Incluye tres pruebas nuevas para separar códigos de credenciales, aplicación, servidor, acceso, conexión y datos inválidos, y verificar que el diagnóstico excluye secretos y errores crudos.
- El entrypoint de registro se ejecutó con REST simulado: éxito con ruta y 11 comandos válidos (salida 0), y fallo 403/50001 con diagnóstico seguro (salida 1). No se envió ninguna solicitud a Discord en esta comprobación.
- Se corrigieron `dev:bot` y `dev:api`, eliminando el preload `--import node`. El arranque en la PC Windows debe verificarse al completar el registro.

Esta corrección no modifica `.env`, dependencias ni migraciones. No se declara completada la integración con Discord.
