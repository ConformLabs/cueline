/* Cueline bridge: Premiere Pro (host.jsx through CSInterface) and the engine (Node), or, in a plain
 * browser, a simulated Premiere and engine that replay a real run, so the panel can be previewed. */
(function () {
  "use strict";

  const IS_CEP = typeof window.__adobe_cep__ !== "undefined";
  const REPO = "ConformLabs/cueline";

  // "1.2.0" vs "1.10.0-beta.2": numbers part by part; a pre-release comes before its release.
  function cmpVersions(a, b) {
    const parse = (v) => { const [main, pre] = String(v || "0").replace(/^v/, "").split("-"); return { n: main.split(".").map((x) => parseInt(x, 10) || 0), pre }; };
    const x = parse(a), y = parse(b);
    for (let i = 0; i < 3; i++) if ((x.n[i] || 0) !== (y.n[i] || 0)) return (x.n[i] || 0) - (y.n[i] || 0);
    if (x.pre && !y.pre) return -1;
    if (!x.pre && y.pre) return 1;
    return String(x.pre || "").localeCompare(String(y.pre || ""), "en", { numeric: true });
  }
  // A release body as up to a few plain lines: list items and headings, markdown marks stripped.
  function noteLines(body) {
    return String(body || "").split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !/^#{1,6}\s*updating/i.test(l))
      .map((l) => l.replace(/^[-*]\s+/, "").replace(/\*\*(.+?)\*\*/g, "$1").replace(/`([^`]+)`/g, "$1").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/^#{1,6}\s*/, ""))
      .filter((l) => l.length > 2).slice(0, 8);
  }

  /* ---------- in Premiere Pro ---------- */
  function cepBridge() {
    const cs = new CSInterface();
    const nodeRequire = window.require || (window.cep_node && window.cep_node.require);
    const path = nodeRequire("path"), fs = nodeRequire("fs"), os = nodeRequire("os");
    const extRoot = cs.getSystemPath(SystemPath.EXTENSION);
    const engine = nodeRequire(path.join(extRoot, "js", "engine.js"));

    // Premiere Pro loads host.jsx once, when the panel first opens. Loading it again here means an
    // updated Cueline works after a panel reload too, without closing it.
    cs.evalScript(`$.evalFile(${JSON.stringify(path.join(extRoot, "jsx", "host.jsx"))})`);

    function call(fn, ...args) {
      const src = `${fn}(${args.map((a) => JSON.stringify(typeof a === "object" ? JSON.stringify(a) : a)).join(",")})`;
      return new Promise((resolve) => cs.evalScript(src, (r) => {
        if (r === "EvalScript error." || r == null) return resolve({ ok: false, error: `Premiere Pro could not run ${fn}. Close and reopen the panel.` });
        try { resolve(JSON.parse(r)); } catch (e) { resolve({ ok: false, error: String(r) }); }
      }));
    }

    /* Premiere Pro keeps a key press for itself unless the panel registers interest in it, and J, K,
     * F, G and the arrows are Premiere shortcuts. These go to Cueline only while it has focus.
     * Keys bound to Premiere's menus (⌘Z, ⌘⇧S) never reach a panel on macOS, so Cueline avoids them. */
    function registerKeys() {
      const mac = process.platform === "darwin";
      const K = mac
        ? { up: 126, down: 125, ret: 36, esc: 53, g: 5, j: 38, k: 40, f: 3, p: 35, z: 6, s: 1, u: 32, slash: 44, lb: 33, rb: 30 }
        : { up: 38, down: 40, ret: 13, esc: 27, g: 71, j: 74, k: 75, f: 70, p: 80, z: 90, s: 83, u: 85, slash: 191, lb: 219, rb: 221 };
      const cmd = mac ? { metaKey: true } : { ctrlKey: true };
      const list = [
        { keyCode: K.up }, { keyCode: K.down }, { keyCode: K.up, altKey: true }, { keyCode: K.down, altKey: true },
        { keyCode: K.ret }, { keyCode: K.ret, shiftKey: true }, { keyCode: K.ret, altKey: true }, { keyCode: K.esc },
        { keyCode: K.g }, { keyCode: K.j }, { keyCode: K.k }, { keyCode: K.f }, { keyCode: K.p }, { keyCode: K.s },
        { keyCode: K.u }, { keyCode: K.u, shiftKey: true },
        { keyCode: K.slash, shiftKey: true },
        { keyCode: K.lb, altKey: true }, { keyCode: K.rb, altKey: true },
        { keyCode: K.z, ...cmd }, { keyCode: K.z, shiftKey: true, ...cmd }, { keyCode: K.s, shiftKey: true, ...cmd },
      ];
      cs.registerKeyEventsInterest(JSON.stringify(list));
    }

    return {
      kind: "premiere",
      registerKeys,
      engine,
      extRoot,
      ping: () => call("cl_ping"),
      info: () => call("cl_info"),
      state: () => call("cl_state"),
      exportAudio: (tracks) => call("cl_exportAudio", path.join(extRoot, "custom", "AudioExportPreset.epr"), tracks),
      placeCaptions: (srtPath, start) => call("cl_placeCaptions", srtPath, start || 0),
      listSequences: () => call("cl_listSequences"),
      openSequence: (id) => call("cl_openSequence", id),
      setPlayhead: (sec) => call("cl_setPlayhead", sec),
      play: (sec) => call("cl_play", sec),
      stop: () => call("cl_stop"),
      addMarkers: (list) => call("cl_addMarkers", list),
      cuts: () => call("cl_cuts"),
      placeAnimated: (rtl, list, look) => call("cl_placeAnimated", path.join(extRoot, "mogrt", rtl ? "CuelineAnimatedRTL.mogrt" : "CuelineAnimated.mogrt"), list, look || []),
      selectedFont: () => call("cl_selectedFont"),
      copyLook: (schema, ratio) => call("cl_copyLook", schema, ratio || 1),
      tempFile(name, text) { const p = path.join(os.tmpdir(), name); fs.writeFileSync(p, text, "utf8"); return p; },
      // Delete a temporary file Cueline itself wrote: only its own names, only in a temp folder.
      removeTemp(p) {
        if (!p) return false;
        const name = path.basename(p), dir = path.dirname(fs.existsSync(p) ? fs.realpathSync(p) : p);
        const ours = /^Cueline .*\.srt$/.test(name) || /^cueline_\d+\.(wav|json)$/.test(name);
        const temp = [os.tmpdir(), "/private/var/folders", "/var/folders", process.env.TEMP || "\u0000"].some((t) => dir.startsWith(t) || fs.existsSync(t) && dir.startsWith(fs.realpathSync(t)));
        if (!ours || !temp) return false;
        try { fs.unlinkSync(p); return true; } catch (e) { return false; }
      },
      fileUrl(p) { return p && fs.existsSync(p) ? "file://" + p.split(path.sep).map(encodeURIComponent).join("/") : null; },
      saveFile(defaultName, text) {
        const r = window.cep.fs.showSaveDialogEx("Export captions", os.homedir(), [defaultName.split(".").pop()], defaultName);
        if (r.err || !r.data) return null;
        fs.writeFileSync(r.data, text, typeof text === "string" ? "utf8" : undefined);
        return r.data;
      },
      copy(text) { const t = document.createElement("textarea"); t.value = text; document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove(); },
      openFolder(p) { nodeRequire("child_process").exec((process.platform === "win32" ? "explorer " : "open ") + JSON.stringify(p)); },
      /* Updates: the latest GitHub release of Cueline, looked up at most once a day (or when asked), cached
       * in the data folder so the panel knows without going online. Quiet when offline. */
      updateCachePath: () => path.join(engine.dataDir(), "update-check.json"),
      knownUpdate() { try { return JSON.parse(fs.readFileSync(this.updateCachePath(), "utf8")); } catch (e) { return null; } },
      checkUpdate(current, force) {
        const cached = this.knownUpdate();
        if (!force && cached && cached.current === current && !cached.error && Date.now() - cached.checkedAt < 24 * 3600 * 1000) return Promise.resolve(cached);
        const https = nodeRequire("https");
        // one GET: { status, headers, body }; never rejects (status 0 with an error when it can't connect)
        const get = (host, p, accept) => new Promise((resolve) => {
          const req = https.get({ host, path: p, headers: { "User-Agent": "Cueline/" + current, Accept: accept || "*/*" }, timeout: 8000 }, (res) => {
            let body = ""; res.setEncoding("utf8"); res.on("data", (d) => (body += d));
            res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body }));
          });
          req.on("timeout", () => req.destroy(new Error("No answer from GitHub.")));
          req.on("error", (e) => resolve({ status: 0, error: e.message }));
        });
        const done = (latest, url, notes) => {
          const out = { checkedAt: Date.now(), current, latest, url, notes, updateAvailable: cmpVersions(latest, current) > 0 };
          try { fs.writeFileSync(this.updateCachePath(), JSON.stringify(out)); } catch (e) {}
          return out;
        };
        // GitHub's API first (the release body as notes). It allows 60 requests an hour per network address without
        // an account, so a busy office network can be refused (403/429): then the releases page, which isn't limited
        // that way, redirects .../releases/latest to .../tag/v<version>, and the notes file comes from the repository.
        // When both fail, the last known result stays, with the error beside it.
        return (async () => {
          const api = await get("api.github.com", `/repos/${REPO}/releases/latest`, "application/vnd.github+json");
          if (api.status === 200) {
            try { const j = JSON.parse(api.body); return done(String(j.tag_name || "").replace(/^v/, ""), j.html_url, noteLines(j.body)); } catch (e) {}
          }
          if (api.status === 404) return { checkedAt: Date.now(), current, error: "No release published yet." };
          const page = await get("github.com", `/${REPO}/releases/latest`);
          const tag = /\/releases\/tag\/v?([^/?#]+)/.exec((page.headers && page.headers.location) || "");
          if (tag) {
            const latest = decodeURIComponent(tag[1]);
            const raw = await get("raw.githubusercontent.com", `/${REPO}/v${latest}/notes/release-${latest}.md`);
            return done(latest, `https://github.com/${REPO}/releases/tag/v${latest}`, raw.status === 200 ? noteLines(raw.body) : []);
          }
          const why = api.status === 0 ? "Couldn't reach GitHub: " + (api.error || "no connection") : api.status === 403 || api.status === 429 ? "GitHub is limiting requests from this network right now. Cueline tries again later." : `GitHub answered ${api.status}.`;
          return cached && cached.latest ? { ...cached, error: why, checkedAt: Date.now() } : { checkedAt: Date.now(), current, error: why };
        })();
      },
      openUrl(url) {
        try { if (window.cep && cep.util && cep.util.openURLInDefaultBrowser) { cep.util.openURLInDefaultBrowser(url); return true; } } catch (e) {}
        return false;
      },
      sysInfo: () => ({ os: `${os.type()} ${os.release()} ${process.arch}`, node: process.version, extRoot, dataDir: engine.dataDir(), modelsDir: engine.modelsDir(), home: os.homedir(), tmp: os.tmpdir(),
        tmpWritable: (() => { try { const f = path.join(os.tmpdir(), "cueline_check_" + Date.now()); fs.writeFileSync(f, "ok"); fs.unlinkSync(f); return true; } catch (e) { return false; } })(),
        presetOk: fs.existsSync(path.join(extRoot, "custom", "AudioExportPreset.epr")) }),
      setFlyout(xml) { try { window.__adobe_cep__.invokeSync("setPanelFlyoutMenu", xml); } catch (e) {} },
      onFlyout(fn) {
        try {
          window.__adobe_cep__.addEventListener("com.adobe.csxs.events.flyoutMenuClicked", (ev) => {
            let d = ev && ev.data;
            if (typeof d === "string") { try { d = JSON.parse(d); } catch (e) { const m = /<menuId>([^<]+)<\/menuId>/.exec(d); d = { menuId: m ? m[1] : d }; } }
            fn(d && (d.menuId || d.menuName));
          });
        } catch (e) {}
      },
      history: {
        dir() { const d = path.join(engine.dataDir(), "history"); fs.mkdirSync(d, { recursive: true }); return d; },
        list() { try { return fs.readdirSync(this.dir()).filter((f) => f.endsWith(".json")).sort().reverse().slice(0, 30).map((f) => { const j = JSON.parse(fs.readFileSync(path.join(this.dir(), f), "utf8")); return { file: f, ...j.meta }; }); } catch (e) { return []; } },
        save(job) { const f = path.join(this.dir(), `${Date.now()}.json`); fs.writeFileSync(f, JSON.stringify(job)); return f; },
        load(file) { return JSON.parse(fs.readFileSync(path.join(this.dir(), file), "utf8")); },
      },
    };
  }

  /* ---------- in a browser: simulated Premiere Pro and engine ---------- */
  function mockBridge() {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    let mockPlay = null;
    const seq = { name: "Interview_Final_v3", id: "mock", fps: 25, inSec: 72.16, outSec: 219.84, endSec: 400, hasInOut: true, videoTracks: 3, playhead: 72.16,
      audio: [{ index: 0, name: "Host", muted: false, clips: 4 }, { index: 1, name: "Guest", muted: false, clips: 3 }, { index: 2, name: "Music", muted: false, clips: 1 }, { index: 3, name: "SFX", muted: true, clips: 6 }] };
    const mockSeqs = [
      { id: "mock", name: "Interview_Final_v3", inSec: 72.16, outSec: 219.84, endSec: 400, hasInOut: true, audioTracks: 3 },
      { id: "mock2", name: "Interview_Guest_Cut", inSec: 0, outSec: 186, endSec: 186, hasInOut: false, audioTracks: 2 },
      { id: "mock3", name: "Teaser_30s", inSec: 0, outSec: 31, endSec: 31, hasInOut: false, audioTracks: 1 },
      { id: "mock4", name: "B-roll selects", inSec: 0, outSec: 240, endSec: 240, hasInOut: false, audioTracks: 0 },
    ];
    const models = [
      { id: "ivrit-turbo", label: "ivrit.ai large-v3-turbo", size: "1.6 GB", lang: "Hebrew", note: "Hebrew, tuned by ivrit.ai.", installed: true, langs: ["he"] },
      { id: "ivrit-large", label: "ivrit.ai large-v3", size: "3.1 GB", lang: "Hebrew", note: "Hebrew, slower, fewer errors on names.", installed: false, langs: ["he"] },
      { id: "turbo", label: "Whisper large-v3-turbo", size: "1.6 GB", lang: "Multilingual", note: "99 languages.", installed: true },
      { id: "large", label: "Whisper large-v3", size: "3.1 GB", lang: "Multilingual", note: "99 languages, most accurate.", installed: false },
      { id: "small", label: "Whisper small", size: "466 MB", lang: "Multilingual", note: "Fast drafts on older machines.", installed: false },
    ];
    const params = new URLSearchParams(location.search);
    const engine = {
      MODELS: models,
      engineStatus: () => ({ ok: params.get("state") !== "noengine", gpu: "Metal", vad: true, bin: "(simulated)" }),
      listModels: () => (params.get("state") === "firstrun" ? models.map((m) => ({ ...m, installed: false })) : models),
      modelsDir: () => "~/Library/Application Support/Cueline/models",
      diskUse: () => 3.2e9,
      downloadModel(id, onProgress) {
        let cancelled = false; const total = 1.6e9;
        const promise = (async () => { for (let got = 0; got <= total; got += 1.6e8) { if (cancelled) throw new Error("Cancelled."); onProgress({ got, total, speed: 1.8e7 }); await sleep(300); }
          models.find((m) => m.id === id).installed = true; })();
        return { promise, cancel() { cancelled = true; } };
      },
      removeModel(id) { models.find((m) => m.id === id).installed = false; },
      speechEnvelope(file) {
        const words = window.CUELINE_MOCK_WORDS || [], hop = 0.01;
        // A single track's export: speaker k (by track parity) talks in every other sentence.
        const one = /cueline_mock_t(\d+)\.wav$/.exec(file || "");
        if (one) {
          let n = 0; const turn = words.map((w) => { const k = n; if (/[.!?]$/.test(w.text)) n++; return k % 2; });
          const end = (words.length ? words[words.length - 1].end : 10) + 2, db = [];
          for (let i = 0; i < end / hop; i++) { const t = i * hop, j = words.findIndex((x) => t >= x.start - 0.03 && t <= x.end + 0.02); db.push(j >= 0 && turn[j] === +one[1] % 2 ? -22 : -50); }
          return { hop, db };
        }
        const end = (words.length ? words[words.length - 1].end : 10) + 2, db = [];
        for (let i = 0; i < end / hop; i++) {
          const t = i * hop, w = words.find((x) => t >= x.start - 0.03 && t <= x.end + 0.02);
          db.push(w ? -24 + 10 * Math.sin(t * 31) * Math.sin(t * 7) - Math.random() * 4 : -62 + Math.random() * 6);
        }
        return { hop, db };
      },
      // Simulated voices: three people taking turns by sentence, ready after 2 s.
      speakerStatus: () => ({ ok: true, models: true }),
      ensureSpeakerModels: async () => {},
      diarize() {
        const words = window.CUELINE_MOCK_WORDS || [], turns = [];
        let n = 0, cur = null;
        for (const w of words) {
          const spk = [0, 1, 0, 2][n % 4];
          if (cur && cur.spk === spk) cur.end = w.end; else turns.push((cur = { start: w.start, end: w.end, spk }));
          if (/[.!?]$/.test(w.text)) n++;
        }
        return { promise: sleep(2000).then(() => ({ turns })), stop() {} };
      },
      transcribe(opts, cb) {
        let stopped = false;
        const words = (window.CUELINE_MOCK_WORDS || []).map((w) => ({ ...w }));
        const promise = (async () => {
          cb.onLog && cb.onLog("$ whisper-cli (simulated) -l " + opts.language);
          for (let i = 0; i < words.length; i++) {
            if (stopped) return { words: words.slice(0, i), stopped: true };
            await sleep(110);
            cb.onWord && cb.onWord({ ...words[i], p: 1 }, i);
            cb.onProgress && cb.onProgress((i + 1) / words.length);
          }
          return { words, language: opts.language };
        })();
        return { promise, stop() { stopped = true; } };
      },
    };
    const ok = (o) => Promise.resolve({ ok: true, ...(o || {}) });
    return {
      kind: "browser",
      registerKeys() {},
      engine,
      extRoot: ".",
      ping: () => ok({ app: "simulated" }),
      state: () => ok({ seq: "mock", key: [seq.inSec, seq.outSec].join("/"), playhead: seq.playhead }),
      info: () => (params.get("state") === "noseq" ? Promise.resolve({ ok: false, error: "No sequence is open. Open one in Premiere Pro, then refresh." }) : ok(JSON.parse(JSON.stringify(seq)))),
      exportAudio: async (tracks) => { await sleep(tracks && tracks.length === 1 ? 150 : 500); return { ok: true, path: tracks && tracks.length === 1 ? `/tmp/cueline_mock_t${tracks[0]}.wav` : "/tmp/cueline_mock.wav", inSec: seq.inSec, duration: seq.outSec - seq.inSec }; },
      placeCaptions: async () => { await sleep(300); return { ok: true, file: "/tmp/cueline.srt" }; },
      listSequences: () => ok({ sequences: mockSeqs.map((x) => ({ ...x, active: x.id === seq.id })) }),
      openSequence: async (id) => { const x = mockSeqs.find((m) => m.id === id); if (!x) return { ok: false, error: "No such sequence." }; await sleep(300); Object.assign(seq, { id: x.id, name: x.name, inSec: x.inSec, outSec: x.outSec, hasInOut: x.hasInOut }); return { ok: true, name: x.name }; },
      setPlayhead: (sec) => { seq.playhead = sec; return ok(); },
      play: (sec) => { seq.playhead = sec; clearInterval(mockPlay); mockPlay = setInterval(() => (seq.playhead += 0.1), 100); return ok(); },
      stop: () => { clearInterval(mockPlay); return ok(); },
      addMarkers: (list) => ok({ added: list.length }),
      cuts: () => ok({ cuts: [4, 9.5, 16, 22.4], fps: 25 }),
      placeAnimated: async (rtl, list) => { await sleep(400); return { ok: true, placed: list.length, track: 3, missing: [] }; },
      selectedFont: () => ok({ font: "Arial-BoldMT", size: 84 }),
      copyLook: async () => { await sleep(200); return { ok: true, copied: 34, controls: 32 }; },
      tempFile: (name) => "/tmp/" + name,
      removeTemp: () => true,
      fileUrl: () => null,
      saveFile(defaultName, text) {
        const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: typeof text === "string" ? "text/plain" : "application/octet-stream" })); a.download = defaultName; a.click(); return defaultName;
      },
      copy(text) { try { navigator.clipboard.writeText(text); } catch (e) {} },
      openFolder() {},
      knownUpdate: () => (params.get("update") ? { checkedAt: Date.now() - 3600e3, current: "1.0.0", latest: "1.0.1", url: "https://github.com/" + REPO + "/releases", notes: ["Speaker colours follow the tag colours", "Fixes the batch screen on small panels"], updateAvailable: true } : null),
      checkUpdate(current) { return sleep(600).then(() => (params.get("update") ? { ...this.knownUpdate(), checkedAt: Date.now() } : { checkedAt: Date.now(), current, latest: current, updateAvailable: false, notes: [] })); },
      openUrl: (url) => { window.open(url, "_blank"); return true; },
      sysInfo: () => ({ os: navigator.platform + " (browser preview)", node: "none", extRoot: ".", dataDir: "~/Library/Application Support/Cueline", modelsDir: "~/Library/Application Support/Cueline/models", home: "", tmp: "/tmp", tmpWritable: true, presetOk: true }),
      setFlyout() {}, onFlyout() {},
      history: {
        list() { try { return JSON.parse(localStorage.getItem("cueline.history") || "[]").map((j, i) => ({ file: String(i), ...j.meta })); } catch (e) { return []; } },
        save(job) { try { const h = JSON.parse(localStorage.getItem("cueline.history") || "[]"); h.unshift(job); localStorage.setItem("cueline.history", JSON.stringify(h.slice(0, 10))); } catch (e) {} },
        load(file) { try { return JSON.parse(localStorage.getItem("cueline.history") || "[]")[+file]; } catch (e) { return null; } },
      },
    };
  }

  window.Host = IS_CEP ? cepBridge() : mockBridge();
  window.Host.cmpVersions = cmpVersions;
})();
