# Estado de NOXIS BOT — v0.2

**Estado: desarrollo verificado localmente; integración real y activación pendientes.** No se declara el proyecto terminado ni listo para producción.

## Implementado

- Revisión de todos los archivos originales del ZIP, registrada en `FILE_REVIEW.md`.
- TypeScript estricto, cinco workspaces, lockfile, configuración estable de entorno y scripts de instalación/diagnóstico.
- PostgreSQL: migraciones versionadas, consultas por dominio, configuración con merge profundo, transacciones, auditoría y exportación de datos.
- Los siete comandos originales conservados y corregidos; cuatro comandos nuevos de comunidad.
- Bienvenida, despedida y autorol seguro; mensajes personalizados.
- OAuth2 OWNER-only, sesión revocable, cookies seguras en producción, comprobación de state, CSRF, rate limiting y logout.
- Panel completo por módulos: configuración, anuncios y preview, roles/plantillas, música, comunidad, métricas y actividad.
- Trabajos web persistentes con idempotencia, comprobaciones al ejecutar, estados reales y tratamiento de resultados inciertos.
- Anuncios programados/cancelables y plantillas de embed con autoría.
- Plantillas de servidor con preview y confirmación; creación conservadora y exclusión mutua.
- Seguridad configurable: observación por defecto, timeout por reincidencia explícita, ventanas de entradas, dominios bloqueados y atribución mediante Audit Log.
- Música: audio directo autorizado, protección contra destinos privados, DAVE instalado, FFmpeg/Opus, controles, playlists, límites y cancelación de cargas.
- Tickets privados y archivo sin borrado, recuperación de creaciones interrumpidas, encuestas/votos, sorteos persistentes, niveles y métricas.
- Dockerfile, Compose y workflow de CI con servicio PostgreSQL 17 incluidos.

## Verificado localmente

Corrección de instalación local: el registro de comandos informa estados HTTP, códigos de Discord y códigos de red conocidos, sin volcar errores crudos ni secretos. Se corrigieron los comandos de desarrollo del bot y la API, que incluían un preload `--import node` inválido. La activación en el servidor real sigue pendiente hasta que el registro y las pruebas de Discord pasen.

Consulta `QA_REPORT.md` para comandos, resultados, alcance y diferencias entre dobles de prueba y servicios reales. Se comprobaron validaciones, servicios críticos, API, PostgreSQL aislado por TCP, procesamiento de audio y el panel en navegador de escritorio/móvil.

## Pendiente externo

1. Completar los datos reales de Discord, IDs autorizados y conexión de PostgreSQL en `.env`.
2. Ejecutar la batería en PostgreSQL 17 nativo, con concurrencia y TLS del proveedor de destino.
3. Conectar el bot al Gateway real, registrar comandos y ejecutar las comprobaciones del servidor de desarrollo.
4. Completar OAuth2 real y negociación de voz DAVE con audio audible.
5. Construir/verificar contenedores en un host con Docker y validar copias/restauración del clúster.

No hay autenticación de prueba ni credenciales inventadas en los entrypoints de producción. Los IDs y tokens ficticios de `scripts/test-env.ts` pertenecen exclusivamente a tests.

## Alcance y límites

- Un servidor privado; no hay registro público ni creación de servidores Discord nuevos.
- Música por fuentes HTTPS de audio directo autorizadas; no hay extracción de Spotify/YouTube ni catálogo externo de búsqueda.
- Anti-raid y anti-nuke alertan; no hay bans masivos, cuarentena ni lockdown automáticos. Esas medidas requerirían un diseño de reglas y confirmaciones específico antes de incorporarlas.
- Anti-phishing usa una lista explícita, no inteligencia universal de amenazas.
- Tickets, encuestas, sorteos y niveles tienen una implementación inicial funcional; la gestión de sus interacciones se realiza en Discord y el panel muestra sus datos y ajustes.
- Las entregas externas no tienen garantía de exactamente una vez; los resultados inciertos requieren revisión.
- Exportar JSON no reemplaza una estrategia probada de backup/restauración PostgreSQL.
