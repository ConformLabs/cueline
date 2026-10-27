/* Cueline engine: runs whisper.cpp (whisper-cli) on this machine and streams words back.
 * Node only (CEP panel with --enable-nodejs). No server, no Python: one process per job. */
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const https = require("https");
const { spawn, spawnSync } = require("child_process");

const IS_WIN = process.platform === "win32";

const MODELS = [
  { id: "ivrit-turbo", label: "ivrit.ai large-v3-turbo", file: "ggml-ivritai-large-v3-turbo.bin",
    url: "https://huggingface.co/ivrit-ai/whisper-large-v3-turbo-ggml/resolve/main/ggml-model.bin",
    size: "1.6 GB", lang: "Hebrew", note: "Hebrew, tuned by ivrit.ai.", dtw: "large.v3.turbo", langs: ["he"] },
  { id: "ivrit-large", label: "ivrit.ai large-v3", file: "ggml-ivritai-large-v3.bin",
    url: "https://huggingface.co/ivrit-ai/whisper-large-v3-ggml/resolve/main/ggml-model.bin",
    size: "3.1 GB", lang: "Hebrew", note: "Hebrew, slower, fewer errors on names.", dtw: "large.v3", langs: ["he"] },
  { id: "turbo", label: "Whisper large-v3-turbo", file: "ggml-large-v3-turbo.bin",
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin",
    size: "1.6 GB", lang: "Multilingual", note: "99 languages.", dtw: "large.v3.turbo" },
  { id: "large", label: "Whisper large-v3", file: "ggml-large-v3.bin",
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin",
    size: "3.1 GB", lang: "Multilingual", note: "99 languages, most accurate.", dtw: "large.v3" },
  { id: "small", label: "Whisper small", file: "ggml-small.bin",
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin",
    size: "466 MB", lang: "Multilingual", note: "Fast drafts on older machines.", dtw: "small" },
];
const VAD_MODEL = { file: "ggml-silero-v5.1.2.bin", url: "https://huggingface.co/ggml-org/whisper-vad/resolve/main/ggml-silero-v5.1.2.bin" };

// Who speaks when, by voice: sherpa-onnx (k2-fsa, Apache-2.0) with pyannote segmentation 3.0 (MIT) and
// 3D-Speaker CAM++ voice embeddings (Apache-2.0). About 34 MB, fetched on first use.
const SPEAKER_MODELS = [
  { file: "speaker-segmentation-pyannote-3.0.onnx", url: "https://huggingface.co/csukuangfj/sherpa-onnx-pyannote-segmentation-3-0/resolve/main/model.onnx" },
  { file: "speaker-embedding-campplus-advanced.onnx", url: "https://github.com/k2-fsa/sherpa-onnx/releases/download/speaker-recongition-models/3dspeaker_speech_campplus_sv_zh_en_16k-common_advanced.onnx" },
];

