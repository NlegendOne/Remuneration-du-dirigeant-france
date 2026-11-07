// Analyse complète : cas 180 k€, balayage 10 k€ -> 400 k€, points de bascule,
// couverture sociale, combinaisons de deux structures.
// Usage : npm run analyse   (écrit dans resultats/)
import fs from 'node:fs'
import path from 'node:path'
import * as M from '../src/moteur.js'

const OUT = path.resolve('resultats')
fs.mkdirSync(OUT, { recursive: true })
const eur = (x) => Math.round(x).toLocaleString('fr-FR').replace(/ /g, ' ') + ' €'
const k = (x) => (x / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' k€'

const FOYERS = {
  celibataire: { label: 'Célibataire, sans enfant', foyer: { couple: false, enfants: 0 } },
  couple2enfants: {
    label: 'Couple marié/pacsé, 2 enfants, conjoint sans revenu',
    foyer: { couple: true, enfants: 2 },
  },
  coupleConjointSalarie: {
    label: 'Couple, conjoint salarié (40 000 € net imposable), sans enfant',
    foyer: { couple: true, enfants: 0, autresRevenusImposables: 36000, conjointActif: true },
  },
}
const NOMS = ["EI / EURL à l'IR", "EURL à l'IS", "SASU à l'IS", "SASU à l'IR"]

let md = []
const p = (s = '') => md.push(s)
const tableau = (entetes, lignes) => {
  p('| ' + entetes.join(' | ') + ' |')
  p('|' + entetes.map(() => '---').join('|') + '|')
  for (const l of lignes) p('| ' + l.join(' | ') + ' |')
  p()
}

// ------------------------------------------------------------------ A. Cas 180 k€
const B0 = 180000
p('# Résultats chiffrés (générés par scripts/analyse.mjs)')
p()
p(`Paramètres 2026 : PASS ${eur(M.PARAMS_2026.PASS)}, barème IR LF 2026, PFU 31,4 %, IS 15 % / 25 %.`)
p('Hypothèses : bénéfice avant rémunération du dirigeant, tout le disponible est versé dans l\'année, ')
p('capital social + comptes courants de l\'EURL = 1 000 €, taux AT/MP 1,25 %, prévoyance cadre 1,5 % incluse en SASU.')
p()
const detail = {}
for (const [cle, F] of Object.entries(FOYERS)) {
  p(`## A. Bénéfice de 180 000 €, ${F.label.toLowerCase()}`)
  p()
  const res = M.comparer(B0, F.foyer)
  detail[cle] = res
  const best = Math.max(...res.map((r) => r.revenuDisponible))
  tableau(
    ['Structure (optimisée)', 'Rémunération', 'Dividendes / quote-part', 'IS', 'Cotisations', 'PS capital', 'IR + CEHR', 'Taxe PUMa', 'Mode div.', '**Revenu disponible**', 'Écart'],
    res.map((r) => [
      r.structure,
      eur(r.choix.remuneration) + (r.structure.startsWith('SASU') ? ' brut' : ' (coût)'),
      eur(r.choix.dividendes || r.choix.quotePart || 0),
      eur(r.is),
      eur(r.cotisations),
      eur(r.prelevementsSociaux),
      eur(r.impotRevenu),
      eur(r.csm),
      r.modeDividendes,
      '**' + eur(r.revenuDisponible) + '**',
      eur(r.revenuDisponible - best),
    ]),
  )
}

// Variantes SASU IS / EURL IS / SASU IR (célibataire)
const f0 = FOYERS.celibataire.foyer
const seuilIJ = Math.ceil(2030 * M.PARAMS_2026.SMIC_H)
const seuil4T = 600 * M.PARAMS_2026.SMIC_H_JANVIER
// salaire brut tel que le net imposable atteigne 20 % du PASS (taxe PUMa)
let sPUMa = 0
while (M.cotisationsAssimileSalarie(sPUMa).netImposable < 0.2 * M.PARAMS_2026.PASS) sPUMa += 10
const variantes = [
  ['SASU IS, dividendes seuls (0 salaire)', M.evaluerSASU_IS(B0, 0, f0)],
  [`SASU IS, salaire 4 trimestres (${eur(seuil4T)} brut)`, M.evaluerSASU_IS(B0, seuil4T, f0)],
  [`SASU IS, salaire anti taxe PUMa (${eur(sPUMa)} brut)`, M.evaluerSASU_IS(B0, sPUMa, f0)],
  [`SASU IS, salaire seuil IJ (${eur(seuilIJ)} brut)`, M.evaluerSASU_IS(B0, seuilIJ, f0)],
  ['SASU IS, salaire = 1 PASS (48 060 € brut)', M.evaluerSASU_IS(B0, 48060, f0)],
  ['SASU IS, salaire 100 000 € brut', M.evaluerSASU_IS(B0, 100000, f0)],
  ['SASU IS, tout en salaire', M.evaluerSASU_IS(B0, M.brutDepuisCout(B0), f0)],
  ['EURL IS, tout en rémunération', M.evaluerEURL_IS(B0, B0, f0)],
  ['EURL IS, rémunération 100 000 €', M.evaluerEURL_IS(B0, 100000, f0)],
  ['EURL IS, rémunération 60 000 €', M.evaluerEURL_IS(B0, 60000, f0)],
  ['SASU IR, 0 salaire', M.evaluerSASU_IR(B0, 0, f0)],
  [`SASU IR, salaire anti taxe PUMa (${eur(sPUMa)} brut)`, M.evaluerSASU_IR(B0, sPUMa, f0)],
  ['SASU IR, salaire = 1 PASS', M.evaluerSASU_IR(B0, 48060, f0)],
]
p('## A bis. Variantes à 180 000 € (célibataire)')
p()
tableau(
  ['Variante', 'IS', 'Cotisations', 'PS', 'IR', 'PUMa', 'Disponible', 'Trim.', 'Pension carrière complète', 'IJ/jour'],
  variantes.map(([n, r]) => [
    n,
    eur(r.is),
    eur(r.cotisations),
    eur(r.prelevementsSociaux),
    eur(r.impotRevenu),
    eur(r.csm),
    '**' + eur(r.revenuDisponible) + '**',
    r.protection.trimestres,
    eur(r.protection.pensionCarriereComplete) + '/an',
    r.protection.ijJour.toFixed(0) + ' €',
  ]),
)

// ------------------------------------------------------------------ B. Couverture sociale
p('## B. Protection sociale générée à 180 000 € (célibataire, solutions optimisées)')
p()
tableau(
  ['Structure', 'Régime', 'Trimestres', 'Revenu retenu retraite base', 'Points compl./an', 'Pension carrière complète*', 'IJ maladie', 'Invalidité totale', 'Capital décès'],
  detail.celibataire.map((r) => [
    r.structure,
    r.protection.regime,
    r.protection.trimestres,
    eur(r.protection.revenuRetraiteBase),
    r.protection.pointsComplementaire.toFixed(0) + ' (' + r.protection.caisseComplementaire + ')',
    eur(r.protection.pensionCarriereComplete) + '/an',
    r.protection.ijJour.toFixed(2) + ' €/j',
    eur(r.protection.invaliditeTotaleAn) + '/an',
    eur(r.protection.capitalDeces),
  ]),
)
p('*Pension annuelle brute si ce schéma était maintenu 43 ans : base = 50 % du revenu retenu (plafonné au PASS), ')
p('complémentaire = points annuels x 43 x valeur de service 2026. Ordre de grandeur, hors réformes futures.')
p()

// Coût de la protection (SASU IS) et équivalent épargne
const rendementReel = 0.02
const tauxConversion = 0.04
const facteurCapitalisation = ((1 + rendementReel) ** 43 - 1) / rendementReel
p('## C. Combien coûte la couverture ? (célibataire, 180 000 €)')
p()
p(`Comparaison : ce que donnerait le même effort placé 43 ans à ${rendementReel * 100} % réel/an puis converti en rente à ${tauxConversion * 100} % (épargne privée).`)
p()
const ref = detail.celibataire.find((r) => r.structure === "SASU à l'IS")
const refE = detail.celibataire.find((r) => r.structure === "EURL à l'IS")
const comparaisons = [
  ['SASU IS : optimum -> salaire seuil IJ', ref, M.evaluerSASU_IS(B0, Math.max(seuilIJ, ref.choix.remuneration), f0)],
  ['SASU IS : optimum -> salaire 1 PASS', ref, M.evaluerSASU_IS(B0, 48060, f0)],
  ['SASU IS : optimum -> salaire 100 k€', ref, M.evaluerSASU_IS(B0, 100000, f0)],
  ['EURL IS : optimum -> tout en rémunération', refE, M.evaluerEURL_IS(B0, B0, f0)],
  ['SASU IS optimum -> EURL IS optimum', ref, refE],
]
tableau(
  ['Passage', 'Revenu disponible perdu / an', 'Pension carrière complète gagnée / an', 'Rente équivalente via épargne privée', 'Verdict'],
  comparaisons.map(([n, a, b]) => {
    const perte = a.revenuDisponible - b.revenuDisponible
    const gain = b.protection.pensionCarriereComplete - a.protection.pensionCarriereComplete
    const prive = perte * facteurCapitalisation * tauxConversion
    return [n, eur(perte), eur(gain), perte > 0 ? eur(prive) : '-', perte <= 0 ? 'gagnant sur les deux tableaux' : gain > prive ? 'la cotisation « rapporte » plus' : 'l\'épargne privée rapporte plus']
  }),
)

// ------------------------------------------------------------------ D. Balayage + points de bascule
const PAS = 2500
const balayage = {}
for (const [cle, F] of Object.entries(FOYERS)) {
  const lignes = []
  for (let B = 10000; B <= 400000; B += PAS) {
    const res = M.comparer(B, F.foyer)
    const ligne = { benefice: B }
    for (const r of res) {
      ligne[r.structure] = r.revenuDisponible
      ligne[r.structure + ' |rému'] = r.choix.remuneration
      ligne[r.structure + ' |trim'] = r.protection.trimestres
      ligne[r.structure + ' |pension'] = r.protection.pensionCarriereComplete
      ligne[r.structure + ' |IJ'] = r.protection.ijJour
    }
    lignes.push(ligne)
  }
  balayage[cle] = lignes
  const csv = [Object.keys(lignes[0]).join(';')]
    .concat(lignes.map((l) => Object.values(l).map((v) => (typeof v === 'number' ? Math.round(v) : v)).join(';')))
    .join('\n')
  fs.writeFileSync(path.join(OUT, `balayage-${cle}.csv`), csv)
}

function croisements(lignes, a, b, tol = 5) {
  // bascule = changement de signe de l'écart a - b, en ignorant les quasi-égalités (< tol €)
  const pts = []
  let prec = null
  for (let i = 0; i < lignes.length; i++) {
    const d = lignes[i][a] - lignes[i][b]
    if (Math.abs(d) < tol) continue
    if (prec && Math.sign(prec.d) !== Math.sign(d)) {
      const x = prec.x + ((lignes[i].benefice - prec.x) * prec.d) / (prec.d - d)
      pts.push({ x, avant: prec.d > 0 ? a : b, apres: d > 0 ? a : b })
    }
    prec = { x: lignes[i].benefice, d }
  }
  return pts
}

p('## D. Points de bascule (balayage 10 k€ -> 400 k€, pas de 2,5 k€, chaque structure optimisée)')
p()
const bascules = {}
for (const [cle, F] of Object.entries(FOYERS)) {
  const L = balayage[cle]
  p(`### ${F.label}`)
  p()
  // meilleure structure par tranche
  const zones = []
  for (const l of L) {
    const best = NOMS.reduce((a, b) => (l[a] >= l[b] ? a : b))
    if (!zones.length || zones[zones.length - 1].best !== best) zones.push({ best, de: l.benefice, a: l.benefice })
    else zones[zones.length - 1].a = l.benefice
  }
  p('Meilleure structure selon le bénéfice :')
  p()
  for (const z of zones) p(`- de ${k(z.de)} à ${k(z.a)} : **${z.best}**`)
  p()
  const paires = [
    ["EI / EURL à l'IR", "EURL à l'IS"],
    ["EI / EURL à l'IR", "SASU à l'IS"],
    ["EURL à l'IS", "SASU à l'IS"],
    ["SASU à l'IR", "SASU à l'IS"],
    ["EI / EURL à l'IR", "SASU à l'IR"],
  ]
  const lignesT = []
  bascules[cle] = []
  for (const [a, b] of paires) {
    const c = croisements(L, a, b)
    bascules[cle].push({ a, b, points: c })
    lignesT.push([
      `${a} vs ${b}`,
      c.length ? c.map((x) => `${k(x.x)} (${x.avant} -> ${x.apres})`).join(' ; ') : `aucun : ${L[L.length - 1][a] > L[L.length - 1][b] ? a : b} toujours devant`,
    ])
  }
  tableau(['Duel', 'Bénéfice de bascule'], lignesT)
  // tableau de synthèse
  const pts = [20000, 40000, 60000, 80000, 100000, 120000, 150000, 180000, 220000, 300000, 400000]
  tableau(
    ['Bénéfice', ...NOMS, 'Gagnant', 'Avance sur le 2e'],
    pts.map((B) => {
      const l = L.find((x) => x.benefice === B)
      const tri = [...NOMS].sort((a, b) => l[b] - l[a])
      const best = tri[0]
      const avance = l[tri[0]] - l[tri[1]]
      return [
        k(B),
        ...NOMS.map((n) => (n === best ? '**' + eur(l[n]) + '**' : eur(l[n]))),
        best,
        eur(avance) + ' (' + ((100 * avance) / l[best]).toFixed(1) + ' %)',
      ]
    }),
  )
}

// ------------------------------------------------------------------ D bis. Sensibilités EURL IS
p('## D bis. Robustesse de l\'EURL à l\'IS (célibataire)')
p()
tableau(
  ['Bénéfice', 'EURL IS (cotisations sur dividendes payées par la société)', 'Variante prudente (payées par le gérant, non déductibles)', 'Capital + comptes courants 50 k€', 'SASU IS optimisée'],
  [80000, 120000, 180000, 250000, 400000].map((B) => [
    k(B),
    eur(M.optimiserEURL_IS(B, f0).revenuDisponible),
    eur(M.optimiserEURL_IS(B, f0, M.PARAMS_2026, { cotisationsDividendesPersonnelles: true }).revenuDisponible),
    eur(M.optimiserEURL_IS(B, f0, M.PARAMS_2026, { capitalEtCCA: 50000 }).revenuDisponible),
    eur(M.optimiserSASU_IS(B, f0).revenuDisponible),
  ]),
)

// ------------------------------------------------------------------ E. Avec contrainte de protection
p('## E. Structures « durables » (hors SASU IR, limitée à 5 exercices) avec un plancher de protection')
p()
p(`Deux planchers testés en SASU : salaire ≥ ${eur(seuil4T)} brut (4 trimestres de retraite) et salaire ≥ ${eur(seuilIJ)} brut`)
p('(indemnités journalières et invalidité). Les structures TNS remplissent ces conditions dès quelques milliers d\'euros de revenu.')
p()
const DURABLES = ["EI / EURL à l'IR", "EURL à l'IS", "SASU à l'IS"]
const sousContrainte = {}
for (const [cle, F] of Object.entries(FOYERS)) {
  p(`### ${F.label}`)
  p()
  const lignesE = []
  for (const [nomC, smin] of [['sans plancher', 0], ['4 trimestres', seuil4T], ['seuil IJ', seuilIJ]]) {
    const Lc = []
    for (let B = 20000; B <= 400000; B += PAS) {
      const l = { benefice: B }
      l["EI / EURL à l'IR"] = M.scenarioEURL_IR(B, F.foyer).revenuDisponible
      l["EURL à l'IS"] = M.optimiserEURL_IS(B, F.foyer).revenuDisponible
      const s = M.optimiserSASU_IS(B, F.foyer, M.PARAMS_2026, { salaireMin: smin })
      l["SASU à l'IS"] = s ? s.revenuDisponible : -Infinity
      Lc.push(l)
    }
    sousContrainte[cle + '|' + nomC] = Lc
    const zones = []
    for (const l of Lc) {
      const best = DURABLES.reduce((a, b) => (l[a] >= l[b] ? a : b))
      if (!zones.length || zones[zones.length - 1].best !== best) zones.push({ best, de: l.benefice, a: l.benefice })
      else zones[zones.length - 1].a = l.benefice
    }
    const c = croisements(Lc, "EURL à l'IS", "SASU à l'IS")
    lignesE.push([
      nomC,
      zones.map((z) => `${k(z.de)}-${k(z.a)} : ${z.best}`).join(' ; '),
      c.map((x) => k(x.x) + ' (' + x.avant + ' -> ' + x.apres + ')').join(' ; ') || 'aucune',
    ])
  }
  tableau(['Plancher SASU', 'Meilleure structure durable', 'Bascule EURL IS / SASU IS'], lignesE)
}
const Lc = sousContrainte['celibataire|seuil IJ']

// ------------------------------------------------------------------ F. Deux structures
p('## F. Deux structures pour deux activités distinctes (célibataire)')
p()
const combos = ['EURL_IR+SASU_IS', 'EURL_IS+SASU_IS', 'SASU_IS+SASU_IS']
const lignesCombo = []
const combosData = []
for (const B of [80000, 120000, 180000, 250000, 400000]) {
  const seul = M.comparer(B, f0)
  const meilleurSeul = seul.reduce((a, b) => (a.revenuDisponible >= b.revenuDisponible ? a : b))
  const row = [k(B), `${meilleurSeul.structure} : ${eur(meilleurSeul.revenuDisponible)}`]
  for (const t of combos) {
    const r = M.optimiserCombo(B, t, f0)
    combosData.push({ benefice: B, type: t, r })
    row.push(
      `${eur(r.revenuDisponible)} (${r.revenuDisponible - meilleurSeul.revenuDisponible >= 0 ? '+' : ''}${eur(r.revenuDisponible - meilleurSeul.revenuDisponible)}) ; répartition ${k(r.choix.beneficeStructure1)} / ${k(r.choix.beneficeStructure2)}`,
    )
  }
  lignesCombo.push(row)
}
tableau(['Bénéfice total', 'Meilleure structure unique', 'EI/EURL IR + SASU IS', 'EURL IS + SASU IS', 'SASU IS + SASU IS'], lignesCombo)
p('Les gains affichés sont AVANT frais de la seconde structure (expertise comptable, juridique, CFE, banque),')
p('typiquement 2 000 à 4 000 € par an, et sous réserve que les deux activités soient réellement distinctes (risque d\'abus de droit, art. L64 et L64 A LPF).')
p()

// ------------------------------------------------------------------ G. Où va l'argent ?
p('## G. Où partent les 180 000 € ? (célibataire, solutions optimisées)')
p()
function droitsRetraite(r) {
  const c = r.detailCotisations
  if (r.structure.startsWith('SASU')) {
    // vieillesse plafonnée (droits de base) + part Agirc-Arrco génératrice de points (taux contractuel / 127 %)
    return c.employeur.vieillessePlafonnee + c.salarie.vieillessePlafonnee + (c.employeur.agircArrco + c.salarie.agircArrco) / 1.27
  }
  // TNS : retraite de base sous le PASS + RCI
  return 0.1787 * Math.min(Math.max(c.assiette, 450 * M.PARAMS_2026.SMIC_H_JANVIER), M.PARAMS_2026.PASS) + c.retraiteComplementaire
}
tableau(
  ['Structure', 'IS', 'Cotisations sociales', 'dont créant des droits retraite', 'PS 18,6 %', 'IR', 'Total prélevé', 'Taux global', 'Disponible'],
  detail.celibataire.map((r) => {
    const tot = B0 - r.revenuDisponible
    return [
      r.structure,
      eur(r.is),
      eur(r.cotisations),
      eur(droitsRetraite(r)),
      eur(r.prelevementsSociaux),
      eur(r.impotRevenu + r.csm),
      eur(tot),
      ((100 * tot) / B0).toFixed(1) + ' %',
      eur(r.revenuDisponible),
    ]
  }),
)

// ------------------------------------------------------------------ H. Taux marginaux
p('## H. Que reste-t-il d\'un euro de bénéfice supplémentaire ? (célibataire, sur 1 000 € de plus)')
p()
const marg = (fn, B) => (fn(B + 1000).revenuDisponible - fn(B).revenuDisponible) / 1000
const routes = [
  ['EI / EURL IR', (B) => M.scenarioEURL_IR(B, f0)],
  ['EURL IS optimisée', (B) => M.optimiserEURL_IS(B, f0)],
  ['SASU IS optimisée', (B) => M.optimiserSASU_IS(B, f0)],
  ['SASU IS, salaire figé à 12 k€, reste en dividendes', (B) => M.evaluerSASU_IS(B, 12000, f0)],
  ['SASU IR optimisée', (B) => M.optimiserSASU_IR(B, f0)],
]
const niveaux = [30000, 60000, 100000, 180000, 300000]
tableau(
  ['Route', ...niveaux.map(k)],
  routes.map(([n, fn]) => [n, ...niveaux.map((B) => (100 * marg(fn, B)).toFixed(0) + ' %')]),
)
p('Lecture : pourcentage de 1 000 € de bénéfice supplémentaire qui arrive réellement dans votre poche.')
p()

// ------------------------------------------------------------------ I. Rémunération optimale
p('## I. Rémunération optimale selon le bénéfice (célibataire)')
p()
const Lb = balayage.celibataire
tableau(
  ['Bénéfice', 'SASU IS : salaire brut optimal', 'EURL IS : rémunération optimale (coût)', 'SASU IR : salaire brut optimal'],
  [30000, 50000, 80000, 100000, 150000, 180000, 250000, 400000].map((B) => {
    const l = Lb.find((x) => x.benefice === B)
    return [k(B), eur(l["SASU à l'IS |rému"]), eur(l["EURL à l'IS |rému"]), eur(l["SASU à l'IR |rému"])]
  }),
)

fs.writeFileSync(path.join(OUT, 'resultats.md'), md.join('\n'))
fs.writeFileSync(
  path.join(OUT, 'donnees.json'),
  JSON.stringify(
    {
      parametres: M.PARAMS_2026,
      balayage,
      bascules,
      sousContrainteIJ: Lc,
      combos: combosData.map((c) => ({ benefice: c.benefice, type: c.type, revenuDisponible: c.r.revenuDisponible, choix: c.r.choix })),
    },
    (key, v) => (v === Infinity ? null : v),
    0,
  ),
)
console.log(md.join('\n'))
