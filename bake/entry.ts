// entry.ts — точка сборки ядра 42-завров в самодостаточный ESM-бандл (без three).
// Команда: bun build entry.ts --target=node --outfile=zavri-core.mjs
// Дальше bake.mjs (node) импортирует zavri-core.mjs + локальный three 0.152.

export * from "../src/lib/zavri/catalog";
export * from "../src/lib/zavri/mesh";
export * from "../src/lib/zavri/rng";
export { partsToGroup, partToMesh } from "../src/lib/zavri/adapterFactory";
