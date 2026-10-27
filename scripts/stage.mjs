// The extension exactly as it gets installed on one platform, and its Adobe (ZXP) signature.
//   stageExtension(dest, "mac" | "win")  copies extension/ to dest: the panel, and only that platform's engine;
//                                        never dotfiles (.debug), old signatures, or the other platform's programs
//   zxpSign(stage)                       signs the staged folder with ZXPSignCmd and writes META-INF/signatures.xml
//                                        and mimetype into it, so Premiere Pro loads it without PlayerDebugMode
// Signing needs (outside the repo, never committed; the Conform Labs extension certificate Surehand uses too):
//   ~/.aemcp-signing/aemcp-extension.p12 and .p12.password, and ZXPSignCmd 4.1.3 in ~/.aemcp-signing/zxpsigncmd-4.1.3
//   Override with CUELINE_SIGN_DIR / CUELINE_ZXPSIGNCMD.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, copyFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = fileURLToPath(new URL("../", import.meta.url));
export const EXT = join(ROOT, "extension");
export const ENGINE_DIR = { mac: "mac", win: "win-x64" };

export function stageExtension(dest, platform) {
  if (!ENGINE_DIR[platform]) throw new Error(`unknown platform ${platform}`);
  const engine = join(EXT, "engine", ENGINE_DIR[platform]);
  if (!existsSync(engine)) throw new Error(`no ${ENGINE_DIR[platform]} engine in extension/engine: build it first (npm run build:${platform === "mac" ? "mac" : "windows"})`);
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  cpSync(EXT, dest, {
    recursive: true,
    filter: (src) => {
      const rel = relative(EXT, src).split(sep).join("/");
      if (!rel) return true;
      const name = rel.split("/").pop();
      if (name.startsWith(".") || rel === "META-INF" || rel.startsWith("META-INF/") || rel === "mimetype") return false;
      if (rel.startsWith("engine/") && rel.split("/").length > 1 && statSync(src).isDirectory() && rel.split("/").length === 2) return rel === `engine/${ENGINE_DIR[platform]}`;
      return true;
    },
  });
  return dest;
}

export function listFiles(dir) {
  const out = [];
  (function walk(d) { for (const n of readdirSync(d).sort()) { const p = join(d, n); statSync(p).isDirectory() ? walk(p) : out.push(relative(dir, p).split(sep).join("/")); } })(dir);
  return out;
}

export function zxpSign(stage) {
  const signDir = process.env.CUELINE_SIGN_DIR || join(homedir(), ".aemcp-signing");
  const tool = process.env.CUELINE_ZXPSIGNCMD || join(signDir, "zxpsigncmd-4.1.3", process.platform === "win32" ? "ZXPSignCmd.exe" : "ZXPSignCmd");
  const p12 = join(signDir, "aemcp-extension.p12"), pwFile = p12 + ".password";
  for (const f of [tool, p12, pwFile]) if (!existsSync(f)) throw new Error(`missing ${f} (see the top of scripts/stage.mjs)`);
  const work = mkdtempSync(join(tmpdir(), "cueline-sign-"));
  try {
    const zxp = join(work, "cueline.zxp");
    const run = (args) => {
      const r = spawnSync(tool, args, { encoding: "utf8" });
      if (r.status !== 0 || /error/i.test(r.stdout)) throw new Error(`ZXPSignCmd ${args[0]} failed: ${(r.stdout + r.stderr).trim()}`);
      return r.stdout.trim();
    };
    run(["-sign", stage, zxp, p12, readFileSync(pwFile, "utf8").trim(), "-tsa", "http://timestamp.digicert.com"]);
    const out = join(work, "out");
    mkdirSync(out);
    if (spawnSync("unzip", ["-q", zxp, "-d", out]).status !== 0) throw new Error("could not unpack the signed .zxp (needs unzip)");
    console.log(run(["-verify", out]));
    mkdirSync(join(stage, "META-INF"), { recursive: true });
    copyFileSync(join(out, "META-INF", "signatures.xml"), join(stage, "META-INF", "signatures.xml"));
    copyFileSync(join(out, "mimetype"), join(stage, "mimetype"));
    return zxp;
  } finally { rmSync(work, { recursive: true, force: true }); }
}

export function zxpVerify(dir) {
  const signDir = process.env.CUELINE_SIGN_DIR || join(homedir(), ".aemcp-signing");
  const tool = process.env.CUELINE_ZXPSIGNCMD || join(signDir, "zxpsigncmd-4.1.3", "ZXPSignCmd");
  const r = spawnSync(tool, ["-verify", dir], { encoding: "utf8" });
  return { ok: r.status === 0 && !/error|fail/i.test(r.stdout), out: (r.stdout + r.stderr).trim() };
}
