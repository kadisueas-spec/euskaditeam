import type { Page, Locator } from "@playwright/test";

// Varios formularios de la app (wizard de rutina, wizard de evaluación,
// registro de peso) usan <Label>Texto</Label> seguido de un <Input>/<select>
// hermano, SIN conectarlos vía htmlFor/id — así que getByLabel() no
// funciona ahí. Este helper ubica el campo por el texto visible de su
// label usando el hermano siguiente en el DOM, que es el patrón real que
// usan esos formularios (<div><Label>X</Label><Input /></div>).
//
// NativeSelect envuelve el <select> real en un <div class="relative"> (para
// el ícono de flecha decorativo) — el hermano inmediato del label en ese
// caso es ese div wrapper, no el <select>. El xpath cubre los dos casos: el
// hermano ES el campo (self::), o el campo está anidado adentro (.//).
export function fieldAfterLabel(page: Page, labelText: string): Locator {
  return page
    .locator("label", { hasText: labelText })
    .locator(
      "xpath=following-sibling::*[1][self::input or self::select or self::textarea] | " +
        "following-sibling::*[1]//*[self::input or self::select or self::textarea]"
    );
}
