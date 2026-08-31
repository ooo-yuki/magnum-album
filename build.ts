const result = await Bun.build({
  entrypoints: ["./src/main.tsx", "./src/vendor.ts"],
  outdir: "./dist",
  target: "browser",
  format: "esm",
  minify: true,
  splitting: true,
  sourcemap: false,
  naming: {
    entry: "[name]-[hash].[ext]",
    chunk: "chunk-[hash].[ext]",
    asset: "[name]-[hash].[ext]",
  },
});

if (!result.success) {
  console.error("Build failed:");
  for (const msg of result.logs) {
    console.error(msg);
  }
  process.exit(1);
}

// Find output files
const cssFiles = result.outputs.filter((o) => o.path.endsWith(".css"));
const jsEntries = result.outputs.filter((o) => o.path.endsWith(".js"));

// Identify vendor chunk vs main chunk
const jsMain = jsEntries.find((o) => o.path.includes("main-")) ?? jsEntries[0];
const jsVendor = jsEntries.find((o) => o.path.includes("vendor-"));
const jsChunks = jsEntries.filter((o) => o !== jsMain && o !== jsVendor);

// Read and patch index.html
const html = await Bun.file("./index.html").text();
let output = html;

// Inject chunks before module script (chunks as modulepreload + script tags)
const chunksTags = jsChunks.map((c) => `    <link rel="modulepreload" href="/magnum/${c.path.split("/").pop()}" />`).join("\n");
if (chunksTags) {
  output = output.replace("</head>", `${chunksTags}\n  </head>`);
}

if (jsVendor) {
  const vendorName = jsVendor.path.split("/").pop();
  output = output.replace("</head>", `    <link rel="modulepreload" href="/magnum/${vendorName}" />\n  </head>`);
}

if (jsMain) {
  const jsName = jsMain.path.split("/").pop();
  output = output.replace(
    'src="/src/main.tsx"',
    `src="/magnum/${jsName}"`
  );
}

for (const css of cssFiles) {
  const cssName = css.path.split("/").pop();
  output = output.replace(
    "</head>",
    `    <link rel="stylesheet" href="/magnum/${cssName}" />\n  </head>`
  );
}

await Bun.write("./dist/index.html", output);

console.log(`Built ${result.outputs.length} files:`);
for (const out of result.outputs) {
  const kb = (out.size / 1024).toFixed(1);
  console.log(`  ${out.path.split("/").pop()} (${kb} KB)`);
}

// Assert vendor splitting occurred
const hasVendorSplit = jsEntries.length >= 2 && result.outputs.some(o => o.path.includes("chunk-") || o.path.includes("vendor-"));
if (!hasVendorSplit) {
  console.warn("Warning: vendor chunk not split — check splitting config");
}

// Copy public assets verbatim (sitemap, robots, images already in dist via prior build)
for (const pub of ["sitemap.xml", "robots.txt"]) {
  try {
    const src = Bun.file(`./public/${pub}`);
    if (await src.exists()) await Bun.write(`./dist/${pub}`, await src.text());
  } catch {}
}
// Ensure dist has public/images
{
  const { $ } = await import("bun");
  await $`cp -r ./public/images ./dist/images 2>/dev/null || true`.quiet();
}