function dataDir() {
  const base = IS_WIN ? (process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"))
                      : path.join(os.homedir(), "Library", "Application Support");
  return path.join(base, "Cueline");
}
function modelsDir() { const d = path.join(dataDir(), "models"); fs.mkdirSync(d, { recursive: true }); return d; }

// The bundled binary sits in <extension>/engine/<platform>/; a dev build can be named in CUELINE_WHISPER.
function binaryPath(extRoot) {
  if (process.env.CUELINE_WHISPER && fs.existsSync(process.env.CUELINE_WHISPER)) return process.env.CUELINE_WHISPER;
  if (!IS_WIN) return path.join(extRoot, "engine", "mac", "whisper-cli"); // universal: Apple Silicon and Intel
  // Windows: the Vulkan build on a PC whose graphics driver brings Vulkan (vulkan-1.dll), else the CPU build
  const dir = path.join(extRoot, "engine", "win-x64"), gpu = path.join(dir, "whisper-cli.exe"), cpu = path.join(dir, "whisper-cli-cpu.exe");
  return hasVulkan() && fs.existsSync(gpu) ? gpu : fs.existsSync(cpu) ? cpu : gpu;
}
/* Which GPU the Vulkan engine should use. whisper-cli takes device 0, and Vulkan often lists the graphics built into
 * the processor first (on ron-pc: Intel graphics as 0, the RTX as 1). Asked once per engine build: whisper-cli with
 * the model and no audio lists its devices while loading the model ("ggml_vulkan: N = name | uma: 0/1"), then stops.
 * The first dedicated one (uma: 0) wins, else device 0. Kept in <data>/gpu.json. */
function vulkanDevice(bin, modelPath) {
  const key = (() => { try { const st = fs.statSync(bin); return `${st.size}-${Math.round(st.mtimeMs)}`; } catch (e) { return ""; } })();
  const file = path.join(dataDir(), "gpu.json");
  try { const c = JSON.parse(fs.readFileSync(file, "utf8")); if (c.key === key) return c; } catch (e) {}
  // a tenth of a second of silence (16 kHz mono): whisper-cli wants a real file before it loads the model
  const wav = path.join(os.tmpdir(), "cueline_gpu_probe.wav"), n = 1600, b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVEfmt ", 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(16000, 24); b.writeUInt32LE(32000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(n * 2, 40);
  try { fs.writeFileSync(wav, b); } catch (e) {}
  const r = spawnSync(bin, ["-m", modelPath, "-f", wav], { encoding: "utf8", timeout: 120000, windowsHide: true });
  try { fs.unlinkSync(wav); } catch (e) {}
  const devices = [...String((r.stdout || "") + (r.stderr || "")).matchAll(/ggml_vulkan:\s+(\d+)\s+=\s+([^|]+?)\s*\|\s*uma:\s*(\d)/g)]
    .map((m) => ({ index: +m[1], name: m[2].replace(/\s*\([^)]*\)\s*$/, "").trim(), integrated: m[3] === "1" }));
  const pick = devices.find((d) => !d.integrated) || devices[0] || { index: 0, name: "" };
  const out = { key, device: pick.index, name: pick.name, devices };
  try { fs.writeFileSync(file, JSON.stringify(out)); } catch (e) {}
  return out;
}
function knownGpuName() { try { return JSON.parse(fs.readFileSync(path.join(dataDir(), "gpu.json"), "utf8")).name || ""; } catch (e) { return ""; } }

function hasVulkan() {
  return IS_WIN && fs.existsSync(path.join(process.env.SystemRoot || "C:\\Windows", "System32", "vulkan-1.dll"));
}

function engineStatus(extRoot) {
  const bin = binaryPath(extRoot);
  const ok = fs.existsSync(bin);
  return { ok, bin, gpu: IS_WIN ? (/whisper-cli\.exe$/.test(bin) && hasVulkan() ? (knownGpuName() ? `Vulkan · ${knownGpuName()}` : "Vulkan") : "CPU") : "Metal", vad: fs.existsSync(path.join(modelsDir(), VAD_MODEL.file)) };
}

function listModels() {
  const dir = modelsDir();
  const known = MODELS.map((m) => {
    const p = path.join(dir, m.file);
    let bytes = 0; try { bytes = fs.statSync(p).size; } catch (e) {}
    return { ...m, path: p, installed: bytes > 1e6, bytes };
  });
  // Any other ggml model the person added by hand.
  let extra = [];
  try {
    extra = fs.readdirSync(dir)
      .filter((f) => /^ggml-.*\.bin$/.test(f) && f !== VAD_MODEL.file && !MODELS.some((m) => m.file === f))
      .map((f) => ({ id: "file:" + f, label: f.replace(/^ggml-|\.bin$/g, ""), file: f, path: path.join(dir, f), installed: true,
        size: (fs.statSync(path.join(dir, f)).size / 1e9).toFixed(1) + " GB", lang: "Custom", note: "Added by you." }));
  } catch (e) {}
  return known.concat(extra);
}

function diskUse() {
  let used = 0;
  try { for (const f of fs.readdirSync(modelsDir())) used += fs.statSync(path.join(modelsDir(), f)).size; } catch (e) {}
  return used;
}

/* ---------- downloads ---------- */

