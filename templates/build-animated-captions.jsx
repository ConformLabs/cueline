/* Builds Cueline's animated caption templates (.mogrt) in After Effects.
 *
 * Run it from File › Scripts › Run Script File… in the oldest After Effects you want to support: a
 * template opens in that version of Premiere Pro and every later one. It makes two comps, left to
 * right and right to left (Hebrew, Arabic), and exports both into ../extension/mogrt. Then, in the
 * Essential Graphics panel, click Edit Properties next to "Caption" in each comp, tick Enable Custom
 * Font Selection, Font Size Adjustment and Faux Styles (scripts can't reach that switch), and export
 * both again (set CUELINE_NO_EXPORT first to skip the first export).
 * Premiere Pro keeps Essential Graphics sliders to 0–100 (the range is set in After Effects, not the
 * template file), so sizes are relative: Size 50 is normal, Line spacing 50 is normal.
 *
 * How it works: Cueline puts one graphic per caption on a video track and fills two hidden text
 * fields: when each word is spoken (seconds from the caption start) and who speaks it. Expressions
 * light the spoken word in that speaker's colour. Everything people may want to change is in
 * Premiere Pro's Essential Graphics panel, named by group ("Spoken word · …", "Background · …").
 * Plain ExtendScript (ES3) so it runs in older versions; expressions use the JavaScript engine. */
