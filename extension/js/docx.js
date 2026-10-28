/* Cueline transcript document: a Word file (.docx) for producers and paper edits.
 * No dependencies: the document is a few XML parts in a zip, stored without compression.
 * Pure, so it runs the same in the panel and in Node tests. Hebrew and Arabic come out right to left. */
(function (root) {
  "use strict";

  const enc = (s) => (typeof Buffer !== "undefined" ? Buffer.from(s, "utf8") : new TextEncoder().encode(s));
  const xml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");

  /* ---------- zip, stored ---------- */
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(b) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

  function zip(files) {
    const parts = [], central = [];
    let offset = 0;
    const u16 = (v) => [v & 0xff, (v >>> 8) & 0xff];
    const u32 = (v) => [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];
    for (const f of files) {
      const name = enc(f.name), data = enc(f.data), crc = crc32(data);
      // version 20, flag 0x0800 (UTF-8 names), method 0 (stored), time/date 0 (1980-01-01)
      const common = [...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0)];
      const local = Uint8Array.from([...u32(0x04034b50), ...common]);
      parts.push(local, name, data);
      central.push(Uint8Array.from([...u32(0x02014b50), ...u16(20), ...common, ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset)]), name);
      offset += local.length + name.length + data.length;
    }
    const cdSize = central.reduce((n, p) => n + p.length, 0);
    const end = Uint8Array.from([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(cdSize), ...u32(offset), ...u16(0)]);
    const all = [...parts, ...central, end], size = all.reduce((n, p) => n + p.length, 0);
    const out = typeof Buffer !== "undefined" ? Buffer.alloc(size) : new Uint8Array(size);
    let at = 0; for (const p of all) { out.set(p, at); at += p.length; }
    return out;
  }

  /* ---------- the document ----------
   * doc: { title, meta: ["2:23", "2 speakers", …], rtl, lang, turns: [{ tc, speaker, text }], footer } */
  function transcriptDocx(doc) {
    const rtl = !!doc.rtl, lang = doc.lang || (rtl ? "he-IL" : "en-US");
    const font = "Arial";
    const rPr = (o) => `<w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/>${o.b ? "<w:b/><w:bCs/>" : ""}${o.color ? `<w:color w:val="${o.color}"/>` : ""}<w:sz w:val="${o.sz}"/><w:szCs w:val="${o.sz}"/>${rtl ? "<w:rtl/>" : ""}<w:lang w:val="en-US" w:bidi="${lang}"/></w:rPr>`;
    const run = (text, o) => `<w:r>${rPr(o)}<w:t xml:space="preserve">${xml(text)}</w:t></w:r>`;
    const tab = (o) => `<w:r>${rPr(o)}<w:tab/></w:r>`;
    const para = (runs, o) => `<w:p><w:pPr>${o.keep ? "<w:keepNext/>" : ""}${o.tabs ? `<w:tabs><w:tab w:val="left" w:pos="${o.tabs}"/></w:tabs>` : ""}<w:spacing w:before="${o.before || 0}" w:after="${o.after || 0}" w:line="${o.line || 276}" w:lineRule="auto"/>${rtl ? "<w:bidi/>" : ""}<w:jc w:val="${rtl ? "right" : "left"}"/></w:pPr>${runs}</w:p>`;

    const body = [];
    body.push(para(run(doc.title || "Transcript", { b: true, sz: 36 }), { after: 60 }));
    if (doc.meta && doc.meta.length) body.push(para(run(doc.meta.map((m) => (rtl ? "‎" + m + "‎" : m)).join("  ·  "),{ sz: 18, color: "6B6A65" }), { after: 360 }));
    for (const t of doc.turns || []) {
      // speaker and timecode on one line, the words under it
      const head = (t.speaker ? run(t.speaker, { b: true, sz: 20 }) + tab({ sz: 18 }) : "") + run(t.tc, { sz: 18, color: "8A8983" });
      body.push(para(head, { keep: true, before: 200, after: 40, tabs: 2600 }));
      body.push(para(run(t.text, { sz: 22 }), { after: 80, line: 300 }));
    }
    if (doc.footer) body.push(para(run(doc.footer, { sz: 16, color: "A9A79F" }), { before: 480 }));

    const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
    const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${W}><w:body>${body.join("")}<w:sectPr>${rtl ? "<w:bidi/>" : ""}<w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1300" w:right="1300" w:bottom="1300" w:left="1300" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`;
    const title = xml(doc.title || "Transcript");
    return zip([
      { name: "[Content_Types].xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>` },
      { name: "_rels/.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>` },
      { name: "docProps/core.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${title}</dc:title><dc:creator>Cueline Captions</dc:creator></cp:coreProperties>` },
      { name: "word/document.xml", data: document },
    ]);
  }

  const api = { transcriptDocx, zip, crc32 };
  if (typeof window !== "undefined") window.Docx = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
