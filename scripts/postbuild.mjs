/**
 * Postbuild: inline hashed CSS/JS into dist/index.html so the preview panel
 * and GitHub Pages can open a single self-contained file without path issues.
 */

import { readFileSync, writeFileSync, readdirSync, unlinkSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dist = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const assets = join(dist, "assets");

/**
 * Pick the single file with the given extension from dist/assets.
 *
 * @param {string} ext - File extension including the dot, e.g. ".css".
 * @returns {string} Absolute path.
 */
function pick(ext) {
  const files = readdirSync(assets).filter((f) => f.endsWith(ext));
  if (files.length !== 1) {
    throw new Error(`Expected exactly one ${ext} in dist/assets, found: ${files.join(", ")}`);
  }
  return join(assets, files[0]);
}

const css = readFileSync(pick(".css"), "utf8");
const js = readFileSync(pick(".js"), "utf8");
let html = readFileSync(join(dist, "index.html"), "utf8");

const before = html;
html = html.replace(/<link rel="stylesheet"[^>]*>/, () => `<style>\n${css}\n</style>`);
html = html.replace(
  /<script type="module"[^>]*><\/script>/,
  () => `<script type="module">\n${js}\n</script>`,
);

if (html === before) {
  throw new Error("postbuild: failed to replace stylesheet/script tags in dist/index.html");
}
if (html.includes("./assets/") || html.includes("/assets/")) {
  throw new Error("postbuild: asset URLs still present after inlining");
}

writeFileSync(join(dist, "index.html"), html, "utf8");
rmSync(assets, { recursive: true, force: true });

console.log("postbuild: inlined CSS/JS into dist/index.html");
