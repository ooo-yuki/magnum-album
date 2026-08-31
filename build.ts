const result = await Bun.build({
  entrypoints: ["./src/main.tsx"],
  outdir: "./dist",
  target: "browser",
  format: "esm",
  minify: true,
  splitting: true,
  sourcemap: false,
  naming: {
    entry: "[name]-[hash].[ext]",
    chunk: "[name]-[hash].[ext]",
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
const jsFile = result.outputs.find((o) => o.path.endsWith(".js"));
const cssFile = result.outputs.find((o) => o.path.endsWith(".css"));

// Read and patch index.html
const html = await Bun.file("./index.html").text();
let output = html;

if (jsFile) {
  const jsName = jsFile.path.split("/").pop();
  output = output.replace(
    'src="/src/main.tsx"',
    `src="/magnum/${jsName}"`
  );
}

if (cssFile) {
  const cssName = cssFile.path.split("/").pop();
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
