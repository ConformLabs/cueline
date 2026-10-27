// Builds the signed, notarized per-user macOS installer: dist/Cueline-<version>.pkg
//
//   npm run package:mac                           build, sign, notarize (waits up to 30 min), staple, verify
//   npm run package:mac -- --no-notarize          build and sign only (fast; not notarized yet)
//   npm run package:mac -- --notarize-only <pkg>  notarize + staple + verify a pkg built before
//
// It installs, for the user running it only (no administrator password):
//   ~/Library/Application Support/Adobe/CEP/extensions/com.conformlabs.cueline   the panel and the universal engine
// A developer symlink at that path is removed first (installer/mac/pkg/scripts/preinstall), never what it points to.
//
// Pipeline: version check + tests -> stage the extension (scripts/stage.mjs, Mac engine only) -> codesign every
// program and library in it (Developer ID, hardened runtime, timestamp) -> smoke-test both architectures -> Adobe ZXP
// signature over the staged files -> pkgbuild (home domain) without AppleDouble files -> productbuild with the
// Conform Labs frame pages (installer/common) and the Developer ID Installer signature -> check the payload byte for
// byte -> notarytool submit --wait -> stapler -> spctl + pkgutil.
//
// Needs: Xcode command line tools; "Developer ID Application" and "Developer ID Installer" in the login keychain; the
// notary keychain profile "aemcp-notary" (shared with Surehand); the ZXP certificate (see scripts/stage.mjs).
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { ROOT, listFiles, stageExtension, zxpSign, zxpVerify } from "./stage.mjs";
import { macPage } from "../installer/common/frame.mjs";
import { installerModels } from "../installer/models.mjs";

const TEAM = "Ron Yitzhaki (PM339FMCLG)";
const APP_IDENTITY = `Developer ID Application: ${TEAM}`;
const INSTALLER_IDENTITY = `Developer ID Installer: ${TEAM}`;
const NOTARY_PROFILE = "aemcp-notary";
const PKG_ID = "com.conformlabs.cueline";
const INSTALL_AT = "/Library/Application Support/Adobe/CEP/extensions/com.conformlabs.cueline"; // in the home domain: under ~
const PKG_SRC = join(ROOT, "installer", "mac", "pkg");
const BUILD = join(PKG_SRC, "build");
const OUT_DIR = join(ROOT, "dist");
const version = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version;

const die = (msg) => { console.error(`\npackage-mac-pkg: ERROR: ${msg}`); process.exit(1); };
const log = (msg) => console.log(`\n== ${msg}`);
function run(cmd, args, opts = {}) {
  console.log(`$ ${cmd} ${args.map((a) => (/[\s"]/.test(a) ? JSON.stringify(a) : a)).join(" ")}`);
  const r = spawnSync(cmd, args, { stdio: "inherit", ...opts });
  if (r.error) die(`${cmd}: ${r.error.message}`);
  if (r.status !== 0) die(`${cmd} exited with status ${r.status}`);
}
function capture(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts });
  if (r.error) die(`${cmd}: ${r.error.message}`);
  if (r.status !== 0) die(`${cmd} ${args.join(" ")} exited with status ${r.status}\n${r.stdout}${r.stderr}`);
  return r.stdout + r.stderr;
}
const sha256 = (f) => createHash("sha256").update(readFileSync(f)).digest("hex");
const mb = (f) => `${(statSync(f).size / 1e6).toFixed(1)} MB`;
const argv = process.argv.slice(2);
if (process.platform !== "darwin") die("macOS only.");