function download(url, dest, onProgress) {
  const part = dest + ".part";
  let req = null, cancelled = false;
  const promise = new Promise((resolve, reject) => {
    const get = (u, hops) => {
      req = https.get(u, { headers: { "User-Agent": "Cueline" } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && hops < 8) {
          res.resume(); return get(new URL(res.headers.location, u).toString(), hops + 1);
        }
        if (res.statusCode !== 200) { res.resume(); return reject(new Error(`Download refused: HTTP ${res.statusCode} from ${new URL(u).host}`)); }
        const total = +res.headers["content-length"] || 0;
        let got = 0, lastT = Date.now(), lastGot = 0, speed = 0;
        const out = fs.createWriteStream(part);
        res.on("data", (chunk) => {
          got += chunk.length;
          const now = Date.now();
          if (now - lastT > 500) { speed = (got - lastGot) / ((now - lastT) / 1000); lastT = now; lastGot = got; onProgress && onProgress({ got, total, speed }); }
        });
        res.pipe(out);
        out.on("finish", () => {
          if (cancelled) return;
          if (total && got < total) return reject(new Error("Download ended early. Try again."));
          fs.renameSync(part, dest); resolve(dest);
        });
        res.on("error", reject); out.on("error", reject);
      });
      req.on("error", (e) => reject(cancelled ? new Error("Cancelled.") : e));
    };
    get(url, 0);
  });
  return { promise, cancel() { cancelled = true; if (req) req.destroy(); try { fs.unlinkSync(part); } catch (e) {} } };
}

function downloadModel(id, onProgress) {
  const m = MODELS.find((x) => x.id === id);
  if (!m) throw new Error("Unknown model: " + id);
  return download(m.url, path.join(modelsDir(), m.file), onProgress);
}

function ensureVad() {
  const dest = path.join(modelsDir(), VAD_MODEL.file);
  if (fs.existsSync(dest)) return Promise.resolve(dest);
  return download(VAD_MODEL.url, dest).promise;
}

function diarizePath(extRoot) {
  return path.join(extRoot, "engine", IS_WIN ? "win-x64" : "mac", "diarize", "sherpa-onnx-offline-speaker-diarization" + (IS_WIN ? ".exe" : ""));
}
function speakerStatus(extRoot) {
  const bin = diarizePath(extRoot);
  return { ok: !!bin && fs.existsSync(bin), models: SPEAKER_MODELS.every((m) => fs.existsSync(path.join(modelsDir(), m.file))) };
}
async function ensureSpeakerModels(onProgress) {
  for (const m of SPEAKER_MODELS) {
    const dest = path.join(modelsDir(), m.file);
    if (!fs.existsSync(dest)) await download(m.url, dest, onProgress).promise;
  }
}

/* Diarize a 16 kHz mono WAV. count > 0 asks for exactly that many voices; 0 lets the clustering
 * decide. Resolves with turns [{start, end, spk}] in seconds. */
function diarize(opts, cb) {
  cb = cb || {};
  const bin = diarizePath(opts.extRoot);
  if (!bin || !fs.existsSync(bin)) throw new Error("Speaker detection is not installed.");
  const args = [
    opts.count > 0 ? `--clustering.num-clusters=${opts.count}` : `--clustering.cluster-threshold=${opts.threshold || 0.9}`,
    `--segmentation.pyannote-model=${path.join(modelsDir(), SPEAKER_MODELS[0].file)}`,
    `--embedding.model=${path.join(modelsDir(), SPEAKER_MODELS[1].file)}`,
    `--segmentation.num-threads=2`, `--embedding.num-threads=2`,
    opts.audio,
  ];
  cb.onLog && cb.onLog("$ sherpa-onnx-offline-speaker-diarization " + args.map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(" "));
  const proc = spawn(bin, args, { windowsHide: true });
  const turns = [];
  let stopped = false, buf = "";
  const onData = (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      const t = /^([\d.]+) -- ([\d.]+) speaker_(\d+)$/.exec(line);
      if (t) { turns.push({ start: +t[1], end: +t[2], spk: +t[3] }); continue; }
      const p = /^progress ([\d.]+)%/.exec(line);
      if (p) cb.onProgress && cb.onProgress(+p[1] / 100);
    }
  };
  proc.stdout.setEncoding("utf8"); proc.stdout.on("data", onData);
  proc.stderr.setEncoding("utf8"); proc.stderr.on("data", onData);
  const promise = new Promise((resolve, reject) => {
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (stopped) return resolve({ turns: [], stopped: true });
      if (code !== 0) return reject(new Error(`Speaker detection stopped (exit ${code}).`));
      resolve({ turns });
    });
  });
  return { promise, stop() { stopped = true; try { proc.kill(); } catch (e) {} } };
}

/* One voice print per time span ({start, end} in seconds) of a 16 kHz WAV, from the helper built on
 * sherpa-onnx's C API (native/voiceprint.c). Resolves with an array of Float32 arrays (null for a span
 * too short to measure). */
