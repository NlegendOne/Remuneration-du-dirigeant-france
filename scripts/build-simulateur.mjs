// Construit simulateur/index.html (fichier autonome) en injectant src/moteur.js dans le gabarit.
// Usage : npm run build
import fs from 'node:fs'
import path from 'node:path'

const moteur = fs.readFileSync(path.resolve('src/moteur.js'), 'utf8')
const exports = [...moteur.matchAll(/^export (?:const|function) (\w+)/gm)].map((m) => m[1])
const corps = moteur
  .replace(/^export \{[^}]*\}\s*$/gm, '')
  .replace(/^export (const|function) /gm, '$1 ')
const iife = `window.Moteur = (function () {\n'use strict'\n${corps}\nreturn { ${exports.join(', ')} }\n})()`
const gabarit = fs.readFileSync(path.resolve('simulateur/template.html'), 'utf8')
if (!gabarit.includes('/*__MOTEUR__*/')) throw new Error('marqueur absent du gabarit')
const html = gabarit.replace('/*__MOTEUR__*/', () => iife)
fs.writeFileSync(path.resolve('simulateur/index.html'), html)
console.log(`simulateur/index.html écrit (${(html.length / 1024).toFixed(0)} Ko, ${exports.length} fonctions exportées)`)
