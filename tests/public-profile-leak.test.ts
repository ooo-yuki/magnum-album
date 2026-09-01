import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
const server = readFileSync(resolve(ROOT, "server.ts"), "utf8");

describe("P1 auth public profile leak id/created_at (4.4)", () => {
  it("handlePublicProfile response не содержит id/created_at/email", () => {
    // найти функцию handlePublicProfile и проверить что Response.json не содержит id/created_at
    const fnIdx = server.indexOf("async function handlePublicProfile");
    const fnSlice = server.slice(fnIdx, fnIdx + 2500);
    expect(fnSlice).toContain("user:{username:name}");
    // user объект в ответе не должен содержать id или created_at
    expect(fnSlice).not.toMatch(/Response\.json\(\{user:\{id/);
    expect(fnSlice).not.toMatch(/Response\.json\(\{user:\{[^}]*created_at/);
    // email не должен появляться в публичном профиле
    const userJsonMatch = fnSlice.match(/Response\.json\(\{user:\{[^}]+\}/);
    if (userJsonMatch) expect(userJsonMatch[0].toLowerCase()).not.toContain("email");
  });
  it("SELECT не тянет created_at/email наружу", () => {
    const fnIdx = server.indexOf("async function handlePublicProfile");
    const fnSlice = server.slice(fnIdx, fnIdx + 2500);
    expect(fnSlice).toContain("SELECT id,username FROM magnum_users");
    expect(fnSlice).not.toContain("created_at FROM magnum_users");
  });
  it("follow/squad используют username-only (не требуют id из профиля)", () => {
    expect(server).toContain("async function handleFollowToggle");
    // follow должен брать username из body, не id
    const fIdx = server.indexOf("async function handleFollowToggle");
    const fSlice = server.slice(fIdx, fIdx + 1500);
    expect(fSlice).toContain("username");
    expect(fSlice).not.toContain("following_id=${uid}"); // not relevant but ensure uses username lookup internally
  });
});
