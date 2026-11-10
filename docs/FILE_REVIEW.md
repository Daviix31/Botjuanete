# Revisión de archivos originales

Se leyeron y revisaron los 48 archivos del ZIP inicial, incluidas las instrucciones, configuración, documentación, cada módulo y cada migración. Se revisaron también los archivos nuevos escritos durante esta actualización.

La tabla identifica cada archivo original y conserva su trazabilidad. Los archivos generados, dependencias de terceros y cachés se verifican mediante instalación, compilación y auditoría; no se presentan como código propio revisado línea por línea.

| Archivo original                               | Resultado             |
| ---------------------------------------------- | --------------------- |
| `.env.example`                                 | Actualizado; revisado |
| `.gitignore`                                   | Actualizado; revisado |
| `AGENTS.md`                                    | Conservado; revisado  |
| `CODEX_PROMPT.md`                              | Conservado; revisado  |
| `README.md`                                    | Actualizado; revisado |
| `apps/api/package.json`                        | Actualizado; revisado |
| `apps/api/src/auth.ts`                         | Actualizado; revisado |
| `apps/api/src/config.ts`                       | Actualizado; revisado |
| `apps/api/src/env.ts`                          | Actualizado; revisado |
| `apps/api/src/index.ts`                        | Actualizado; revisado |
| `apps/api/tsconfig.json`                       | Actualizado; revisado |
| `apps/bot/package.json`                        | Actualizado; revisado |
| `apps/bot/src/client.ts`                       | Actualizado; revisado |
| `apps/bot/src/commands/config.ts`              | Actualizado; revisado |
| `apps/bot/src/commands/embed.ts`               | Actualizado; revisado |
| `apps/bot/src/commands/index.ts`               | Actualizado; revisado |
| `apps/bot/src/commands/music.ts`               | Actualizado; revisado |
| `apps/bot/src/commands/ping.ts`                | Actualizado; revisado |
| `apps/bot/src/commands/role.ts`                | Actualizado; revisado |
| `apps/bot/src/commands/security.ts`            | Actualizado; revisado |
| `apps/bot/src/commands/template.ts`            | Actualizado; revisado |
| `apps/bot/src/config.ts`                       | Actualizado; revisado |
| `apps/bot/src/deploy-commands.ts`              | Actualizado; revisado |
| `apps/bot/src/env.ts`                          | Actualizado; revisado |
| `apps/bot/src/events/register.ts`              | Actualizado; revisado |
| `apps/bot/src/index.ts`                        | Actualizado; revisado |
| `apps/bot/src/services/logging.ts`             | Actualizado; revisado |
| `apps/bot/src/services/music.ts`               | Actualizado; revisado |
| `apps/bot/src/types.ts`                        | Actualizado; revisado |
| `apps/bot/src/utils/permissions.ts`            | Actualizado; revisado |
| `apps/bot/tsconfig.json`                       | Actualizado; revisado |
| `apps/dashboard/app/globals.css`               | Actualizado; revisado |
| `apps/dashboard/app/layout.tsx`                | Actualizado; revisado |
| `apps/dashboard/app/page.tsx`                  | Actualizado; revisado |
| `apps/dashboard/next-env.d.ts`                 | Actualizado; revisado |
| `apps/dashboard/next.config.ts`                | Actualizado; revisado |
| `apps/dashboard/package.json`                  | Actualizado; revisado |
| `apps/dashboard/tsconfig.json`                 | Actualizado; revisado |
| `docker-compose.yml`                           | Actualizado; revisado |
| `docs/ARCHITECTURE.md`                         | Actualizado; revisado |
| `docs/STATUS.md`                               | Actualizado; revisado |
| `package.json`                                 | Actualizado; revisado |
| `packages/database/migrations/001_initial.sql` | Conservado; revisado  |
| `packages/database/package.json`               | Actualizado; revisado |
| `packages/database/scripts/migrate.ts`         | Actualizado; revisado |
| `packages/database/src/index.ts`               | Actualizado; revisado |
| `packages/database/tsconfig.json`              | Actualizado; revisado |
| `tsconfig.base.json`                           | Actualizado; revisado |