function voiceprints(opts) {
  const bin = diarizePath(opts.extRoot).replace(/sherpa-onnx-offline-speaker-diarization(\.exe)?$/, "cueline-voiceprint$1");
  if (!fs.existsSync(bin)) return Promise.reject(new Error("The voice print helper is missing."));
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, [path.join(modelsDir(), SPEAKER_MODELS[1].file), opts.audio], { windowsHide: true });
    let out = "", err = "";
    proc.stdout.setEncoding("utf8"); proc.stdout.on("data", (d) => (out += d));
    proc.stderr.setEncoding("utf8"); proc.stderr.on("data", (d) => (err += d));
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code !== 0) return reject(new Error("Voice prints failed: " + err.trim().split("\n").pop()));
      const lines = out.split("\n").slice(0, opts.spans.length);
      resolve(lines.map((l) => (l.trim() ? Float32Array.from(l.split(","), Number) : null)));
    });
    proc.stdin.end(opts.spans.map((sp) => `${sp.start.toFixed(3)} ${sp.end.toFixed(3)}`).join("\n") + "\n");
  });
}

function removeModel(id) {
  const m = listModels().find((x) => x.id === id);
  if (m && m.installed) fs.unlinkSync(m.path);
}

/* ---------- speech envelope: where the audio is loud, in 10 ms frames ----------
 * Captions are timed from this, not only from Whisper's word timestamps, which can drift. */

function readWav(file) {
  const buf = fs.readFileSync(file);
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") throw new Error("Not a WAV file: " + file);
  let pos = 12, fmt = null, data = null;
  while (pos + 8 <= buf.length) {
    const id = buf.toString("ascii", pos, pos + 4), size = buf.readUInt32LE(pos + 4), body = pos + 8;
    if (id === "fmt ") {
      let tag = buf.readUInt16LE(body);
      if (tag === 0xfffe && size >= 26) tag = buf.readUInt16LE(body + 24); // extensible: the real format is in the sub-format GUID
      fmt = { tag, channels: buf.readUInt16LE(body + 2), rate: buf.readUInt32LE(body + 4), bits: buf.readUInt16LE(body + 14) };
    } else if (id === "data") {
      data = { start: body, length: Math.min(size, buf.length - body) };
    }
    pos = body + size + (size & 1);
  }
  if (!fmt || !data) throw new Error("WAV file has no audio data: " + file);
  if (!(fmt.tag === 1 || fmt.tag === 3)) throw new Error(`Unsupported WAV encoding ${fmt.tag}`);
  return { buf, fmt, data };
}

function speechEnvelope(file, hopSec) {
  const hop = hopSec || 0.01;
  const { buf, fmt, data } = readWav(file);
  const bytes = fmt.bits / 8, frame = bytes * fmt.channels;
  const total = Math.floor(data.length / frame);
  const per = Math.max(1, Math.round(fmt.rate * hop));
  const read =
    fmt.tag === 3 && fmt.bits === 32 ? (o) => buf.readFloatLE(o) :
    fmt.bits === 16 ? (o) => buf.readInt16LE(o) / 32768 :
    fmt.bits === 24 ? (o) => buf.readIntLE(o, 3) / 8388608 :
    fmt.bits === 32 ? (o) => buf.readInt32LE(o) / 2147483648 :
    fmt.bits === 8 ? (o) => (buf.readUInt8(o) - 128) / 128 : null;
  if (!read) throw new Error(`Unsupported WAV sample size ${fmt.bits}`);
  const n = Math.floor(total / per), db = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let s = i * per; s < (i + 1) * per; s++) {
      let v = 0;
      for (let c = 0; c < fmt.channels; c++) v += read(data.start + s * frame + c * bytes);
      v /= fmt.channels; sum += v * v;
    }
    db[i] = 10 * Math.log10(sum / per + 1e-12);
  }
  return { hop, db: Array.from(db) };
}

/* ---------- transcription ---------- */

const LINE = /^\[(\d+):(\d\d):(\d\d\.\d+)\s+-->\s+(\d+):(\d\d):(\d\d\.\d+)\]\s+(.*)$/;
const secs = (h, m, s) => +h * 3600 + +m * 60 + +s;

/* Runs one job. Callbacks: onWord(word), onProgress(0..1), onLog(line).
 * Resolves with { words, language } once whisper-cli exits; words carry p (confidence) from the JSON. */
