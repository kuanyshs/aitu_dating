// Packs the web build into one HTML file that opens anywhere: as a claude.ai artifact, from
// a web server or straight from disk (file://). Run after `pnpm build:web`:
//   node scripts/build-standalone.mjs <out.html>
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const out = process.argv[2];
if (!out) throw new Error('Usage: node scripts/build-standalone.mjs <out.html>');

const dir = path.join('dist', '_expo', 'static', 'js', 'web');
const entries = readdirSync(dir).filter((f) => /^entry-.*\.js$/.test(f));
if (entries.length !== 1) throw new Error(`Expected one entry bundle, found ${entries.length}`);
const js = readFileSync(path.join(dir, entries[0]), 'utf8');
if (js.toLowerCase().includes('</script')) throw new Error('The bundle would close its script tag');

// A whole document: opened from disk on a phone, the viewport meta keeps it at the phone's
// width instead of a 980-pixel desktop page shrunk to fit.
const head = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#ffffff">
<title>Aitu Dating</title>
<style>
  :root { --bg: #ffffff; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #101010; color-scheme: dark; } }
  :root[data-theme="dark"] { --bg: #101010; color-scheme: dark; }
  html, body { height: 100%; }
  body { overflow: hidden; background: var(--bg); }
  #root { display: flex; height: 100%; flex: 1; }
</style>
</head>
<body>
<div id="root"></div>
<script>
  (function () {
    // Opened as a saved file the address is the file's path, and the browser refuses to
    // change it: navigation then keeps the address as it is instead of failing. The app
    // itself sends an address it does not know to Home.
    ['pushState', 'replaceState'].forEach(function (name) {
      var original = history[name].bind(history);
      history[name] = function (state, title, url) {
        try {
          return original(state, title, url);
        } catch (error) {
          return original(state, title);
        }
      };
    });
    try {
      if (location.protocol !== 'file:' && location.pathname !== '/') history.replaceState(null, '', '/');
    } catch (error) {}
  })();
</script>
<script>
`;
writeFileSync(out, `${head}${js}\n</script>\n</body>\n</html>\n`);
console.log(`written ${out} (${Math.round((head.length + js.length) / 1024)} KB)`);
