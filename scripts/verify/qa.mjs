// `npm run verify:qa` - sets QA_MOCK before the alias loader can resolve any import.
// Optional live server checks: `BASE=http://localhost:3111 npm run verify:qa`.
import { spawnSync } from "node:child_process";

const args = [
  "--experimental-transform-types",
  "--import",
  "./tests/support/register-alias.mjs",
  "--test",
  "tests/schema.test.mts",
  "tests/design-sync.test.mts",
  "tests/participants-route.test.mts",
  "tests/http-smoke.test.mts",
];

const r = spawnSync(process.execPath, args, {
  stdio: "inherit",
  env: { ...process.env, QA_MOCK: "1" },
});
process.exit(r.status ?? 1);