function transcribe(opts, cb) {
  cb = cb || {};
  const bin = binaryPath(opts.extRoot);
  if (!fs.existsSync(bin)) return { promise: Promise.reject(new Error("The engine is missing. Reinstall Cueline.")), stop() {} };
  const model = listModels().find((m) => m.id === opts.model);
  if (!model || !model.installed) return { promise: Promise.reject(new Error("Model not downloaded: " + (model ? model.label : opts.model))), stop() {} };

  const outBase = path.join(os.tmpdir(), "cueline_" + Date.now());
  const args = [
    "-m", model.path, "-f", opts.audio,
    "-l", opts.language || "auto",
    "-ml", "1", "-sow",                // one word per segment, so words stream as they are decoded
    "-ojf", "-of", outBase,            // full JSON at the end, for confidence
    "-pp",
    "-t", String(Math.max(2, Math.min(8, os.cpus().length - 2))),
  ];
  if (model.dtw) args.push("-dtw", model.dtw);
  if (IS_WIN && /whisper-cli\.exe$/.test(bin)) {
    const gpu = vulkanDevice(bin, model.path);
    args.push("-dev", String(gpu.device));
    cb.onLog && cb.onLog(`GPU: ${gpu.name || "device " + gpu.device}${gpu.devices && gpu.devices.length > 1 ? ` (of ${gpu.devices.map((d) => d.name).join(", ")})` : ""}`);
  }
  if (opts.translate) args.push("-tr");
  if (opts.prompt) args.push("--prompt", opts.prompt);
  const vadPath = path.join(modelsDir(), VAD_MODEL.file);
  if (opts.vad && fs.existsSync(vadPath)) args.push("--vad", "-vm", vadPath, "-vsd", "300", "-vp", "200");

  cb.onLog && cb.onLog("$ whisper-cli " + args.map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(" "));
  const proc = spawn(bin, args, { windowsHide: true });
  const words = [];
  let stopped = false, outBuf = "", errBuf = "";

  proc.stdout.setEncoding("utf8");
  proc.stdout.on("data", (d) => {
    outBuf += d;
    let i;
    while ((i = outBuf.indexOf("\n")) >= 0) {
      const line = outBuf.slice(0, i).trim(); outBuf = outBuf.slice(i + 1);
      const m = LINE.exec(line);
      if (!m) continue;
      const text = m[7].trim();
      if (!text || /^\[.*\]$/.test(text)) continue; // [BLANK_AUDIO], [Music]
      const w = { text, start: secs(m[1], m[2], m[3]), end: secs(m[4], m[5], m[6]), p: 1 };
      words.push(w);
      cb.onWord && cb.onWord(w, words.length - 1);
    }
  });
  proc.stderr.setEncoding("utf8");
  proc.stderr.on("data", (d) => {
    errBuf += d;
    let i;
    while ((i = errBuf.indexOf("\n")) >= 0) {
      const line = errBuf.slice(0, i); errBuf = errBuf.slice(i + 1);
      const p = /progress\s*=\s*(\d+)%/.exec(line);
      if (p) cb.onProgress && cb.onProgress(+p[1] / 100);
      else if (line.trim()) cb.onLog && cb.onLog(line);
    }
  });

  const promise = new Promise((resolve, reject) => {
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (stopped) return resolve({ words, stopped: true });
      if (code !== 0) return reject(new Error(`The engine stopped (exit ${code}). Open the log for details.`));
      let language = opts.language;
      try {
        const j = JSON.parse(fs.readFileSync(outBase + ".json", "utf8"));
        language = (j.result && j.result.language) || language;
        const segs = (j.transcription || []).filter((s) => s.text.trim() && !/^\s*\[.*\]\s*$/.test(s.text));
        // Same order as stdout; confidence of a word = its least certain token.
        for (let k = 0; k < Math.min(segs.length, words.length); k++) {
          const ps = (segs[k].tokens || []).filter((t) => !/^\[_/.test(t.text)).map((t) => t.p);
          if (ps.length) words[k].p = Math.min(...ps);
        }
        fs.unlinkSync(outBase + ".json");
      } catch (e) { cb.onLog && cb.onLog("No JSON from the engine: " + e.message); }
      resolve({ words, language });
    });
  });

  return { promise, stop() { stopped = true; try { proc.kill(); } catch (e) {} } };
}

module.exports = { MODELS, modelsDir, dataDir, binaryPath, engineStatus, listModels, diskUse, downloadModel, ensureVad, removeModel, transcribe, speechEnvelope, speakerStatus, ensureSpeakerModels, diarize, voiceprints, VAD_MODEL, SPEAKER_MODELS };
