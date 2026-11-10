# Validación real antes de producción

Estas comprobaciones necesitan tu aplicación oficial, un servidor Discord de desarrollo y tu PostgreSQL. No se realizaron con credenciales reales en esta entrega.

## Preparación

- [ ] `.env` completo, protegido y fuera del repositorio; sin datos de prueba.
- [ ] Bot invitado al servidor correcto; intents y permisos mínimos configurados.
- [ ] PostgreSQL 17 accesible; migraciones aplicadas; certificados verificados si usas TLS.
- [ ] `npm run doctor -- --live` correcto.
- [ ] `npm run deploy:commands` correcto; `/ping` responde.

## Identidad y panel

- [ ] OAuth2 permite entrar a un OWNER real y rechaza una cuenta no incluida.
- [ ] El callback coincide con Discord Developer Portal.
- [ ] Guardar bienvenida, despedida, logs y autorol funciona y persiste tras reiniciar API/bot.
- [ ] Logout invalida la sesión; las cookies de producción usan HttpOnly, Secure y SameSite.
- [ ] Se ven de forma diferenciada salud de PostgreSQL, conexión del bot y trabajos pendientes.

## Servidor y anuncios

- [ ] Probar roles seguros y rechazos por permisos, jerarquía, integración y rol `@everyone`.
- [ ] Preview de plantilla correcto; creación solo tras confirmar; repetir conserva recursos existentes.
- [ ] Anuncio inmediato con preview, imagen y formato correctos.
- [ ] Anuncio programado se entrega una vez, registra autor y puede cancelarse antes de iniciarse.
- [ ] Retirar permisos al autor antes de la hora impide ejecutar la acción.
- [ ] Reiniciar durante una entrega deja un resultado para revisión y no reenvía a ciegas.

## Seguridad y comunidad

- [ ] Entradas/salidas y autorol funcionan con usuarios reales y fallan de forma visible si faltan permisos.
- [ ] Antispam en observación registra actividad sin castigar por una sola señal.
- [ ] Timeout solo con regla explícita, reincidencia y permiso Moderar miembros.
- [ ] Anti-raid usa el umbral configurado; Audit Log atribuye acciones y alerta.
- [ ] Dominios de la lista se detectan sin tratar otros sufijos como coincidencias.
- [ ] Ticket privado visible únicamente para creador, soporte y bot; cerrar conserva mensajes.
- [ ] Encuesta admite un voto por miembro, cambio de voto y cierre.
- [ ] Sorteo mantiene participantes y ganador tras reinicio.
- [ ] Niveles respetan cooldown y muestran clasificación.

## Música y operación

- [ ] Fuente directa autorizada con derechos de retransmisión y host permitido.
- [ ] Conexión de voz con DAVE y audio audible en un canal normal.
- [ ] Pausa, reanudación, salto, volumen, cola, playlists y parada sin procesos huérfanos.
- [ ] URL fallida, host no permitido y pérdida de conexión no bloquean permanentemente la cola.
- [ ] Dos instancias del bot no quedan activas para el mismo servidor.
- [ ] Pruebas con `TEST_DATABASE_URL` pasan sobre PostgreSQL 17 nativo.
- [ ] Dockerfile y Compose construyen e inician en el host de destino.
- [ ] Copia del clúster y restauración verificadas en otra instancia; exportación JSON accesible solo al operador.

Registra fecha, entorno, resultados y fallos encontrados. Solo tras estas verificaciones puede evaluarse la activación en producción.