function notarize(pkg) {
  log(`Notarizing ${basename(pkg)} (waits up to 30m)`);
  const r = spawnSync("xcrun", ["notarytool", "submit", pkg, "--keychain-profile", NOTARY_PROFILE, "--wait", "--timeout", "30m", "--output-format", "json"], { encoding: "utf8" });
  const out = `${r.stdout || ""}\n${r.stderr || ""}`;
  let result = {};
  try { result = JSON.parse(out.split("\n").reverse().find((l) => l.trim().startsWith("{"))); } catch {}
  console.log(out.trim());
  if (result.status !== "Accepted") {
    if (result.id) spawnSync("xcrun", ["notarytool", "log", result.id, "--keychain-profile", NOTARY_PROFILE], { stdio: "inherit" });
    die(`notarization ${result.status || "failed"}${result.id ? ` (submission ${result.id})` : ""}`);
  }
  log("Stapling");
  run("xcrun", ["stapler", "staple", pkg]);
  run("xcrun", ["stapler", "validate", pkg]);
  verifyPkg(pkg, true);
}
function verifyPkg(pkg, notarized) {
  log("Verifying the package signature");
  run("pkgutil", ["--check-signature", pkg]);
  const r = spawnSync("spctl", ["-a", "-vvv", "-t", "install", pkg], { encoding: "utf8" });
  const out = (r.stdout + r.stderr).trim();
  console.log(out);
  if (notarized && (r.status !== 0 || !/source=Notarized Developer ID/.test(out))) die("Gatekeeper does not accept the notarized package");
  if (!notarized) console.log("(not notarized yet: Gatekeeper rejecting it is expected)");
}

const only = argv.indexOf("--notarize-only");
if (only >= 0) { const pkg = resolve(argv[only + 1] || ""); if (!existsSync(pkg)) die(`no such file: ${pkg}`); notarize(pkg); process.exit(0); }

// ---------- 1. checks ----------
log(`Cueline ${version}: checks`);
run("npm", ["run", "--silent", "check"], { cwd: ROOT });

// ---------- 2. stage ----------
log("Staging the extension (Mac engine only)");
rmSync(BUILD, { recursive: true, force: true });
const stage = stageExtension(join(BUILD, "root"), "mac");
run("xattr", ["-cr", stage]);

// ---------- 3. code signing ----------
log("Signing the programs (hardened runtime)");
const machO = listFiles(stage).filter((rel) => rel.startsWith("engine/") && /Mach-O/.test(capture("file", ["-b", join(stage, rel)])));
// libraries before the programs that load them
machO.sort((a, b) => (b.endsWith(".dylib") ? 1 : 0) - (a.endsWith(".dylib") ? 1 : 0));
for (const rel of machO) {
  const f = join(stage, rel);
  const archs = capture("lipo", ["-archs", f]).trim().split(/\s+/).sort().join(",");
  if (archs !== "arm64,x86_64") die(`${rel} is ${archs}, not universal`);
  chmodSync(f, rel.endsWith(".dylib") ? 0o644 : 0o755);
  run("codesign", ["--force", "--options", "runtime", "--timestamp", "--sign", APP_IDENTITY, f]);
  const info = capture("codesign", ["-dvv", f]);
  if (!info.includes(`Authority=${APP_IDENTITY}`) || !/Timestamp=/.test(info)) die(`unexpected signature on ${rel}`);
}

// ---------- 4. smoke test: every program runs on both architectures, finding its libraries ----------
log("Smoke-testing the signed programs");
const rosetta = spawnSync("arch", ["-x86_64", "/usr/bin/true"]).status === 0;
for (const arch of ["arm64", "x86_64"]) {
  if (arch === "x86_64" && !rosetta) { console.log("x86_64: skipped (no Rosetta)"); continue; }
  const test = (rel, args, expect) => {
    const r = spawnSync("arch", [`-${arch}`, join(stage, rel), ...args], { encoding: "utf8" });
    const out = (r.stdout || "") + (r.stderr || "");
    if (r.signal || /dyld|Library not loaded|killed/i.test(out) || !expect.test(out)) die(`${arch} ${rel}: ${r.signal || r.status}\n${out.slice(0, 600)}`);
  };
  test("engine/mac/whisper-cli", ["--help"], /usage/i);
  test("engine/mac/diarize/sherpa-onnx-offline-speaker-diarization", ["--help"], /speaker|usage|segmentation/i);
  test("engine/mac/diarize/cueline-voiceprint", [], /usage/i);
  console.log(`${arch}: whisper-cli, speaker detection and voice prints run`);
}

// ---------- 5. Adobe signature over exactly these files ----------
log("Adobe (ZXP) signature");
zxpSign(stage);
const staged = Object.fromEntries(listFiles(stage).map((rel) => [rel, sha256(join(stage, rel))]));