(function () {
  var here = File($.fileName).parent;
  var out = new Folder(here.fsName + "/../extension/mogrt");
  if (!out.exists) out.create();
  app.project.expressionEngine = "javascript-1.0";
  var FONT = "Arial-BoldMT", SIZE = 84;

  function hex(h) { return [parseInt(h.substr(1, 2), 16) / 255, parseInt(h.substr(3, 2), 16) / 255, parseInt(h.substr(5, 2), 16) / 255]; }
  function styleText(layer, text, size, rtl) {
    var p = layer.property("Source Text"), td = p.value;
    td.resetCharStyle(); td.resetParagraphStyle();
    td.text = text; td.font = FONT; td.fontSize = size; td.applyFill = true; td.fillColor = [1, 1, 1];
    td.applyStroke = false; td.strokeOverFill = false; td.strokeWidth = 0;
    td.justification = ParagraphJustification.CENTER_JUSTIFY; td.tracking = 0;
    try { td.composerEngine = ComposerEngine.UNIVERSAL_TYPE_ENGINE; } catch (e) {}
    try { td.direction = rtl ? ParagraphDirection.DIRECTION_RIGHT_TO_LEFT : ParagraphDirection.DIRECTION_LEFT_TO_RIGHT; } catch (e2) {}
    p.setValue(td);
  }

  /* The controls, in the order Premiere Pro shows them: [effect, name, default, Essential Graphics name]. */
  var CONTROLS = [
    ["ADBE Color Control", "Text colour", [1, 1, 1]],
    ["ADBE Dropdown Control", "Text case", ["Normal", "UPPERCASE"]],
    ["ADBE Slider Control", "Letter spacing", 0],
    ["ADBE Slider Control", "Line spacing", 50],      // 50 = normal (Essential Graphics sliders run 0–100)
    ["ADBE Slider Control", "Outline width", 0],
    ["ADBE Color Control", "Outline colour", [0, 0, 0]],
    ["ADBE Slider Control", "Size", 50],              // 50 = normal, 100 = double
    ["ADBE Point Control", "Position", [960, 1320]],

    ["ADBE Color Control", "Speaker 1 colour", hex("#FFD23F"), "Spoken word · Speaker 1"],
    ["ADBE Color Control", "Speaker 2 colour", hex("#7FDBFF"), "Spoken word · Speaker 2"],
    ["ADBE Color Control", "Speaker 3 colour", hex("#FF8FC7"), "Spoken word · Speaker 3"],
    ["ADBE Dropdown Control", "Spoken word style", ["Coloured word", "Coloured box", "Coloured word on a box"], "Spoken word · Style"],
    ["ADBE Slider Control", "Spoken word size", 10, "Spoken word · Grow"], // % bigger than the other words
    ["ADBE Dropdown Control", "Word animation", ["None", "Pop", "Bounce", "Fade in", "Rise"], "Spoken word · Animation"],
    ["ADBE Color Control", "Word box colour", [0.1, 0.1, 0.1], "Spoken word · Box colour"],
    ["ADBE Color Control", "Word on box colour", [0, 0, 0], "Spoken word · Text on box"],
    ["ADBE Slider Control", "Word box padding", 14, "Spoken word · Box padding"],
    ["ADBE Slider Control", "Word box roundness", 16, "Spoken word · Box roundness"],

    ["ADBE Dropdown Control", "Said words", ["Text colour", "Keep the highlight", "Said-word colour"], "Said words"],
    ["ADBE Color Control", "Said word colour", [0.75, 0.75, 0.75], "Said words · Colour"],
    ["ADBE Slider Control", "Upcoming words opacity", 100, "Upcoming words · Opacity"],

    ["ADBE Checkbox Control", "Background", 0, "Background"],
    ["ADBE Color Control", "Background colour", [0, 0, 0], "Background · Colour"],
    ["ADBE Slider Control", "Background opacity", 60, "Background · Opacity"],
    ["ADBE Slider Control", "Background padding", 34, "Background · Padding"],
    ["ADBE Slider Control", "Background roundness", 14, "Background · Roundness"],

    ["ADBE Checkbox Control", "Shadow", 1, "Shadow"],
    ["ADBE Color Control", "Shadow colour", [0, 0, 0], "Shadow · Colour"],
    ["ADBE Slider Control", "Shadow opacity", 75, "Shadow · Opacity"],
    ["ADBE Slider Control", "Shadow distance", 10, "Shadow · Distance"],
    ["ADBE Slider Control", "Shadow softness", 18, "Shadow · Softness"],

    ["ADBE Dropdown Control", "Caption entrance", ["None", "Pop", "Fade", "Slide up", "Bounce"], "Caption entrance"],
    ["ADBE Slider Control", "Random tilt", 0, "Random tilt"]
  ];

  function build(rtl) {
    var name = rtl ? "Cueline Animated Captions RTL" : "Cueline Animated Captions";
    for (var i = app.project.numItems; i >= 1; i--) if (app.project.item(i).name === name) app.project.item(i).remove();
    var comp = app.project.items.addComp(name, 1920, 1920, 1, 30, 25);

    var ctl = comp.layers.addNull(); ctl.name = "Controls"; ctl.enabled = false;
    function fx() { return comp.layer("Controls").property("Effects"); }
    for (var c = 0; c < CONTROLS.length; c++) {
      var k = CONTROLS[c];
      fx().addProperty(k[0]);
      var at = fx().numProperties;
      // Setting a menu's items replaces the effect (and its name), so name it afterwards.
      if (k[0] === "ADBE Dropdown Control") fx().property(at).property(1).setPropertyParameters(k[2]);
      fx().property(at).name = k[1];
      if (k[0] === "ADBE Dropdown Control") fx().property(at).property(1).setValue(k[1] === "Caption entrance" ? 2 : 1);
      else fx().property(at).property(1).setValue(k[2]);
    }
    // defaults that read better than the first menu item
    fx().property("Word animation").property(1).setValue(2);

    // The data Cueline fills in. Disabled: expressions read them, nothing renders them.
    var spk = comp.layers.addText("x"); spk.name = "Word speakers"; styleText(spk, "0,0,0,0", 40, false); spk.enabled = false;
    var tim = comp.layers.addText("x"); tim.name = "Word timing"; styleText(tim, "0,0.4,0.8,1.2", 40, false); tim.enabled = false;

    function shapeLayer(nm) {
      var L = comp.layers.addShape(); L.name = nm;
      L.property("Contents").addProperty("ADBE Vector Group");
      L.property("Contents").property(1).property("Contents").addProperty("ADBE Vector Shape - Rect");
      L.property("Contents").property(1).property("Contents").addProperty("ADBE Vector Graphic - Fill");
      return L;
    }
    var bg = shapeLayer("Background");
    var box = shapeLayer("Word box");

    var tx = comp.layers.addText("x"); tx.name = "Caption";
    styleText(tx, rtl ? "ככה נראות הכתוביות" : "This is how captions look", SIZE, rtl);

    // Measuring layers for the box behind the spoken word: the same style as the caption, holding the
    // spoken word's line, the line up to and including the word, and the word alone.
    var meas = ["Measure line", "Measure to word", "Measure word"];
    for (var m = 0; m < meas.length; m++) { var ml = comp.layers.addText("x"); ml.name = meas[m]; styleText(ml, "x", SIZE, rtl); ml.property("Transform").property("Opacity").setValue(0); ml.guideLayer = true; }

    // layer order, top to bottom: measuring, Caption, Word box, Background, data, Controls
    box.moveAfter(tx); bg.moveAfter(box);

    var C = 'thisComp.layer("Controls").effect';
    var IDX = 'var raw = String(thisComp.layer("Word timing").text.sourceText).replace(/\\s/g, "");\n' +
      'var tm = raw ? raw.split(",") : [];\n' +
      'var t = time - inPoint, idx = -1;\n' +
      'for (var i = 0; i < tm.length; i++) { var v = parseFloat(tm[i]); if (!isNaN(v) && t >= v - 0.001) idx = i; }\n' +
      'var tw = idx < 0 ? 0 : t - parseFloat(tm[idx]);\n';
    var SPK = 'var sp = String(thisComp.layer("Word speakers").text.sourceText).split("|")[0].replace(/\\s/g, "").split(",");\n' +
      'var k = parseInt(sp[Math.max(0, idx)], 10); if (isNaN(k) || k < 0) k = 0;\n' +
      'var spkCol = ' + C + '("Speaker " + (k % 3 + 1) + " colour")("Color");\n';
    var STYLE = 'var style = ' + C + '("Spoken word style")("Menu");\n';

    // ---- the caption's look: case, spacing, outline (keeps the font and text Premiere Pro sets)
    tx.property("Source Text").expression =
      'var s = text.sourceText.style;\n' +
      's = s.setAllCaps(' + C + '("Text case")("Menu") == 2).setTracking(3 * ' + C + '("Letter spacing")("Slider"));\n' +
      's = s.setAutoLeading(false).setLeading(s.fontSize * 1.2 * (50 + ' + C + '("Line spacing")("Slider")) / 100);\n' +
      'var ow = ' + C + '("Outline width")("Slider"), oc = ' + C + '("Outline colour")("Color");\n' +
      's = s.setApplyStroke(ow > 0).setStrokeWidth(Math.max(ow, 0)).setStrokeColor([oc[0], oc[1], oc[2]]);\n' +
      's';

    function T() { return tx.property("Text"); }
    // Each letter grows around its own centre: words keep their place, in both directions.
    T().property("More Options").property("Anchor Point Grouping").setValue(1);
    T().property("More Options").property("Grouping Alignment").setValue([0, -30]);
    function A(nm) { return T().property("Animators").property(nm); }
    function animator(nm, props) {
      T().property("Animators").addProperty("ADBE Text Animator").name = nm;
      for (var p = 0; p < props.length; p++) A(nm).property("ADBE Text Animator Properties").addProperty(props[p]);
      A(nm).property("ADBE Text Selectors").addProperty("ADBE Text Selector");
      var adv = A(nm).property("ADBE Text Selectors").property(1).property("ADBE Text Range Advanced");
      adv.property("ADBE Text Range Units").setValue(2);   // index
      adv.property("ADBE Text Range Type2").setValue(3);   // words
    }
    function SEL(nm, k) { return A(nm).property("ADBE Text Selectors").property(1).property(k); }
    function P(nm, k) { return A(nm).property("ADBE Text Animator Properties").property(k); }

    animator("Text colour", ["ADBE Text Fill Color"]);
    SEL("Text colour", "ADBE Text Index Start").expression = "0";
    SEL("Text colour", "ADBE Text Index End").expression = "9999";
    P("Text colour", "ADBE Text Fill Color").expression = C + '("Text colour")("Color")';

    animator("Said words", ["ADBE Text Fill Color"]);
    SEL("Said words", "ADBE Text Index Start").expression = "0";
    SEL("Said words", "ADBE Text Index End").expression = IDX + 'var mode = ' + C + '("Said words")("Menu");\nmode == 1 || idx < 1 ? 0 : idx';
    P("Said words", "ADBE Text Fill Color").expression = IDX + SPK +
      'var mode = ' + C + '("Said words")("Menu");\nmode == 3 ? ' + C + '("Said word colour")("Color") : spkCol';

    animator("Upcoming words", ["ADBE Text Opacity"]);
    SEL("Upcoming words", "ADBE Text Index Start").expression = IDX + "Math.max(0, idx + 1)";
    SEL("Upcoming words", "ADBE Text Index End").expression = "9999";
    P("Upcoming words", "ADBE Text Opacity").expression = C + '("Upcoming words opacity")("Slider")';

    animator("Spoken word", ["ADBE Text Fill Color", "ADBE Text Scale 3D", "ADBE Text Opacity", "ADBE Text Position 3D"]);
    SEL("Spoken word", "ADBE Text Index Start").expression = IDX + "idx < 0 ? 0 : idx";
    SEL("Spoken word", "ADBE Text Index End").expression = IDX + "idx < 0 ? 0 : idx + 1";
    P("Spoken word", "ADBE Text Fill Color").expression = IDX + SPK + STYLE +
      'style == 2 ? ' + C + '("Word on box colour")("Color") : spkCol';
    var ANIM = 'var anim = ' + C + '("Word animation")("Menu");\n';
    P("Spoken word", "ADBE Text Scale 3D").expression = IDX + ANIM +
      'var s = 100 + ' + C + '("Spoken word size")("Slider");\n' +
      'if (anim == 2) s = s * (1 + 0.3 * (1 - ease(tw, 0, 0.14, 0, 1)));\n' +
      'if (anim == 3) s = s * (1 + 0.28 * Math.sin(tw * 24) * Math.exp(-tw * 9) * (tw < 0.6 ? 1 : 0));\n' +
      '[s, s, 100]';
    P("Spoken word", "ADBE Text Opacity").expression = IDX + ANIM +
      'anim == 4 ? linear(tw, 0, 0.14, ' + C + '("Upcoming words opacity")("Slider"), 100) : 100';
    P("Spoken word", "ADBE Text Position 3D").expression = IDX + ANIM +
      'anim == 5 ? [0, linear(tw, 0, 0.14, 22, 0), 0] : [0, 0, 0]';

    // ---- layout and the caption entrance (time from the clip's start in Premiere Pro)
    function TR(L, k) { return L.property("Transform").property(k); }
    var ENTER = 'var ent = ' + C + '("Caption entrance")("Menu"), te = time - inPoint;\n';
    TR(tx, "Anchor Point").expression = "var r = sourceRectAtTime(0, false); [r.left + r.width / 2, r.top + r.height / 2]";
    TR(tx, "Position").expression = ENTER + 'var p = ' + C + '("Position")("Point");\nent == 4 ? [p[0], p[1] + 40 * (1 - ease(te, 0, 0.22, 0, 1))] : p';
    TR(tx, "Scale").expression = ENTER + 'var s = 2 * ' + C + '("Size")("Slider"), f = 1;\n' +
      'if (ent == 2) f = ease(te, 0, 0.15, 0.85, 1);\n' +
      'if (ent == 5) f = te < 0.7 ? 1 - 0.3 * Math.exp(-te * 9) * Math.cos(te * 26) : 1;\n' +
      '[s * f, s * f]';
    TR(tx, "Opacity").expression = ENTER + '(ent == 3 || ent == 4) ? linear(te, 0, 0.2, 0, 100) : 100';
    TR(tx, "Rotation").expression =
      'var a = ' + C + '("Random tilt")("Slider"), txt = String(text.sourceText), h = 0;\n' +
      'for (var i = 0; i < txt.length; i++) h = (h * 31 + txt.charCodeAt(i)) % 100003;\n' +
      'seedRandom(h, true); a ? random(-a, a) : 0';

    tx.property("Effects").addProperty("ADBE Drop Shadow");
    function DS(k) { return tx.property("Effects").property(1).property(k); }
    var full = DS("ADBE Drop Shadow-0002").maxValue;
    DS("ADBE Drop Shadow-0001").expression = C + '("Shadow colour")("Color")';
    DS("ADBE Drop Shadow-0002").expression = C + '("Shadow")("Checkbox") == 1 ? ' + C + '("Shadow opacity")("Slider") * ' + (full / 100) + ' : 0';
    DS("ADBE Drop Shadow-0005").expression = C + '("Shadow distance")("Slider")';
    DS("ADBE Drop Shadow-0004").expression = C + '("Shadow softness")("Slider")';

    // ---- the background box and the spoken word's box ride on the caption (parented: same
    // position, size, tilt and entrance), measured in the caption's own coordinates.
    function rect(L) { return L.property("Contents").property(1).property("Contents"); }
    bg.parent = tx; box.parent = tx;
    TR(bg, "Position").setValue([0, 0]); TR(box, "Position").setValue([0, 0]);
    rect(bg).property(1).property("ADBE Vector Rect Size").expression =
      'var r = thisComp.layer("Caption").sourceRectAtTime(0, false), p = ' + C + '("Background padding")("Slider");\n[r.width + 2 * p, r.height + 1.1 * p]';
    rect(bg).property(1).property("ADBE Vector Rect Position").expression =
      'var r = thisComp.layer("Caption").sourceRectAtTime(0, false);\n[r.left + r.width / 2, r.top + r.height / 2]';
    rect(bg).property(1).property("ADBE Vector Rect Roundness").expression = C + '("Background roundness")("Slider")';
    rect(bg).property(2).property("ADBE Vector Fill Color").expression = C + '("Background colour")("Color")';
    TR(bg, "Opacity").expression = C + '("Background")("Checkbox") == 1 ? ' + C + '("Background opacity")("Slider") * thisComp.layer("Caption").transform.opacity / 100 : 0';

    // Which line the spoken word is on, and where it sits in that line.
    var WORDPOS = IDX +
      'var full = String(thisComp.layer("Caption").text.sourceText), lines = full.split(/\\r\\n|\\r|\\n/), L = 0, w = idx, n = 0;\n' +
      'var lw = [];\n' +
      'for (var j = 0; j < lines.length; j++) { var ws = lines[j].replace(/^\\s+|\\s+$/g, "").split(/\\s+/); if (ws.length == 1 && ws[0] == "") ws = []; lw.push(ws); }\n' +
      'for (var j = 0; j < lw.length; j++) { if (w < lw[j].length) { L = j; break; } w -= lw[j].length; L = j; }\n';
    // Premiere Pro applies a changed font only when it draws the caption, and expressions can't switch
    // to it there, so Cueline writes the font after the speakers ("0,1|Font|size|ratio"): the measuring
    // takes the size, and the box scales by how much wider the font is than the template's.
    function measure(nm, body) {
      comp.layer(nm).property("Source Text").expression = WORDPOS + body + '\n' +
        'var st = thisComp.layer("Caption").text.sourceText.style, ff = String(thisComp.layer("Word speakers").text.sourceText).split("|");\n' +
        'if (ff.length > 2) { var fz = parseFloat(ff[2]); if (fz > 0) st = st.setFontSize(fz); }\n' +
        'st.setText(str.length ? str : " ")';
    }
    measure("Measure line", 'var str = idx < 0 ? "" : (lw[L] || []).join(" ");');
    measure("Measure to word", 'var str = idx < 0 ? "" : (lw[L] || []).slice(0, w + 1).join(" ");');
    measure("Measure word", 'var str = idx < 0 ? "" : ((lw[L] || [])[w] || "");');
    var BOXGEO = WORDPOS +
      'var wl = thisComp.layer("Measure line").sourceRectAtTime(time, false).width;\n' +
      'var wt = thisComp.layer("Measure to word").sourceRectAtTime(time, false).width;\n' +
      'var ww = thisComp.layer("Measure word").sourceRectAtTime(time, false).width;\n' +
      'var fr = String(thisComp.layer("Word speakers").text.sourceText).split("|"), kk = fr.length > 3 ? parseFloat(fr[3]) : 1;\n' +
      'if (!(kk > 0)) kk = 1; wl *= kk; wt *= kk; ww *= kk;\n' +
      'var r = thisComp.layer("Caption").sourceRectAtTime(0, false), pitch = r.height / Math.max(1, lw.length);\n' +
      'var sz = (100 + ' + C + '("Spoken word size")("Slider")) / 100, pad = ' + C + '("Word box padding")("Slider");\n' +
      (rtl ? 'var cx = wl / 2 - wt + ww / 2;\n' : 'var cx = -wl / 2 + wt - ww / 2;\n') +
      'var cy = r.top + (L + 0.5) * pitch;\n';
    rect(box).property(1).property("ADBE Vector Rect Size").expression = BOXGEO + '[ww + (sz - 1) * pitch * 0.45 + 2 * pad, pitch * 0.92 * sz + pad]'; // letters grow in place, so the word widens by about a letter
    rect(box).property(1).property("ADBE Vector Rect Position").expression = BOXGEO + '[cx, cy]';
    rect(box).property(1).property("ADBE Vector Rect Roundness").expression = C + '("Word box roundness")("Slider")';
    rect(box).property(2).property("ADBE Vector Fill Color").expression = IDX + SPK + STYLE + 'style == 3 ? ' + C + '("Word box colour")("Color") : spkCol';
    TR(box, "Opacity").expression = IDX + STYLE + '(style == 1 || idx < 0) ? 0 : thisComp.layer("Caption").transform.opacity';

    // ---- Essential Graphics. Each addition goes on top of the panel, so add them last to first.
    // Property objects go stale as the panel changes, so each one is looked up when it is added.
    comp.openInEssentialGraphics();
    function e(n) { return function () { return comp.layer("Controls").property("Effects").property(n).property(1); }; }
    function src(layer) { return function () { return comp.layer(layer).property("Source Text"); }; }
    var list = [[src("Caption"), "Caption"]];
    for (var q = 0; q < CONTROLS.length; q++) list.push([e(CONTROLS[q][1]), CONTROLS[q][3] || CONTROLS[q][1]]);
    list.push([src("Word timing"), "Word timing (set by Cueline)"]);
    list.push([src("Word speakers"), "Word speakers (set by Cueline)"]);
    for (var j = list.length - 1; j >= 0; j--) list[j][0]().addToMotionGraphicsTemplateAs(comp, list[j][1]);
    comp.motionGraphicsTemplateName = name;
    return comp;
  }

  var titles = [build(false).name, build(true).name];
  if (!app.project.file) app.project.save(new File(here.fsName + "/animated-captions.aep"));
  else app.project.save();
  if ($.global.CUELINE_NO_EXPORT) return "Built " + titles.join(", ") + " (not exported)";
  // Exporting reopens the project, so comps are found again by name each time.
  function byName(n) { for (var i = 1; i <= app.project.numItems; i++) if (app.project.item(i).name === n) return app.project.item(i); return null; }
  var names = ["CuelineAnimated", "CuelineAnimatedRTL"], made = [];
  for (var c = 0; c < titles.length; c++) {
    // Export writes "<comp name>.mogrt" into the folder it is given.
    byName(titles[c]).exportAsMotionGraphicsTemplate(true, out.fsName);
    var f = new File(out.fsName + "/" + titles[c] + ".mogrt"), dest = new File(out.fsName + "/" + names[c] + ".mogrt");
    if (dest.exists) dest.remove();
    if (f.exists && f.rename(names[c] + ".mogrt")) made.push(dest.fsName);
  }
  return "Made " + made.length + " templates with After Effects " + app.version + ":\n" + made.join("\n");
})();
