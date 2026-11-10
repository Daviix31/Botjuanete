# Arquitectura NOXIS BOT v0.2

Monorepo de TypeScript estricto. El alcance operativo sigue siendo un servidor privado definido por `DISCORD_GUILD_ID`.

| Directorio              | Responsabilidad                                                                  |
| ----------------------- | -------------------------------------------------------------------------------- |
| `apps/bot/src/commands` | Interacciones slash y validación de opciones                                     |
| `apps/bot/src/events`   | Eventos limitados al servidor autorizado y manejo de errores                     |
| `apps/bot/src/services` | Roles, plantillas, anuncios, seguridad, comunidad, música y worker               |
| `apps/bot/src/utils`    | Jerarquía, permisos y exclusión mutua por servidor                               |
| `apps/api/src`          | OAuth2, sesiones revocables, CSRF, rate limit, REST de Discord y API del panel   |
| `apps/dashboard`        | Panel Next.js en español, componentes por módulo y cliente de API                |
| `packages/shared`       | Esquemas Zod, contratos, tipos, plantillas y carga estable de `.env`             |
| `packages/database`     | Pool PostgreSQL, transacciones, consultas por dominio, exportación y migraciones |
| `scripts`               | Configuración inicial, diagnóstico y entornos aislados de prueba                 |
| `tests`                 | Pruebas de validación, permisos, API, datos, bot, audio y navegador              |

## Cambios respecto a v0.1

Se conserva la separación bot/API/panel/PostgreSQL. Se incorpora un paquete compartido para evitar validaciones divergentes y una cola PostgreSQL para ejecutar acciones web en el proceso que está conectado a Discord. No se añaden Redis ni otro servidor de colas.

## Flujo de una acción web

1. La API verifica JWT, sesión activa, allowlist, origen y token CSRF.
2. Valida la solicitud y consulta los permisos del actor en Discord.
3. Guarda el trabajo con clave de idempotencia y evento de auditoría en una transacción.
4. El bot reclama un trabajo mediante `FOR UPDATE SKIP LOCKED` y vuelve a comprobar permisos actuales, servidor y jerarquía.
5. Ejecuta la acción y persiste su resultado. El panel consulta ese estado.

El bot mantiene un lease renovable en PostgreSQL que evita dos instancias activas para el mismo servidor. Las plantillas, además, se serializan dentro del proceso para evitar duplicados al coincidir un comando slash con un trabajo web.

Discord y PostgreSQL no comparten una transacción: una caída entre la entrega y su registro puede dejar un resultado incierto. Los trabajos interrumpidos pasan a revisión y los anuncios inciertos a fallo con indicación de revisar el canal. No se promete entrega exactamente una vez. Los anuncios usan nonce cuando la API de Discord lo admite y no se reenvían automáticamente tras una interrupción.

## Identidad y permisos

OAuth2 solicita `identify`; no conserva access tokens de Discord. La cookie HttpOnly contiene un JWT HS256 con emisor, audiencia, expiración, ID de sesión y secreto CSRF. PostgreSQL registra las sesiones activas para que logout invalide también una copia del JWT. En producción las cookies son Secure y requieren HTTPS en el mismo sitio que el panel.

La allowlist controla acceso al panel. Las acciones también requieren permisos efectivos de servidor y respetan la jerarquía del actor y del bot. Los roles nuevos no reciben permisos administrativos y el autorol rechaza permisos de administración/moderación. Las menciones automáticas se desactivan en mensajes generados.

El log HTTP omite consultas OAuth y redacta cookies y autorización. Los errores públicos no devuelven secretos, errores SQL ni respuestas crudas de Discord. CORS limita el origen del panel. `TRUST_PROXY` se activa explícitamente.

## Datos y trabajos persistentes

- Configuración JSONB con merge profundo atómico y auditoría transaccional.
- Migraciones con checksum y lock de transacción, compatibles con la migración inicial.
- Anuncios, trabajos, plantillas de embed y playlists persistentes.
- Tickets con restricción única para un ticket activo por usuario y recuperación de creaciones interrumpidas.
- Votos únicos y modificables mientras la encuesta esté abierta.
- Sorteos con cierre bajo bloqueo de fila y ganadores persistidos antes de editar el mensaje público.
- XP con cooldown comprobado por SQL, métricas limitadas al servidor y heartbeat separado del health de API.

## Seguridad

Antispam en observación por defecto, timeout solo bajo una regla explícita y reincidencia. Los detectores tienen ventanas configurables y memoria acotada. Anti-raid y Audit Log alertan; no aplican bans masivos. Anti-phishing compara hosts con una lista de bloqueo explícita, sin afirmar cobertura universal.

## Audio

`@discordjs/voice` 0.19.2 y DAVE mediante `@snazzah/davey`. `opusscript` evita exigir compilación nativa de Opus. FFmpeg transforma el audio desde stdin, con protocolos externos deshabilitados en el decodificador.

El servidor acepta únicamente audio directo HTTPS de dominios exactos permitidos. Resuelve DNS, rechaza direcciones no públicas y fija la dirección usada al conectar para evitar rebinding. No sigue redirecciones. Comprueba MIME, tamaño, timeout y permisos del canal; espera a que la conexión de voz esté lista. Cancela descargas y procesos al detener o cambiar de pista, limita cola/duración y desconecta sesiones vacías.

Las pruebas locales comprueban dependencias, decodificación, codificación y ciclo de vida. La negociación con Discord, DAVE sobre voz real y audibilidad requieren un servidor de prueba.

## Límites de la validación

PGlite ejecuta PostgreSQL en WASM y permite probar el protocolo TCP usado por `pg`; no sustituye un clúster nativo ni reproduce todas sus condiciones de concurrencia, TLS o recuperación. Las mismas pruebas admiten `TEST_DATABASE_URL` para PostgreSQL nativo. Los dobles de Discord en tests no se usan por los entrypoints de producción.