// ---------- 6. pkgbuild + productbuild ----------
log("Building the component package");
const componentName = `cueline-${version}-component.pkg`;
const component = join(BUILD, componentName);
const scripts = join(BUILD, "scripts");
mkdirSync(scripts, { recursive: true });
copyFileSync(join(PKG_SRC, "scripts", "preinstall"), join(scripts, "preinstall"));
chmodSync(join(scripts, "preinstall"), 0o755);
run("pkgbuild", ["--root", stage, "--install-location", INSTALL_AT, "--scripts", scripts, "--identifier", PKG_ID, "--version", version, component]);
// pkgbuild stores extended attributes as "._name" AppleDouble files, which Installer would drop into the extension
// (and the ZXP check would then fail). Rebuild the Payload and Bom without them, as Surehand's script does.
const expanded = join(BUILD, "component-expanded");
run("pkgutil", ["--expand", component, expanded]);
const bomList = capture("lsbom", [join(expanded, "Bom")]).split("\n").filter((l) => l.trim() && !/(^|\/)\._/.test(l.split("\t")[0]));
writeFileSync(join(BUILD, "bom.txt"), bomList.join("\n") + "\n");
rmSync(join(expanded, "Payload")); rmSync(join(expanded, "Bom"));
run("tar", ["-c", "-z", "--format", "odc", "--no-mac-metadata", "--no-xattrs", "--no-acls", "--uid", "0", "--gid", "0", "--uname", "root", "--gname", "wheel", "-f", join(expanded, "Payload"), "-C", stage, "."]);
run("mkbom", ["-i", join(BUILD, "bom.txt"), join(expanded, "Bom")]);
const entries = capture("lsbom", ["-s", join(expanded, "Bom")]).trim().split("\n");
const infoFile = join(expanded, "PackageInfo");
writeFileSync(infoFile, readFileSync(infoFile, "utf8").replace(/numberOfFiles="\d+"/, `numberOfFiles="${entries.length}"`));
rmSync(component);
run("pkgutil", ["--flatten", expanded, component]);
rmSync(expanded, { recursive: true, force: true });

