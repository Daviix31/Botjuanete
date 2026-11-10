import { test } from "node:test";
import assert from "node:assert/strict";
import { describeDeployFailure } from "../apps/bot/src/utils/deploy-error.js";

test("registro distingue rechazo de token, aplicación, servidor y acceso", () => {
  assert.match(describeDeployFailure({ status: 401, code: 50014 }), /DISCORD_TOKEN/);
  assert.match(describeDeployFailure({ status: 403, code: 20012 }), /DISCORD_CLIENT_ID/);
  assert.match(describeDeployFailure({ status: 404, code: 10004 }), /DISCORD_GUILD_ID/);
  const access = describeDeployFailure({ status: 403, code: 50001 });
  assert.match(access, /HTTP 403 · Discord 50001/);
  assert.match(access, /applications.commands/);
  assert.match(access, /No hace falta Administrator/);
});

test("registro distingue conexión, datos inválidos y límites de Discord", () => {
  const connection = describeDeployFailure({ cause: { code: "UND_ERR_CONNECT_TIMEOUT" } });
  assert.match(connection, /UND_ERR_CONNECT_TIMEOUT/);
  assert.match(connection, /conexión/);
  assert.doesNotMatch(connection, /DISCORD_TOKEN/);
  assert.match(describeDeployFailure({ status: 400, code: 50035 }), /datos de los comandos/);
  assert.match(describeDeployFailure({ status: 429 }), /Espera/);
});

test("diagnóstico no imprime secretos ni mensajes, cuerpos, URL o códigos arbitrarios", () => {
  const secret = "PRIVATE_TOKEN_MUST_NOT_APPEAR";
  const examples = [
    null,
    undefined,
    secret,
    { status: secret, code: secret, message: secret },
    { status: NaN, code: Infinity, cause: { code: secret } },
    {
      status: 403,
      code: 50001,
      message: secret,
      headers: { Authorization: secret },
      requestBody: { json: secret },
      rawError: { message: secret },
      url: secret,
    },
  ];
  for (const error of examples)
    assert.doesNotMatch(describeDeployFailure(error), /PRIVATE_TOKEN_MUST_NOT_APPEAR|NaN|Infinity/);
});
