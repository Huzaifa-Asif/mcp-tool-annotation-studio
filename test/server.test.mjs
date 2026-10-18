import test from "node:test";
import assert from "node:assert/strict";
import { isAllowedHost, routes } from "../src/server.mjs";
test("server allows only loopback hosts", () => { assert.equal(isAllowedHost("localhost:4173"), true); assert.equal(isAllowedHost("127.0.0.1:4173"), true); assert.equal(isAllowedHost("evil.test"), false); });
test("server exposes only fixed static routes", () => { assert.equal(routes.has("/src/core.mjs"), true); assert.equal(routes.has("/../package.json"), false); });
