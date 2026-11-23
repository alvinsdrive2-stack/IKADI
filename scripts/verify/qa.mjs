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
  "tests/kta-pejabat-route.test.mts",
  "tests/ocr-route.test.mts",
  "tests/http-smoke.test.mts",
  "tests/change-password-route.test.mts",
  "tests/anggota-gate.test.mts",
  "tests/participants-filter.test.mts",
  "tests/participant-profile.test.mts",
  "tests/participant-delete.test.mts",
  "tests/anggota-profile-data.test.mts",
  "tests/admin-password.test.mts",
];

const r = spawnSync(process.execPath, args, {
  stdio: "inherit",
  env: { ...process.env, QA_MOCK: "1", RATE_LIMIT_FORCE: "1" },
});
process.exit(r.status ?? 1);
