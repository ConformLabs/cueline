// The version lives in package.json. This writes it into the panel and the CEP manifest, or checks they match.
//   node scripts/version.mjs            stamp package.json's version into the files
//   node scripts/version.mjs 1.0.1      set a new version, then stamp it
//   node scripts/version.mjs --check    exit 1 if a file has another version
// CEP manifest versions are numbers only (x.y.z): a pre-release such as 1.1.0-beta.1 is 1.1.0 there.
import { readFileSync, writeFileSync } from "node:fs";

const ROOT = new URL("../", import.meta.url);
const pkgUrl = new URL("package.json", ROOT);
const pkg = JSON.parse(readFileSync(pkgUrl, "utf8"));
const arg = process.argv[2];
if (arg && arg !== "--check") {
  if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$/.test(arg)) { console.error(`not a version: ${arg}`); process.exit(1); }
  pkg.version = arg;
  writeFileSync(pkgUrl, JSON.stringify(pkg, null, 2) + "\n");
}
const v = pkg.version, numeric = v.replace(/[-+].*$/, "");
const FILES = [
  ["extension/js/panel.js", /const VERSION = "([^"]+)";/, () => `const VERSION = "${v}";`],
  ["extension/CSXS/manifest.xml", /ExtensionBundleVersion="([^"]+)"/, () => `ExtensionBundleVersion="${numeric}"`],
  ["extension/CSXS/manifest.xml", /<Extension Id="com\.conformlabs\.cueline\.panel" Version="([^"]+)"\/>/, () => `<Extension Id="com.conformlabs.cueline.panel" Version="${numeric}"/>`],
];
let bad = 0;
for (const [rel, re, put] of FILES) {
  const url = new URL(rel, ROOT), text = readFileSync(url, "utf8"), m = re.exec(text);
  if (!m) { console.error(`${rel}: no version found`); bad++; continue; }
  const want = rel.endsWith(".xml") ? numeric : v;
  if (arg === "--check") { if (m[1] !== want) { console.error(`${rel}: ${m[1]}, package.json says ${want}`); bad++; } }
  else writeFileSync(url, text.replace(re, put()));
}
if (bad) process.exit(1);
console.log(arg === "--check" ? `version ${v}: all files match` : `version ${v} stamped`);
