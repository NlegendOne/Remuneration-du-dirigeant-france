// Capitaliser dans la société ou tout distribuer ? Analyse pluriannuelle (EURL IS, SASU IS)
// Usage : node scripts/capitalisation.mjs   (écrit resultats/capitalisation.md)
//
// Principe : à train de vie identique (consommation annuelle C), on compare le patrimoine net
// constitué au bout de N ans selon la réserve laissée chaque année dans la société.
//  - côté perso : le surplus (revenu disponible - C) est placé à r, gains taxés à la sortie ;
//  - côté société : la réserve est placée à r, produits taxés chaque année à l'IS (25 %),
//    puis sortie selon 4 modes (dividendes, cession, cession au départ en retraite, transmission).
import fs from 'node:fs'
import * as M from '../src/moteur.js'

const P = M.PARAMS_2026
const foyer = { couple: false, enfants: 0 }
const R_PLACEMENT = 0.04 // rendement brut annuel, identique dedans et dehors
const IS_PRODUITS = 0.25 // produits financiers de la société taxés à 25 % (base IS déjà > 42 500 €)
const TAUX_PERSO = { pea: 0.186, cto: 0.314 } // fiscalité des gains du placement personnel
const CONSO = 60000 // train de vie annuel identique dans tous les scénarios
const eur = (x) => Math.round(x).toLocaleString('fr-FR').replace(/[  ]/g, ' ') + ' €'
const k = (x) => (x / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' k€'

// ------------------------------------------------------------ fiscalité de sortie de la réserve G
function sortieDividendes(structure, G) {
  // distribution en une fois, l'année suivant l'arrêt de l'activité (aucun autre revenu)
  if (structure === 'SASU') {
    const pfu = 0.314 * G
    const ir = M.impotRevenu({ revenuImposable: 0.6 * G - 0.068 * G, rfrSupplement: 0.4 * G }, foyer).total
    return Math.min(pfu, ir + 0.186 * G)
  }
  // EURL : gérant majoritaire, dividendes (ou boni de liquidation) soumis aux cotisations TNS
  const c = M.cotisationsTNS(G)
  const pfu = 0.128 * G
  const bareme = M.impotRevenu({ revenuImposable: 0.6 * G - c.csgDeductible, rfrSupplement: 0.4 * G }, foyer).total
  return c.total + Math.min(pfu, bareme)
}
// distribution étalée sur 10 ans pendant la retraite, avec une pension imposable de 30 000 €/an
const PENSION = 30000
function sortieEtalee(structure, G) {
  const d = G / 10
  const f = { ...foyer, autresRevenusImposables: 0.9 * PENSION }
  const irPension = M.impotRevenu({ revenuImposable: 0.9 * PENSION }, f).total
  let impot
  if (structure === 'SASU') {
    const pfu = M.impotRevenu({ revenuImposable: 0.9 * PENSION, montantPFU: d }, f).total - irPension
    const bar = M.impotRevenu({ revenuImposable: 0.9 * PENSION + 0.6 * d - 0.068 * d, rfrSupplement: 0.4 * d }, f).total - irPension
    impot = Math.min(pfu, bar) + 0.186 * d
  } else {
    // EURL : le retraité resté gérant majoritaire cotise encore au régime TNS sur ses dividendes
    const c = M.cotisationsTNS(d)
    const pfu = 0.128 * d
    const bar = M.impotRevenu({ revenuImposable: 0.9 * PENSION + 0.6 * d - c.csgDeductible, rfrSupplement: 0.4 * d }, f).total - irPension
    impot = c.total + Math.min(pfu, bar)
  }
  return 10 * impot
}
const SORTIES = {
  dividendes: { label: 'Dividendes / liquidation en une fois', f: sortieDividendes },
  etalee: { label: 'Dividendes étalés sur 10 ans de retraite', f: sortieEtalee },
  cession: { label: 'Cession des titres (PFU 31,4 %)', f: (s, G) => 0.314 * G },
  retraite: { label: 'Cession au départ en retraite (abattement 500 k€)', f: (s, G) => 0.128 * Math.max(0, G - 500000) + 0.186 * G },
  transmission: { label: 'Transmission (donation, succession)', f: () => 0 },
}

// ------------------------------------------------------------ simulation pluriannuelle
function annee(structure, benefice, reserve) {
  const opts = { reserve }
  return structure === 'EURL' ? M.optimiserEURL_IS(benefice, foyer, P, opts) : M.optimiserSASU_IS(benefice, foyer, P, opts)
}

function simuler(structure, benefice, reserve, N, tauxPerso) {
  const a = annee(structure, benefice, reserve)
  if (!a || a.revenuDisponible < CONSO - 1) return null
  const surplus = a.revenuDisponible - CONSO
  let perso = 0
  let verse = 0
  let soc = 0
  for (let t = 0; t < N; t++) {
    perso = perso * (1 + R_PLACEMENT) + surplus
    verse += surplus
    soc = soc * (1 + R_PLACEMENT * (1 - IS_PRODUITS)) + reserve
  }
  const persoNet = perso - tauxPerso * Math.max(0, perso - verse)
  const res = {}
  for (const [cle, s] of Object.entries(SORTIES)) {
    // en cas de transmission, les plus-values latentes du placement personnel sont aussi purgées
    const perso_ = cle === 'transmission' ? perso : persoNet
    res[cle] = perso_ + soc - s.f(structure, soc)
  }
  return { a, surplus, persoNet, soc, res }
}

// ------------------------------------------------------------ rapport
const md = []
const p = (s = '') => md.push(s)
const tab = (h, L) => {
  p('| ' + h.join(' | ') + ' |')
  p('|' + h.map(() => '---').join('|') + '|')
  L.forEach((l) => p('| ' + l.join(' | ') + ' |'))
  p()
}
p('# Capitaliser dans la société ou tout distribuer ?')
p()
p(`Hypothèses : célibataire, train de vie de ${eur(CONSO)} par an dans tous les scénarios, placement à ${R_PLACEMENT * 100} % brut par an `)
p(`dans la société (produits taxés à l'IS à ${IS_PRODUITS * 100} % chaque année) comme à titre personnel (gains taxés à la sortie, ${TAUX_PERSO.pea * 100} % type PEA). `)
p('Règles 2026 figées sur toute la durée. La « tranche à 15 % » = laisser chaque année 42 500 € de bénéfice imposable à 15 %, soit une réserve nette de 36 125 €.')
p()

const RESERVES = [0, 36125, 60000, 80000]
for (const B of [120000, 180000, 250000]) {
  for (const N of [10, 20]) {
    p(`## Bénéfice ${k(B)}, horizon ${N} ans : patrimoine net final selon le mode de sortie`)
    p()
    const lignes = []
    for (const st of ['EURL', 'SASU']) {
      const base = simuler(st, B, 0, N, TAUX_PERSO.pea)
      for (const X of RESERVES) {
        const s = simuler(st, B, X, N, TAUX_PERSO.pea)
        const nom = `${st} IS, réserve ${X === 0 ? '0 (tout distribuer)' : X === 36125 ? '36 125 € (tranche à 15 %)' : eur(X)}`
        if (!s) {
          lignes.push([nom, 'train de vie non couvert', ...Object.keys(SORTIES).map(() => '')])
          continue
        }
        const cell = (cle) => {
          const v = s.res[cle]
          const d = v - base.res[cle]
          return X === 0 ? eur(v) : `${eur(v)} (${d >= 0 ? '+' : ''}${eur(d)})`
        }
        lignes.push([nom, eur(s.a.revenuDisponible), ...Object.keys(SORTIES).map(cell)])
      }
    }
    tab(['Stratégie annuelle', 'Revenu disponible / an', ...Object.values(SORTIES).map((s) => s.label)], lignes)
  }
}

// Réserve optimale (grille fine) à 180 k€
p('## Quelle réserve annuelle maximise le patrimoine ? (bénéfice 180 k€)')
p()
const lignesOpt = []
for (const st of ['EURL', 'SASU']) {
  for (const N of [10, 20]) {
    for (const [cle, s] of Object.entries(SORTIES)) {
      let best = null
      for (let X = 0; X <= 120000; X += 2500) {
        const r = simuler(st, 180000, X, N, TAUX_PERSO.pea)
        if (r && (!best || r.res[cle] > best.v)) best = { X, v: r.res[cle] }
      }
      const z = simuler(st, 180000, 0, N, TAUX_PERSO.pea).res[cle]
      const q = simuler(st, 180000, 36125, N, TAUX_PERSO.pea).res[cle]
      lignesOpt.push([`${st} IS`, `${N} ans`, s.label, eur(best.X), eur(best.v - z), eur(q - z)])
    }
  }
}
tab(['Structure', 'Horizon', 'Sortie', 'Réserve optimale / an', 'Gain vs tout distribuer', 'Gain de la tranche à 15 % seule'], lignesOpt)

// Sensibilité placement perso CTO
p('## Sensibilité : placement personnel sur compte-titres (gains taxés 31,4 %)')
p()
const lignesCTO = []
for (const st of ['EURL', 'SASU']) {
  const z = simuler(st, 180000, 0, 20, TAUX_PERSO.cto)
  const q = simuler(st, 180000, 36125, 20, TAUX_PERSO.cto)
  lignesCTO.push([`${st} IS, 180 k€, 20 ans`, ...Object.keys(SORTIES).map((c) => `${q.res[c] - z.res[c] >= 0 ? '+' : ''}${eur(q.res[c] - z.res[c])}`)])
}
tab(['Gain de la tranche à 15 % vs tout distribuer', ...Object.values(SORTIES).map((s) => s.label)], lignesCTO)

// Coût de sortie d'1 € de réserve (taux effectifs)
p('## Taux effectif de sortie d\'une réserve de 500 000 € (en une fois, sans autre revenu)')
p()
tab(['Mode de sortie', 'EURL IS', 'SASU IS'], Object.entries(SORTIES).map(([cle, s]) => [s.label, (100 * s.f('EURL', 500000) / 500000).toFixed(1) + ' %', (100 * s.f('SASU', 500000) / 500000).toFixed(1) + ' %']))

fs.writeFileSync('resultats/capitalisation.md', md.join('\n'))
console.log(md.join('\n'))
