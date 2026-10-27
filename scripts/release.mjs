// Publishes a Cueline release: version stamped, checked, both installers built, committed, tagged, released.
//
//   npm run release -- 1.0.1 --notes notes/release-1.0.1.md
//   npm run release -- 1.1.0-beta.1 --notes notes/release-1.1.0-beta.1.md     (a pre-release: only beta users)
//   options: --sign-windows   Authenticode-sign the Windows Setup (SimplySign Desktop logged in)
//            --skip-windows   Mac installer only
//            --draft          create the GitHub release as a draft
//
// Steps: clean git tree -> stamp the version (scripts/version.mjs) -> npm run check -> build the engines if missing
// -> notarized Mac pkg (scripts/package-mac-pkg.mjs) -> Windows Setup (scripts/package-win-installer.mjs) -> .sha256
// next to each -> commit "Cueline <version>", tag v<version>, push -> gh release create with the notes file as the
// body (the Updates screen in the panel shows its first lines) and both installers attached.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./stage.mjs";

const argv = process.argv.slice(2);
const version = argv[0];
const opt = (n) => { const i = argv.indexOf(n); return i > 0 ? argv[i + 1] : null; };
const flag = (n) => argv.includes(n);
const die = (m) => { console.error(`\nrelease: ${m}`); process.exit(1); };
const run = (cmd, args, opts = {}) => { console.log(`\n$ ${cmd} ${args.join(" ")}`); const r = spawnSync(cmd, args, { stdio: "inherit", cwd: ROOT, ...opts }); if (r.status !== 0) die(`${cmd} ${args[0] || ""} failed`); };
const out = (cmd, args) => spawnSync(cmd, args, { cwd: ROOT, encoding: "utf8" }).stdout.trim();

if (!version || !/^\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$/.test(version)) die("usage: npm run release -- <version> --notes <file>");
const notes = opt("--notes");
if (!notes || !existsSync(join(ROOT, notes))) die(`release notes file not found: ${notes} (write notes/release-${version}.md first)`);
if (/Tested on: \(filled in/.test(readFileSync(join(ROOT, notes), "utf8"))) die(`${notes}: fill in the "Tested on" line`);
if (out("git", ["status", "--porcelain"])) die("the git tree has changes: commit or stash them first");
if (out("git", ["tag", "-l", `v${version}`])) die(`tag v${version} exists already`);

run("node", ["scripts/version.mjs", version]);
run("npm", ["run", "--silent", "check"]);
if (!existsSync(join(ROOT, "extension/engine/mac/whisper-cli"))) run("npm", ["run", "build:mac"]);
run("node", ["scripts/package-mac-pkg.mjs"]);
const assets = [join(ROOT, "dist", `Cueline-${version}.pkg`)];
if (!flag("--skip-windows")) {
  if (!existsSync(join(ROOT, "extension/engine/win-x64/whisper-cli.exe"))) run("npm", ["run", "build:windows"]);
  run("node", ["scripts/package-win-installer.mjs", ...(flag("--sign-windows") ? ["--sign"] : [])]);
  assets.push(join(ROOT, "dist", `Cueline-Setup-${version}.exe`));
}
for (const a of [...assets]) {
  const sum = createHash("sha256").update(readFileSync(a)).digest("hex");
  writeFileSync(a + ".sha256", `${sum}  ${a.split("/").pop()}\n`);
  assets.push(a + ".sha256");
}

run("git", ["add", "-A"]);
// a commit only when stamping changed something (releasing the version already in package.json changes nothing)
if (out("git", ["status", "--porcelain"])) run("git", ["commit", "-m", `Cueline ${version}`]);
run("git", ["tag", "-a", `v${version}`, "-m", `Cueline ${version}`]);
run("git", ["push", "--follow-tags"]);
run("gh", ["release", "create", `v${version}`, ...assets, "--title", `Cueline ${version}`, "--notes-file", notes,
  ...(version.includes("-") ? ["--prerelease"] : []), ...(flag("--draft") ? ["--draft"] : [])]);
console.log(`\nReleased Cueline ${version}.`);
