// Construit article/index.html (page autonome, graphiques SVG intégrés) depuis l'article Markdown.
// Usage : node scripts/build-article.mjs
import fs from 'node:fs'
import { marked } from 'marked'

const md = fs.readFileSync('article/eurl-sasu-ei-180k-2026.md', 'utf8')
const titre = md.match(/^# (.+)$/m)[1]
let html = marked.parse(md.replace(/^# .+\n/, ''))
// images SVG intégrées dans la page
html = html.replace(/<img src="(img\/[^"]+\.svg)" alt="([^"]*)">/g, (_, src, alt) =>
  `<figure>${fs.readFileSync('article/' + src, 'utf8').replace('<svg ', `<svg aria-label="${alt}" `)}</figure>`)
// liens externes : nouvel onglet
html = html.replace(/<a href="http/g, '<a target="_blank" rel="noopener" href="http')
// tableaux défilants sur mobile
html = html.replace(/<table>/g, '<div class="tw"><table>').replace(/<\/table>/g, '</table></div>')

const page = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>EI, EURL ou SASU à 180 000 €</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=IBM+Plex+Sans:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">
<style>
/* Article long format : une colonne de lecture, tableaux et graphiques plus larges que le texte. */
:root { color-scheme: light; --paper:#f2f2ee; --card:#fcfcfb; --ink:#0b0b0b; --ink-2:#52514e; --line:#e1e0d9; --accent:#4436c8; --mark:#ffe066;
  --display:"Bricolage Grotesque","IBM Plex Sans",system-ui,sans-serif; --body:"IBM Plex Sans",system-ui,-apple-system,"Segoe UI",sans-serif; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { color-scheme: dark; --paper:#0d0d0d; --card:#1a1a19; --ink:#f0efec; --ink-2:#c3c2b7; --line:#2c2c2a; --accent:#a69cf5; --mark:#5c4b00; } }
:root[data-theme="dark"] { color-scheme: dark; --paper:#0d0d0d; --card:#1a1a19; --ink:#f0efec; --ink-2:#c3c2b7; --line:#2c2c2a; --accent:#a69cf5; --mark:#5c4b00; }
* { box-sizing: border-box; }
body { margin:0; background:var(--paper); color:var(--ink); font:17px/1.65 var(--body); }
main { max-width: 860px; margin: 0 auto; padding: 40px 20px 80px; }
main > p, main > ul, main > ol, main > h2, main > h3, main > blockquote { max-width: 68ch; }
h1, h2, h3 { font-family: var(--display); text-wrap: balance; line-height: 1.15; }
h1 { font-size: clamp(32px, 5vw, 50px); font-weight: 800; letter-spacing: -0.02em; margin: 0 0 18px; }
h2 { font-size: 28px; margin: 48px 0 12px; letter-spacing: -0.01em; }
h3 { font-size: 20px; margin: 30px 0 8px; }
a { color: var(--accent); }
strong { background: linear-gradient(transparent 62%, var(--mark) 62%); }
hr { border: 0; border-top: 1px solid var(--line); margin: 36px 0; }
li { margin: 4px 0; }
.tw { overflow-x: auto; margin: 18px 0; background: var(--card); border: 1px solid var(--line); border-radius: 10px; }
table { border-collapse: collapse; width: 100%; font-size: 14.5px; font-variant-numeric: tabular-nums; }
th, td { padding: 8px 12px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; }
th { font-size: 13px; color: var(--ink-2); font-weight: 600; }
tr:last-child td { border-bottom: 0; }
td strong, th strong { background: none; }
figure { margin: 22px 0; }
figure svg { width: 100%; height: auto; display: block; border-radius: 10px; }
em { color: var(--ink-2); }
code { font-size: .9em; }
</style>
</head>
<body>
<main>
<h1>${titre}</h1>
${html}
</main>
</body>
</html>
`
fs.writeFileSync('article/index.html', page)
console.log('article/index.html écrit', (page.length / 1024).toFixed(0), 'Ko')