// one payload-free package per speech model choice (installer/models.mjs): its postinstall downloads the model
log("Building the model packages (Installation Type's choices)");
const models = await installerModels();
const modelTemplate = readFileSync(join(PKG_SRC, "scripts", "model"), "utf8");
const xml = (t) => String(t).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
for (const m of models) {
  if (m.title.length > 30) die(`${m.id}: title too long for the Installer's list (30 characters): ${m.title}`);
  const dir = join(BUILD, `scripts-model-${m.id}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "postinstall"), modelTemplate.replace("@FILES@", m.files.map((f) => JSON.stringify(`${f.file}|${f.url}|${f.bytes}`)).join(" ")));
  chmodSync(join(dir, "postinstall"), 0o755);
  m.pkgId = `${PKG_ID}.model.${m.id}`;
  m.pkgFile = `cueline-model-${m.id}.pkg`;
  run("pkgbuild", ["--nopayload", "--scripts", dir, "--install-location", INSTALL_AT, "--identifier", m.pkgId, "--version", version, join(BUILD, m.pkgFile)]);
  // Installer's Size column and Space Required read the package's own installKBytes: give it the download's size
  const ex = join(BUILD, `expanded-model-${m.id}`);
  run("pkgutil", ["--expand", join(BUILD, m.pkgFile), ex]);
  const info = join(ex, "PackageInfo"), kb = Math.ceil(m.files.reduce((a, f) => a + f.bytes, 0) / 1024);
  let pi = readFileSync(info, "utf8");
  pi = /<payload\b/.test(pi) ? pi.replace(/<payload\b[^>]*\/?>/, `<payload numberOfFiles="0" installKBytes="${kb}"/>`) : pi.replace(/<\/pkg-info>/, `    <payload numberOfFiles="0" installKBytes="${kb}"/>\n</pkg-info>`);
  writeFileSync(info, pi);
  rmSync(join(BUILD, m.pkgFile));
  run("pkgutil", ["--flatten", ex, join(BUILD, m.pkgFile)]);
  rmSync(ex, { recursive: true, force: true });
}
const choiceXml = [
  `    <choice id="cueline" title="Cueline" description="${xml("The Premiere Pro panel and its engine, for your Mac account only.")}" enabled="false" selected="true">`,
  `        <pkg-ref id="${PKG_ID}"/>`, "    </choice>",
  ...models.flatMap((m) => {
    const files = `[${m.files.map((f) => `'${f.file}'`).join(",")}]`;
    return [
      `    <choice id="model-${m.id}" title="${xml(m.title)}" description="${xml(`${m.note}. Downloads now, into ~/Library/Application Support/Cueline/models; or later, in the panel's Models. Already on this Mac: not downloaded again.`)}" start_selected="${m.default ? `!have(${files})` : "false"}">`,
      `        <pkg-ref id="${m.pkgId}"/>`, "    </choice>",
    ];
  }),
].join("\n");
const refs = [`    <pkg-ref id="${PKG_ID}" version="${version}" onConclusion="none">${componentName}</pkg-ref>`,
  // installKBytes: the download's size, so Installer's Size column and Space Required count it
  ...models.map((m) => `    <pkg-ref id="${m.pkgId}" version="${version}" installKBytes="${Math.ceil(m.files.reduce((a, f) => a + f.bytes, 0) / 1024)}" onConclusion="none">${m.pkgFile}</pkg-ref>`)].join("\n");
const outline = ["cueline", ...models.map((m) => `model-${m.id}`)].map((c) => `        <line choice="${c}"/>`).join("\n");

log("Building the signed product archive");
const res = join(BUILD, "resources");
mkdirSync(res, { recursive: true });
for (const page of ["welcome", "conclusion"]) writeFileSync(join(res, `${page}.html`), macPage(page, { version }));
for (const image of ["background-light.tiff", "background-dark.tiff"]) copyFileSync(join(PKG_SRC, "resources", image), join(res, image));
const dist = join(BUILD, "distribution.xml");
writeFileSync(dist, readFileSync(join(PKG_SRC, "distribution.xml"), "utf8").replace("@CHOICES_OUTLINE@", outline).replace("@CHOICES@", choiceXml).replace("@PKG_REFS@", refs));
mkdirSync(OUT_DIR, { recursive: true });
const pkg = join(OUT_DIR, `Cueline-${version}.pkg`);
rmSync(pkg, { force: true });
run("productbuild", ["--distribution", dist, "--resources", res, "--package-path", BUILD, "--sign", INSTALLER_IDENTITY, "--timestamp", pkg]);

// ---------- 7. the finished pkg holds exactly the staged files, byte for byte, still signed ----------
log("Checking the payload");
const unpacked = join(BUILD, "unpacked");
run("pkgutil", ["--expand-full", pkg, unpacked]);
const payload = join(unpacked, componentName, "Payload");
for (const m of models) if (!existsSync(join(unpacked, m.pkgFile, "Scripts", "postinstall"))) die(`${m.pkgFile}: no postinstall in the pkg`);
const got = listFiles(payload);
if (got.some((rel) => /(^|\/)\._/.test(rel))) die("AppleDouble files in the payload");
if (got.sort().join("\n") !== Object.keys(staged).sort().join("\n")) die(`payload files differ from the stage:\n${got.join("\n")}`);
for (const rel of got) if (sha256(join(payload, rel)) !== staged[rel]) die(`${rel} differs after packaging`);
for (const rel of machO) run("codesign", ["--verify", "--strict", join(payload, rel)]);
const zv = zxpVerify(payload);
if (!zv.ok) die(`the Adobe signature does not verify on the payload:\n${zv.out}`);
console.log(`payload: ${got.length} files, Adobe signature verified, ${machO.length} programs and libraries signed`);

if (argv.includes("--no-notarize")) { verifyPkg(pkg, false); console.log(`\nBuilt (not notarized): ${pkg} (${mb(pkg)})`); process.exit(0); }
notarize(pkg);
console.log(`\nDone: ${pkg} (${mb(pkg)})`);
