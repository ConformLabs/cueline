// Builds the Windows engine on a Windows PC over SSH (scripts/build-windows.ps1) and copies it into
// extension/engine/win-x64/.
//   npm run build:windows                 (host "ron-pc" from ~/.ssh/config; CUELINE_WIN_HOST=other-pc to change)
// Needs key-based SSH to a PC with Visual Studio Build Tools (C++), CMake and Git.
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./stage.mjs";

const host = process.env.CUELINE_WIN_HOST || "ron-pc";
const SSH = ["-o", "BatchMode=yes", "-o", "ConnectTimeout=10"];
const run = (cmd, args) => { console.log(`$ ${cmd} ${args.join(" ")}`); const r = spawnSync(cmd, args, { stdio: "inherit" }); if (r.status !== 0) { console.error(`${cmd} failed (${r.status})`); process.exit(1); } };
const work = "C:/cueline-build";
run("ssh", [...SSH, host, `if not exist C:\\cueline-build mkdir C:\\cueline-build`]);
run("scp", [...SSH, join(ROOT, "scripts", "build-windows.ps1"), join(ROOT, "native", "voiceprint.c"), `${host}:${work}/`]);
run("ssh", [...SSH, host, `powershell -NoProfile -ExecutionPolicy Bypass -File C:\\cueline-build\\build-windows.ps1 -Work C:\\cueline-build -VoiceprintC C:\\cueline-build\\voiceprint.c`]);
const dest = join(ROOT, "extension", "engine", "win-x64");
rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
run("scp", [...SSH, "-r", `${host}:${work}/out/*`, dest + "/"]);
console.log(`Windows engine in ${dest}`);
