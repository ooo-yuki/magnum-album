import homepage from "./index.html";

const server = Bun.serve({
  port: Number(process.env.PORT) || 3000,
  routes: {
    "/magnum": homepage,
    "/magnum/*": homepage,
  },
  development: process.env.NODE_ENV !== "production",
});

console.log(`MAGNUM server running at ${server.url}magnum/`);
