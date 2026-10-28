/* Cueline panel: screens and state.
 * Transcribe opens the review screen at once; captions stream in as Whisper writes them and can be
 * edited during the run. When it ends they are fixed and placed on a caption track by themselves.
 * Premiere Pro's scripting can create a caption track but not edit one, so "Update timeline" places
 * the edited version as a new track. */
(function () {
  "use strict";

  const $ = (s, el) => (el || document).querySelector(s);
  const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const VERSION = "1.0.3";
  const REPO_URL = "https://github.com/ConformLabs/cueline", WIKI_URL = REPO_URL + "/wiki", SITE_URL = "https://conformlabs.co/cueline/";
  const TILE = '<svg class="tile" width="28" height="28" viewBox="0 0 200 200" aria-hidden="true"><rect class="bg" width="200" height="200"></rect><g transform="translate(24 24) scale(0.76)"><path d="M58 44H164M36 82H92M36 118H92M58 156H164" fill="none" stroke="#14161A" stroke-width="24"></path><path d="M112 86h28v28h-28Z" fill="#14161A"></path></g></svg>';
  const MARK = '<svg width="56" height="56" viewBox="0 0 200 200" aria-hidden="true"><path d="M58 48H160M40 82H90M40 118H90M58 152H160" fill="none" stroke="var(--ink)" stroke-width="18"></path><path d="M112 88h24v24h-24Z" fill="none" stroke="var(--product-cueline)" stroke-width="6"></path></svg>';
  const ICON = {
    back: '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M6.5 1.5 3 5l3.5 3.5"></path></svg>',
    menu: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M2 3h8M2 6h8M2 9h8"></path></svg>',
    jump: '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 1h7L6 4.5z" fill="currentColor"/><path d="M6 4v7.5" stroke="currentColor" stroke-width="1.5"/></svg>',
    play: '<svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true"><path d="M2 1l7 4-7 4z"/></svg>',
    stopsq: '<svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true"><rect x="2" y="2" width="6" height="6"/></svg>',
    undo: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3.5 1.5 1 4l2.5 2.5M1 4h6.5a3.5 3.5 0 0 1 0 7H5"/></svg>',
    refresh: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M10.5 6A4.5 4.5 0 1 1 9 2.6M9.5 0.5V3H7"/></svg>',
    replace: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M1 4h9L7.5 1.5M11 8H2l2.5 2.5"/></svg>',
    target: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3.5" y="3.5" width="5" height="5"/><path d="M6 0v3M6 9v3M0 6h3M9 6h3"/></svg>',
    history: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M6 2.5V6l2.5 1.5M1.5 6a4.5 4.5 0 1 0 1.3-3.2M1.5 1.5v2h2"></path></svg>',
  };
  // Every language Whisper knows (whisper.cpp's list), Auto detect first, then Hebrew and English.
  const LANGS = [["auto", "Auto detect"], ["he", "Hebrew"], ["en", "English"], ["af", "Afrikaans"], ["sq", "Albanian"], ["am", "Amharic"], ["ar", "Arabic"], ["hy", "Armenian"], ["as", "Assamese"], ["az", "Azerbaijani"], ["ba", "Bashkir"], ["eu", "Basque"], ["be", "Belarusian"], ["bn", "Bengali"], ["bs", "Bosnian"], ["br", "Breton"], ["bg", "Bulgarian"], ["yue", "Cantonese"], ["ca", "Catalan"], ["zh", "Chinese"], ["hr", "Croatian"], ["cs", "Czech"], ["da", "Danish"], ["nl", "Dutch"], ["et", "Estonian"], ["fo", "Faroese"], ["fi", "Finnish"], ["fr", "French"], ["gl", "Galician"], ["ka", "Georgian"], ["de", "German"], ["el", "Greek"], ["gu", "Gujarati"], ["ht", "Haitian Creole"], ["ha", "Hausa"], ["haw", "Hawaiian"], ["hi", "Hindi"], ["hu", "Hungarian"], ["is", "Icelandic"], ["id", "Indonesian"], ["it", "Italian"], ["ja", "Japanese"], ["jw", "Javanese"], ["kn", "Kannada"], ["kk", "Kazakh"], ["km", "Khmer"], ["ko", "Korean"], ["lo", "Lao"], ["la", "Latin"], ["lv", "Latvian"], ["ln", "Lingala"], ["lt", "Lithuanian"], ["lb", "Luxembourgish"], ["mk", "Macedonian"], ["mg", "Malagasy"], ["ms", "Malay"], ["ml", "Malayalam"], ["mt", "Maltese"], ["mi", "Maori"], ["mr", "Marathi"], ["mn", "Mongolian"], ["my", "Myanmar"], ["ne", "Nepali"], ["no", "Norwegian"], ["nn", "Nynorsk"], ["oc", "Occitan"], ["ps", "Pashto"], ["fa", "Persian"], ["pl", "Polish"], ["pt", "Portuguese"], ["pa", "Punjabi"], ["ro", "Romanian"], ["ru", "Russian"], ["sa", "Sanskrit"], ["sr", "Serbian"], ["sn", "Shona"], ["sd", "Sindhi"], ["si", "Sinhala"], ["sk", "Slovak"], ["sl", "Slovenian"], ["so", "Somali"], ["es", "Spanish"], ["su", "Sundanese"], ["sw", "Swahili"], ["sv", "Swedish"], ["tl", "Tagalog"], ["tg", "Tajik"], ["ta", "Tamil"], ["tt", "Tatar"], ["te", "Telugu"], ["th", "Thai"], ["bo", "Tibetan"], ["tr", "Turkish"], ["tk", "Turkmen"], ["uk", "Ukrainian"], ["ur", "Urdu"], ["uz", "Uzbek"], ["vi", "Vietnamese"], ["cy", "Welsh"], ["yi", "Yiddish"], ["yo", "Yoruba"]];
  const LANG_NATIVE = { he: "עברית", ar: "العربية", ru: "Русский", fr: "Français", es: "Español", de: "Deutsch", yi: "ייִדיש", fa: "فارسی", zh: "中文", ja: "日本語", ko: "한국어", uk: "Українська", el: "Ελληνικά", hi: "हिन्दी" };

  /* ---------- state ---------- */
  const saved = (() => { try { return JSON.parse(localStorage.getItem("cueline.settings") || "{}"); } catch (e) { return {}; } })();
  const S = {
    screen: "main",
    info: null, infoError: null,
    lang: saved.lang || "he",
    model: saved.model || "ivrit-turbo",
    preset: saved.preset || "broadcast",
    custom: saved.custom || { ...Cues.PRESETS.broadcast, name: "Custom" },
    glossary: saved.glossary || [{ from: "תל-אביב", to: "תל אביב" }],
    opts: { vad: true, fillers: true, translate: false, rtlFix: true, autofix: true, cuts: true, speakers: true, dashes: true, speakerTracks: true, ...(saved.opts || {}) },
    speakerMode: saved.speakerMode || (saved.opts && saved.opts.speakers === false ? "off" : "voice"), // off | voice | track
    speakerCount: saved.speakerCount || 0, // 0 = auto detect
    updateAuto: saved.updateAuto !== false, update: null,
    look: saved.look || "clean",
    fillerMode: saved.fillerMode || (saved.opts && saved.opts.fillers === false ? "keep" : "mark"),
    tracks: null,
    job: null,
    cues: [], offset: 0, filter: "all", selected: null, find: "", repl: "", showReplace: false,
    placed: null, dirty: false, playhead: null, nowId: null, audioPath: null,
    follow: saved.follow !== false,
    wide: false, // panel docked wide: review splits into list + detail, main screen into two columns
    log: [],
  };
  function persist() {
    try { localStorage.setItem("cueline.settings", JSON.stringify({ lang: S.lang, model: S.model, preset: S.preset, custom: S.custom, glossary: S.glossary, opts: S.opts, follow: S.follow, fillerMode: S.fillerMode, speakerMode: S.speakerMode, speakerCount: S.speakerCount, updateAuto: S.updateAuto, look: S.look })); } catch (e) {}
  }
  function spec() {
    const base = S.preset === "custom" ? S.custom : Cues.PRESETS[S.preset];
    return { ...base, fps: (S.info && S.info.fps) || 25, dashes: !!S.opts.dashes };
  }
  function log(line) { S.log.push(`${new Date().toTimeString().slice(0, 8)}  ${line}`); if (S.log.length > 500) S.log.shift(); }

  const tc = (sec) => Cues.timecode(sec, (S.info && S.info.fps) || 25);
  const dur = (sec) => { sec = Math.max(0, Math.round(sec)); const m = Math.floor(sec / 60), s = sec % 60; return m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`; };
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const spokenLang = () => (S.lang === "auto" ? S.detected : S.lang);
  const isRtlLang = () => ["he", "ar", "fa", "ur", "yi", "ps", "sd"].includes(spokenLang()) && !S.opts.translate;

  /* ---------- toast ---------- */
  let toastTimer;
  function toast(text, bad) {
    const t = $("#toast");
    t.className = "toast" + (bad ? " bad" : "");
    t.innerHTML = `<span class="g ${bad ? "g-failed" : "g-verified"}" aria-hidden="true"></span><span>${esc(text)}</span>`;
    t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), bad ? 7000 : 4500);
  }

  /* ---------- header and footer ---------- */
  function statusLine() {
    const st = Host.engine.engineStatus(Host.extRoot);
    if (!st.ok) return ["g-failed", "Engine missing"];
    if (S.job && S.job.running && S.screen === "working") return ["g-run", `${S.job.phase.replace(/…$/, "").split(" · ")[0]} · ${(S.info && S.info.name) || ""}${S.batch && !S.batch.done ? ` · ${S.batch.i + 1} of ${S.batch.ids.length}` : ""}`];
    if (S.job && S.job.running) return ["g-run", S.job.phase];
    if (S.screen === "review") {
      const sum = Cues.summary(S.cues, spec());
      if (S.placed) return ["g-verified", `Placed · ${sum.count} captions · ${sum.toReview} to review`];
      return [sum.toReview ? "g-changed" : "g-verified", `${sum.count} captions · ${sum.toReview} to review`];
    }
    if (!installedModels().length) return ["g-changed", "Set up · 1 step left"];
    return ["g-verified", `Ready · ${st.gpu}`];
  }

  function renderHead() {
    const [g, text] = statusLine();
    const status = `<div class="status"><span class="g g-sm ${g}" aria-hidden="true"></span><span>${esc(text)}</span></div>`;
    let h;
    if (S.screen === "review") {
      h = `<button class="btn icon" type="button" data-act="back" aria-label="Back to settings" ${S.job && S.job.running ? "disabled" : ""}>${ICON.back}</button>
        <div class="who"><div class="name">Review</div>${status}</div>
        ${S.job && S.job.running ? '<button class="btn" type="button" data-act="stop">Stop</button>' : ""}
        <button class="btn icon" type="button" data-act="menu" aria-label="Menu" aria-haspopup="menu">${ICON.menu}</button>`;
    } else if (S.screen === "working") {
      h = `${TILE}<div class="who"><div class="name">Cueline Captions</div>${status}</div><button class="btn" type="button" data-act="stop">Stop</button>`;
    } else {
      h = `${TILE}<div class="who"><div class="name">Cueline Captions</div>${status}</div>
        <button class="btn icon" type="button" data-act="history" aria-label="History">${ICON.history}</button>
        <button class="btn icon" type="button" data-act="menu" aria-label="Menu" aria-haspopup="menu">${ICON.menu}</button>`;
    }
    $("#head").innerHTML = h;
  }

  function renderFoot() {
    const f = $("#foot");
    if (S.screen === "review") { f.hidden = true; return; }
    f.hidden = false;
    const m = currentModel();
    f.innerHTML = S.screen === "working"
      ? `<span>${esc(m ? m.label : "")} · ${esc(Host.engine.engineStatus(Host.extRoot).gpu)}</span><button class="link" type="button" data-act="log">Log</button>`
      : `<span>${esc(hostLabel())}${Host.kind === "browser" ? " · preview" : ""}</span><button class="link${S.update && S.update.updateAvailable && Host.cmpVersions(S.update.latest, VERSION) > 0 ? " update" : ""}" type="button" data-goto="update" title="Updates">${VERSION}${S.update && S.update.updateAvailable && Host.cmpVersions(S.update.latest, VERSION) > 0 ? " · update ready" : ""}</button>`;
  }

  /* ---------- models ---------- */
  function installedModels() { return Host.engine.listModels().filter((m) => m.installed); }
  function currentModel() {
    const inst = installedModels();
    return inst.find((m) => m.id === S.model) || inst.find((m) => (m.langs || []).includes(S.lang)) || inst[0] || null;
  }

  /* ---------- main (ready) ---------- */
  function renderMain() {
    const st = Host.engine.engineStatus(Host.extRoot);
    if (!st.ok) return renderSetup("engine");
    if (!installedModels().length) return renderSetup("model");
    const i = S.info, sp = spec();
    let source;
    if (!i) {
      source = `<section class="sec"><div class="sec-head"><span class="label">Source</span><button class="btn small icon ghost" type="button" data-act="refresh" aria-label="Refresh" title="Refresh">${ICON.refresh}</button></div>
        <div class="notebox bad" role="alert" style="margin:0"><div class="row"><span class="g g-failed" aria-hidden="true"></span><span class="st st-failed">No sequence</span></div><span>${esc(S.infoError || "Reading the sequence…")}</span></div></section>`;
    } else {
      const left = (i.inSec / i.endSec) * 100, right = 100 - (i.outSec / i.endSec) * 100;
      const chosen = S.tracks || [];
      source = `<section class="sec src">
        <div class="sec-head"><div class="seq-name" title="${esc(i.name)}">${esc(i.name)}</div><button class="btn small icon ghost" type="button" data-act="refresh" aria-label="Refresh" title="Refresh. Cueline also follows In/Out and track changes by itself.">${ICON.refresh}</button></div>
        <div class="range"><span class="tc">${tc(i.inSec)}</span><div class="bar"><i style="left:${left.toFixed(1)}%;right:${right.toFixed(1)}%"></i></div><span class="tc">${tc(i.outSec)}</span></div>
        <div class="range-meta"><span class="mono-s">${i.hasInOut ? "In/Out" : "Whole sequence"} · ${dur(i.outSec - i.inSec)} · ${i.fps} fps</span><span class="mono-s">of ${dur(i.endSec)}</span></div>
        <div class="row" style="align-items:flex-start"><span class="label" style="padding-top:4px;width:44px;flex:none" title="${chosen.length} of ${i.audio.length} tracks">Audio</span>
        <div class="tracks">${i.audio.map((a) => `<button class="track" type="button" data-track="${a.index}" aria-pressed="${chosen.includes(a.index)}">A${a.index + 1}${a.name && !/^Audio \d+$/.test(a.name) ? ` <span class="tn">${esc(a.name)}</span>` : ""}</button>`).join("")}</div></div>
      </section>`;
    }
    const models = installedModels();
    const cm = currentModel();
    $("#view").className = "view" + (S.wide ? " wide" : "");
    $("#view").innerHTML = `${source}
      <section class="sec">
        <div class="field"><label class="label" for="lang">Language</label>
          <div class="combo"><input id="lang" class="select" type="text" role="combobox" aria-expanded="false" aria-controls="langlist" autocomplete="off" spellcheck="false" value="${esc(langName(S.lang))}" title="Type to search ${LANGS.length - 1} languages"><div class="combo-list" id="langlist" role="listbox" hidden></div></div></div>
        <div class="field"><label class="label" for="model">Model</label>
          <select id="model" class="select">${models.map((m) => `<option value="${esc(m.id)}" ${cm && cm.id === m.id ? "selected" : ""}>${esc(m.label)} · ${esc(m.lang)} · ${esc(m.size)}</option>`).join("")}</select></div>
        ${modelWarning(cm)}
        <div class="field"><span class="label">Style</span>
          <div class="seg" role="radiogroup" aria-label="Caption style">
            ${["broadcast", "social", "oneword"].map((k) => `<button type="button" role="radio" data-preset="${k}" aria-checked="${S.preset === k}">${Cues.PRESETS[k].name}</button>`).join("")}
          </div></div>
        <div class="hintline spec">${specLine(sp)}</div>
      </section>
      <button class="more" type="button" data-act="more-opts" aria-expanded="${!!S.showMore}"><span class="label">More options</span><span class="mono-s">${S.showMore ? "" : esc(optSummary())}</span><span class="chev" aria-hidden="true">${S.showMore ? "▴" : "▾"}</span></button>
      <section class="sec" style="gap:2px" ${S.showMore ? "" : "hidden"}>
        <div class="field" style="margin-bottom:6px"><span class="label">Glossary</span><div class="row between"><span class="mono-s">${plural(S.glossary.filter((g) => g.from).length, "term")}</span><button class="link" type="button" data-act="style">Style and glossary</button></div></div>
        ${opt("autofix", "Fix automatically", "Splits, merges and extends captions that break the style, when Whisper finishes. You can undo it.")}
        ${opt("cuts", "Snap to cuts", "Captions that start or end within 12 frames of a shot change move onto the cut, so none flash across it.")}
        ${opt("vad", "Skip silence", "Faster, and no invented words in quiet parts.")}
        <div class="field" style="margin:6px 0 4px"><span class="label">Speakers</span>
          <div class="row"><div class="seg grow" role="radiogroup" aria-label="Speakers">
            ${[["off", "Off"], ["voice", "By voice"], ["track", "By track"]].map(([v, n]) => `<button type="button" role="radio" data-spkmode="${v}" aria-checked="${S.speakerMode === v}">${n}</button>`).join("")}
          </div>${S.speakerMode === "voice" ? `<select id="spkcount" class="select" style="width:auto" aria-label="How many speakers">${[[0, "Auto detect"], [2, "2 people"], [3, "3 people"], [4, "4 people"], [5, "5 people"], [6, "6 people"]].map(([v, n]) => `<option value="${v}" ${S.speakerCount === v ? "selected" : ""}>${n}</option>`).join("")}</select>` : ""}</div></div>
        <div class="hintline">${S.speakerMode === "voice" ? "Tells people apart by their voices, on this computer. A new caption starts when someone else talks." : S.speakerMode === "track" ? "Each picked audio track is one person, for interviews with a mic per person." : "No speaker tags."}</div>
        ${S.speakerMode !== "off" ? opt("speakerTracks", "A caption track per speaker", "Each person on their own caption track, Speaker 1 at the bottom, so each can get its own Track Style in Premiere Pro.") : ""}
        ${S.speakerMode !== "off" ? opt("dashes", "Dialogue dashes", "A quick back-and-forth shares one caption, one line per speaker: “- Where were you?” “- At the office.”") : ""}
        <div class="field" style="margin:6px 0 4px"><span class="label">Fillers</span>
          <div class="seg" role="radiogroup" aria-label="Fillers">
            ${[["mark", "Mark"], ["remove", "Remove"], ["keep", "Keep"]].map(([v, n]) => `<button type="button" role="radio" data-fillmode="${v}" aria-checked="${S.fillerMode === v}">${n}</button>`).join("")}
          </div></div>
        <div class="hintline">${S.fillerMode === "mark" ? "אה, אמ, um, uh are marked for you to keep or remove after." : S.fillerMode === "remove" ? "אה, אמ, um, uh are left out of the captions." : "Fillers stay in the captions."}</div>
        ${opt("translate", "Translate to English", "English captions from any spoken language.")}
      </section>
      <div class="go">
        <button class="btn main big" type="button" data-act="go" ${!i || !(S.tracks || []).length ? "disabled" : ""}>Transcribe <span class="sub">${i ? dur(i.outSec - i.inSec) : ""}</span></button>
        <div class="hint">${i && !(S.tracks || []).length ? "Pick at least one audio track." : `${esc(cm ? cm.label.replace("large-v3-", "") : "")} · ${esc(langName(S.lang))} · ${esc(sp.name)} · on this computer, nothing uploaded`}</div>
        <button class="link batchlink" type="button" data-act="batch">Transcribe several sequences</button>
      </div>`;
  }

  function optSummary() {
    const on = [S.opts.autofix && "auto-fix", S.opts.vad && "skip silence", S.speakerMode === "voice" && "speakers by voice", S.speakerMode === "track" && (S.tracks || []).length > 1 && "speakers by track", { mark: "mark fillers", remove: "no fillers", keep: "" }[S.fillerMode], S.opts.translate && "to English"].filter(Boolean);
    return on.join(" · ") || "none on";
  }

  function langName(code) { const l = LANGS.find(([v]) => v === code); return l ? l[1] : code; }

  function modelWarning(m) {
    if (!m || !m.langs || S.lang === "auto" || m.langs.includes(S.lang)) return "";
    const fit = installedModels().find((x) => !x.langs);
    const name = (LANGS.find(([v]) => v === S.lang) || [, S.lang])[1];
    return `<div class="hintline warnline"><span class="g g-sm g-changed" aria-hidden="true"></span> ${esc(m.label)} is tuned for ${esc(m.lang)}. ${fit ? `For ${esc(name)}, pick ${esc(fit.label)}.` : `Download a multilingual model for ${esc(name)}.`}</div>`;
  }

  function specLine(sp) {
    if (sp.oneWord) return `<b>1</b> word per caption · <b>${sp.maxDur.toFixed(1)}</b> s max`;
    return `<b>${sp.maxChars}</b> chars · <b>${sp.maxLines}</b> line${sp.maxLines > 1 ? "s" : ""} · <b>${sp.maxCps}</b> cps · <b>${sp.minDur.toFixed(1)}–${sp.maxDur.toFixed(1)}</b> s · <b>${sp.gapFrames}</b>-frame gap`;
  }
  function opt(key, t, d) {
    return `<label class="opt"><input type="checkbox" data-opt="${key}" ${S.opts[key] ? "checked" : ""}><span class="box"></span><span><span class="t">${t}</span><span class="d">${esc(d)}</span></span></label>`;
  }

  /* ---------- first run and missing engine ---------- */
  function renderSetup(kind) {
    $("#view").className = "view";
    if (kind === "engine") {
      $("#view").innerHTML = `<div class="empty">${MARK}<div class="et">The engine is missing</div>
        <p>Cueline could not find whisper-cli in its folder. Reinstall Cueline to put it back.</p>
        <pre class="report" style="margin:0;align-self:stretch">${esc(Host.engine.engineStatus(Host.extRoot).bin)}</pre></div>`;
      return;
    }
    const pick = Host.engine.listModels().find((m) => (m.langs || []).includes(S.lang)) || Host.engine.listModels().find((m) => m.id === "turbo");
    $("#view").innerHTML = `<div class="empty">${MARK}
      <div class="et">Download a model to start</div>
      <p>Cueline transcribes on this computer. It needs one speech model, downloaded once.</p>
      <ol class="steps">
        <li><span class="g g-sm g-verified" aria-hidden="true" style="vertical-align:-1px"></span> Engine installed · ${esc(Host.engine.engineStatus(Host.extRoot).gpu)}</li>
        <li><span class="g g-sm g-pending" aria-hidden="true" style="vertical-align:-1px"></span> A model for your language</li>
      </ol>
      <button class="btn main big" type="button" data-download="${esc(pick.id)}" style="margin-top:8px">Download ${esc(pick.label.replace("large-v3-", ""))} <span class="sub">${esc(pick.size)}</span></button>
      <div id="dl-${esc(pick.id)}" style="align-self:stretch"></div>
      <button class="link" type="button" data-act="models">Other languages and models</button>
    </div>`;
  }

  /* ---------- working (review-first mode) ---------- */
  function renderWorking() {
    const j = S.job;
    const stages = [
      ["Export audio from Premiere Pro", j.stage > 0 ? "done" : "now", j.exportSecs ? `${j.exportSecs} s` : ""],
      ["Find speech", j.speechSecs != null ? "done" : j.stage >= 1 ? "now" : "todo", j.speechSecs != null && j.audioDur ? `${dur(j.speechSecs)} of ${dur(j.audioDur)}` : ""],
      ["Transcribe", j.stage > 1 || j.transcribed ? "done" : j.stage === 1 ? "now" : "todo", j.stage >= 1 ? `${Math.round(j.progress * 100)}%` : ""],
      // Runs beside Whisper, but on the CPU it usually ends after it.
      ...(j.spk ? [["Tell speakers apart", j.spk.done ? "done" : j.transcribed ? "now" : "todo", j.spk.note || ""]] : []),
      [`Build captions to ${spec().name}`, j.stage > 2 ? "done" : j.stage === 2 ? "now" : "todo", ""],
      ["Check reading speed and timing", j.stage > 2 ? "done" : "todo", ""],
    ];
    const g = { done: "g-verified", now: "g-run", todo: "g-pending" };
    const el = Math.max(0, (Date.now() - j.startedAt) / 1000);
    const left = j.transcribed ? null : j.progress >= 0.1 ? (el / j.progress) * (1 - j.progress) : null;
    const speed = j.audioDur && el > 1 ? (j.audioDur * j.progress) / el : null;
    $("#view").className = "view working" + (S.wide ? " wide" : "");
    $("#view").innerHTML = `
      <div class="stages" role="list">${stages.map(([n, s, m]) => `<div class="stage ${s}" role="listitem"><span class="g g-sm ${g[s]}" aria-hidden="true"></span><span class="sn">${esc(n)}</span><span class="mono-s">${esc(m)}</span></div>`).join("")}</div>
      <div class="meter">
        <div class="pbar" role="progressbar" aria-valuenow="${Math.round(j.progress * 100)}" aria-valuemin="0" aria-valuemax="100" aria-label="Progress"><div style="width:${(j.progress * 100).toFixed(1)}%"></div></div>
        <div class="nums">
          <div><span class="label">Elapsed</span><span class="v">${dur(el)}</span></div>
          <div><span class="label">Left</span><span class="v">${left == null ? (j.transcribed ? "Finishing" : "…") : "~" + dur(left)}</span></div>
          <div><span class="label">Speed</span><span class="v">${speed ? speed.toFixed(1) + "×" : "–"}</span></div>
        </div>
      </div>
      <div class="live">
        <span class="label">Live transcript</span>
        <div class="feedtext" id="feed" ${isRtlLang() ? 'dir="rtl"' : ""}>${S.cues.map((c, k) => `<p class="${k === S.cues.length - 1 ? "cursor" : ""}"><span class="tc" dir="ltr">${tc(c.start + S.offset)}</span><span>${esc(c.text.replace(/\n/g, " "))}</span></p>`).join("")}</div>
      </div>`;
    const f = $("#feed"); if (f) f.scrollTop = f.scrollHeight;
  }

  /* ---------- review ---------- */
  function reviewRows() {
    const sp = spec(), report = new Map(Cues.checkAll(S.cues, sp).map((r) => [r.id, r.issues]));
    let list = S.cues;
    if (S.filter === "review") list = list.filter((c) => (report.get(c.id) || []).length);
    if (S.filter === "fillers") list = list.filter((c) => (c.words || []).some((w) => w.filler));
    if (S.find) list = list.filter((c) => c.text.includes(S.find));
    return { list, report };
  }

  function cueRow(c, issues, tail) {
    const sp = spec(), d = c.end - c.start, rate = Cues.cps(c);
    const dir = Cues.isRtl(c.text) ? ' dir="rtl"' : "";
    let html = esc(c.text).replace(/\n/g, "<br>");
    const low = issues.find((x) => x.kind === "conf");
    if (low) low.words.forEach((w, k) => { if (w) html = html.split(esc(w)).join(`<span class="lowc" title="Confidence ${Math.round((low.ps[k] || 0) * 100)}%">${esc(w)}</span>`); });
    const fills = (c.words || []).filter((w) => w.filler);
    for (const w of new Set(fills.map((x) => x.text))) html = html.split(esc(w)).join(`<span class="filler" title="Filler, marked for review">${esc(w)}</span>`);
    if (S.find) html = html.split(esc(S.find)).join(`<span class="hit">${esc(S.find)}</span>`);
    const why = issueChips(c, issues);
    const cpsCls = sp.oneWord ? "" : rate > sp.maxCps + 0.05 ? " bad" : rate > sp.maxCps * 0.9 ? " warn" : "";
    const sel = S.selected === c.id, playing = S.playingId === c.id;
    const nudge = sel && !tail && !S.wide ? nudgeBar(c) : "";
    return `<div class="cue${sel ? " sel" : ""}${tail ? " tail" : ""}${S.nowId === c.id ? " now" : ""}" role="listitem" data-cue="${c.id}">
      <span class="g g-sm ${tail ? "g-run" : issues.length ? "g-changed" : "g-verified"}" aria-hidden="true"></span>
      <div>
        <div class="ctop">
          <button class="jumpbtn" type="button" data-jump="${c.id}" title="Go to caption in timeline (G)" aria-label="Go to caption in timeline">${ICON.jump}</button>
          <span class="times"><button type="button" data-seek="${c.start}" title="Go to in-point">${tc(c.start + S.offset)}</button></span>
          ${speakerChip(c)}
          <span class="dur">${d.toFixed(1)} s · <span class="cps${cpsCls}">${Math.round(rate)} cps</span></span>
          <button class="playbtn" type="button" data-play="${c.id}" title="${playing ? "Stop" : "Play this caption in Premiere Pro (P)"}" aria-label="${playing ? "Stop" : "Play this caption in Premiere Pro"}">${playing ? ICON.stopsq : ICON.play}</button>
        </div>
        <div class="txt"${dir} ${tail ? "" : 'contenteditable="true" spellcheck="false"'} data-edit="${c.id}" aria-label="Caption text">${html}</div>
        ${tail ? '<div class="why"><span class="mono-s">Still being written</span></div>' : issues.length || c.autofixed || fills.length ? `<div class="why">${fills.length ? `<span class="chip fill">${plural(fills.length, "filler")}</span><button class="chip fix" type="button" data-fill="drop" data-id="${c.id}">Remove</button><button class="chip fix" type="button" data-fill="keep" data-id="${c.id}">Keep</button>` : ""}${c.autofixed ? `<span class="chip auto" title="${esc(typeof c.autofixed === "string" ? "Auto-fixed: " + c.autofixed : "Auto-fixed")}">Auto-fixed</span>` : ""}${why}</div>` : ""}
        ${sel && !tail && !S.wide ? waveStrip(c) : ""}
        ${nudge}
      </div>
    </div>`;
  }

  const FIX_LABEL = { split: "Split in two", extend: "Extend", merge: "Merge with next", glossary: "Add to glossary" };
  const fixLabel = (f, x) => (f === "spkalt" ? `Said by ${(S.speakers && S.speakers[x.alt]) || `Speaker ${x.alt + 1}`}` : f === "spkok" ? "Looks right" : FIX_LABEL[f]);
  function issueChips(c, issues) {
    return issues.map((x) => `<span class="chip" ${x.hint ? `title="${esc(x.hint)}"` : ""}>${esc(x.label)}</span>${x.hint ? `<span class="hint">${esc(x.hint)}</span>` : ""}` + x.fixes.map((f) => `<button class="chip fix" type="button" data-fix="${f}" data-id="${c.id}"${x.words ? ` data-word="${esc(x.words[0])}"` : ""}${x.alt != null ? ` data-word="${x.from}:${x.alt}"` : ""}>${fixLabel(f, x)}</button>`).join("")).join("");
  }

  function nudgeBar(c) {
    return `<div class="nudge" role="group" aria-label="Timing">
        <span class="label">In</span><button class="tcbtn" type="button" data-seek="${c.start}" title="Go to in-point">${tc(c.start + S.offset)}</button><button class="btn small icon" type="button" data-nudge="in:-1" data-id="${c.id}" aria-label="In one frame earlier">‹</button><button class="btn small icon" type="button" data-nudge="in:1" data-id="${c.id}" aria-label="In one frame later">›</button><button class="btn small" type="button" data-setph="in" data-id="${c.id}" title="Set in to playhead (Alt+[)" aria-label="Set in to playhead">⇤</button>
        <span class="nbr"></span><span class="label">Out</span><button class="tcbtn" type="button" data-seek="${c.end}" title="Go to out-point">${tc(c.end + S.offset)}</button><button class="btn small icon" type="button" data-nudge="out:-1" data-id="${c.id}" aria-label="Out one frame earlier">‹</button><button class="btn small icon" type="button" data-nudge="out:1" data-id="${c.id}" aria-label="Out one frame later">›</button><button class="btn small" type="button" data-setph="out" data-id="${c.id}" title="Set out to playhead (Alt+])" aria-label="Set out to playhead">⇥</button>
        ${S.playhead != null && S.playhead - S.offset > c.start + 0.05 && S.playhead - S.offset < c.end - 0.05 && (c.words || []).length > 1 ? `<span class="nbr"></span><button class="btn small" type="button" data-splitph="${c.id}" title="Split this caption at the playhead (S)">Split at playhead</button>` : ""}
      </div>`;
  }

  // Who is talking, from the track each word was loudest on. Dialogue captions show both.
  function speakerChip(c, inDetail) {
    if (!S.speakers) return "";
    const ks = [];
    for (const w of c.words || []) if (w.spk != null && ks[ks.length - 1] !== w.spk) ks.push(w.spk);
    return ks.length ? `<span class="spks">${ks.map((k) => !inDetail && S.renaming && S.renaming.id === c.id && S.renaming.k === k
      ? `<input class="spkname s${k % 4}" data-spkname="${k}" value="${esc(S.speakers[k] || "")}" aria-label="Name for ${esc(S.speakers[k] || "")}" maxlength="24" spellcheck="false">`
      : `<button type="button" class="spk s${k % 4}" data-spk="${k}" data-id="${c.id}" title="${esc(S.speakers[k] || "")}. Click to rename or change who says it">${esc(S.speakers[k] || "?")}</button>`).join("")}</span>` : "";
  }

  // A speaker tag's menu: rename this person everywhere, or say these words belong to someone else.
  function speakerMenu(anchor, k, id) {
    const others = S.speakers.map((n, j) => j).filter((j) => j !== k);
    openMenu(anchor, [
      [`spkname:${id}:${k}`, `Rename ${S.speakers[k]}…`, "everywhere"],
      "-",
      ...others.map((j) => [`spkset:${id}:${k}:${j}`, `Said by ${S.speakers[j]}`]),
      [`spkset:${id}:${k}:new`, "Said by someone new"],
    ]);
  }
  function speakerMenuAction(m) {
    const [kind, id, k, to] = m.split(":");
    if (kind === "spkname") {
      S.renaming = { id, k: +k };
      renderReview();
      const inp = $(".spkname"); if (inp) { inp.focus(); inp.select(); }
      return;
    }
    let j = +to;
    if (to === "new") { j = S.speakers.length; S.speakers = S.speakers.concat(`Speaker ${j + 1}`); }
    const c = S.cues.find((x) => x.id === id);
    setCues(Cues.setSpeaker(S.cues, id, +k, j, spec()), `Said by ${S.speakers[j]}${c ? ": " + c.text.replace(/\n/g, " ").slice(0, 30) : ""}`);
  }
  function commitRename(inp, keep) {
    if (!S.renaming) return;
    const k = S.renaming.k, name = inp.value.trim().replace(/\s+/g, " ");
    S.renaming = null;
    if (keep && name && name !== S.speakers[k]) {
      const was = S.speakers[k];
      S.speakers = S.speakers.map((n, i) => (i === k ? name : n));
      log(`Renamed ${was} to ${name}`);
      saveHistory();
    }
    renderReview();
  }

  function waveStrip(c) {
    if (!S.env) return '<div class="wave none">The waveform needs this run\'s audio. It shows for new transcriptions.</div>';
    return `<div class="wave" data-wave="${c.id}">
      <canvas aria-hidden="true"></canvas>
      <div class="wnb" data-nb="prev"></div><div class="wnb" data-nb="next"></div>
      <div class="wreg"></div><div class="wph" hidden></div>
      <button class="wh" type="button" data-edge="in" aria-label="Drag to move the in-point" title="Drag to move the in-point"></button>
      <button class="wh" type="button" data-edge="out" aria-label="Drag to move the out-point" title="Drag to move the out-point"></button>
      <span class="wtip" hidden></span>
    </div>`;
  }

  /* ---------- the waveform strip: layout, drag, click to seek ---------- */
  const audioEnd = () => (S.env ? S.env.db.length * S.env.hop : Infinity);
  function waveParts() {
    const el = $(".wave[data-wave]"); if (!el) return null;
    const i = S.cues.findIndex((x) => x.id === el.dataset.wave); if (i < 0) return null;
    const c = S.cues[i];
    return { el, c, prev: S.cues[i - 1], next: S.cues[i + 1], view: el._view || Wave.windowFor(c, audioEnd()) };
  }
  const pct = (t, v) => ((t - v.t0) / (v.t1 - v.t0)) * 100;
  function placeWave(p, a, b) {
    const v = p.view, el = p.el;
    const reg = el.querySelector(".wreg"), hin = el.querySelector('[data-edge="in"]'), hout = el.querySelector('[data-edge="out"]');
    reg.style.left = pct(a, v) + "%"; reg.style.width = Math.max(0, pct(b, v) - pct(a, v)) + "%";
    hin.style.left = pct(a, v) + "%"; hout.style.left = pct(b, v) + "%";
    const nb = (name, x) => {
      const box = el.querySelector(`[data-nb="${name}"]`);
      if (!x || x.end < v.t0 || x.start > v.t1) { box.hidden = true; return; }
      box.hidden = false;
      const l = Math.max(0, pct(x.start, v)), r = Math.min(100, pct(x.end, v));
      box.style.left = l + "%"; box.style.width = Math.max(0, r - l) + "%";
    };
    nb("prev", p.prev); nb("next", p.next);
    const css = getComputedStyle(document.documentElement);
    Wave.draw(el.querySelector("canvas"), S.env, v, { inside: css.getPropertyValue("--product-cueline").trim() || "#6EA8FF", outside: css.getPropertyValue("--rule-strong").trim() || "#6E727A" }, a, b);
    moveWavePlayhead();
  }
  function layoutWave() {
    const p = waveParts(); if (!p) return;
    p.el._view = Wave.windowFor(p.c, audioEnd()); p.view = p.el._view;
    placeWave(p, p.c.start, p.c.end);
  }
  function moveWavePlayhead() {
    const el = $(".wave[data-wave]"); if (!el || !el._view) return;
    const line = el.querySelector(".wph"), t = S.playhead == null ? null : S.playhead - S.offset;
    if (t == null || t < el._view.t0 || t > el._view.t1) { line.hidden = true; return; }
    line.hidden = false; line.style.left = pct(t, el._view) + "%";
  }

  let drag = null;
  // Mouse events, not pointer events: Premiere Pro's embedded browser sends no pointerdown/pointerup.
  document.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    const h = e.target.closest(".wave .wh"), wave = e.target.closest(".wave[data-wave]");
    if (!wave) return;
    const p = waveParts(); if (!p) return;
    const rect = wave.getBoundingClientRect();
    const tAt = (x) => p.view.t0 + Math.max(0, Math.min(1, (x - rect.left) / rect.width)) * (p.view.t1 - p.view.t0);
    if (!h) { Host.setPlayhead(tAt(e.clientX) + S.offset); S.playhead = tAt(e.clientX) + S.offset; moveWavePlayhead(); return; } // click: playhead there
    e.preventDefault();
    const sp = spec(), fps = sp.fps || 25, gap = (sp.gapFrames || 0) / fps, edge = h.dataset.edge;
    const lo = edge === "in" ? (p.prev ? p.prev.end + gap : 0) : p.c.start + 1 / fps;
    const hi = edge === "in" ? p.c.end - 1 / fps : (p.next ? p.next.start - gap : audioEnd());
    drag = { id: p.c.id, edge, p, tAt, lo, hi, fps, t: edge === "in" ? p.c.start : p.c.end };
    wave.classList.add("dragging");
  });
  const dragTime = (e) => Math.round(Math.max(drag.lo, Math.min(drag.hi, drag.tAt(e.clientX))) * drag.fps) / drag.fps;
  document.addEventListener("mousemove", (e) => {
    if (!drag) return;
    const t = dragTime(e);
    drag.t = t;
    const a = drag.edge === "in" ? t : drag.p.c.start, b = drag.edge === "out" ? t : drag.p.c.end;
    placeWave(drag.p, a, b);
    const tip = drag.p.el.querySelector(".wtip");
    tip.hidden = false; tip.textContent = `${drag.edge === "in" ? "In" : "Out"} ${tc(t + S.offset)} · ${(b - a).toFixed(2)} s`;
    tip.style.left = pct(t, drag.p.view) + "%";
  });
  document.addEventListener("mouseup", (e) => {
    if (!drag) return;
    if (e && e.clientX != null) drag.t = dragTime(e); // a quick flick may send no move events
    const d = drag; drag = null;
    d.p.el.classList.remove("dragging");
    const c = S.cues.find((x) => x.id === d.id);
    if (!c || Math.abs((d.edge === "in" ? c.start : c.end) - d.t) < 1e-6) return layoutWave();
    setCues(Cues.setTime(S.cues, d.id, d.edge, d.t, spec()), `Moved ${d.edge === "in" ? "in" : "out"}-point to ${tc(d.t + S.offset)}`);
  });
  const WIDE_AT = 760;
  function checkWide() {
    const w = window.innerWidth >= WIDE_AT;
    if (w === S.wide) return false;
    S.wide = w; document.body.classList.toggle("wide", w);
    return true;
  }
  window.addEventListener("resize", () => { if (checkWide()) render(); else layoutWave(); });
  checkWide();

  /* ---------- wide panel: detail pane and the caption timeline ---------- */
  function detailPane(report, tailIds) {
    const i = S.cues.findIndex((x) => x.id === S.selected), c = S.cues[i];
    if (!c) return `<aside class="detail empty" aria-label="Selected caption"><p>Pick a caption to see its timing against the audio.</p><p class="mono-s">↑ ↓ move · J K next to review · G go to it in the timeline</p></aside>`;
    const tail = tailIds.has(c.id), issues = tail ? [] : report.get(c.id) || [];
    const sp = spec(), rate = Cues.cps(c), playing = S.playingId === c.id;
    const dir = Cues.isRtl(c.text) ? ' dir="rtl"' : "";
    return `<aside class="detail" aria-label="Selected caption">
      <div class="dhead">
        <span class="label">Caption ${i + 1} of ${S.cues.length}</span>${speakerChip(c, true)}
        <span class="dur">${(c.end - c.start).toFixed(2)} s · <span class="cps${!sp.oneWord && rate > sp.maxCps + 0.05 ? " bad" : ""}">${Math.round(rate)} cps</span></span>
        <button class="jumpbtn" type="button" data-jump="${c.id}" title="Go to caption in timeline (G)" aria-label="Go to caption in timeline">${ICON.jump}</button>
        <button class="playbtn" type="button" data-play="${c.id}" title="${playing ? "Stop" : "Play this caption in Premiere Pro (P)"}" aria-label="${playing ? "Stop" : "Play this caption in Premiere Pro"}">${playing ? ICON.stopsq : ICON.play}</button>
      </div>
      <div class="dtext"${dir}>${esc(c.text).replace(/\n/g, "<br>")}</div>
      ${tail ? '<div class="why"><span class="mono-s">Still being written</span></div>' : `${waveStrip(c)}${nudgeBar(c)}${issues.length ? `<div class="why">${issueChips(c, issues)}</div>` : ""}`}
    </aside>`;
  }
  // Swap only the detail pane (selection changed while the list must stay as it is, e.g. typing).
  function renderDetail() {
    const old = $(".detail"); if (!old) return;
    const { report } = reviewRows();
    const tailIds = new Set(S.job && S.job.stream ? S.job.stream.tail.map((c) => c.id) : []);
    old.outerHTML = detailPane(report, tailIds);
    document.querySelectorAll(".tb.sel").forEach((x) => x.classList.remove("sel"));
    const b = document.querySelector(`.tb[data-tl="${S.selected}"]`); if (b) b.classList.add("sel");
    layoutWave();
  }

  // Every caption as a block over the whole run; amber ones need review. Click a block to go there.
  const tlSpan = () => Math.max(S.cues.length ? S.cues[S.cues.length - 1].end : 0, isFinite(audioEnd()) ? audioEnd() : 0, (S.job && S.job.audioDur) || 0, 1);
  function timelineStrip(report) {
    const span = tlSpan();
    const spkOf = (c) => { const w = (c.words || []).find((x) => x.spk != null); return S.speakers && w ? ` sp${w.spk % 4}` : ""; };
    const blocks = S.cues.map((c) => `<button type="button" class="tb${spkOf(c)}${(report.get(c.id) || []).length ? " iss" : ""}${S.selected === c.id ? " sel" : ""}${S.nowId === c.id ? " now" : ""}" data-tl="${c.id}" style="left:${((c.start / span) * 100).toFixed(3)}%;width:${(((c.end - c.start) / span) * 100).toFixed(3)}%" title="${esc(tc(c.start + S.offset) + "  " + c.text.replace(/\n/g, " "))}" aria-label="${esc(tc(c.start + S.offset))}"></button>`).join("");
    const cuts = (S.cuts || []).filter((k) => k > 0 && k < span).map((k) => `<i class="tcut" style="left:${((k / span) * 100).toFixed(3)}%"></i>`).join("");
    return `<div class="tline" data-tline aria-label="All captions over time">${cuts}${blocks}<div class="tph" hidden></div></div>`;
  }
  function moveTlinePlayhead() {
    const line = $(".tline .tph"); if (!line) return;
    const t = S.playhead == null ? null : S.playhead - S.offset, span = tlSpan();
    if (t == null || t < 0 || t > span) { line.hidden = true; return; }
    line.hidden = false; line.style.left = ((t / span) * 100).toFixed(3) + "%";
  }

  function renderReview() {
    const sp = spec(), sum = Cues.summary(S.cues, sp);
    const { list, report } = reviewRows();
    const running = S.job && S.job.running;
    let progress = "";
    if (running) {
      const el = (Date.now() - S.job.startedAt) / 1000, p = S.job.progress;
      const left = p >= 0.1 ? (el / p) * (1 - p) : null;
      progress = `<div class="meter" style="padding:8px 12px">
        <div class="row between"><span class="mono-s">${esc(S.job.phase)}</span><span class="mono-s">${left == null ? "Estimating…" : "~" + dur(left) + " left"}</span></div>
        <div class="pbar" role="progressbar" aria-valuenow="${Math.round(p * 100)}" aria-valuemin="0" aria-valuemax="100" aria-label="Progress"><div style="width:${(p * 100).toFixed(1)}%"></div></div></div>`;
    }
    const pv = running || !S.cues.length ? { solved: 0 } : Cues.fixPreview(S.cues, sp, timed);
    const nav = `<span class="issuenav"><button class="btn small icon" type="button" data-act="previssue" aria-label="Previous caption to review (K)" title="Previous to review (K)">‹</button><span class="mono-s">${issuePos()}</span><button class="btn small icon" type="button" data-act="nextissue" aria-label="Next caption to review (J)" title="Next to review (J)">›</button></span>`;
    const check = !S.cues.length ? ""
      : pv.solved ? `<div class="check amber"><span class="g g-changed" aria-hidden="true"></span><span class="grow">${pv.solved} can be fixed automatically${sum.toReview > pv.solved ? ` · ${sum.toReview} to review` : ""}</span>${nav}<button class="btn small" type="button" data-act="fixall">Fix all</button></div>`
      : sum.toReview ? `<div class="check amber"><span class="g g-changed" aria-hidden="true"></span><span class="grow">${sum.toReview} to review</span>${nav}</div>`
      : `<div class="check"><span class="g g-verified" aria-hidden="true"></span><span class="grow">All ${sum.count} captions meet the ${esc(sp.name)} style</span></div>`;
    const fillers = running ? 0 : Cues.fillerCount(S.cues);
    if (!fillers && S.filter === "fillers") S.filter = "all";
    const tailIds = new Set(S.job && S.job.stream ? S.job.stream.tail.map((c) => c.id) : []);
    const keepScroll = S.wide && $("#cues") ? $("#cues").scrollTop : null;
    $("#view").className = "view review" + (S.wide ? " wide" : "");
    $("#view").innerHTML = `${progress}
      <div class="rhead">
        ${check}
        <div class="toolbar">
          <input class="input" id="find" type="search" aria-label="Find in captions" placeholder="Find" value="${esc(S.find)}" ${isRtlLang() ? 'dir="rtl"' : ""}>
          <button class="btn small icon${S.showReplace ? " on" : ""}" type="button" data-act="replace" aria-expanded="${S.showReplace}" aria-label="Replace" title="Find and replace">${ICON.replace}</button>
          <button class="btn small${S.follow ? " on" : ""}" type="button" data-act="follow" aria-pressed="${S.follow}" title="Follow the playhead">Follow</button>
          <button class="btn small icon" type="button" data-act="undo" aria-label="Undo (U)" title="${undoStack.length ? "Undo " + esc(undoStack[undoStack.length - 1].label.toLowerCase()) + " (U)" : "Nothing to undo"}" ${undoStack.length ? "" : "disabled"}>${ICON.undo}</button>
          <button class="btn small icon" type="button" data-act="tonow" aria-label="Go to the caption at the playhead (F)" title="Caption at the playhead (F)">${ICON.target}</button>
          <div class="filters">
            <button type="button" data-filter="all" aria-pressed="${S.filter === "all"}">All ${sum.count}</button>
            <button type="button" data-filter="review" aria-pressed="${S.filter === "review"}">Review ${sum.toReview}</button>
            ${fillers ? `<button type="button" data-filter="fillers" aria-pressed="${S.filter === "fillers"}" title="Captions with marked fillers">Fillers ${fillers}</button>` : ""}
          </div>
        </div>
        ${S.showReplace ? `<div class="replace"><input class="input" id="rfind" aria-label="Find" value="${esc(S.find)}" placeholder="Find" style="height:24px;font-size:11px"><input class="input" id="rrepl" aria-label="Replace with" value="${esc(S.repl)}" placeholder="Replace with" style="height:24px;font-size:11px"><button class="btn small" type="button" data-act="doreplace">Replace ${S.find ? S.cues.filter((c) => c.text.includes(S.find)).length : ""}</button></div>` : ""}
      </div>
      ${S.autoNote && !running ? `<div class="notebox autonote" role="status"><div class="row between"><span><span class="g g-sm g-verified" aria-hidden="true" style="vertical-align:-1px"></span> Auto-fixed ${plural(S.autoNote.changed, "caption")}${S.autoNote.from !== S.autoNote.to ? ` (${S.autoNote.from} → ${S.autoNote.to})` : ""}${S.autoNote.left ? ` · ${S.autoNote.left} still need you` : ""}</span><span class="row"><button class="link" type="button" data-act="undo">Undo</button><button class="btn small icon ghost" type="button" data-act="autook" aria-label="Dismiss">×</button></span></div></div>` : ""}
      ${fillers ? `<div class="notebox fillnote" role="status"><div class="row between"><span>${plural(fillers, "filler")} marked</span><span class="row"><button class="link" type="button" data-filter="fillers">Show</button><button class="btn small" type="button" data-fillall="drop">Remove all</button><button class="btn small ghost" type="button" data-fillall="keep">Keep all</button></span></div></div>` : ""}
      ${!tipSeen() && !running && S.cues.length ? `<div class="notebox tip"><span><b>Tip.</b> ${ICON.jump} goes to a caption in the timeline. J and K step through what to review. U undoes. Press ? for all shortcuts.</span><div class="acts"><button class="btn small" type="button" data-act="tipok">Got it</button></div></div>` : ""}
      ${S.wide ? '<div class="split">' : ""}<div class="cues" role="list" id="cues">${list.length ? list.map((c) => cueRow(c, tailIds.has(c.id) ? [] : report.get(c.id) || [], tailIds.has(c.id))).join("") : `<div class="empty"><p>${running ? "Listening…" : S.filter === "review" ? "Nothing to review." : "No captions match."}</p></div>`}</div>
      ${S.wide ? detailPane(report, tailIds) + "</div>" + (S.cues.length ? timelineStrip(report) : "") : ""}
      <div class="dock">
        <div class="two"><button class="btn main" type="button" data-act="place" ${running || !S.cues.length || (S.placed && !S.dirty) ? "disabled" : ""}>${placeLabel(running)}</button><button class="btn" type="button" data-act="export">Export</button><button class="btn icon" type="button" data-act="more" aria-label="More options">${dots()}</button></div>
        <div class="dest"><span>${destLine(running)}</span><span>${S.lang === "auto" && S.detected ? esc(langName(S.detected)) + (isRtlLang() && S.opts.rtlFix ? " · " : "") : ""}${isRtlLang() && S.opts.rtlFix ? "RTL fixed" : ""}</span></div>
      </div>`;
    if (keepScroll != null && $("#cues")) $("#cues").scrollTop = keepScroll;
    layoutWave();
    moveTlinePlayhead();
  }
  function tipSeen() { try { return localStorage.getItem("cueline.tip.keys") === "1"; } catch (e) { return true; } }

  function issueIds() { const sp = spec(); return Cues.checkAll(S.cues, sp).filter((r) => r.issues.length).map((r) => r.id); }
  function issuePos() { const ids = issueIds(), k = ids.indexOf(S.selected); return k >= 0 ? `${k + 1}/${ids.length}` : `–/${ids.length}`; }
  function visibleIds() { return [...document.querySelectorAll("#cues [data-cue]")].map((x) => x.dataset.cue); }

  function select(id, opts) {
    if (!id) return;
    S.selected = id;
    renderReview();
    const row = document.querySelector(`[data-cue="${id}"]`);
    if (row) { centerRow(row); if (opts && opts.flash) { row.classList.add("flash"); setTimeout(() => row.classList.remove("flash"), 320); } }
  }
  function jump(id) {
    const c = S.cues.find((x) => x.id === id); if (!c) return;
    const fps = (S.info && S.info.fps) || 25;
    Host.setPlayhead(c.start + S.offset + 1 / fps); // one frame in, so the monitor shows the caption
    S.playhead = c.start + S.offset + 1 / fps; S.nowId = id; userMoved = 0;
    select(id, { flash: true });
  }
  function stepIssue(dir) {
    const ids = issueIds(), n = ids.length; if (!n) return;
    const pos = (id) => S.cues.findIndex((c) => c.id === id);
    let k = ids.indexOf(S.selected);
    if (k >= 0) k = (k + dir + n) % n;
    else {
      // From a caption that is fine: the nearest one to review after it (J) or before it (K).
      const cur = pos(S.selected);
      if (dir > 0) { k = ids.findIndex((id) => pos(id) > cur); if (k < 0) k = 0; }
      else { k = -1; ids.forEach((id, i) => { if (pos(id) < cur) k = i; }); if (k < 0) k = n - 1; }
    }
    jump(ids[k]);
  }
  function stepRow(dir, andJump) {
    const ids = visibleIds(); if (!ids.length) return;
    let k = ids.indexOf(S.selected); k = k < 0 ? 0 : Math.max(0, Math.min(ids.length - 1, k + dir));
    andJump ? jump(ids[k]) : select(ids[k]);
  }
  function cueAt(t) { const rel = t - S.offset; return S.cues.find((c) => rel >= c.start - 0.001 && rel < c.end) || null; }

  // Follow the playhead: mark the caption under it and keep it in view, unless the person is busy.
  let userMoved = 0;
  function onPlayhead() {
    if (S.screen !== "review") return;
    moveWavePlayhead();
    moveTlinePlayhead();
    const c = S.playhead == null ? null : cueAt(S.playhead);
    const id = c ? c.id : null;
    if (id === S.nowId) return;
    S.nowId = id;
    document.querySelectorAll(".cue.now, .tb.now").forEach((x) => x.classList.remove("now"));
    const tb = id && document.querySelector(`.tb[data-tl="${id}"]`); if (tb) tb.classList.add("now");
    let row = id && document.querySelector(`[data-cue="${id}"]`);
    if (!row) return;
    row.classList.add("now");
    const busy = (document.activeElement && document.activeElement.dataset && document.activeElement.dataset.edit) || Date.now() - userMoved < 3000 || drag;
    if (!S.follow || busy) return;
    // The caption under the playhead becomes the selected one, so its waveform and timing are open.
    if (S.selected !== id) {
      S.selected = id;
      if (S.wide) { document.querySelectorAll(".cue.sel").forEach((x) => x.classList.remove("sel")); row.classList.add("sel"); renderDetail(); }
      else { renderReview(); row = document.querySelector(`[data-cue="${id}"]`); if (!row) return; }
    }
    centerRow(row);
  }

  // Scroll the review list so a row sits in the middle of what is visible between the sticky header
  // and the dock, with a short smooth scroll (instant under reduced motion).
  function centerRow(row, instant) {
    const view = S.wide ? $("#cues") : $("#view"); if (!view || !row) return;
    const vr = view.getBoundingClientRect(), rr = row.getBoundingClientRect();
    const head = S.wide ? null : $(".rhead"), dock = S.wide ? null : $(".dock");
    const top = head ? head.getBoundingClientRect().bottom : vr.top;
    const bottom = dock ? dock.getBoundingClientRect().top : vr.bottom;
    const target = view.scrollTop + (rr.top - top) - Math.max(0, (bottom - top - rr.height) / 2);
    const still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    view.scrollTo({ top: Math.max(0, target), behavior: instant || still ? "auto" : "smooth" });
  }

  // Play one caption in Premiere Pro: playhead to its in-point, play, stop at its out-point.
  // The poll speeds up while playing so the stop lands within a few frames.
  async function play(id) {
    const was = S.playingId;
    if (was) { S.playingId = null; await Host.stop(); renderReview(); if (was === id) return; }
    const c = S.cues.find((x) => x.id === id); if (!c) return;
    const r = await Host.play(c.start + S.offset);
    if (!r.ok) return toast(r.error, true);
    S.playingId = id; S.playEnd = c.end + S.offset; S.playStarted = Date.now(); S.playFrom = c.start + S.offset;
    select(id);
  }
  async function playTick() {
    if (!S.playingId) return;
    if (S.playhead >= S.playEnd - 0.02) { S.playingId = null; await Host.stop(); return renderReview(); }
    // Premiere starts playback only while it is the active app; say so instead of waiting silently.
    if (Date.now() - S.playStarted > 1500 && Math.abs(S.playhead - S.playFrom) < 0.05) {
      S.playingId = null; await Host.stop(); renderReview();
      toast("Premiere Pro didn't start playing. Click its timeline once, then press play again.", true);
    }
  }

  const dots = () => '<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><rect x="1" y="5" width="2" height="2"></rect><rect x="5" y="5" width="2" height="2"></rect><rect x="9" y="5" width="2" height="2"></rect></svg>';
  function placeLabel(running) {
    if (running) return "Places when done";
    if (!S.placed) return "Place on timeline";
    return S.dirty ? "Update timeline" : "On the timeline";
  }
  function destLine(running) {
    const per = S.speakers && S.opts.speakerTracks && S.speakerMode !== "off";
    const tracks = per ? `${S.speakers.length} caption tracks, one per speaker,` : "a caption track";
    if (running) return `Goes onto a caption track at ${tc(S.offset)} when Whisper finishes`;
    if (S.placed && S.dirty) return `Edited since it was placed. Update adds this version as ${per ? "new caption tracks" : "a new caption track"}.`;
    if (S.placed) return `On ${tracks} from ${tc(S.offset)}`;
    return per ? `${S.speakers.length} new caption tracks, one per speaker, from ${tc(S.offset)}` : `New caption track from ${tc(S.offset)}`;
  }

  /* ---------- overlay screens ---------- */
  /* One overlay at a time. A screen opened from the menu goes back to the menu. Focus moves to Back
   * when a screen opens and returns where it was when it closes; screenToken stops a slow answer
   * (an update check, a self-check) from drawing over a screen opened since. */
  let screenToken = 0, focusBefore = null;
  function openScreen(kind, parent) {
    if (!S.overlay) focusBefore = document.activeElement;
    S.overlay = kind; S.overlayParent = parent || null; screenToken++;
    renderScreen();
    const back = $("#screen [data-act=close]"); if (back) back.focus();
  }
  function closeScreen() {
    if (S.overlayParent) return openScreen(S.overlayParent);
    S.overlay = null; $("#screen").hidden = true; render();
    if (focusBefore && document.body.contains(focusBefore)) try { focusBefore.focus(); } catch (e) {}
    focusBefore = null;
  }
  function still(token, fn) { return (...a) => { if (token === screenToken) fn(...a); }; }
  function openUrl(url) { if (!Host.openUrl(url)) { Host.copy(url); toast("Link copied: paste it in your browser."); } }
  const tilde = (t) => { const h = Host.sysInfo().home; return h ? String(t).split(h).join("~") : String(t); };
  const hostLabel = () => { const v = S.hostVersion; const major = v ? parseInt(v, 10) : 0; return major >= 22 ? `Premiere Pro ${2000 + major}` : "Premiere Pro"; };

  function renderScreen() {
    const el = $("#screen");
    if (!S.overlay) { el.hidden = true; return; }
    el.hidden = false;
    const head = (title, action) => `<div class="screen-head"><button class="btn icon" type="button" data-act="close" aria-label="Back">${ICON.back}</button><span id="screenTitle" class="screen-title">${esc(title)}</span>${action || ""}</div>`;
    if (S.overlay === "style") {
      const sp = S.preset === "custom" ? S.custom : Cues.PRESETS[S.preset];
      const ro = S.preset !== "custom" ? "readonly" : "";
      el.innerHTML = head("Caption style") + `<div class="screen-body">
        <section class="sec"><div class="seg" role="radiogroup" aria-label="Preset">
          ${["broadcast", "social", "oneword", "custom"].map((k) => `<button type="button" role="radio" data-preset="${k}" aria-checked="${S.preset === k}">${k === "custom" ? "Custom" : Cues.PRESETS[k].name}</button>`).join("")}
        </div>${S.preset !== "custom" ? '<div class="spec">Presets are fixed. Choose Custom to change the numbers.</div>' : ""}</section>
        <div class="mgroup"><span class="label">Lines</span>
          ${num("maxChars", "Characters per line", sp.maxChars, "Lines break at punctuation first", ro)}
          <div class="kv"><span>Lines per caption</span><div class="filters">${[1, 2].map((n) => `<button type="button" data-lines="${n}" aria-pressed="${sp.maxLines === n}" ${ro ? "disabled" : ""}>${n}</button>`).join("")}</div></div>
          ${num("maxCps", "Reading speed", sp.maxCps, "Characters per second, at most", ro)}
        </div>
        <div class="mgroup"><span class="label">Timing</span>
          ${num("minDur", "Shortest caption, s", sp.minDur, "", ro)}
          ${num("maxDur", "Longest caption, s", sp.maxDur, "", ro)}
          ${num("gapFrames", "Gap between captions, frames", sp.gapFrames, "Snapped to the sequence frame rate", ro)}
        </div>
        <div class="mgroup"><span class="label">Glossary · ${plural(S.glossary.filter((g) => g.from).length, "term")}</span>
          <div class="intro" style="padding-bottom:4px">How a word is heard, and how to write it. The terms are also given to Whisper as context.</div>
          <div class="terms">${S.glossary.concat([{ from: "", to: "" }]).map((g, k) => `<div class="term">
            <input class="input" data-gl="${k}" data-side="from" aria-label="Heard as" placeholder="Heard as" value="${esc(g.from)}" dir="auto" style="height:24px">
            <span class="arrow">→</span>
            <input class="input" data-gl="${k}" data-side="to" aria-label="Write as" placeholder="Write as" value="${esc(g.to)}" dir="auto" style="height:24px">
            ${k < S.glossary.length ? `<button class="btn small icon ghost" type="button" data-glrm="${k}" aria-label="Remove term">×</button>` : "<span></span>"}</div>`).join("")}</div>
        </div>
        <div class="mgroup"><span class="label">Right to left</span>
          <label class="opt" style="padding:8px 12px"><input type="checkbox" data-opt="rtlFix" ${S.opts.rtlFix ? "checked" : ""}><span class="box"></span><span><span class="t">Fix punctuation for Hebrew and Arabic</span><span class="d">Keeps full stops and commas at the end of the line in Premiere Pro.</span></span></label>
        </div></div>`;
    } else if (S.overlay === "models") {
      const ms = Host.engine.listModels();
      el.innerHTML = head("Models") + `<div class="screen-body">
        <div class="intro">Models run on this computer with whisper.cpp. Download once; they work offline after that.</div>
        <div class="list" role="list">${ms.map((m) => {
          const dl = downloads[m.id];
          return `<div class="lrow" role="listitem"><span class="g g-sm ${dl ? "g-run" : m.installed ? "g-verified" : "g-pending"}" aria-hidden="true"></span>
            <div style="min-width:0"><div class="lt">${esc(m.label)}</div><div class="ls">${esc(m.note || "")}${currentModel() && currentModel().id === m.id ? " In use." : ""}</div>
            <div id="dl-${esc(m.id)}">${dl ? dlBar(dl) : `<div class="lm">${esc(m.size)} · ${esc(m.lang)}</div>`}</div></div>
            ${dl ? `<button class="btn small" type="button" data-cancel="${esc(m.id)}">Cancel</button>` : m.installed ? `<button class="btn small" type="button" data-remove="${esc(m.id)}">Remove</button>` : `<button class="btn small" type="button" data-download="${esc(m.id)}">Download</button>`}</div>`;
        }).join("")}</div>
        <div class="mgroup"><span class="label">Your own model</span><div class="kv"><span>Add a ggml model file<span class="ks">Put any whisper.cpp .bin file named ggml-*.bin in the folder below.</span></span></div></div>
        <div class="mgroup"><span class="label">Storage</span>
          <div class="kv"><span class="mono-s" style="word-break:break-all">${esc(Host.engine.modelsDir())}</span><button class="btn small" type="button" data-act="openmodels">Open</button></div>
          <div class="kv"><span>Used</span><span class="mono-s">${(Host.engine.diskUse() / 1e9).toFixed(1)} GB</span></div></div>
      </div>`;
    } else if (S.overlay === "batch") {
      const list = S.batchList || [], pick = S.batchPick || new Set();
      const n = list.filter((x) => pick.has(x.id)).length, total = list.filter((x) => pick.has(x.id)).reduce((a, x) => a + (x.outSec - x.inSec), 0);
      el.innerHTML = head("Transcribe several sequences") + `<div class="screen-body">
        <div class="intro">Each sequence is transcribed with the settings on the main screen, one after another, and gets its own caption track. Its In/Out is used when it has one.</div>
        ${list.length ? `<div class="row between" style="padding:0 12px 6px"><span class="mono-s">${n} of ${list.length} picked · ${dur(total)} of audio</span><span class="row"><button class="link" type="button" data-act="batchall">All</button><button class="link" type="button" data-act="batchnone">None</button></span></div>
        <div class="list" role="list">${list.map((x) => `<label class="lrow brow${x.audioTracks ? "" : " off"}"><input type="checkbox" data-bpick="${esc(x.id)}" ${pick.has(x.id) ? "checked" : ""} ${x.audioTracks ? "" : "disabled"}>
          <span style="min-width:0"><span class="lt" style="display:block">${esc(x.name)}${x.active ? ' <span class="mono-s">· open now</span>' : ""}</span><span class="lm" style="display:block">${x.audioTracks ? `${dur(x.outSec - x.inSec)} · ${x.hasInOut ? "In/Out" : "whole sequence"}` : "No audio"}</span></span></label>`).join("")}</div>` : '<div class="intro">No sequences in this project.</div>'}
        <div class="go" style="padding:12px"><button class="btn main big" type="button" data-act="batchgo" ${n ? "" : "disabled"}>Transcribe ${plural(n, "sequence")}</button>
        <div class="hint">${esc(langName(S.lang))} · ${esc(spec().name)}${S.speakerMode !== "off" ? " · speakers " + (S.speakerMode === "voice" ? "by voice" : "by track") : ""} · audio tracks with clips in each</div></div></div>`;
    } else if (S.overlay === "history") {
      const h = Host.history.list();
      el.innerHTML = head("History") + `<div class="screen-body">
        ${h.length ? `<div class="list" role="list">${h.map((j) => `<button class="lrow" type="button" data-open="${esc(j.file)}" style="text-align:left;border:0;border-bottom:1px solid var(--rule);background:transparent;width:100%">
          <span class="g g-sm ${j.placed ? "g-verified" : "g-changed"}" aria-hidden="true"></span>
          <span style="min-width:0"><span class="lt" style="display:block">${esc(j.seq)}</span><span class="lm" style="display:block">${esc(j.when)} · ${j.count} captions · ${esc(j.lang)} · ${j.placed ? "placed" : "not placed"}</span></span><span class="mono-s">›</span></button>`).join("")}</div>`
          : '<div class="intro">Finished transcriptions show here, so you can reopen, fix and place them again.</div>'}</div>`;
    } else if (S.overlay === "keys") {
      const rows = [["↑ ↓", "Select the previous or next caption"], ["⌥↑ ⌥↓", "Select and go to it in the timeline"], ["G", "Go to the selected caption in the timeline"],
        ["F", "Select the caption at the playhead"], ["J  K", "Next or previous caption to review"], ["P", "Play the selected caption in Premiere Pro, stop at its end"],
        ["Enter", "Edit the selected caption"], ["Enter (editing)", "Save and edit the next caption"], ["⇧Enter (editing)", "Line break"], ["Esc", "Stop editing"],
        ["⌥[  ⌥]", "Set in or out to the playhead"], ["⌥Enter (editing)", "Split at the cursor"], ["S", "Split the selected caption at the playhead"], ["U  ⇧U", "Undo, redo"], ["?", "This list"]];
      el.innerHTML = head("Keyboard shortcuts") + `<div class="screen-body"><div class="list">${rows.map(([k, v]) => `<div class="kv"><span>${esc(v)}</span><span class="kbd">${esc(k)}</span></div>`).join("")}</div>
        <div class="intro">Shortcuts work in the review list when you are not typing in a field. Space stays with Premiere Pro for play and pause.</div></div>`;
    } else if (S.overlay === "menu") {
      const u = S.update, upd = u && u.updateAvailable && Host.cmpVersions(u.latest, VERSION) > 0;
      const row = (act, label, sub, extra) => `<button class="mrow" type="button" ${act}><span class="mtext"><span class="mlabel">${esc(label)}</span>${sub ? `<span class="msub">${sub}</span>` : ""}</span><span class="chev" aria-hidden="true">${extra == null ? "›" : extra}</span></button>`;
      const group = (title, rows) => `<div class="mgroup"><div class="label">${esc(title)}</div>${rows.join("")}</div>`;
      const inReview = S.screen === "review";
      el.innerHTML = head("Cueline Captions") + `<div class="screen-body">
        ${inReview ? group("This transcription", [
          row('data-act="undo"', undoStack.length ? `Undo ${undoStack[undoStack.length - 1].label.toLowerCase()}` : "Undo", "U", ""),
          row('data-act="redo"', "Redo", "⇧U", ""),
          row('data-goto="keys"', "Keyboard shortcuts", "?")]) : ""}
        ${group("Work", [
          row('data-act="batch"', "Transcribe several sequences", "Every sequence you pick, one after another"),
          row('data-goto="history"', "History", "Reopen, fix and place earlier transcriptions")])}
        ${group("Settings", [
          row('data-goto="style"', "Caption style and glossary", esc(spec().name) + " · " + plural(S.glossary.filter((g) => g.from).length, "glossary term")),
          row('data-goto="models"', "Models", esc(plural(installedModels().length, "model")) + " installed · " + esc(tilde(Host.engine.modelsDir())))])}
        ${group("Help", [
          row('data-goto="test"', "Check Cueline", "Engine, models and Premiere Pro, with fixes"),
          row('data-act="diag"', "Copy diagnostics", "For a bug report or a chat", ""),
          row('data-goto="update"', "Updates", upd ? `<span class="ink">${esc(u.latest)} is ready</span> · you have ${VERSION}` : `You have ${VERSION}`),
          row('data-goto="about"', "About and help", null),
          row('data-goto="log"', "Log", "What Cueline did, step by step")])}
      </div>`;
    } else if (S.overlay === "about") {
      const LOGO = TILE.replace('class="tile" width="28" height="28"', 'class="tile" width="64" height="64"');
      const credits = [["whisper.cpp", "MIT"], ["ivrit.ai Whisper models", "Apache-2.0"], ["OpenAI Whisper models", "MIT"], ["sherpa-onnx", "Apache-2.0"], ["pyannote segmentation 3.0", "MIT"], ["3D-Speaker CAM++", "Apache-2.0"], ["Silero VAD", "MIT"], ["IBM Plex", "OFL"]];
      el.innerHTML = head("About and help") + `<div class="screen-body">
        <div class="about">${LOGO}<div><div class="t">Cueline Captions</div><div class="s">for Adobe® Premiere Pro® · version ${VERSION}</div></div></div>
        <div class="links">${[["Getting started", WIKI_URL], ["The Cueline panel", WIKI_URL + "/The-Cueline-panel"], ["Troubleshooting", WIKI_URL + "/Troubleshooting"], ["Report a problem", REPO_URL + "/issues"], ["Cueline Captions on conformlabs.co", SITE_URL]]
          .map(([t, u]) => `<button type="button" data-url="${esc(u)}"><span>${esc(t)}</span><span aria-hidden="true">›</span></button>`).join("")}</div>
        <div class="credits"><span class="label">Built on</span>${credits.map(([n, l]) => `<div class="kv"><span>${esc(n)}</span><span class="mono-s">${l}</span></div>`).join("")}</div>
        <div class="spacer"></div>
        <div class="sfoot">Made by Ron Yitzhaki at Conform Labs · MIT licence. Everything runs on this computer; nothing is uploaded. Adobe and Premiere Pro are trademarks of Adobe; Cueline Captions is not affiliated with Adobe.</div>
      </div>`;
    } else if (S.overlay === "update") {
      drawUpdate(el, head);
    } else if (S.overlay === "test") {
      drawChecks(el, head);
    } else if (S.overlay === "animated") {
      const rtl = isRtlLang(), tooOld = S.hostVersion && parseInt(S.hostVersion, 10) < 25; // templates made in After Effects 2025
      el.innerHTML = head("Animated captions") + `<div class="screen-body">
        <div class="intro">One graphic per caption on a new video track, the spoken word lit in its speaker's colour. Pick a look; every part of it can still be changed in Premiere Pro's Essential Graphics panel.</div>
        <div class="looks" role="radiogroup" aria-label="Look">${Looks.LOOKS.map((l) => `<button type="button" class="look" role="radio" data-look="${l.id}" aria-checked="${S.look === l.id}">
          ${lookPreview(Looks.lookValues(l.id), rtl)}<span class="lt">${esc(l.name)}</span><span class="ls">${esc(l.note)}</span></button>`).join("")}</div>
        <div class="go" style="padding:12px"><button class="btn main big" type="button" data-act="animgo" ${S.cues.length && !animating && !tooOld ? "" : "disabled"}>${animating ? "Placing…" : `Place ${plural(S.cues.length, "animated caption")}`}</button>
          <div class="hint">${tooOld ? `Animated captions need Premiere Pro 2025 or later; this is ${esc(hostLabel())}.` : `${rtl ? "Right to left" : "Left to right"} · positioned for this sequence's frame · on a new track, nothing covered`}</div></div>
        <div class="copylook"><span class="label">Same look everywhere</span>
          <span class="hintline">Style one caption in Essential Graphics, select it on the timeline, then copy its look and font to every caption on its track.</span>
          <button class="btn" type="button" data-act="copylook">Copy the selected caption's look to all</button></div>
      </div>`;
    } else if (S.overlay === "log") {
      el.innerHTML = head("Log", '<button class="btn small" type="button" data-act="copylog">Copy</button>') + `<div class="screen-body"><pre class="report" style="max-height:none;flex:1 1 auto;margin:12px">${esc(S.log.join("\n") || "Nothing yet.")}</pre></div>`;
    }
  }
  /* Updates: what the last check found, a fresh check when the screen opens, the release notes, and a
   * Download link to the release (Cueline doesn't install itself yet). */
  function drawUpdate(el, head) {
    const u = S.update, checking = S.updateChecking;
    const avail = u && u.latest && Host.cmpVersions(u.latest, VERSION) > 0;
    const card = avail
      ? `<div class="upd"><div class="upd-head"><span class="v">${esc(u.latest)} is ready</span><span class="have">you have ${VERSION}</span></div>
          ${(u.notes || []).length ? `<ul>${u.notes.slice(0, 5).map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}
          <button class="link under" type="button" data-url="${esc(u.url || REPO_URL + "/releases/latest")}">What’s new</button>
          <button class="btn main big" type="button" data-url="${esc(u.url || REPO_URL + "/releases/latest")}">Download</button>
          <div class="note">Download the installer and run it, then close and reopen the Cueline panel.</div>${u.error ? `<div class="note">${esc(u.error)}</div>` : ""}</div>`
      : `<div class="upd current"><div class="upd-head"><span class="v">${checking ? "Checking…" : u && u.error && !u.latest ? "Couldn’t check" : "You’re up to date"}</span><span class="have">version ${VERSION}</span></div>
          ${!checking && u && u.error ? `<div class="note">${esc(u.error)}</div>` : ""}</div>`;
    const auto = S.updateAuto !== false;
    el.innerHTML = head("Updates", `<button class="btn small" type="button" data-act="updcheck" ${checking ? "disabled" : ""}>Check now</button>`) + `<div class="screen-body">${card}
      <div class="kvs"><div class="kv"><span>Check automatically</span><button class="link" type="button" data-act="updauto" aria-label="Check automatically: ${auto ? "once a day" : "off"}. Click to turn ${auto ? "off" : "on"}">${auto ? "once a day" : "off"}</button></div>
      <div class="kv"><span>Last checked</span><span class="mono-s">${u && u.checkedAt ? whenLabel(u.checkedAt) : "not yet"}</span></div>
      <div class="kv"><button class="link" type="button" data-url="${REPO_URL}/releases">See all release notes</button><span></span></div></div>
      <div class="spacer"></div><div class="sfoot">Updates come only from the official Cueline release on GitHub.</div></div>`;
  }
  function whenLabel(t) {
    const m = Math.round((Date.now() - t) / 60000);
    return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : new Date(t).toLocaleDateString();
  }
  async function checkUpdate(force) {
    if (S.updateAuto === false && !force) return;
    S.updateChecking = true; if (S.overlay === "update") renderScreen();
    const r = await Host.checkUpdate(VERSION, force);
    S.updateChecking = false; S.update = r;
    if (r && r.error) log("Update check: " + r.error); else if (r) log(`Update check: latest ${r.latest}${r.updateAvailable ? ", update ready" : ""}`);
    renderFoot(); if (S.overlay === "update" || S.overlay === "menu") renderScreen();
  }

  /* Check Cueline: everything a transcription needs, failures first with what to do. */
  async function runChecks() {
    const st = Host.engine.engineStatus(Host.extRoot), sys = Host.sysInfo(), models = installedModels();
    const checks = [];
    checks.push(st.ok ? { ok: true, label: "Engine", text: `whisper.cpp ready · ${st.gpu}` } : { ok: false, label: "Engine", text: "The transcription engine is missing from " + tilde(st.bin || Host.extRoot) + ". Reinstall Cueline." });
    checks.push(models.length ? { ok: true, label: "Models", text: models.map((m) => m.label).join(", ") } : { ok: false, label: "Models", text: "No model is downloaded yet. Get one to transcribe.", fix: ["models", "Get a model"] });
    checks.push(st.vad ? { ok: true, label: "Skip silence", text: "Silence model ready" } : { ok: false, label: "Skip silence", text: "The silence model isn't downloaded. Cueline gets it on the next transcription, or now.", fix: ["vad", "Get it"] });
    const sp = Host.engine.speakerStatus ? Host.engine.speakerStatus(Host.extRoot) : { ok: false };
    checks.push(!sp.ok ? { ok: false, label: "Speakers by voice", text: "Speaker detection isn't installed with this copy of Cueline. Reinstall it, or use speakers by track." }
      : sp.models ? { ok: true, label: "Speakers by voice", text: "Speaker detection ready" } : { ok: false, label: "Speakers by voice", text: "The voice models (34 MB) aren't downloaded. Cueline gets them on the first run by voice, or now.", fix: ["spk", "Get them"] });
    const ping = await Host.ping();
    checks.push(ping.ok ? { ok: true, label: "Premiere Pro", text: `Scripts run (${hostLabel()}, ${ping.app})` } : { ok: false, label: "Premiere Pro", text: "Cueline can't talk to Premiere Pro: " + (ping.error || "no answer") + ". Close and reopen the panel." });
    const info = S.info;
    checks.push(info ? { ok: true, label: "Sequence", text: `${info.name} · ${info.fps} fps · ${plural(info.audio.filter((a) => a.clips).length, "audio track")} with clips` } : { ok: false, label: "Sequence", text: S.infoError || "No sequence is open. Open one in Premiere Pro." });
    checks.push(sys.presetOk ? { ok: true, label: "Audio export", text: "Export preset found" } : { ok: false, label: "Audio export", text: "The audio export preset is missing. Reinstall Cueline." });
    checks.push(sys.tmpWritable ? { ok: true, label: "Temporary files", text: "The temporary folder is writable" } : { ok: false, label: "Temporary files", text: "Cueline can't write to " + tilde(sys.tmp) + ". Check the folder's permissions." });
    return checks;
  }
  function drawChecks(el, head) {
    const c = S.checks;
    const again = `<button class="btn small" type="button" data-act="rerun" ${c ? "" : "disabled"}>Run again</button>`;
    if (!c) { el.innerHTML = head("Check Cueline", again) + '<div class="screen-body"><div class="intro">Checking…</div></div>'; return; }
    const passed = c.list.filter((x) => x.ok).length, failed = c.list.length - passed;
    const mono = (t) => esc(t).replace(/(~\/[^\s,;·]+|\b\d+(?:\.\d+)+\b)/g, '<span class="mono">$1</span>');
    el.innerHTML = head("Check Cueline", again) + `<div class="screen-body">
      <div class="tsum"><div class="tsum-title"><span class="mono">${passed}</span> of <span class="mono">${c.list.length}</span> checks passed</div><span class="mono-s">${failed ? failed + " to fix" : "Nothing to fix"} · checked ${new Date(c.at).toTimeString().slice(0, 5)}</span></div>
      ${c.list.filter((x) => !x.ok).map((x) => `<div class="check bad"><span class="g g-failed" role="img" aria-label="Failed"></span><div class="cbody"><div class="chead"><span class="clabel">${esc(x.label)}</span><span class="st st-failed">Failed</span></div><span class="cmain">${mono(x.text)}</span>${x.fix ? `<button class="btn small main" type="button" data-checkfix="${x.fix[0]}">${esc(x.fix[1])}</button>` : ""}</div></div>`).join("")}
      ${c.list.filter((x) => x.ok).map((x) => `<div class="check" title="${esc(x.label + ": " + x.text)}"><span class="g g-verified" role="img" aria-label="Passed"></span><span class="ctext"><span class="clabel-s">${esc(x.label)} · </span>${mono(x.text)}</span><span class="st st-verified">Passed</span></div>`).join("")}
    </div>`;
  }
  async function openChecks(parent) {
    S.checks = null; openScreen("test", parent);
    const token = screenToken, list = await runChecks();
    still(token, () => { S.checks = { list, at: Date.now() }; renderScreen(); })();
  }

  // Copy diagnostics: what someone helping needs, nothing private beyond folder names.
  async function copyDiagnostics(btn) {
    const st = Host.engine.engineStatus(Host.extRoot), sys = Host.sysInfo(), ping = await Host.ping();
    const sp = Host.engine.speakerStatus ? Host.engine.speakerStatus(Host.extRoot) : {};
    const lines = [
      `Cueline Captions ${VERSION} · ${new Date().toISOString()}`,
      `Host: ${ping.ok ? `Premiere Pro ${ping.app} (build ${ping.build || "?"})` : "not answering: " + ping.error}`,
      `System: ${sys.os} · CEP Node ${sys.node}`,
      `Extension: ${tilde(sys.extRoot)}`, `Data: ${tilde(sys.dataDir)}`, `Models: ${tilde(sys.modelsDir)}`,
      `Engine: ${st.ok ? "ready" : "missing"} · ${st.gpu || ""} · silence model ${st.vad ? "yes" : "no"} · speakers ${sp.ok ? (sp.models ? "ready" : "models missing") : "not installed"}`,
      `Installed models: ${installedModels().map((m) => m.label).join(", ") || "none"}`,
      `Settings: ${langName(S.lang)} · ${(currentModel() || {}).label || "?"} · ${spec().name} · speakers ${S.speakerMode}${S.speakerMode === "voice" ? " (" + (S.speakerCount || "auto") + ")" : ""} · fillers ${S.fillerMode} · ${Object.entries(S.opts).filter(([, v]) => v).map(([k]) => k).join(", ")}`,
      `Sequence: ${S.info ? `${S.info.name} · ${S.info.fps} fps · ${dur(S.info.outSec - S.info.inSec)}${S.info.hasInOut ? " In/Out" : ""}` : S.infoError || "none"}`,
      `Update check: ${S.update ? (S.update.error ? S.update.error : `latest ${S.update.latest}`) + " · " + whenLabel(S.update.checkedAt) : "not yet"}`,
      "", "Recent log:", ...S.log.slice(-20).map(tilde),
    ];
    Host.copy(lines.join("\n"));
    if (btn) { const chev = btn.querySelector(".chev"); if (chev) { chev.className = "st st-verified"; chev.textContent = "Copied"; setTimeout(() => { chev.className = "chev"; chev.textContent = ""; }, 2000); } }
    else toast("Diagnostics copied: paste them in a bug report or a chat.");
  }

  // Premiere Pro's own panel menu (the ≡ next to the panel's tab) with the same choices as ☰.
  function setFlyout() {
    const item = (id, label) => `<MenuItem Id="${id}" Label="${label}" Enabled="true"/>`, sep = '<MenuItem Label="---"/>';
    Host.setFlyout("<Menu>" + item("batch", "Transcribe several sequences…") + item("history", "History…") + sep + item("style", "Caption style and glossary…") + item("models", "Models…") + sep +
      item("test", "Check Cueline") + item("diag", "Copy diagnostics") + sep + item("update", "Check for updates…") + item("about", "About and help…") + "</Menu>");
  }
  function onFlyout(id) {
    if (id === "batch") return openBatch();
    if (id === "diag") return copyDiagnostics();
    if (id === "test") return openChecks();
    if (id === "update") { openScreen("update"); return checkUpdate(true); }
    if (["history", "style", "models", "about"].includes(id)) openScreen(id);
  }

  function num(key, label, val, sub, ro) {
    return `<div class="kv"><span>${esc(label)}${sub ? `<span class="ks">${esc(sub)}</span>` : ""}</span><input class="input num" data-spec="${key}" aria-label="${esc(label)}" value="${val}" inputmode="decimal" ${ro}></div>`;
  }
  function dlBar(dl) {
    const pct = dl.total ? dl.got / dl.total : 0;
    return `<div class="pbar" role="progressbar" aria-valuenow="${Math.round(pct * 100)}" aria-valuemin="0" aria-valuemax="100" aria-label="Download progress"><div style="width:${(pct * 100).toFixed(1)}%"></div></div>
      <div class="lm">${(dl.got / 1e9).toFixed(1)} of ${(dl.total / 1e9).toFixed(1)} GB · ${(dl.speed / 1e6).toFixed(0)} MB/s${dl.speed && dl.total ? ` · about ${dur((dl.total - dl.got) / dl.speed)}` : ""}</div>`;
  }

  /* ---------- menus ---------- */
  function openMenu(anchor, items) {
    const m = $("#menu");
    m.innerHTML = items.map((it) => (it === "-" ? "<hr>" : `<button type="button" role="menuitem" data-menu="${it[0]}"><span>${esc(it[1])}</span><span class="mono-s">${esc(it[2] || "")}</span></button>`)).join("");
    m.hidden = false;
    const r = anchor.getBoundingClientRect();
    m.style.right = Math.max(8, window.innerWidth - r.right) + "px";
    if (r.top > window.innerHeight / 2) { m.style.top = ""; m.style.bottom = window.innerHeight - r.top + 4 + "px"; }
    else { m.style.bottom = ""; m.style.top = r.bottom + 4 + "px"; }
    const first = m.querySelector("button"); if (first) first.focus();
  }
  function closeMenu() { $("#menu").hidden = true; }

  /* ---------- render ---------- */
  function render() {
    renderHead();
    if (S.screen === "main") { if (document.activeElement && document.activeElement.id === "lang") return renderFoot(); renderMain(); }
    else if (S.screen === "working") renderWorking();
    else if (S.screen === "batchdone") renderBatchDone();
    else if (S.screen === "review") {
      // Never redraw the list under someone who is typing in it.
      const a = document.activeElement;
      if (a && ((a.dataset && a.dataset.edit) || (a.classList && a.classList.contains("spkname"))) && $("#view").contains(a)) { renderHead(); return; }
      renderReview();
    }
    renderFoot();
  }

  /* ---------- sequence ---------- */
  async function refresh() {
    const r = await Host.info();
    if (!r.ok) { S.info = null; S.infoError = r.error; log(r.error); }
    else {
      const changed = !S.info || S.info.id !== r.id;
      S.info = r; S.infoError = null;
      if (changed || !S.tracks) S.tracks = r.audio.filter((a) => !a.muted && a.clips > 0).map((a) => a.index);
      if (!S.tracks.length) S.tracks = r.audio.map((a) => a.index);
    }
    if (S.screen === "main") render();
  }

  /* ---------- the job ---------- */
  // Captions timed from the audio when the envelope is known (see Cues.snapToSpeech).
  function timed(cues) { return S.env ? Cues.snapToSpeech(cues, S.env, spec()) : cues; }

  function prep(ws) {
    let w = ws;
    if (S.fillerMode === "remove") w = Cues.removeFillers(w, S.lang).words;
    else if (S.fillerMode === "mark") w = Cues.markFillers(w, S.lang);
    return Cues.applyGlossary(w, S.glossary).words;
  }

  /* Who speaks when, by voice. With a set number of people a short blip can take one of the slots,
   * so it asks for one or two more and folds the blips away (Cues.tidyTurns). Never throws: without
   * speakers the captions are still fine. */
  async function findSpeakers(audio) {
    try {
      const E = Host.engine;
      if (!E.speakerStatus(Host.extRoot).models) {
        log("Getting the speaker models (about 34 MB)…");
        await E.ensureSpeakerModels();
      }
      const want = S.speakerCount, t0 = Date.now();
      let turns = [];
      for (let extra = 0; extra <= (want ? 2 : 0); extra++) {
        const job = E.diarize({ extRoot: Host.extRoot, audio, count: want ? want + extra : 0 }, { onLog: log });
        if (S.job) S.job.diar = job;
        const r = await job.promise;
        if (r.stopped) return null;
        turns = Cues.tidyTurns(r.turns, want);
        if (!want || new Set(turns.map((t) => t.spk)).size >= want) break;
      }
      const n = new Set(turns.map((t) => t.spk)).size;
      log(`Speakers by voice: ${n} found in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
      S.speakers = n > 1 ? Array.from({ length: n }, (_, k) => `Speaker ${k + 1}`) : null;
      return n > 1 ? turns : null;
    } catch (e) {
      log("No speakers by voice: " + e.message);
      return null;
    }
  }

  /* ---------- batch: several sequences, one after another ----------
   * Each sequence is opened in Premiere Pro, read like a refresh, and run through go() with the
   * main screen's settings. The results screen opens any of them in review. */
  async function openBatch() {
    const r = await Host.listSequences();
    if (!r.ok) return toast(r.error, true);
    S.batchList = r.sequences;
    S.batchPick = new Set(r.sequences.filter((x) => x.audioTracks).map((x) => x.id));
    openScreen("batch");
  }
  async function runBatch() {
    const ids = S.batchList.filter((x) => S.batchPick.has(x.id)).map((x) => x.id);
    closeScreen();
    S.batch = { ids, i: 0, results: [], stopped: false };
    for (let i = 0; i < ids.length && !S.batch.stopped; i++) {
      S.batch.i = i;
      const meta = S.batchList.find((x) => x.id === ids[i]);
      const open = await Host.openSequence(ids[i]);
      if (!open.ok) { S.batch.results.push({ id: ids[i], name: meta.name, error: open.error }); continue; }
      S.info = null; S.tracks = null;
      await refresh();
      if (!S.info) { S.batch.results.push({ id: ids[i], name: meta.name, error: S.infoError || "Could not read the sequence." }); continue; }
      const res = await go({ batch: true });
      S.batch.results.push({ id: ids[i], name: meta.name, ...res });
    }
    S.batch.done = true; S.job = null;
    S.screen = "batchdone";
    render();
    const okN = S.batch.results.filter((x) => x.ok).length;
    toast(`${okN} of ${ids.length} sequences have captions.`, okN < ids.length);
  }
  function renderBatchDone() {
    const b = S.batch;
    $("#view").className = "view";
    $("#view").innerHTML = `<section class="sec"><div class="sec-head"><span class="label">Batch finished</span><span class="mono-s">${b.results.filter((x) => x.ok).length} of ${b.ids.length} done${b.stopped ? " · stopped" : ""}</span></div></section>
      <div class="list" role="list">${b.results.map((x, k) => `<div class="lrow brow" role="listitem">
        <span class="g g-sm ${x.ok ? (x.toReview ? "g-changed" : "g-verified") : "g-failed"}" aria-hidden="true"></span>
        <span style="min-width:0;flex:1"><span class="lt" style="display:block">${esc(x.name)}</span><span class="lm" style="display:block">${x.ok ? `${plural(x.count, "caption")} · ${x.toReview} to review${x.speakers ? " · " + plural(x.speakers, "speaker") : ""} · ${x.placed ? "placed" : "not placed"}` : esc(x.error || "Failed")}</span></span>
        ${x.ok ? `<button class="btn small" type="button" data-bopen="${k}">Review</button>` : ""}</div>`).join("")}
        ${b.stopped ? b.ids.slice(b.results.length).map((id) => `<div class="lrow brow off"><span class="g g-sm g-pending" aria-hidden="true"></span><span class="lt">${esc((S.batchList.find((x) => x.id === id) || {}).name || id)}</span><span class="lm">not started</span></div>`).join("") : ""}</div>
      <div class="go" style="padding:12px"><button class="btn" type="button" data-act="batchback">Back to settings</button></div>`;
  }
  async function openBatchResult(k) {
    const x = S.batch.results[k]; if (!x || !x.job) return;
    const r = await Host.openSequence(x.id);
    if (!r.ok) return toast(r.error, true);
    await refresh();
    const j = x.job;
    Object.assign(S, { cues: j.cues, offset: j.offset, env: j.env, speakers: j.speakers, placed: j.placed, placedCues: j.cues, dirty: false, job: null, selected: null, filter: "all", screen: "review" });
    undoStack.length = 0; redoStack.length = 0;
    render();
  }

  async function go(opts) {
    opts = opts || {};
    const model = currentModel();
    if (!model || !S.info) return;
    S.cues = []; S.selected = null; S.filter = "all"; S.find = ""; S.placed = null; S.dirty = false; undoStack.length = 0; redoStack.length = 0; S.autoNote = null;
    let stream = new Cues.Stream(spec(), prep);
    S.job = { running: true, stage: 0, progress: 0, phase: "Exporting audio…", startedAt: Date.now(), stream, model };
    // The progress screen while it works; the review screen opens with the finished captions.
    S.screen = "working";
    render();
    const tick = setInterval(() => { if (S.job && S.job.running) render(); }, 1000);

    try {
      const t0 = Date.now();
      const exp = await Host.exportAudio(S.tracks);
      if (!exp.ok) throw new Error(exp.error);
      S.job.exportSecs = Math.max(1, Math.round((Date.now() - t0) / 1000));
      S.job.audioDur = exp.duration;
      S.offset = exp.inSec;
      S.audioPath = exp.path; // kept for the speech envelope
      log(`Exported ${dur(exp.duration)} of audio from A${S.tracks.map((t) => t + 1).join(", A")} to ${exp.path}`);

      // Speakers: each picked track exported alone and measured, so every word can go to the track
      // it is loudest on. Done before Whisper starts so captions split by speaker as they stream in.
      S.spkEnvs = null; S.speakers = null;
      if (S.speakerMode === "track" && S.tracks.length > 1 && Host.engine.speechEnvelope) {
        S.job.phase = "Reading each track…"; render();
        const envs = [];
        for (const t of S.tracks) {
          const e = await Host.exportAudio([t]);
          if (!e.ok) { log(`No speakers: exporting A${t + 1} alone failed: ${e.error}`); break; }
          try { envs.push(Host.engine.speechEnvelope(e.path)); } catch (err) { log(`No speakers: ${err.message}`); break; } finally { Host.removeTemp(e.path); }
        }
        if (envs.length === S.tracks.length) {
          S.spkEnvs = envs;
          S.speakers = S.tracks.map((t) => { const a = S.info && S.info.audio.find((x) => x.index === t); return a && a.name && !/^Audio \d+$/.test(a.name) ? a.name : `A${t + 1}`; });
          log(`Speakers: one per track, ${S.speakers.join(", ")}`);
        }
      }
      let lastSpk = null;
      // Speakers by voice: the diarizer runs beside Whisper on the same audio. Words that arrive before
      // it is done are tagged when its turns land (and the captions rebuilt, if nobody edited yet).
      const rawWords = [];
      let diar = null;
      if (S.speakerMode === "voice" && Host.engine.diarize && Host.engine.speakerStatus(Host.extRoot).ok) {
        S.job.spk = { done: false };
        diar = findSpeakers(exp.path).then((t) => { if (S.job) S.job.spk = { done: true, note: S.speakers ? `${S.speakers.length} speakers` : "one voice" }; return t; });
      }

      S.job.stage = 1; S.job.phase = "Transcribing…";
      const engineJob = Host.engine.transcribe({
        extRoot: Host.extRoot, audio: exp.path, model: model.id, language: S.lang, translate: S.opts.translate, vad: S.opts.vad,
        prompt: S.glossary.filter((g) => g.to).map((g) => g.to).join(", ") || undefined,
      }, {
        onWord: (w) => {
          if (S.spkEnvs) { w = { ...w, spk: Cues.speakerOf(w, S.spkEnvs, lastSpk) }; lastSpk = w.spk ?? lastSpk; }
          else if (S.turns) { w = { ...w, spk: Cues.speakerAtTurns(w, S.turns, lastSpk) }; lastSpk = w.spk ?? lastSpk; }
          rawWords.push(w);
          stream.push(w);
          stream.final = timed(stream.final);
          S.cues = stream.all();
          scheduleRender();
        },
        onProgress: (p) => { S.job.progress = p; S.job.phase = `Transcribing · ${Math.round(p * 100)}%`; scheduleRender(); },
        onLog: (l) => log(l),
      });
      S.job.engine = engineJob;
      // Read where speech really is while Whisper works; captions are timed from it.
      S.env = null;
      try { if (Host.engine.speechEnvelope) { const t1 = Date.now(); S.env = Host.engine.speechEnvelope(exp.path); log(`Speech envelope: ${S.env.db.length} frames in ${Date.now() - t1} ms`); S.job.speechSecs = Cues.speechFrames(S.env, {}).sp.reduce((a, b) => a + b, 0) * S.env.hop; } }
      catch (e) { log("No speech envelope, using Whisper's timing: " + e.message); }
      const applyTurns = (turns, ready) => {
        if (!turns || !S.job || S.job.stream !== stream) return;
        S.turns = turns;
        const tagged = ready || Cues.speakersFromTurns(rawWords, turns);
        lastSpk = tagged.length ? tagged[tagged.length - 1].spk : null;
        if (!stream.final.some((c) => c.edited)) {
          // Rebuild from the words so captions split where the speaker changes.
          const fresh = new Cues.Stream(spec(), prep);
          for (const w of tagged) fresh.push(w);
          fresh.final = timed(fresh.final);
          stream = fresh; S.job.stream = fresh;
          S.cues = stream.all();
        } else {
          const at = new Map(tagged.map((w) => [Math.round(w.start * 1000), w.spk]));
          const tag = (c) => ({ ...c, words: (c.words || []).map((w) => ({ ...w, spk: at.get(Math.round(w.start * 1000)) ?? w.spk })) });
          stream.final = stream.final.map(tag); stream.tail = stream.tail.map(tag);
          S.cues = stream.all();
        }
        rawWords.splice(0, rawWords.length, ...tagged);
        scheduleRender();
      };
      if (diar) diar.then(applyTurns);
      const res = await engineJob.promise;
      S.job.transcribed = true; scheduleRender();
      if (diar) {
        S.job.phase = "Telling speakers apart…"; scheduleRender();
        await diar;
        // Once more with every word: speaker changes settle on sentence ends (Cues.speakersFromTurns),
        // then each sentence is checked against the speakers' voice prints (Cues.refineSpeakers).
        if (S.turns && !res.stopped) {
          let tagged = Cues.speakersFromTurns(rawWords, S.turns);
          if (Host.engine.voiceprints) {
            try {
              const t1 = Date.now(), spans = Cues.sentenceSpans(tagged);
              const prints = await Host.engine.voiceprints({ extRoot: Host.extRoot, audio: exp.path, spans });
              const refined = Cues.refineSpeakers(tagged, spans, prints);
              const moved = spans.filter((sp) => refined[sp.i0].spk !== tagged[sp.i0].spk).length;
              log(`Speakers checked sentence by sentence in ${Date.now() - t1} ms: ${moved} moved`);
              tagged = refined;
              // Then each hand-over is timed by the voices, where they clearly disagree with Whisper.
              const t2 = Date.now(), centres = Cues.speakerCentres(refined, Cues.sentenceSpans(refined), prints);
              const cands = Cues.cutCandidates(refined);
              if (cands.length) {
                const p2 = await Host.engine.voiceprints({ extRoot: Host.extRoot, audio: exp.path, spans: cands.flatMap((c) => c.spans) });
                const cuts = Cues.bestCuts(cands, p2, centres);
                tagged = Cues.moveCuts(refined, cuts);
                log(`Speaker hand-overs timed by voice in ${Date.now() - t2} ms: ${cuts.map((c) => `${tc(refined[c.i].start + S.offset)} → ${tc(c.t + S.offset)}`).join(", ") || "none moved"}`);
              }
            } catch (e) { log("No sentence check: " + e.message); }
          }
          applyTurns(S.turns, tagged);
        }
      }
      if (Host.removeTemp(exp.path)) log("Removed the temporary audio export");

      S.job.stage = 2; S.job.phase = "Building captions…";
      if (S.lang === "auto") { S.detected = res.language; log("Detected language: " + res.language); }
      // Confidence arrives with the JSON at the end; copy it onto the words the captions hold.
      const pAt = new Map(res.words.map((w) => [Math.round(w.start * 1000), w.p]));
      stream.final = stream.final.map((c) => ({ ...c, words: (c.words || []).map((w) => ({ ...w, p: c.edited ? 1 : pAt.get(Math.round(w.start * 1000)) ?? w.p })) }));
      S.cues = timed(stream.finish().map((c) => ({ ...c, words: (c.words || []).map((w) => ({ ...w, p: c.edited ? 1 : pAt.get(Math.round(w.start * 1000)) ?? w.p })) })));
      S.job.stage = 3; S.job.running = false; S.job.progress = 1;
      S.spkEnvs = null; S.turns = null;
      if (S.speakers) {
        const heard = new Set(); for (const c of S.cues) for (const w of c.words || []) if (w.spk != null) heard.add(w.spk);
        if (heard.size < 2) { log("Speakers: only one track had speech, no speaker tags"); S.speakers = null; }
      }
      const el = (Date.now() - S.job.startedAt) / 1000;
      log(`${res.stopped ? "Stopped" : "Transcribed"} ${dur(exp.duration)} in ${dur(el)} · ${(exp.duration / el).toFixed(1)}× real time · ${res.words.length} words · ${S.cues.length} captions`);
      const fixedN = S.opts.autofix && S.cues.length ? autoFix(null, true) : 0;
      if (S.opts.cuts && S.cues.length) await snapCuts(true);
      saveHistory();
      if (opts.batch) {
        if (!res.stopped && S.cues.length) await place();
        if (res.stopped && S.batch) S.batch.stopped = true;
        const sum = Cues.summary(S.cues, spec());
        return { ok: S.cues.length > 0, error: S.cues.length ? null : "No speech found.", count: sum.count, toReview: sum.toReview, speakers: S.speakers ? S.speakers.length : 0, placed: !!S.placed,
          job: { cues: S.cues, offset: S.offset, env: S.env, speakers: S.speakers, placed: S.placed } };
      }
      S.screen = "review";
      if (!res.stopped && S.cues.length) await place();
      else toast(res.stopped ? `Stopped. ${S.cues.length} captions kept.` : `${S.cues.length} captions from ${dur(exp.duration)} of audio, in ${dur(el)}.${S.lang === "auto" && S.detected ? ` Detected ${langName(S.detected)}.` : ""}`);
    } catch (e) {
      log("Error: " + e.message);
      if (S.job) S.job.running = false;
      if (opts.batch) return { ok: false, error: e.message };
      if (!S.cues.length) S.screen = "main";
      toast(e.message, true);
    } finally {
      clearInterval(tick);
      render();
    }
  }

  let renderQueued = false;
  function scheduleRender() {
    if (renderQueued) return; renderQueued = true;
    requestAnimationFrame(() => { renderQueued = false; render(); });
  }

  function stop() {
    if (S.batch && !S.batch.done) S.batch.stopped = true;
    if (S.job && S.job.engine) S.job.engine.stop();
    if (S.job && S.job.diar) S.job.diar.stop();
  }

  function saveHistory() {
    try {
      Host.history.save({ meta: { seq: S.info ? S.info.name : "", when: new Date().toLocaleString(), count: S.cues.length, lang: S.lang, placed: !!S.placed, offset: S.offset, preset: S.preset }, cues: S.cues.map(({ id, start, end, text, words }) => ({ id, start, end, text, words })), offset: S.offset, speakers: S.speakers || null, env: S.env ? { hop: S.env.hop, db: S.env.db.map((d) => Math.round(d)) } : null });
    } catch (e) { log("History not saved: " + e.message); }
  }

  /* ---------- edits, with undo ----------
   * Every change to the captions records the list before it (up to 100 steps). Not while Whisper is
   * still writing: restoring an older list then would drop captions that arrived since. */
  const undoStack = [], redoStack = [];
  function remember(label) {
    if (S.job && S.job.running) return;
    undoStack.push({ cues: S.cues, label }); if (undoStack.length > 100) undoStack.shift();
    redoStack.length = 0;
  }
  function markDirty() { S.dirty = !!S.placed && S.cues !== S.placedCues; }
  function undoRedo(from, to, verb) {
    if (S.job && S.job.running) return toast("Undo is available when transcription finishes.", true);
    const step = from.pop(); if (!step) return toast(`Nothing to ${verb.toLowerCase()}.`);
    to.push({ cues: S.cues, label: step.label });
    S.cues = step.cues; markDirty(); render();
    toast(`${verb === "Undo" ? "Undid" : "Redid"}: ${step.label}.`);
  }
  const undo = () => { S.autoNote = null; undoRedo(undoStack, redoStack, "Undo"); };
  const redo = () => undoRedo(redoStack, undoStack, "Redo");

  function setCues(next, why) {
    remember(why || "Edit");
    S.cues = timed(next);
    if (S.job && S.job.stream && S.job.running) {
      // Keep the stream's frozen part in step with edits made during transcription.
      const tail = new Set(S.job.stream.tail.map((c) => c.id));
      S.job.stream.final = next.filter((c) => !tail.has(c.id));
    }
    markDirty();
    if (why) log(why);
    render();
  }

  let editTimer = null;
  function commitEdit(el) {
    const id = el.dataset.edit;
    const text = el.innerText.replace(/ /g, " ").replace(/\n{2,}/g, "\n").trim();
    const c = S.cues.find((x) => x.id === id);
    if (!c || c.text === text) return;
    remember("Text edit");
    S.cues = Cues.editText(S.cues, id, text);
    if (S.job && S.job.stream && S.job.running) S.job.stream.final = S.job.stream.final.map((x) => (x.id === id ? S.cues.find((y) => y.id === id) : x));
    if (S.placed && !S.dirty) { markDirty(); renderHead(); const b = $("[data-act=place]"); if (b) { b.disabled = false; b.textContent = placeLabel(false); } const d = $(".dest span"); if (d) d.textContent = destLine(false); return; }
    renderHead();
  }

  // Split where the text cursor is. A cursor inside a word keeps the word whole in the second part.
  function splitAtCaret(el) {
    const id = el.dataset.edit;
    const sel = window.getSelection(); if (!sel.rangeCount) return;
    const r = document.createRange(); r.selectNodeContents(el); r.setEnd(sel.getRangeAt(0).startContainer, sel.getRangeAt(0).startOffset);
    const before = r.toString();
    commitEdit(el);
    const c = S.cues.find((x) => x.id === id); if (!c) return;
    const toks = before.split(/\s+/).filter(Boolean);
    const midWord = before.length && !/\s$/.test(before) && el.innerText.charAt(before.length).trim() !== "";
    const k = toks.length - (midWord ? 1 : 0);
    if (k < 1 || k >= (c.words || []).length) return toast("Put the cursor between two words to split there.");
    setCues(Cues.splitAtWord(S.cues, id, k, spec()), "Split at cursor");
    S.selected = id; renderReview();
  }

  // Fix what can be fixed, tag the captions it changed, and keep one undo step for all of it.
  function autoFix(label, quiet) {
    const before = S.cues;
    const pv = Cues.fixPreview(before, spec(), timed);
    if (!pv.solved) { if (label) toast("Nothing left that a fix can solve."); return 0; }
    const old = new Map(before.map((c) => [c.id, c]));
    const next = pv.cues.map((c) => {
      const o = old.get(c.id);
      if (o && o.text === c.text && o.start === c.start && o.end === c.end) return c;
      const was = o ? (o.text !== c.text ? "was merged or split" : `was ${(o.end - o.start).toFixed(1)} s, ${Math.round(Cues.cps(o))} cps`) : "new, from a split";
      return { ...c, autofixed: was };
    });
    remember(label || "Automatic fixes");
    S.cues = next; markDirty();
    S.autoNote = { changed: next.filter((c) => c.autofixed).length, from: before.length, to: next.length, solved: pv.solved, left: pv.left };
    log(`${label || "Automatic fixes"}: solved ${pv.solved}, ${pv.left} left; ${before.length} → ${next.length} captions`);
    if (!quiet) { toast(`Fixed ${plural(pv.solved, "problem")} automatically${pv.left ? `; ${pv.left} still need you` : ""}. U undoes it.`); render(); }
    return pv.solved;
  }

  function applyFix(kind, id, word) {
    const sp = spec();
    if (kind === "split") setCues(Cues.fixSplit(S.cues, id, sp), "Split " + id);
    else if (kind === "extend") setCues(Cues.fixExtend(S.cues, id, sp), "Extended " + id);
    else if (kind === "merge") setCues(Cues.fixMerge(S.cues, id, sp), "Merged " + id);
    else if (kind === "spkalt") { const [from, alt] = String(word).split(":").map(Number); setCues(Cues.setSpeaker(S.cues, id, from, alt, sp), `Said by ${S.speakers ? S.speakers[alt] : alt + 1}`); }
    else if (kind === "spkok") setCues(Cues.confirmSpeaker(S.cues, id), "Speaker confirmed");
    else if (kind === "glossary") {
      S.glossary.push({ from: word || "", to: word || "" }); persist();
      S.cues = S.cues.map((c) => (c.id === id ? { ...c, words: (c.words || []).map((w) => ({ ...w, p: 1 })) } : c));
      openScreen("style");
    }
  }

  /* ---------- shot changes ----------
   * Reads where the picture cuts now (the edit may have changed since the last time) and moves
   * caption edges onto the cuts near them. One undo step. Returns how many captions moved. */
  async function snapCuts(quiet) {
    const r = await Host.cuts();
    if (!r.ok) { log("Cuts: " + r.error); if (!quiet) toast(r.error, true); return 0; }
    S.cuts = r.cuts.map((k) => k - S.offset);
    const before = S.cues, next = Cues.snapToCuts(before, S.cuts, spec());
    const moved = next.filter((c, k) => c.start !== before[k].start || c.end !== before[k].end).length;
    log(`Cuts: ${r.cuts.length} in the sequence, ${moved} captions moved onto them`);
    if (moved) { remember("Snap to cuts"); S.cues = next; markDirty(); }
    if (!quiet) { toast(moved ? `Moved ${plural(moved, "caption")} onto the cuts. U undoes it.` : r.cuts.length ? "Every caption already clears the cuts." : "No cuts in this sequence."); render(); }
    return moved;
  }

  /* ---------- place and export ---------- */
  function srt(list) { return Cues.toSRT(list || S.cues, { offset: S.offset, rtlFix: isRtlLang() && S.opts.rtlFix }); }

  // Place the captions on a new caption track. Premiere Pro's scripting can create a caption track
  // but not edit or delete one, so an update after edits adds a new track.
  let placing = false;
  async function place() {
    if (placing) return;
    placing = true;
    try {
      const again = !!S.placed;
      const placedCues = S.cues;
      // One track per speaker: Premiere Pro puts each new caption track on top, so placing in order
      // leaves Speaker 1 at the bottom and the last speaker on top. Scripts can't name caption
      // tracks, so the toast says which is whose.
      const lists = S.speakers && S.opts.speakerTracks && S.speakerMode !== "off"
        ? Cues.splitBySpeaker(placedCues, spec(), S.speakers.length).map((list, k) => ({ list, name: S.speakers[k] || `Speaker ${k + 1}` })).filter((x) => x.list.length)
        : [{ list: placedCues, name: null }];
      for (const x of lists) {
        const p = Host.tempFile(`Cueline ${(S.info && S.info.name) || "captions"}${x.name ? " " + x.name : ""} ${Date.now()}.srt`.replace(/[\/\\:*?"<>|]/g, "-"), srt(x.list));
        const r = await Host.placeCaptions(p, 0);
        Host.removeTemp(p); // the caption track keeps its own copy
        if (!r.ok) return toast(r.error, true);
        log(`Placed ${x.list.length} captions${x.name ? " for " + x.name : ""} from ${p}`);
      }
      S.placed = { at: Date.now() }; S.placedCues = placedCues; S.dirty = S.cues !== placedCues;
      saveHistory();
      if (lists.length > 1) toast(`${again ? "Updated the timeline" : "Placed"}: ${lists.length} caption tracks, bottom to top ${lists.map((x) => x.name).join(", ")}.`);
      else toast(again ? `Updated the timeline: ${placedCues.length} captions on a new caption track.` : `Placed ${placedCues.length} captions on a caption track at ${tc(S.offset)}.`);
      render();
    } finally { placing = false; }
  }

  // A small picture of a look: three words, the second one being spoken.
  function lookPreview(v, rtl) {
    const k = 0.18, words = rtl ? ["ככה", "נראות", "הכתוביות"] : ["This", "is", "how"];
    const up = v["Text case"] === 2 ? "text-transform:uppercase;" : "";
    const ow = v["Outline width"] * k, oc = v["Outline colour"];
    const outline = ow > 0 ? [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]].map(([x, y]) => `${(x * ow).toFixed(1)}px ${(y * ow).toFixed(1)}px 0 ${oc}`) : [];
    const sh = v["Shadow"] ? [`${(v["Shadow · Distance"] * k * 0.7).toFixed(1)}px ${(v["Shadow · Distance"] * k * 0.7).toFixed(1)}px ${(v["Shadow · Softness"] * k).toFixed(1)}px ${v["Shadow · Colour"]}${Math.round(v["Shadow · Opacity"] * 2.55).toString(16).padStart(2, "0")}`] : [];
    const ts = outline.concat(sh).join(",") || "none";
    const spk = v["Spoken word · Speaker 1"], style = v["Spoken word · Style"];
    const said = v["Said words"] === 2 ? spk : v["Said words"] === 3 ? v["Said words · Colour"] : v["Text colour"];
    const spoken = style === 2 ? `color:${v["Spoken word · Text on box"]};background:${spk};` : style === 3 ? `color:${spk};background:${v["Spoken word · Box colour"]};` : `color:${spk};`;
    const pad = style === 1 ? "" : `padding:0 ${Math.max(2, v["Spoken word · Box padding"] * k).toFixed(1)}px;border-radius:${(v["Spoken word · Box roundness"] * k).toFixed(1)}px;text-shadow:none;`;
    const bg = v["Background"] ? `background:${v["Background · Colour"]}${Math.round(v["Background · Opacity"] * 2.55).toString(16).padStart(2, "0")};border-radius:${(v["Background · Roundness"] * k).toFixed(1)}px;padding:2px ${(v["Background · Padding"] * k).toFixed(1)}px;` : "";
    const tilt = v["Random tilt"] ? `transform:rotate(${-v["Random tilt"] * 0.6}deg);` : "";
    return `<span class="lprev" aria-hidden="true"><span class="lcap" dir="${rtl ? "rtl" : "ltr"}" style="color:${v["Text colour"]};${up}letter-spacing:${(v["Letter spacing"] * 3 / 1000).toFixed(3)}em;text-shadow:${ts};${bg}${tilt}font-size:${(15 * v["Size"] / 50).toFixed(1)}px">` +
      `<span style="color:${said}">${words[0]}</span> <span style="${spoken}${pad}display:inline-block;margin:0 ${(v["Spoken word · Grow"] / 250).toFixed(2)}em;transform:scale(${1 + v["Spoken word · Grow"] / 100})">${words[1]}</span> <span style="opacity:${Math.max(0.12, v["Upcoming words · Opacity"] / 100)}">${words[2]}</span></span></span>`;
  }

  /* How much wider a font sets text than the template's Arial Bold, measured here in the panel (fonts
   * are found by their PostScript name, which is what Premiere Pro stores). Premiere Pro draws a
   * changed font itself, so the template scales its box behind the spoken word by this. */
  async function fontRatio(ps, rtl) {
    if (!ps || ps === "Arial-BoldMT" || typeof FontFace === "undefined") return 1;
    try {
      const fam = "cl-m-" + ps.replace(/[^A-Za-z0-9]/g, "");
      const face = new FontFace(fam, `local("${ps.replace(/"/g, "")}")`), base = new FontFace("cl-base", 'local("Arial-BoldMT"), local("Arial Bold")');
      await Promise.all([face.load(), base.load()]);
      document.fonts.add(face); document.fonts.add(base);
      const ctx = document.createElement("canvas").getContext("2d");
      const sample = rtl ? "הרגשתי פחד וחוסר אונים, במצב שאין אף אחד ששומר עליך" : "The quick brown fox jumps over the lazy dog, 2026";
      ctx.font = `100px "${fam}"`; const a = ctx.measureText(sample).width;
      ctx.font = '100px "cl-base"'; const b = ctx.measureText(sample).width;
      return a > 0 && b > 0 ? Math.round((a / b) * 1000) / 1000 : 1;
    } catch (e) { log(`Font ${ps}: could not measure it here (${e.message || e}); the word box uses the template font's widths`); return 1; }
  }

  async function copyLook() {
    const schema = Object.keys(Looks.CONTROLS).filter((n) => n !== "Position").map((n) => ({ name: n, type: Looks.CONTROLS[n] }));
    const f = await Host.selectedFont();
    if (!f.ok) return toast(f.error, true);
    const ratio = await fontRatio(f.font, isRtlLang());
    if (f.font) log(`Copy look: font ${f.font} ${f.size || ""}, ${ratio}× as wide as the template font`);
    const r = await Host.copyLook(schema, ratio);
    log(r.ok ? `Copied a look to ${r.copied} animated captions (${r.controls} controls and the font)` : "Copy look: " + r.error);
    toast(r.ok ? (r.copied ? `Copied the look to ${plural(r.copied, "caption")}.` : "No other animated captions on that track.") : r.error, !r.ok);
  }

  /* Animated captions: one graphic per caption on a new video track, the spoken word lit in its
   * speaker's colour. Looks, colours, font and position are set in Premiere Pro's Essential Graphics. */
  let animating = false;
  async function placeAnimated() {
    if (animating || !S.cues.length) return;
    animating = true;
    try {
      const list = S.cues.map((c) => {
        const b = Cues.wordBeats(c);
        return {
          start: c.start + S.offset, end: c.end + S.offset,
          text: c.text.replace(/^- /gm, "").replace(/\n/g, "\r"),
          timing: b.beats.map((x) => x.t.toFixed(2)).join(","),
          speakers: b.beats.map((x) => (S.speakers && x.spk != null ? x.spk : 0)).join(","),
        };
      });
      if (S.overlay === "animated") renderScreen();
      const look = Looks.forHost(Looks.lookValues(S.look));
      const t0 = Date.now(), r = await Host.placeAnimated(isRtlLang(), list, look);
      log(r.ok ? `Animated captions (${S.look}): ${r.placed} graphics on V${r.track} in ${((Date.now() - t0) / 1000).toFixed(1)} s${r.missing && r.missing.length ? "; the template has no " + r.missing.join(", ") : ""}` : "Animated captions: " + r.error);
      if (!r.ok) return toast(r.error, true);
      toast(`Placed ${plural(r.placed, "animated caption")} on V${r.track}. Change any part in Essential Graphics.`);
    } finally { animating = false; if (S.overlay === "animated") renderScreen(); }
  }

  function exportAs(kind) {
    const base = ((S.info && S.info.name) || "captions").replace(/[\/\\:*?"<>|]/g, "-");
    const o = { offset: S.offset, fps: (S.info && S.info.fps) || 25, rtlFix: isRtlLang() && S.opts.rtlFix };
    const out = {
      srt: [base + ".srt", () => Cues.toSRT(S.cues, o)],
      vtt: [base + ".vtt", () => Cues.toVTT(S.cues, o)],
      tc: [base + " transcript.txt", () => Cues.toTranscript(S.cues, { ...o, speakers: S.speakers })],
      txt: [base + ".txt", () => Cues.toPlain(S.cues)],
      docx: [base + " transcript.docx", () => producerDoc(o)],
    }[kind];
    if (!out) return;
    const p = Host.saveFile(out[0], out[1]());
    if (p) { log("Saved " + p); toast("Saved " + p.split(/[\\/]/).pop() + "."); }
  }

  // A Word transcript for producers: paragraphs by speaker with timecodes, right to left for Hebrew.
  function producerDoc(o) {
    const turns = Cues.transcriptTurns(S.cues);
    const names = S.speakers, who = (k) => (names && k != null ? names[k] || `Speaker ${k + 1}` : "");
    const span = S.cues.length ? S.cues[S.cues.length - 1].end - S.cues[0].start : 0;
    const meta = [`${tc(S.cues.length ? S.cues[0].start + S.offset : 0)} – ${tc(S.cues.length ? S.cues[S.cues.length - 1].end + S.offset : 0)}`, dur(span)];
    if (names) meta.push(plural(names.length, "speaker"));
    meta.push(langName(S.opts.translate ? "en" : spokenLang()));
    meta.push(new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }));
    return Docx.transcriptDocx({
      title: (S.info && S.info.name) || "Transcript", meta, rtl: isRtlLang(),
      turns: turns.map((t) => ({ tc: Cues.timecode(t.start + o.offset, o.fps), speaker: who(t.spk), text: t.text })),
      footer: "Transcribed on this computer with Cueline Captions",
    });
  }

  /* ---------- downloads ---------- */
  const downloads = {};
  function startDownload(id) {
    const job = Host.engine.downloadModel(id, (p) => {
      downloads[id] = { ...downloads[id], ...p };
      const box = document.getElementById("dl-" + id); if (box) box.innerHTML = dlBar(downloads[id]);
    });
    downloads[id] = { got: 0, total: 0, speed: 0, job };
    if (S.overlay === "models") renderScreen(); else render();
    job.promise.then(() => {
      delete downloads[id]; S.model = id; persist(); log("Downloaded " + id);
      toast("Model downloaded. It works offline from now on.");
    }).catch((e) => { delete downloads[id]; log("Download failed: " + e.message); if (e.message !== "Cancelled.") toast(e.message, true); })
      .finally(() => { if (S.overlay) renderScreen(); render(); });
    if (Host.engine.ensureVad) Host.engine.ensureVad().catch((e) => log("VAD model: " + e.message));
  }

  /* ---------- events ---------- */
  document.addEventListener("mousedown", (e) => {
    const tl = e.target.closest(".tline"); if (!tl || e.target.closest("button")) return;
    const r = tl.getBoundingClientRect(), t = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * tlSpan();
    Host.setPlayhead(t + S.offset); S.playhead = t + S.offset; userMoved = 0; onPlayhead();
  });
  document.addEventListener("click", async (e) => {
    const t = e.target.closest("button, [data-cue]");
    if (!$("#menu").hidden && !e.target.closest("#menu")) closeMenu();
    if (!t) return;
    const d = t.dataset;
    if (d.menu && /^spk/.test(d.menu)) { closeMenu(); return speakerMenuAction(d.menu); }
    if (d.spk != null && d.spk !== "" && d.id) { e.stopPropagation(); return speakerMenu(t, +d.spk, d.id); }
    if (d.menu) {
      closeMenu();
      ({ undo, redo, keys: () => openScreen("keys"), style: () => openScreen("style"), models: () => openScreen("models"), history: () => openScreen("history"), log: () => openScreen("log"), batch: () => openBatch(),
         srt: () => exportAs("srt"), vtt: () => exportAs("vtt"), tc: () => exportAs("tc"), txt: () => exportAs("txt"), docx: () => exportAs("docx"), snapcuts: () => snapCuts(false), animated: () => openScreen("animated"),
         copy: () => { Host.copy(Cues.toPlain(S.cues)); toast("Transcript copied."); },
         markers: async () => { const r = await Host.addMarkers(S.cues.map((c) => ({ start: c.start + S.offset, end: c.end + S.offset, text: c.text }))); r.ok ? toast(`Added ${r.added} markers.`) : toast(r.error, true); },
      }[d.menu] || (() => {}))();
      return;
    }
    if (d.look) { S.look = d.look; persist(); return renderScreen(); }
    if (d.act === "animgo") return placeAnimated();
    if (d.act === "copylook") return copyLook();
    if (d.act === "menu") return openScreen("menu");
    if (d.act === "export") return openMenu(t, [["srt", "SRT file", ".srt"], ["vtt", "WebVTT file", ".vtt"], ["docx", "Transcript for producers", ".docx"], ["tc", "Transcript with timecodes", ".txt"], ["txt", "Plain transcript", ".txt"]]);
    if (d.act === "more") return openMenu(t, [["animated", "Animated captions on a video track", String(S.cues.length)], ["snapcuts", "Snap to cuts now", S.cuts ? String(S.cuts.length) : ""], ["markers", "Markers, one per caption", String(S.cues.length)], ["copy", "Copy transcript"]]);
    if (d.act === "go") return go();
    if (d.act === "more-opts") { S.showMore = !S.showMore; return render(); }
    if (d.act === "stop") return stop();
    if (d.act === "refresh") return refresh();
    if (d.act === "back") { S.screen = S.batch && S.batch.done ? "batchdone" : "main"; return render(); }
    if (d.act === "style") return openScreen("style");
    if (d.act === "models") return openScreen("models");
    if (d.act === "history") return openScreen("history");
    if (d.act === "batch") return openBatch();
    if (d.act === "batchgo") return runBatch();
    if (d.act === "batchall") { S.batchPick = new Set(S.batchList.filter((x) => x.audioTracks).map((x) => x.id)); return renderScreen(); }
    if (d.act === "batchnone") { S.batchPick = new Set(); return renderScreen(); }
    if (d.act === "batchback") { S.batch = null; S.screen = "main"; return render(); }
    if (d.bopen != null && d.bopen !== "") return openBatchResult(+d.bopen);
    if (d.act === "log") return openScreen("log");
    if (d.goto) {
      const from = S.overlay === "menu" ? "menu" : null;
      if (d.goto === "test") return openChecks(from);
      if (d.goto === "update") { openScreen("update", from); return checkUpdate(true); }
      return openScreen(d.goto, from);
    }
    if (d.url) return openUrl(d.url);
    if (d.act === "diag") return copyDiagnostics(S.overlay === "menu" ? t : null);
    if (d.act === "rerun") return openChecks(S.overlayParent);
    if (d.act === "updcheck") return checkUpdate(true);
    if (d.act === "updauto") { S.updateAuto = S.updateAuto === false; persist(); toast(S.updateAuto ? "Cueline looks for updates once a day." : "Cueline won’t look for updates by itself."); return renderScreen(); }
    if (d.checkfix) {
      if (d.checkfix === "models") return openScreen("models", "test");
      const job = d.checkfix === "vad" ? Host.engine.ensureVad() : Host.engine.ensureSpeakerModels();
      toast("Downloading…");
      return Promise.resolve(job).then(() => { toast("Done."); openChecks(S.overlayParent); }, (e) => toast(e.message, true));
    }
    if (d.act === "close") return closeScreen();
    if (d.act === "copylog") { Host.copy(S.log.join("\n")); return toast("Log copied."); }
    if (d.act === "openmodels") return Host.openFolder(Host.engine.modelsDir());
    if (d.act === "fixall") return autoFix("Fix all");
    if (d.act === "replace") { S.showReplace = !S.showReplace; return render(); }
    if (d.act === "doreplace") { const r = Cues.replaceAll(S.cues, S.find, S.repl); setCues(r.cues, `Replaced ${r.count}`); return toast(`Replaced ${r.count}.`); }
    if (d.act === "place") return place();
    if (d.spkmode) { S.speakerMode = d.spkmode; persist(); return render(); }
    if (d.fillmode) { S.fillerMode = d.fillmode; persist(); return render(); }
    if (d.preset) { S.preset = d.preset; persist(); if (S.screen === "review") S.cues = Cues.timeCues(S.cues, spec()); renderScreen(); return render(); }
    if (d.lines) { S.custom.maxLines = +d.lines; persist(); return renderScreen(); }
    if (d.track != null && d.track !== "") { const k = +d.track; S.tracks = S.tracks.includes(k) ? S.tracks.filter((x) => x !== k) : S.tracks.concat(k).sort(); return render(); }
    if (d.filter) { S.filter = d.filter; return render(); }
    if (d.seek != null && d.seek !== "") { e.stopPropagation(); const row = t.closest("[data-cue]"); Host.setPlayhead(+d.seek + S.offset); if (row) select(row.dataset.cue, { flash: true }); return; }
    if (d.jump) return jump(d.jump);
    if (d.tl) return jump(d.tl);
    if (d.splitph) return setCues(Cues.splitAtTime(S.cues, d.splitph, S.playhead - S.offset, spec()), "Split at playhead");
    if (d.play) return play(d.play);
    if (d.nudge) { const [edge, n] = d.nudge.split(":"); const c = S.cues.find((x) => x.id === d.id); const fps = (S.info && S.info.fps) || 25; return setCues(Cues.setTime(S.cues, d.id, edge, (edge === "in" ? c.start : c.end) + (+n) / fps, spec())); }
    if (d.setph) { if (S.playhead == null) return toast("Waiting for the playhead position.", true); return setCues(Cues.setTime(S.cues, d.id, d.setph, S.playhead - S.offset, spec())); }
    if (d.act === "previssue") return stepIssue(-1);
    if (d.act === "nextissue") return stepIssue(1);
    if (d.act === "follow") { S.follow = !S.follow; persist(); userMoved = 0; S.nowId = null; renderReview(); return onPlayhead(); }
    if (d.act === "tonow") { const c = S.playhead == null ? null : cueAt(S.playhead); if (!c) return toast("No caption at the playhead.", false); userMoved = 0; return select(c.id, { flash: true }); }
    if (d.act === "keys") return openScreen("keys");
    if (S.overlay === "menu" && (d.act === "undo" || d.act === "redo")) { S.overlayParent = null; closeScreen(); }
    if (d.act === "undo") return undo();
    if (d.fill) return setCues(d.fill === "drop" ? Cues.dropFillers(S.cues, spec(), [d.id]) : Cues.keepFillers(S.cues, [d.id]), d.fill === "drop" ? "Removed fillers" : "Kept fillers");
    if (d.fillall) { const n = Cues.fillerCount(S.cues); setCues(d.fillall === "drop" ? Cues.dropFillers(S.cues, spec()) : Cues.keepFillers(S.cues), d.fillall === "drop" ? "Removed all fillers" : "Kept all fillers"); return toast(`${d.fillall === "drop" ? "Removed" : "Kept"} ${plural(n, "filler")}. U undoes it.`); }
    if (d.act === "autook") { S.autoNote = null; return renderReview(); }
    if (d.act === "tipok") { try { localStorage.setItem("cueline.tip.keys", "1"); } catch (e) {} return renderReview(); }
    if (d.fix) return applyFix(d.fix, d.id, d.word);
    if (d.download) return startDownload(d.download);
    if (d.cancel) { const dl = downloads[d.cancel]; if (dl) dl.job.cancel(); return; }
    if (d.remove) {
      // No pop-up: the first click asks on the button itself, a second within 3 s removes.
      if (t.dataset.armed !== "1") { t.dataset.armed = "1"; const was = t.textContent; t.textContent = "Remove? Click again"; t.classList.add("danger"); setTimeout(() => { if (t.isConnected) { t.dataset.armed = ""; t.textContent = was; t.classList.remove("danger"); } }, 3000); return; }
      Host.engine.removeModel(d.remove); toast("Model removed. You can download it again any time."); return renderScreen();
    }
    if (d.glrm != null && d.glrm !== "") { S.glossary.splice(+d.glrm, 1); persist(); return renderScreen(); }
    if (d.open != null && d.open !== "") {
      const j = Host.history.load(d.open); if (!j) return;
      S.cues = j.cues; S.offset = j.offset || 0; S.placed = null; S.dirty = false; S.job = null; S.env = j.env || null; S.speakers = j.speakers || null; S.screen = "review"; undoStack.length = 0; redoStack.length = 0;
      closeScreen(); return;
    }
    if (d.cue && !e.target.closest("button")) { if (S.selected !== d.cue) { const editing = e.target.closest("[data-edit]"); S.selected = d.cue; if (editing) { document.querySelectorAll(".cue.sel").forEach((x) => x.classList.remove("sel")); t.classList.add("sel"); if (S.wide) renderDetail(); } else select(d.cue); } }
  });

  /* Language search: focus shows the whole list, typing filters it by English name, own name or code.
   * Enter or a click picks; Escape or leaving puts the current language back. */
  function langMatches(q) {
    q = q.trim().toLowerCase();
    return q ? LANGS.filter(([c, n]) => n.toLowerCase().includes(q) || c === q || (LANG_NATIVE[c] || "").includes(q)) : LANGS;
  }
  function showLangs(q) {
    const list = $("#langlist"), box = $("#lang"); if (!list) return;
    const m = langMatches(q);
    list.innerHTML = m.length ? m.map(([c, n], k) => `<button type="button" role="option" class="${k === 0 ? "first" : ""}" aria-selected="${c === S.lang}" data-lang="${c}"><span>${esc(n)}</span><span class="mono-s">${LANG_NATIVE[c] ? esc(LANG_NATIVE[c]) + " · " : ""}${c === "auto" ? "" : c}</span></button>`).join("") : '<div class="none">No language matches.</div>';
    list.hidden = false; box.setAttribute("aria-expanded", "true");
  }
  function pickLang(code) {
    const box = $("#lang");
    if (code) {
      S.lang = code;
      const fit = installedModels().find((m) => (m.langs || []).includes(S.lang));
      if (fit) S.model = fit.id; else if ((currentModel() || {}).langs) { const multi = installedModels().find((m) => !m.langs); if (multi) S.model = multi.id; }
      persist();
    }
    if (box) box.blur();
    renderMain();
  }
  document.addEventListener("focusin", (e) => { if (e.target.id === "lang") { e.target.select(); showLangs(""); } });
  document.addEventListener("input", (e) => { if (e.target.id === "lang") showLangs(e.target.value); });
  document.addEventListener("mousedown", (e) => { const o = e.target.closest("#langlist [data-lang]"); if (o) { e.preventDefault(); pickLang(o.dataset.lang); } });
  document.addEventListener("keydown", (e) => {
    if (e.target.id !== "lang") return;
    if (e.key === "Enter") { e.preventDefault(); const m = langMatches(e.target.value); if (m.length) pickLang(m[0][0]); }
    else if (e.key === "Escape") { e.preventDefault(); pickLang(null); }
  }, true);
  document.addEventListener("focusout", (e) => { if (e.target.id === "lang") setTimeout(() => { if (document.activeElement && document.activeElement.id === "lang") return; if (S.screen === "main") renderMain(); }, 0); });
  document.addEventListener("focusout", (e) => { if (e.target.classList && e.target.classList.contains("spkname")) commitRename(e.target, true); });
  document.addEventListener("change", (e) => {
    const t = e.target, d = t.dataset;
    if (t.id === "lang") return;
    if (d.bpick) { t.checked ? S.batchPick.add(d.bpick) : S.batchPick.delete(d.bpick); return renderScreen(); }
    if (t.id === "model") { S.model = t.value; persist(); render(); }
    else if (t.id === "spkcount") { S.speakerCount = +t.value; persist(); render(); }
    else if (d.opt) { S.opts[d.opt] = t.checked; persist(); render(); }
    else if (d.spec) { const v = parseFloat(t.value); if (isFinite(v)) { S.custom[d.spec] = v; persist(); } }
  });

  document.addEventListener("input", (e) => {
    const t = e.target, d = t.dataset;
    if (d.edit) { clearTimeout(editTimer); editTimer = setTimeout(() => commitEdit(t), 500); }
    else if (t.id === "find" || t.id === "rfind") { S.find = t.value; const pos = t.selectionStart; const id = t.id; render(); const n = document.getElementById(id); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }
    else if (t.id === "rrepl") { S.repl = t.value; }
    else if (d.gl != null && d.gl !== "") {
      const k = +d.gl; if (!S.glossary[k]) S.glossary[k] = { from: "", to: "" };
      S.glossary[k][d.side] = t.value; persist();
    }
  });

  document.addEventListener("focusout", (e) => {
    const t = e.target;
    if (t.dataset && t.dataset.edit) { clearTimeout(editTimer); commitEdit(t); setTimeout(() => { if (!document.activeElement || !document.activeElement.dataset || !document.activeElement.dataset.edit) render(); }, 0); }
    if (t.dataset && t.dataset.gl != null && S.overlay === "style" && t.dataset.gl == S.glossary.length - 1 && t.value) renderScreen();
  });

  document.addEventListener("keydown", (e) => {
    const t = e.target;
    if (t.classList && t.classList.contains("spkname")) {
      if (e.key === "Enter") { e.preventDefault(); commitRename(t, true); }
      else if (e.key === "Escape") { e.preventDefault(); commitRename(t, false); }
      return;
    }
    const editing = t.dataset && t.dataset.edit;
    if (e.key === "Escape") {
      if (!$("#menu").hidden) return closeMenu();
      if (S.overlay) return closeScreen();
      if (editing) { commitEdit(t); t.blur(); return; }
    }
    const mod = e.metaKey || e.ctrlKey;
    // ⌥Enter in the text: split at the cursor. (⌘⇧S and ⌘Z belong to Premiere's menus and never get here on macOS.)
    if (editing && e.key === "Enter" && e.altKey) { e.preventDefault(); return splitAtCaret(t); }
    if (mod && (e.key === "z" || e.key === "Z") && !editing && S.screen === "review") { e.preventDefault(); return e.shiftKey ? redo() : undo(); }
    if (editing) {
      // Enter or Cmd/Ctrl+Enter: save and go to the next caption; Shift+Enter: line break in this one.
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault(); commitEdit(t);
        const all = [...document.querySelectorAll("[data-edit]")]; const n = all[all.indexOf(t) + 1];
        if (n) { S.selected = n.dataset.edit; n.focus(); document.querySelectorAll(".cue.sel").forEach((x) => x.classList.remove("sel")); n.closest(".cue").classList.add("sel"); } else t.blur();
      }
      return;
    }
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || S.overlay || S.screen !== "review" || e.metaKey || e.ctrlKey) return;
    const k = e.key;
    const run = (fn) => { e.preventDefault(); fn(); };
    if (k === "ArrowDown") return run(() => stepRow(1, e.altKey));
    if (k === "ArrowUp") return run(() => stepRow(-1, e.altKey));
    if (k === "g" || k === "G") return run(() => S.selected && jump(S.selected));
    if (k === "j" || k === "J") return run(() => stepIssue(1));
    if (k === "k" || k === "K") return run(() => stepIssue(-1));
    if (k === "f" || k === "F") return run(() => $("[data-act=tonow]") && $("[data-act=tonow]").click());
    if (k === "p" || k === "P") return run(() => S.selected && play(S.selected));
    if (k === "u" || k === "U") return run(() => (e.shiftKey ? redo() : undo()));
    if ((k === "s" || k === "S") && !e.shiftKey) return run(() => {
      const c = S.cues.find((x) => x.id === S.selected);
      if (!c || S.playhead == null || S.playhead - S.offset <= c.start || S.playhead - S.offset >= c.end) return toast("Put the playhead inside the selected caption to split it there.");
      setCues(Cues.splitAtTime(S.cues, S.selected, S.playhead - S.offset, spec()), "Split at playhead");
    });
    if (k === "?") return run(() => openScreen("keys"));
    if (k === "Enter" && S.selected) return run(() => { const el = document.querySelector(`[data-edit="${S.selected}"]`); if (el) { el.focus(); placeCaretAtEnd(el); } });
    if (e.altKey && (k === "[" || k === "]" || e.code === "BracketLeft" || e.code === "BracketRight") && S.selected && S.playhead != null)
      return run(() => setCues(Cues.setTime(S.cues, S.selected, e.code === "BracketLeft" || k === "[" ? "in" : "out", S.playhead - S.offset, spec())));
  });
  function placeCaretAtEnd(el) { const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r); }
  document.addEventListener("wheel", () => { userMoved = Date.now(); }, { passive: true });

  /* ---------- watch Premiere: In/Out, tracks and the playhead ----------
   * Premiere sends no event for In/Out changes, so poll a small snapshot once a second and reload the
   * source only when it changed. The playhead feeds follow-playhead in the review list. */
  let lastKey = null, polling = false;
  async function poll() {
    if (polling || document.hidden || (S.job && S.job.running)) return;
    polling = true;
    try {
      const st = await Host.state();
      if (st && st.ok) {
        const key = st.key || "none";
        if (key !== lastKey) { const first = lastKey === null; lastKey = key; if (!first) { await refresh(); log("Source changed in Premiere Pro; refreshed."); } }
        if (st.playhead != null && st.playhead !== S.playhead) { S.playhead = st.playhead; onPlayhead(); }
        await playTick();
      }
    } finally { polling = false; }
  }
  (function loop() { poll().finally(() => setTimeout(loop, S.playingId ? 100 : S.screen === "review" ? 250 : 1000)); })();

  /* ---------- start ---------- */
  window.addEventListener("focus", () => { if (S.screen === "main" && !S.overlay) refresh(); });
  try { Host.registerKeys(); } catch (e) { log("Keyboard shortcuts not registered: " + e.message); }
  setFlyout(); Host.onFlyout(onFlyout);
  S.update = Host.knownUpdate();
  Host.ping().then((r) => { if (r.ok) { S.hostVersion = r.app; renderFoot(); } });
  setTimeout(() => checkUpdate(false), 4000); // once a day at most; quiet when offline
  // Browser preview only: ?demo=review runs the simulated transcription on load (README screenshots).
  if (Host.kind === "browser" && /[?&]demo=review/.test(location.search)) setTimeout(async () => {
    try { localStorage.setItem("cueline.tip.keys", "1"); } catch (e) {}
    const t = document.querySelector('[data-track="2"]'); if (t) t.click();
    await go();
    if (S.cues[2]) select(S.cues[2].id);
  }, 600);
  log(`Cueline Captions ${VERSION} in ${Host.kind === "browser" ? "a browser (simulated Premiere Pro)" : "Premiere Pro"}`);
  render();
  refresh();
  if (Host.kind === "premiere") Host.ping().then((r) => log(r.ok ? `Premiere Pro ${r.app}` : r.error));
})();
