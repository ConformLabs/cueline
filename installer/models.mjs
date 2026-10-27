// The speech models the installers offer to download, from the panel's own list (extension/js/engine.js), so the
// installers and the Models screen never disagree. Each choice is one or more files, each with its exact size
// (read from the server when the installer is built; a download is kept only when it is that size).
//   installerModels()  -> [{ id, title, note, default, files: [{ file, url, bytes }] }]   (async)
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const E = require("../extension/js/engine.js");

// what each choice is for, in the installers' words; the order is the order shown
const CHOICES = [
  { id: "ivrit-turbo", note: "Hebrew, fast", default: true },
  { id: "turbo", note: "99 languages, fast", default: false },
  { id: "ivrit-large", note: "Hebrew, fewer errors on names", default: false },
  { id: "large", note: "99 languages, most accurate", default: false },
  { id: "small", note: "99 languages, quick drafts", default: false },
  { id: "helpers", title: "Speaker and silence models", note: "Speakers by voice and skip silence", default: true },
];

const gb = (b) => (b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : `${Math.round(b / 1e6)} MB`);

export async function installerModels() {
  const out = [];
  for (const c of CHOICES) {
    const files = c.id === "helpers"
      ? [E.VAD_MODEL, ...E.SPEAKER_MODELS].map((m) => ({ file: m.file, url: m.url }))
      : [E.MODELS.find((m) => m.id === c.id)].map((m) => ({ file: m.file, url: m.url }));
    for (const f of files) {
      const r = await fetch(f.url, { method: "HEAD", redirect: "follow" });
      f.bytes = Number(r.headers.get("content-length"));
      if (!r.ok || !(f.bytes > 0)) throw new Error(`${f.url}: no size (HTTP ${r.status})`);
    }
    const total = files.reduce((a, f) => a + f.bytes, 0);
    const title = c.title || E.MODELS.find((m) => m.id === c.id).label;
    out.push({ id: c.id, title, note: `${c.note} · ${gb(total)}`, size: gb(total), default: c.default, files });
  }
  return out;
}

/** The model list for the Windows Setup (cueline.nsi): MODELS_FOR_EACH runs a macro once per choice with
 *  N id "title" "note" default(1/0) "file|url|bytes;..." "file to look for" */
export function nsisModels(models) {
  const q = (s) => `"${String(s).replace(/"/g, "'")}"`;
  return [
    "; Generated from installer/models.mjs by scripts/package-win-installer.mjs: do not edit.",
    `!define MODEL_COUNT ${models.length}`,
    "!macro MODELS_FOR_EACH MACRO",
    ...models.map((m, i) => `  !insertmacro \${MACRO} ${i + 1} ${m.id} ${q(m.title)} ${q(m.note)} ${m.default ? 1 : 0} ${q(m.files.map((f) => `${f.file}|${f.url}|${f.bytes}`).join(";"))} ${q([...m.files].sort((a, b) => b.bytes - a.bytes)[0].file)}`),
    "!macroend",
    "",
  ].join("\r\n");
}
