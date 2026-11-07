// Génère les graphiques SVG de l'article à partir du moteur.
// Usage : node scripts/graphiques.mjs   (écrit dans article/img/)
import fs from 'node:fs'
import path from 'node:path'
import * as M from '../src/moteur.js'

const OUT = path.resolve('article/img')
fs.mkdirSync(OUT, { recursive: true })

// Couleurs par entité (fixes dans tous les graphiques), palette validée (validate_palette.js)
const COUL = {
  "EURL à l'IS": { light: '#2a78d6', dark: '#3987e5', cls: 's1' },
  "SASU à l'IS": { light: '#eb6834', dark: '#d95926', cls: 's2' },
  "EI / EURL à l'IR": { light: '#1baf7a', dark: '#199e70', cls: 's3' },
  "SASU à l'IR": { light: '#eda100', dark: '#c98500', cls: 's4' },
}
const SEG = [
  { nom: 'Revenu disponible', light: '#2a78d6', dark: '#3987e5', ink: '#ffffff' },
  { nom: 'Impôt sur le revenu', light: '#eb6834', dark: '#d95926', ink: '#ffffff' },
  { nom: 'Prélèvements sociaux 18,6 %', light: '#1baf7a', dark: '#199e70', ink: '#ffffff' },
  { nom: 'Impôt sur les sociétés', light: '#eda100', dark: '#c98500', ink: '#0b0b0b' },
  { nom: 'Cotisations créant des droits retraite', light: '#e87ba4', dark: '#d55181', ink: '#ffffff' },
  { nom: 'Autres cotisations et CSG', light: '#008300', dark: '#008300', ink: '#ffffff' },
]
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const fmt = (x) => Math.round(x).toLocaleString('fr-FR').replace(/[  ]/g, ' ')
const fmtK = (x) => (x / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' k€'

function style(extra = '') {
  const vars = (mode) =>
    Object.values(COUL).map((c) => `.${c.cls}{stroke:${c[mode]};fill:${c[mode]}}`).join('') +
    SEG.map((s, i) => `.g${i}{fill:${s[mode]}}`).join('')
  return `<style>
  .bg{fill:#fcfcfb} .t1{fill:#0b0b0b} .t2{fill:#52514e} .t3{fill:#898781}
  .grid{stroke:#e1e0d9;stroke-width:1} .axis{stroke:#c3c2b7;stroke-width:1}
  .ring{stroke:#fcfcfb} .ln{fill:none;stroke-width:2;stroke-linejoin:round;stroke-linecap:round}
  text{font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
  .tab{font-variant-numeric:tabular-nums}
  ${vars('light')}
  @media (prefers-color-scheme: dark){
    .bg{fill:#1a1a19} .t1{fill:#f0efec} .t2{fill:#c3c2b7}
    .grid{stroke:#2c2c2a} .axis{stroke:#383835} .ring{stroke:#1a1a19}
    ${vars('dark')}
  }
  path.ln,line.ln{fill:none}
  ${extra}
</style>`
}

// --------------------------------------------------------------- 1. Écart vs EI
function graphiqueEcart(foyer, titre, sousTitre, fichier) {
  const W = 760
  const H = 440
  const m = { l: 74, r: 128, t: 92, b: 52 }
  const series = ["EURL à l'IS", "SASU à l'IS", "SASU à l'IR"]
  const xs = []
  for (let B = 20000; B <= 400000; B += 5000) xs.push(B)
  const data = xs.map((B) => {
    const res = M.comparer(B, foyer)
    const ei = res.find((r) => r.structure === "EI / EURL à l'IR").revenuDisponible
    const o = { B }
    for (const s of series) o[s] = res.find((r) => r.structure === s).revenuDisponible - ei
    return o
  })
  const yMin = -15000
  const yMax = 40000
  const X = (B) => m.l + ((B - 20000) / (400000 - 20000)) * (W - m.l - m.r)
  const Y = (v) => m.t + ((yMax - v) / (yMax - yMin)) * (H - m.t - m.b)
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="t d">`
  s += `<title id="t">${esc(titre)}</title><desc id="d">${esc(sousTitre)}</desc>${style()}`
  s += `<rect class="bg" width="${W}" height="${H}" rx="8"/>`
  s += `<text class="t1" x="${m.l - 50}" y="30" font-size="17" font-weight="600">${esc(titre)}</text>`
  s += `<text class="t2" x="${m.l - 50}" y="52" font-size="13">${esc(sousTitre)}</text>`
  // légende
  let lx = m.l - 50
  for (const n of series) {
    s += `<line class="ln ${COUL[n].cls}" x1="${lx}" y1="74" x2="${lx + 18}" y2="74"/>`
    s += `<text class="t2" x="${lx + 24}" y="78" font-size="12">${esc(n)}</text>`
    lx += 24 + n.length * 6.6 + 22
  }
  s += `<line class="axis" x1="${lx}" y1="74" x2="${lx + 18}" y2="74" stroke-width="2"/>`
  s += `<text class="t2" x="${lx + 24}" y="78" font-size="12">Ligne 0 = EI / EURL à l'IR (référence)</text>`
  // grille
  for (let v = yMin; v <= yMax; v += 5000) {
    const y = Y(v)
    s += `<line class="${v === 0 ? 'axis' : 'grid'}" x1="${m.l}" x2="${W - m.r}" y1="${y}" y2="${y}"/>`
    s += `<text class="t3 tab" x="${m.l - 8}" y="${y + 4}" font-size="11" text-anchor="end">${v > 0 ? '+' : ''}${fmtK(v)}</text>`
  }
  for (const B of [50000, 100000, 150000, 200000, 250000, 300000, 350000, 400000]) {
    s += `<text class="t3 tab" x="${X(B)}" y="${H - m.b + 18}" font-size="11" text-anchor="middle">${fmtK(B)}</text>`
  }
  s += `<text class="t3" x="${(m.l + W - m.r) / 2}" y="${H - 12}" font-size="11" text-anchor="middle">Bénéfice annuel avant rémunération du dirigeant</text>`

  // repère 180 k€
  s += `<line class="grid" x1="${X(180000)}" x2="${X(180000)}" y1="${m.t}" y2="${H - m.b}"/>`
  s += `<text class="t3" x="${X(180000) + 4}" y="${m.t + 10}" font-size="11">180 k€</text>`
  // séries
  const fins = []
  for (const n of series) {
    const d = data.map((o, i) => `${i ? 'L' : 'M'}${X(o.B).toFixed(1)},${Y(o[n]).toFixed(1)}`).join('')
    s += `<path class="ln ${COUL[n].cls}" d="${d}"/>`
    const last = data[data.length - 1]
    fins.push({ n, y: Y(last[n]), v: last[n] })
    s += `<circle class="${COUL[n].cls} ring" cx="${X(last.B)}" cy="${Y(last[n])}" r="4" stroke-width="2"/>`
  }
  // étiquettes de fin (avec ligne de rappel si collision)
  fins.sort((a, b) => a.y - b.y)
  for (let i = 1; i < fins.length; i++) if (fins[i].y - fins[i - 1].y < 26) fins[i].ly = fins[i - 1].ly ?? fins[i - 1].y + 26
  for (const f of fins) {
    const ly = f.ly ?? f.y
    s += `<text class="t1 tab" x="${W - m.r + 10}" y="${ly - 2}" font-size="12" font-weight="600">${f.v > 0 ? '+' : ''}${fmt(f.v)} €</text>`
    s += `<text class="t2" x="${W - m.r + 10}" y="${ly + 12}" font-size="11">${esc(f.n)}</text>`
  }
  s += '</svg>'
  fs.writeFileSync(path.join(OUT, fichier), s)
  return data
}

const d1 = graphiqueEcart(
  { couple: false, enfants: 0 },
  'Gain de revenu disponible par rapport à l\'EI / EURL à l\'IR',
  'Célibataire sans enfant, chaque structure optimisée (rémunération / dividendes), règles 2026',
  'ecart-celibataire.svg',
)
graphiqueEcart(
  { couple: true, enfants: 2 },
  'Gain de revenu disponible par rapport à l\'EI / EURL à l\'IR',
  'Couple, 2 enfants, conjoint sans revenu (3 parts), chaque structure optimisée, règles 2026',
  'ecart-couple-2-enfants.svg',
)

// --------------------------------------------------------------- 2. Où partent les 180 000 €
function graphiqueRepartition(B, foyer, fichier) {
  const res = M.comparer(B, foyer)
  const ordre = ["EI / EURL à l'IR", "EURL à l'IS", "SASU à l'IS", "SASU à l'IR"]
  const W = 760
  const barH = 24
  const gapRow = 46
  const m = { l: 150, r: 30, t: 130, b: 30 }
  const H = m.t + ordre.length * gapRow + m.b
  const X = (v) => (v / B) * (W - m.l - m.r)
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="t d">`
  s += `<title id="t">Où partent les ${fmt(B)} € de bénéfice ?</title><desc id="d">Répartition du bénéfice entre revenu disponible, impôts et cotisations, par structure optimisée (célibataire)</desc>${style()}`
  s += `<rect class="bg" width="${W}" height="${H}" rx="8"/>`
  s += `<text class="t1" x="20" y="30" font-size="17" font-weight="600">Où partent les ${fmt(B)} € de bénéfice ?</text>`
  s += `<text class="t2" x="20" y="52" font-size="13">Célibataire, solutions optimisées, règles 2026. Tout le disponible est versé dans l'année.</text>`
  // légende (2 lignes)
  let lx = 20
  let ly = 80
  SEG.forEach((g, i) => {
    const w = 18 + g.nom.length * 6.4 + 22
    if (lx + w > W - 20) {
      lx = 20
      ly += 20
    }
    s += `<rect class="g${i}" x="${lx}" y="${ly - 9}" width="12" height="12" rx="3"/>`
    s += `<text class="t2" x="${lx + 18}" y="${ly + 1}" font-size="12">${esc(g.nom)}</text>`
    lx += w
  })
  ordre.forEach((nom, j) => {
    const r = res.find((x) => x.structure === nom)
    const c = r.detailCotisations
    let droits
    if (nom.startsWith('SASU')) droits = c.employeur.vieillessePlafonnee + c.salarie.vieillessePlafonnee + (c.employeur.agircArrco + c.salarie.agircArrco) / 1.27
    else droits = 0.1787 * Math.min(Math.max(c.assiette, 450 * M.PARAMS_2026.SMIC_H_JANVIER), M.PARAMS_2026.PASS) + c.retraiteComplementaire
    const vals = [r.revenuDisponible, r.impotRevenu + r.csm, r.prelevementsSociaux, r.is, droits, r.cotisations - droits]
    const y = m.t + j * gapRow
    s += `<text class="t1" x="${m.l - 10}" y="${y + barH / 2 + 4}" font-size="13" text-anchor="end">${esc(nom)}</text>`
    let x = m.l
    vals.forEach((v, i) => {
      if (v <= 0) return
      const w = X(v)
      const wDraw = Math.max(0, w - 2) // surface gap de 2px
      const first = i === 0
      const last = i === vals.length - 1 || vals.slice(i + 1).every((u) => u <= 0)
      // coins : 4px seulement aux extrémités de la barre
      const rx = first || last ? 4 : 0
      s += `<rect class="g${i}" x="${x.toFixed(1)}" y="${y}" width="${wDraw.toFixed(1)}" height="${barH}" rx="${rx}"/>`
      const lab = fmtK(v)
      if (wDraw > lab.length * 7 + 10) s += `<text x="${(x + 6).toFixed(1)}" y="${y + barH / 2 + 4}" font-size="11" fill="${SEG[i].ink}" class="tab">${lab}</text>`
      x += w
    })
  })
  s += '</svg>'
  fs.writeFileSync(path.join(OUT, fichier), s)
}
graphiqueRepartition(180000, { couple: false, enfants: 0 }, 'repartition-180k.svg')
console.log('Graphiques écrits dans', OUT)
console.log('Contrôle 400 k€ (célibataire) :', d1[d1.length - 1])
