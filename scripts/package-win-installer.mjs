// Builds the Windows installer, dist/Cueline-Setup-<version>.exe, with NSIS (makensis) on this Mac.
//   npm run package:windows              unsigned
//   npm run package:windows -- --sign    Authenticode-signs Cueline's own programs, the Setup and its uninstaller
//                                        (scripts/sign-win.mjs: Surehand's Certum cloud certificate through
//                                        SimplySign Desktop, which must be logged in)
// Stages the extension with the Windows engine (npm run build:windows makes it), signs it with the Adobe (ZXP)
// certificate, and wraps it in the Conform Labs Setup frame (installer/common/conformlabs.nsh).
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { ROOT, listFiles, stageExtension, zxpSign } from "./stage.mjs";

const NSIS_DIR = join(ROOT, "installer", "windows", "nsis");
const BUILD = join(NSIS_DIR, "build");
const OUT_DIR = join(ROOT, "dist");
const version = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version;
const sign = process.argv.includes("--sign");
const has = (cmd) => spawnSync("which", [cmd], { stdio: "ignore" }).status === 0;
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: "inherit", ...opts });
const sha256 = (f) => createHash("sha256").update(readFileSync(f)).digest("hex");

if (!has("makensis")) throw new Error("makensis not found: brew install makensis");
const signScript = join(ROOT, "scripts", "sign-win.mjs");
if (sign && spawnSync(process.execPath, [signScript, "--check"], { stdio: "inherit" }).status !== 0) process.exit(1);
run("npm", ["run", "--silent", "check"], { cwd: ROOT });

for (const f of ["wizard-164.bmp", "header-150.bmp", "glyph-done-sunk-9.bmp"])
  if (!existsSync(join(NSIS_DIR, "art", f))) throw new Error(`missing installer/windows/nsis/art/${f}: run node installer/common/generate-art.mjs`);
const icon = join(ROOT, "brand", "Cueline.ico");

// the extension as installed: Windows engine only, Cueline's own programs Authenticode-signed (with --sign) before
// the Adobe signature is made over every file
rmSync(BUILD, { recursive: true, force: true });
const stage = stageExtension(join(BUILD, "stage"), "win");
if (sign) for (const rel of ["engine/win-x64/whisper-cli.exe", "engine/win-x64/diarize/cueline-voiceprint.exe"]) run(process.execPath, [signScript, join(stage, rel)]);
zxpSign(stage);
const files = listFiles(stage);
const estimatedKb = Math.ceil(files.reduce((a, rel) => a + statSync(join(stage, rel)).size, 0) / 1024) + 100;

const [maj, min, pat] = version.split(/[.+-]/).map((n) => parseInt(n, 10) || 0);
mkdirSync(OUT_DIR, { recursive: true });
const outFile = join(OUT_DIR, `Cueline-Setup-${version}.exe`);
rmSync(outFile, { force: true });
const defines = { VERSION: version, VERSION4: `${maj}.${min}.${pat}.0`, STAGE: stage, ICON: icon, OUTFILE: outFile, ESTIMATED_KB: String(estimatedKb) };
if (sign) defines.SIGN_CMD = `"${process.execPath}" "${signScript}"`;
const utf8 = /utf-?8/i.test(`${process.env.LC_ALL || process.env.LC_CTYPE || process.env.LANG || ""}`);
run("makensis", ["-V2", "-WX", "-INPUTCHARSET", "UTF8", ...Object.entries(defines).map(([k, v]) => `-D${k}=${v}`), join(NSIS_DIR, "cueline.nsi")], {
  env: utf8 ? process.env : { ...process.env, LANG: "en_US.UTF-8", LC_ALL: "en_US.UTF-8" },
});
console.log(`\nWindows installer${sign ? "" : " (unsigned)"}:\n  ${outFile}\n  ${(statSync(outFile).size / 1e6).toFixed(1)} MB, ${files.length} files, sha256 ${sha256(outFile)}`);