No se retiró ningún archivo original. Los entrypoints y comandos originales se conservaron. Se añadieron archivos por dominio para completar funciones y pruebas.

## Hallazgos corregidos

- Incompatibilidad de tipos de builders de slash y acceso a guild en eventos de canales DM.
- Carga de `.env` dependiente del directorio de ejecución y errores de arranque poco claros.
- Instalación nativa obligatoria de Opus y dependencias vulnerables asociadas; sustitución por Opus en JavaScript.
- Merge superficial de configuración que podía perder ajustes anidados.
- Falta de sesiones revocables, CSRF para cambios y auditoría de acciones del panel.
- Validaciones insuficientes de IDs, jerarquía del actor, autorol y permisos efectivos.
- Plantillas sin confirmación y configuración sobrescrita por valores predeterminados.
- Antispam sancionador por defecto y ventana anti-raid fija que ignoraba la configuración.
- Falta de atribución a actor mediante Audit Log y detección de dominios bloqueados.
- Reproducción que podía confirmar pistas fallidas, perder la siguiente pista o reiniciar tras detener una carga.
- Falta de comprobación de destinos privados, espera de conexión de voz y limpieza fiable de audio.
- Panel de módulos informativo, tablas persistentes sin servicios y ausencia de pruebas.

## Archivos añadidos

- `.dockerignore`
- `.github/workflows/ci.yml`
- `.prettierignore`
- `.prettierrc.json`
- `Dockerfile`
- `apps/api/src/app.ts`
- `apps/api/src/discord.ts`
- `apps/bot/src/commands/community.ts`
- `apps/bot/src/services/announcements.ts`
- `apps/bot/src/services/audio-source.ts`
- `apps/bot/src/services/community.ts`
- `apps/bot/src/services/roles.ts`
- `apps/bot/src/services/security.ts`
- `apps/bot/src/services/templates.ts`
- `apps/bot/src/services/worker.ts`
- `apps/bot/src/utils/locks.ts`
- `apps/dashboard/components/activity.tsx`
- `apps/dashboard/components/administration.tsx`
- `apps/dashboard/components/announcements.tsx`
- `apps/dashboard/components/fields.tsx`
- `apps/dashboard/components/music.tsx`
- `apps/dashboard/components/settings.tsx`
- `apps/dashboard/lib/api.ts`
- `docs/LIVE_CHECKLIST.md`
- `docs/QA_REPORT.md`
- `docs/verification/audit-production.json`
- `docs/verification/check.txt`
- `docs/verification/e2e.txt`
- `docs/verification/install.txt`
- `package-lock.json`
- `packages/database/migrations/002_modules.sql`
- `packages/database/src/backup.ts`
- `packages/database/src/community.ts`
- `packages/database/src/connection.ts`
- `packages/database/src/metrics.ts`
- `packages/database/src/operations.ts`
- `packages/database/src/settings.ts`
- `packages/shared/package.json`
- `packages/shared/src/env.ts`
- `packages/shared/src/index.ts`
- `packages/shared/tsconfig.json`
- `playwright.config.ts`
- `scripts/backup.ts`
- `scripts/doctor.ts`
- `scripts/e2e-runner.ts`
- `scripts/setup.ts`
- `scripts/test-db.ts`
- `scripts/test-env.ts`
- `scripts/test-runner.ts`
- `tests/api.test.ts`
- `tests/bot.test.ts`
- `tests/database.test.ts`
- `tests/e2e/dashboard.spec.ts`
- `tests/e2e/fixtures.ts`
- `tests/music.test.ts`
- `tests/validation.test.ts`
- `tsconfig.tools.json`
