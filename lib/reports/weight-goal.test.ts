import { test } from "node:test";
import assert from "node:assert/strict";
import { goalMentions, weightDirectionFromGoal } from "@/lib/reports/weight-goal";

test("perder grasa + ganar fuerza es objetivo de bajar", () => {
  assert.equal(weightDirectionFromGoal("Perder grasa, ganar fuerza y desarrollar gluteos"), "lose");
});

test("ganar masa es objetivo de subir", () => {
  assert.equal(weightDirectionFromGoal("Ganar masa muscular"), "gain");
  assert.equal(weightDirectionFromGoal("Hipertrofia"), "gain");
  assert.equal(weightDirectionFromGoal("Subir de peso"), "gain");
});

test("sin objetivo de peso: neutro", () => {
  assert.equal(weightDirectionFromGoal("Ganar fuerza"), null);
  assert.equal(weightDirectionFromGoal("Mejorar la técnica"), null);
  assert.equal(weightDirectionFromGoal(null), null);
  assert.equal(weightDirectionFromGoal("Bajar de peso y ganar masa"), null);
});

test("temas del objetivo", () => {
  assert.equal(goalMentions("desarrollar gluteos", "gluteos"), true);
  assert.equal(goalMentions("Glúteos más fuertes", "gluteos"), true);
  assert.equal(goalMentions("Glúteos más fuertes", "fuerza"), true);
  assert.equal(goalMentions("Perder grasa", "grasa"), true);
});
