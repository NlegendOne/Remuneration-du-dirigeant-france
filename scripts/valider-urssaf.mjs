// Validation du moteur contre les moteurs officiels de l'Urssaf (publicodes)
//  - modele-ti 0.1.0   : travailleurs indépendants, réforme de l'assiette 2025/2026
//  - modele-social 11.1.0 : assimilés salariés (président de SASU) et barème IR
// Usage : npm run valider
import Engine from 'publicodes'
import reglesTI from 'modele-ti'
import reglesSocial from 'modele-social'
import {
  PARAMS_2026,
  cotisationsTNS,
  cotisationsAssimileSalarie,
  impotRevenu,
} from '../src/moteur.js'

const silencieux = { logger: { log() {}, warn() {}, error() {} } }
const ti = new Engine(reglesTI, silencieux)
const soc = new Engine(reglesSocial, silencieux)
const val = (e, r) => e.evaluate(r).nodeValue
const pct = (a, b) => (b === 0 ? (a === 0 ? 0 : Infinity) : (100 * (a - b)) / b)
let ecartMax = 0
const ligne = (...c) => console.log(c.map((x) => String(x).padStart(13)).join(''))

// ---------------------------------------------------------------- TNS (EI / EURL IR)
console.log('\n== Indépendant (EI / EURL à l\'IR) : cotisations totales, moteur vs Urssaf modele-ti')
ligne('Bénéfice', 'Moteur', 'Urssaf', 'Écart %', 'Retr.base', 'Urssaf', 'RCI', 'Urssaf')
for (const B of [5000, 15000, 30000, 50000, 80000, 120000, 180000, 250000, 400000]) {
  ti.setSituation({
    'entreprise . catégorie juridique': "'SARL'",
    'entreprise . imposition': "'IR'",
    "entreprise . chiffre d'affaires": `${B} €/an`,
    'entreprise . charges': '0 €/an',
    'entreprise . date de création': '01/01/2020',
  })
  const u = val(ti, 'indépendant . cotisations et contributions')
  const m = cotisationsTNS(B)
  const e = pct(m.total, u)
  ecartMax = Math.max(ecartMax, Math.abs(e))
  ligne(
    B,
    m.total.toFixed(0),
    u.toFixed(0),
    e.toFixed(2),
    m.retraiteBase.toFixed(0),
    val(ti, 'indépendant . cotisations et contributions . cotisations . retraite de base').toFixed(0),
    m.retraiteComplementaire.toFixed(0),
    val(ti, 'indépendant . cotisations et contributions . cotisations . retraite complémentaire').toFixed(0),
  )
}

// ---------------------------------------------------------------- TNS EURL IS (rémunération + dividendes)
console.log('\n== Gérant majoritaire d\'EURL à l\'IS : rémunération brute + dividendes soumis')
ligne('Rému brute', 'Div. soumis', 'Moteur', 'Urssaf', 'Écart %')
for (const [R, D] of [
  [40000, 0],
  [60000, 50000],
  [100000, 30000],
  [20000, 80000],
]) {
  ti.setSituation({
    'entreprise . catégorie juridique': "'SARL'",
    'entreprise . imposition': "'IS'",
    'entreprise . date de création': '01/01/2020',
    'indépendant . rémunération . brute': `${R} €/an`,
    'indépendant . dividendes . soumis à cotisations sociales': `${D} €/an`,
  })
  const u = val(ti, 'indépendant . cotisations et contributions')
  const m = cotisationsTNS(R + D)
  const e = pct(m.total, u)
  ecartMax = Math.max(ecartMax, Math.abs(e))
  ligne(R, D, m.total.toFixed(0), u.toFixed(0), e.toFixed(2))
}

// ---------------------------------------------------------------- Assimilé salarié
console.log('\n== Président de SASU (assimilé salarié) : moteur vs Urssaf modele-social')
console.log('   (Urssaf : mutuelle santé retirée, même taux AT/MP ; écart résiduel = contribution dialogue social 0,016 %)')
ligne('Brut', 'Coût moteur', 'Coût Urssaf', 'Écart %', 'Net moteur', 'Net Urssaf', 'Écart %')
for (const S of [7212, 12000, 25000, 48060, 60000, 90000, 150000]) {
  soc.setSituation({
    'entreprise . catégorie juridique': "'SAS'",
    'entreprise . associés': "'unique'",
    'dirigeant . régime social': "'assimilé salarié'",
    'entreprise . imposition': "'IS'",
    'salarié . contrat . salaire brut': `${S} €/an`,
    'entreprise . date de création': '01/01/2020',
    'établissement . taux ATMP': '1.25%',
  })
  const santeEmp = 12 * val(soc, 'salarié . cotisations . prévoyances . santé . employeur')
  const santeSal = 12 * (val(soc, 'salarié . cotisations . prévoyances . santé . salarié') || 0)
  const coutU = 12 * val(soc, 'salarié . coût total employeur') - santeEmp
  // la CSG porte aussi sur la part patronale santé : on la neutralise (9,7 %)
  const netU = 12 * val(soc, 'salarié . rémunération . net . à payer avant impôt') + santeSal + 0.097 * santeEmp
  const m = cotisationsAssimileSalarie(S)
  const e1 = pct(m.coutTotal, coutU)
  const e2 = pct(m.net, netU)
  ecartMax = Math.max(ecartMax, Math.abs(e1), Math.abs(e2))
  ligne(S, m.coutTotal.toFixed(0), coutU.toFixed(0), e1.toFixed(2), m.net.toFixed(0), netU.toFixed(0), e2.toFixed(2))
}

// ---------------------------------------------------------------- IR (barème standard)
console.log('\n== Impôt sur le revenu (barème LF 2026, quotient familial, décote) : moteur vs Urssaf modele-social')
ligne('Rev. imposable', 'Parts', 'Moteur', 'Urssaf', 'Écart €')
let ecartIR = 0
for (const [R, couple, enfants] of [
  [12000, false, 0],
  [30000, false, 0],
  [80000, false, 0],
  [133478, false, 0],
  [250000, false, 0],
  [45000, true, 0],
  [120000, true, 2],
  [200000, true, 3],
]) {
  soc.setSituation({
    'salarié . contrat . salaire brut': '0 €/mois',
    'impôt . méthode de calcul': "'barème standard'",
    'impôt . foyer fiscal . revenu imposable . autres revenus imposables': `${R} €/an`,
    'impôt . foyer fiscal . situation de famille': couple ? "'couple'" : "'célibataire'",
    'impôt . foyer fiscal . enfants à charge': `${enfants}`,
  })
  const u = val(soc, 'impôt . foyer fiscal . impôt sur le revenu')
  const foyer = { couple, enfants }
  const r = impotRevenu({ revenuImposable: R }, foyer)
  ecartIR = Math.max(ecartIR, Math.abs(r.impotBareme - u))
  ligne(R, r.parts, r.impotBareme.toFixed(0), u.toFixed(0), (r.impotBareme - u).toFixed(1))
}
if (ecartIR > 2) {
  console.error('ÉCHEC IR : écart > 2 €')
  process.exit(1)
}

console.log(`\nÉcart relatif maximal sur les cotisations : ${ecartMax.toFixed(2)} %`)
if (ecartMax > 1) {
  console.error('ÉCHEC : écart > 1 %')
  process.exit(1)
}
console.log('OK : moteur cohérent avec les moteurs officiels Urssaf (écart < 1 %).')
console.log(`PASS ${PARAMS_2026.PASS} €, SMIC horaire ${PARAMS_2026.SMIC_H} €`)
