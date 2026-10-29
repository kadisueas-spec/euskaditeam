import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BROADCAST_BODY_MAX,
  BROADCAST_DEFAULTS,
  BROADCAST_TAG,
  BROADCAST_URL,
  buildBroadcastPayload,
  normalizeBroadcastText,
} from "@/lib/push/broadcast";

test("el texto precargado arma un payload válido que abre Inicio", () => {
  const out = buildBroadcastPayload(BROADCAST_DEFAULTS);
  assert.ok("payload" in out);
  assert.deepEqual(out.payload, {
    title: "Estamos mejorando la app 💪",
    body: "Sumamos mejoras en tus entrenamientos y reportes. Cerrá y volvé a abrir la app para verlas.",
    url: BROADCAST_URL,
    tag: BROADCAST_TAG,
  });
  assert.equal(BROADCAST_URL, "/client/home");
});

test("tildes y ñ: sobreviven a JSON y UTF-8 tal cual", () => {
  const out = buildBroadcastPayload({ title: "Año nuevo, más energía 💪", body: "Pequeñas mejoras: sesión, récords y canción" });
  assert.ok("payload" in out);
  // Lo que viaja en la push: JSON → bytes UTF-8 → de vuelta
  const bytes = new TextEncoder().encode(JSON.stringify(out.payload));
  const back = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  assert.equal(back.title, "Año nuevo, más energía 💪");
  assert.equal(back.body, "Pequeñas mejoras: sesión, récords y canción");
});

test("tilde separada de la letra (texto pegado): se une en un solo carácter", () => {
  const decomposed = "Cerrá y volvé"; // "a" + tilde combinable
  assert.equal(normalizeBroadcastText(decomposed), "Cerrá y volvé");
  assert.equal(normalizeBroadcastText(decomposed).length, "Cerrá y volvé".length);
});

test("validación: título y texto obligatorios, con tope", () => {
  assert.deepEqual(buildBroadcastPayload({ title: "  ", body: "x" }), { error: "Escribí un título." });
  assert.deepEqual(buildBroadcastPayload({ title: "x", body: "" }), { error: "Escribí el texto." });
  const long = buildBroadcastPayload({ title: "x", body: "a".repeat(BROADCAST_BODY_MAX + 1) });
  assert.ok("error" in long);
  // Los emojis cuentan como un carácter, no por sus bytes
  assert.ok("payload" in buildBroadcastPayload({ title: "💪".repeat(60), body: "ok" }));
});
