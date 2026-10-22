// Tests unitarios con el runner nativo de Node (`npm test`): Node 24 ejecuta
// TypeScript directo, pero no entiende el alias "@/" de tsconfig ni los
// imports sin extensión. Este hook los resuelve a los archivos .ts del repo.
import { register } from "node:module";

register("./test-alias-hooks.mjs", import.meta.url);
