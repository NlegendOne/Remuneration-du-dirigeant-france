/*
 * Moteur de comparaison des statuts du dirigeant (France, règles 2026)
 * ---------------------------------------------------------------------
 * EI / EURL à l'IR, EURL à l'IS, SASU à l'IS, SASU à l'IR (option 239 bis AB),
 * et combinaisons de deux structures.
 *
 * Aucune dépendance. Utilisable en Node (ESM) et dans le navigateur.
 * Les cotisations sont calibrées sur les moteurs officiels de l'Urssaf
 * (paquets npm « modele-ti » 0.1.0 pour les indépendants, réforme 2026 incluse,
 * et « modele-social » 11.1.0 pour les assimilés salariés) : voir
 * scripts/valider-urssaf.mjs.
 *
 * Convention : tous les montants sont annuels, en euros.
 */

// ---------------------------------------------------------------------------
// 1. Paramètres 2026
// ---------------------------------------------------------------------------
export const PARAMS_2026 = {
  annee: 2026,
  PASS: 48060, // arrêté du 22/12/2025 (4 005 €/mois)
  SMIC_H_JANVIER: 12.02, // SMIC horaire au 1er janvier 2026 (trimestres, assiettes minimales)
  SMIC_H: 12.31, // SMIC horaire depuis le 1er juin 2026 (revalorisation automatique +2,41 %)

  // Impôt sur le revenu : barème de la loi de finances pour 2026 (revenus 2025),
  // utilisé comme approximation pour les revenus 2026 (LF 2027 non adoptée au 07/11/2026).
  IR_TRANCHES: [
    { plafond: 11600, taux: 0 },
    { plafond: 29579, taux: 0.11 },
    { plafond: 84577, taux: 0.3 },
    { plafond: 181917, taux: 0.41 },
    { plafond: Infinity, taux: 0.45 },
  ],
  QF_PLAFOND_DEMI_PART: 1807,
  DECOTE_SEUL: 897,
  DECOTE_COUPLE: 1483,
  DECOTE_TAUX: 0.4525,
  ABATTEMENT_10_MIN: 509,
  ABATTEMENT_10_MAX: 14555,
  CEHR_SEUIL_SEUL: 250000,
  CEHR_SEUIL_COUPLE: 500000,
  CDHR_TAUX: 0.2,
  CDHR_DECOTE_TAUX: 0.825, // approximation (art. 224 CGI), voir docs
  CDHR_FIN_DECOTE_SEUL: 330000,
  CDHR_FIN_DECOTE_COUPLE: 660000,

  // Revenus de capitaux mobiliers (LFSS 2026 art. 12 : CSG 9,2 % -> 10,6 %)
  PFU_IR: 0.128,
  PS_CAPITAL: 0.186, // CSG 10,6 % + CRDS 0,5 % + prélèvement de solidarité 7,5 %
  CSG_DEDUCTIBLE_CAPITAL: 0.068,
  ABATTEMENT_DIVIDENDES: 0.4,

  // Cotisation subsidiaire maladie (« taxe PUMa »), art. L380-2 et D380-1 CSS
  CSM_TAUX: 0.065,
  CSM_SEUIL_ACTIVITE: 0.2, // x PASS
  CSM_ABATTEMENT_CAPITAL: 0.5, // x PASS
  CSM_PLAFOND_ASSIETTE: 8, // x PASS

  // Impôt sur les sociétés (art. 219 CGI)
  IS_TAUX_REDUIT: 0.15,
  IS_SEUIL_REDUIT: 42500,
  IS_TAUX_NORMAL: 0.25,

  // Retraite et prestations
  AGIRC_ARRCO_PRIX_ACHAT: 20.1877,
  AGIRC_ARRCO_VALEUR_SERVICE: 1.4386,
  RCI_PRIX_ACHAT: 21.726,
  RCI_VALEUR_SERVICE: 1.347,
  CAPITAL_DECES_REGIME_GENERAL: 3681, // valeur retenue par le simulateur Urssaf
  DUREE_CARRIERE_ANNEES: 43, // 172 trimestres (générations 1965 et suivantes)
}

// ---------------------------------------------------------------------------
// 2. Outils
// ---------------------------------------------------------------------------
const clamp = (x, a, b) => Math.min(Math.max(x, a), b)
const pos = (x) => (x > 0 ? x : 0)
const r2 = (x) => Math.round(x * 100) / 100

/** Mécanisme « taux progressif » de publicodes : interpolation linéaire entre paliers. */
function tauxProgressif(x, paliers) {
  if (x < paliers[0][0]) return paliers[0][1]
  for (let i = 1; i < paliers.length; i++) {
    const [p0, t0] = paliers[i - 1]
    const [p1, t1] = paliers[i]
    if (x < p1) return t0 + ((x - p0) / (p1 - p0)) * (t1 - t0)
  }
  return paliers[paliers.length - 1][1]
}

export function impotSocietes(benefice, P = PARAMS_2026) {
  const b = pos(benefice)
  return (
    P.IS_TAUX_REDUIT * Math.min(b, P.IS_SEUIL_REDUIT) +
    P.IS_TAUX_NORMAL * pos(b - P.IS_SEUIL_REDUIT)
  )
}

// ---------------------------------------------------------------------------
// 3. Cotisations du travailleur indépendant (SSI) : réforme de l'assiette 2025/2026
//    Décret n° 2024-688 du 5 juillet 2024 ; art. L131-6 et D613-1 s. CSS.
//    Activité commerciale ou libérale non réglementée (régime SSI).
// ---------------------------------------------------------------------------
export function cotisationsTNS(revenuBrut, P = PARAMS_2026, opts = {}) {
  const PASS = P.PASS
  const rb = pos(revenuBrut)
  // Assiette unique : revenu brut abattu de 26 % (abattement compris entre 1,76 % et 130 % du PASS)
  const abattement = clamp(0.26 * rb, 0.0176 * PASS, 1.3 * PASS)
  const assiette = pos(rb - abattement)

  // Maladie-maternité : taux progressif jusqu'à 3 PASS, 6,5 % au-delà
  const tauxMaladie =
    Math.round(
      tauxProgressif(assiette / PASS, [
        [0.2, 0],
        [0.4, 1.5],
        [0.6, 4],
        [1.1, 6.5],
        [2, 7.7],
        [3, 8.5],
      ]) * 100,
    ) / 10000
  const maladie = tauxMaladie * Math.min(assiette, 3 * PASS) + 0.065 * pos(assiette - 3 * PASS)

  // Indemnités journalières : 0,5 % (assiette minimale 40 % PASS, plafond 5 PASS)
  const ij = 0.005 * clamp(assiette, 0.4 * PASS, 5 * PASS)

  // Allocations familiales : 0 % jusqu'à 110 % PASS, progressif jusqu'à 3,1 % à 140 % PASS
  const tauxAF =
    Math.round(
      tauxProgressif(assiette / PASS, [
        [1.1, 0],
        [1.4, 3.1],
      ]) * 100,
    ) / 10000
  const allocationsFamiliales = tauxAF * assiette

  // Retraite de base : 17,87 % jusqu'au PASS, 0,72 % au-delà (assiette minimale 450 h SMIC)
  const assietteRetraite = Math.max(assiette, 450 * P.SMIC_H_JANVIER)
  const retraiteBase = 0.1787 * Math.min(assietteRetraite, PASS) + 0.0072 * pos(assietteRetraite - PASS)

  // Retraite complémentaire (RCI) : 8,1 % jusqu'au PASS, 9,1 % de 1 à 4 PASS
  const retraiteComplementaire =
    0.081 * Math.min(assiette, PASS) + 0.091 * pos(Math.min(assiette, 4 * PASS) - PASS)

  // Invalidité-décès : 1,3 % (assiette entre 11,5 % PASS et 1 PASS)
  const invaliditeDeces = 0.013 * clamp(assiette, 0.115 * PASS, PASS)

  // CSG-CRDS : 9,7 % dont 6,8 % déductible, 2,9 % non déductible (CSG 2,4 % + CRDS 0,5 %)
  const csgDeductible = 0.068 * assiette
  const csgNonDeductible = 0.029 * assiette

  // Contribution à la formation professionnelle
  const cfp = (opts.artisan ? 0.0029 : 0.0025) * PASS

  const cotisationsSociales =
    maladie + ij + allocationsFamiliales + retraiteBase + retraiteComplementaire + invaliditeDeces
  const total = cotisationsSociales + csgDeductible + csgNonDeductible + cfp

  return {
    revenuBrut: rb,
    abattement,
    assiette,
    maladie,
    ij,
    allocationsFamiliales,
    retraiteBase,
    retraiteComplementaire,
    invaliditeDeces,
    csgDeductible,
    csgNonDeductible,
    cfp,
    total,
    tauxMaladie,
    tauxAF,
  }
}

// ---------------------------------------------------------------------------
// 4. Cotisations de l'assimilé salarié (président de SAS/SASU sans contrat de travail)
//    Pas d'assurance chômage ni AGS ; pas de RGDU (réservée aux rémunérations
//    soumises à l'assurance chômage) ; taux réduits maladie / famille supprimés
//    en 2026 (intégrés à la RGDU).
// ---------------------------------------------------------------------------
export function cotisationsAssimileSalarie(brut, P = PARAMS_2026, opts = {}) {
  const PASS = P.PASS
  const S = pos(brut)
  const T1 = Math.min(S, PASS)
  const T2 = pos(Math.min(S, 8 * PASS) - PASS)
  const tauxATMP = opts.tauxATMP ?? 0.0125 // code risque 70.3AD (agences immobilières), 2026
  const prevoyanceCadre = opts.prevoyanceCadre === false ? 0 : 0.015 * T1
  const cet = S > PASS ? 0.0035 * Math.min(S, 8 * PASS) : 0

  const employeur = {
    maladie: 0.13 * S,
    allocationsFamiliales: 0.0525 * S,
    vieillessePlafonnee: 0.0855 * T1,
    vieillesseDeplafonnee: 0.0211 * S,
    atmp: tauxATMP * S,
    fnal: 0.001 * T1,
    csa: 0.003 * S,
    formationPro: 0.0055 * S,
    taxeApprentissage: 0.0068 * S,
    dialogueSocial: 0.00016 * S,
    agircArrco: 0.0472 * T1 + 0.1295 * T2,
    ceg: 0.0129 * T1 + 0.0162 * T2,
    cet: cet * 0.6,
    prevoyanceCadre,
  }
  const assietteCSG = 0.9825 * Math.min(S, 4 * PASS) + pos(S - 4 * PASS) + prevoyanceCadre
  const salarie = {
    vieillessePlafonnee: 0.069 * T1,
    vieillesseDeplafonnee: 0.004 * S,
    agircArrco: 0.0315 * T1 + 0.0864 * T2,
    ceg: 0.0086 * T1 + 0.0108 * T2,
    cet: cet * 0.4,
    csgDeductible: 0.068 * assietteCSG,
    csgNonDeductible: 0.024 * assietteCSG,
    crds: 0.005 * assietteCSG,
  }
  const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0)
  const totalEmployeur = sum(employeur)
  const totalSalarie = sum(salarie)
  const net = S - totalSalarie
  // Net imposable : on réintègre CSG non déductible + CRDS (la prévoyance « décès-invalidité »
  // patronale reste exonérée d'IR dans les limites de l'art. 83 CGI)
  const netImposable = net + salarie.csgNonDeductible + salarie.crds
  return {
    brut: S,
    employeur,
    salarie,
    totalEmployeur,
    totalSalarie,
    coutTotal: S + totalEmployeur,
    net,
    netImposable,
    pointsAgircArrco: (0.062 * T1 + 0.17 * T2) / P.AGIRC_ARRCO_PRIX_ACHAT,
  }
}

/** Inverse : salaire brut tel que le coût total employeur = cout (bissection). */
export function brutDepuisCout(cout, P = PARAMS_2026, opts = {}) {
  if (cout <= 0) return 0
  let lo = 0
  let hi = cout
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (cotisationsAssimileSalarie(mid, P, opts).coutTotal > cout) hi = mid
    else lo = mid
  }
  return lo
}

// ---------------------------------------------------------------------------
// 5. Impôt sur le revenu du foyer
// ---------------------------------------------------------------------------
export function nombreDeParts(foyer) {
  const base = foyer.couple ? 2 : 1
  const n = foyer.enfants || 0
  const enfants = n <= 2 ? 0.5 * n : 1 + (n - 2)
  return base + enfants
}

function baremeIR(revenuParPart, P) {
  let impot = 0
  let bas = 0
  for (const t of P.IR_TRANCHES) {
    if (revenuParPart > bas) impot += (Math.min(revenuParPart, t.plafond) - bas) * t.taux
    bas = t.plafond
  }
  return impot
}

export function tauxMarginal(revenuParPart, P = PARAMS_2026) {
  let bas = 0
  for (const t of P.IR_TRANCHES) {
    if (revenuParPart < t.plafond) return t.taux
    bas = t.plafond
  }
  return P.IR_TRANCHES[P.IR_TRANCHES.length - 1].taux
}

/**
 * @param revenuImposable revenu net global imposable au barème (après abattements)
 * @param montantPFU revenus soumis au PFU (taxés à 12,8 %)
 * @param rfrSupplement montants à ajouter au RFR (abattement 40 % réintégré, etc.)
 */
export function impotRevenu({ revenuImposable, montantPFU = 0, rfrSupplement = 0 }, foyer, P = PARAMS_2026) {
  const parts = nombreDeParts(foyer)
  const partsBase = foyer.couple ? 2 : 1
  const R = pos(revenuImposable)
  const impotAvecQF = parts * baremeIR(R / parts, P)
  const impotSansQF = partsBase * baremeIR(R / partsBase, P)
  const demiPartsSupp = (parts - partsBase) * 2
  const impotBrut = Math.max(impotAvecQF, impotSansQF - demiPartsSupp * P.QF_PLAFOND_DEMI_PART)
  const seuilDecote = foyer.couple ? P.DECOTE_COUPLE : P.DECOTE_SEUL
  const decote = Math.min(impotBrut, pos(seuilDecote - P.DECOTE_TAUX * impotBrut))
  const impotBareme = impotBrut - decote
  const pfu = P.PFU_IR * montantPFU
  const rfr = R + montantPFU + rfrSupplement
  const s = foyer.couple ? P.CEHR_SEUIL_COUPLE : P.CEHR_SEUIL_SEUL
  const cehr = 0.03 * pos(Math.min(rfr, 2 * s) - s) + 0.04 * pos(rfr - 2 * s)
  let cdhr = 0
  if (rfr > s) {
    const finDecote = foyer.couple ? P.CDHR_FIN_DECOTE_COUPLE : P.CDHR_FIN_DECOTE_SEUL
    let base = P.CDHR_TAUX * rfr - (impotBareme + pfu + cehr)
    if (rfr < finDecote) base -= P.CDHR_DECOTE_TAUX * (finDecote - rfr)
    cdhr = pos(base)
  }
  const total = impotBareme + pfu + cehr + cdhr
  return {
    parts,
    impotBrut,
    decote,
    impotBareme,
    pfu,
    cehr,
    cdhr,
    total,
    rfr,
    tmi: tauxMarginal(R / parts, P),
  }
}

function abattement10(montant, P) {
  if (montant <= 0) return 0
  return clamp(0.1 * montant, Math.min(P.ABATTEMENT_10_MIN, montant), P.ABATTEMENT_10_MAX)
}

/** Cotisation subsidiaire maladie (taxe PUMa). */
export function cotisationSubsidiaireMaladie(revenusActivite, revenusCapital, foyer, P = PARAMS_2026) {
  const PASS = P.PASS
  if (foyer.conjointActif) return 0 // le conjoint a des revenus d'activité > 20 % PASS
  const seuil = P.CSM_SEUIL_ACTIVITE * PASS
  if (revenusActivite >= seuil) return 0
  const assiette = pos(Math.min(revenusCapital, P.CSM_PLAFOND_ASSIETTE * PASS) - P.CSM_ABATTEMENT_CAPITAL * PASS)
  return P.CSM_TAUX * assiette * (1 - pos(revenusActivite) / seuil)
}

// ---------------------------------------------------------------------------
// 6. Protection sociale acquise (indicateurs annuels)
// ---------------------------------------------------------------------------
function trimestres(revenuValidant, P) {
  return clamp(Math.floor(revenuValidant / (150 * P.SMIC_H_JANVIER)), 0, 4)
}

export function protectionAssimileSalarie(brut, P = PARAMS_2026, opts = {}) {
  const PASS = P.PASS
  const c = cotisationsAssimileSalarie(brut, P, opts)
  const smicAnnuel = (P.SMIC_H * 151.67 * 12)
  const conditionIJ = brut >= 2030 * P.SMIC_H // cotisations sur 2 030 h SMIC sur 12 mois
  const ij = conditionIJ ? 0.5 * Math.min(brut / 365, (1.4 * smicAnnuel) / 365) : 0
  const pensionComplParAn = c.pointsAgircArrco * P.AGIRC_ARRCO_VALEUR_SERVICE
  const baseRevenu = Math.min(brut, PASS)
  return {
    regime: 'Régime général (assimilé salarié)',
    trimestres: trimestres(brut, P),
    revenuRetraiteBase: baseRevenu,
    pointsComplementaire: c.pointsAgircArrco,
    caisseComplementaire: 'Agirc-Arrco',
    pensionAnnuelleAcquiseParAn: (0.5 * baseRevenu) / P.DUREE_CARRIERE_ANNEES + pensionComplParAn,
    pensionCarriereComplete: 0.5 * baseRevenu + pensionComplParAn * P.DUREE_CARRIERE_ANNEES,
    ijJour: ij,
    invaliditeTotaleAn: conditionIJ ? 0.5 * baseRevenu : 0,
    capitalDeces: brut > 0 ? P.CAPITAL_DECES_REGIME_GENERAL : 0,
    prevoyanceCadre: opts.prevoyanceCadre !== false && brut > 0,
  }
}

export function protectionTNS(revenuBrut, P = PARAMS_2026) {
  const PASS = P.PASS
  const c = cotisationsTNS(revenuBrut, P)
  const assiette = c.assiette
  const assietteRetraite = Math.max(assiette, 450 * P.SMIC_H_JANVIER)
  const condition = assiette >= 0.1 * PASS
  const points = c.retraiteComplementaire / P.RCI_PRIX_ACHAT
  const pensionComplParAn = points * P.RCI_VALEUR_SERVICE
  const baseRevenu = Math.min(assietteRetraite, PASS)
  return {
    regime: 'Sécurité sociale des indépendants',
    trimestres: trimestres(assietteRetraite, P),
    revenuRetraiteBase: baseRevenu,
    pointsComplementaire: points,
    caisseComplementaire: 'RCI',
    pensionAnnuelleAcquiseParAn: (0.5 * baseRevenu) / P.DUREE_CARRIERE_ANNEES + pensionComplParAn,
    pensionCarriereComplete: 0.5 * baseRevenu + pensionComplParAn * P.DUREE_CARRIERE_ANNEES,
    ijJour: condition ? Math.min(assiette, PASS) / 730 : 0,
    invaliditeTotaleAn: condition ? 0.5 * Math.min(assiette, PASS) : 0,
    capitalDeces: condition ? 0.2 * PASS : 0,
    prevoyanceCadre: false,
  }
}

const AUCUNE_PROTECTION = {
  regime: 'Aucune (PUMa : frais de santé uniquement)',
  trimestres: 0,
  revenuRetraiteBase: 0,
  pointsComplementaire: 0,
  caisseComplementaire: '-',
  pensionAnnuelleAcquiseParAn: 0,
  pensionCarriereComplete: 0,
  ijJour: 0,
  invaliditeTotaleAn: 0,
  capitalDeces: 0,
  prevoyanceCadre: false,
}

// ---------------------------------------------------------------------------
// 7. Scénarios « une structure »
//    benefice = bénéfice avant rémunération du dirigeant (CA - charges, hors dirigeant)
//    foyer = { couple, enfants, autresRevenusImposables, conjointActif }
//    Tout le bénéfice disponible est distribué (objectif : revenu disponible de l'année).
// ---------------------------------------------------------------------------

/** Assemble la fiscalité personnelle à partir des flux bruts de l'année. */
function fiscalitePersonnelle(flux, foyer, P, modeDividendes) {
  // flux : { revenuActiviteImposable (avant abattement 10 %), abattable (bool),
  //          revenuProfessionnelBICBNC, dividendes, dividendesSoumisPS,
  //          beneficeSASUIR, revenusActiviteCSM, revenusCapitalCSM }
  const autres = foyer.autresRevenusImposables || 0
  const salaires = flux.revenuActiviteImposable || 0
  const salairesNets = salaires - abattement10(salaires, P)
  const bicbnc = flux.revenuProfessionnelBICBNC || 0
  const quotePartIR = flux.beneficeSASUIR || 0
  // CSG déductible sur la quote-part SASU IR (revenus du patrimoine), déduite en régime de croisière
  const csgDedPatrimoine = P.CSG_DEDUCTIBLE_CAPITAL * quotePartIR
  const D = flux.dividendes || 0
  const Dps = flux.dividendesSoumisPS || 0
  const psDividendes = P.PS_CAPITAL * Dps
  const psQuotePart = P.PS_CAPITAL * quotePartIR

  const base = salairesNets + bicbnc + quotePartIR - csgDedPatrimoine + autres
  const ir0 = impotRevenu({ revenuImposable: base }, foyer, P)

  let res
  const essais = []
  if (D > 0 && modeDividendes !== 'bareme') {
    const ir = impotRevenu({ revenuImposable: base, montantPFU: D }, foyer, P)
    essais.push({ mode: 'PFU', ir })
  }
  if (D > 0 && modeDividendes !== 'pfu') {
    const imposables = (1 - P.ABATTEMENT_DIVIDENDES) * D - P.CSG_DEDUCTIBLE_CAPITAL * Dps
    const ir = impotRevenu(
      { revenuImposable: base + imposables, rfrSupplement: P.ABATTEMENT_DIVIDENDES * D },
      foyer,
      P,
    )
    essais.push({ mode: 'barème', ir })
  }
  if (essais.length === 0) res = { mode: '-', ir: ir0 }
  else res = essais.reduce((a, b) => (a.ir.total <= b.ir.total ? a : b))

  // Impôt « attribuable » à l'activité = impôt du foyer - impôt sur les autres revenus seuls
  const irAutres = autres > 0 ? impotRevenu({ revenuImposable: autres }, foyer, P).total : 0
  const csm = cotisationSubsidiaireMaladie(
    flux.revenusActiviteCSM || 0,
    flux.revenusCapitalCSM || 0,
    foyer,
    P,
  )
  return {
    modeDividendes: res.mode,
    ir: res.ir,
    impotAttribuable: res.ir.total - irAutres,
    prelevementsSociauxCapital: psDividendes + psQuotePart,
    csm,
  }
}

function resultat(nom, details) {
  return { structure: nom, ...details }
}

/** EI au réel ou EURL à l'IR (gérant associé unique, TNS). */
export function scenarioEURL_IR(benefice, foyer, P = PARAMS_2026, opts = {}) {
  const c = cotisationsTNS(benefice, P, opts)
  const revenuPro = benefice - c.total + c.csgNonDeductible // BIC/BNC imposable
  const f = fiscalitePersonnelle(
    {
      revenuProfessionnelBICBNC: revenuPro,
      revenusActiviteCSM: revenuPro,
    },
    foyer,
    P,
  )
  const net = benefice - c.total
  const disponible = net - f.impotAttribuable - f.csm
  return resultat('EI / EURL à l\'IR', {
    benefice,
    choix: { remuneration: benefice, dividendes: 0 },
    is: 0,
    cotisations: c.total,
    detailCotisations: c,
    remunerationNette: net,
    dividendesBruts: 0,
    prelevementsSociaux: 0,
    impotRevenu: f.impotAttribuable,
    detailIR: f.ir,
    csm: f.csm,
    modeDividendes: '-',
    revenuDisponible: disponible,
    protection: protectionTNS(benefice, P),
  })
}

/** EURL à l'IS : rémunération TNS (coût total R) + dividendes. */
export function evaluerEURL_IS(benefice, R, foyer, P = PARAMS_2026, opts = {}) {
  const capitalEtCCA = opts.capitalEtCCA ?? 1000
  const reserve = opts.reserve || 0 // bénéfice net laissé en réserve
  const is = impotSocietes(benefice - R, P)
  const D = pos(benefice - R - is - reserve)
  const Dlibre = Math.min(D, 0.1 * capitalEtCCA)
  const Dsoumis = D - Dlibre
  const c = cotisationsTNS(R + Dsoumis, P, opts)
  // Par défaut (pratique courante, et choix du simulateur Urssaf) la société règle l'intégralité
  // des cotisations du gérant, y compris celles assises sur les dividendes, et les déduit.
  // Variante prudente : le gérant paie lui-même la part liée aux dividendes (non déductible).
  const prudent = !!opts.cotisationsDividendesPersonnelles
  const cR = prudent ? cotisationsTNS(R, P, opts) : c
  const cotisationsSurDividendes = prudent ? c.total - cR.total : 0
  if (R < cR.total - 1e-6) return null
  const remunerationNette = R - cR.total
  const revenuArt62 = remunerationNette + cR.csgNonDeductible
  const f = fiscalitePersonnelle(
    {
      revenuActiviteImposable: revenuArt62,
      dividendes: D,
      dividendesSoumisPS: Dlibre,
      revenusActiviteCSM: revenuArt62 + Dsoumis,
      revenusCapitalCSM: Dlibre,
    },
    foyer,
    P,
    opts.modeDividendes,
  )
  const disponible =
    remunerationNette + D - cotisationsSurDividendes - f.prelevementsSociauxCapital - f.impotAttribuable - f.csm
  return resultat('EURL à l\'IS', {
    benefice,
    choix: { remuneration: R, dividendes: D },
    is,
    cotisations: c.total,
    detailCotisations: c,
    remunerationNette,
    dividendesBruts: D,
    prelevementsSociaux: f.prelevementsSociauxCapital,
    impotRevenu: f.impotAttribuable,
    detailIR: f.ir,
    csm: f.csm,
    modeDividendes: f.modeDividendes,
    revenuDisponible: disponible,
    protection: protectionTNS(R + Dsoumis, P),
  })
}

/** SASU à l'IS : salaire (brut S) + dividendes. */
export function evaluerSASU_IS(benefice, S, foyer, P = PARAMS_2026, opts = {}) {
  const c = cotisationsAssimileSalarie(S, P, opts)
  if (c.coutTotal > benefice + 1e-6) return null
  const reserve = opts.reserve || 0
  const is = impotSocietes(benefice - c.coutTotal, P)
  const D = pos(benefice - c.coutTotal - is - reserve)
  const f = fiscalitePersonnelle(
    {
      revenuActiviteImposable: c.netImposable,
      dividendes: D,
      dividendesSoumisPS: D,
      revenusActiviteCSM: c.netImposable,
      revenusCapitalCSM: D,
    },
    foyer,
    P,
    opts.modeDividendes,
  )
  const disponible = c.net + D - f.prelevementsSociauxCapital - f.impotAttribuable - f.csm
  return resultat('SASU à l\'IS', {
    benefice,
    choix: { remuneration: S, dividendes: D },
    is,
    cotisations: c.totalEmployeur + c.totalSalarie,
    detailCotisations: c,
    remunerationNette: c.net,
    dividendesBruts: D,
    prelevementsSociaux: f.prelevementsSociauxCapital,
    impotRevenu: f.impotAttribuable,
    detailIR: f.ir,
    csm: f.csm,
    modeDividendes: f.modeDividendes,
    revenuDisponible: disponible,
    protection: S > 0 ? protectionAssimileSalarie(S, P, opts) : AUCUNE_PROTECTION,
  })
}

/** SASU à l'IR (option art. 239 bis AB, 5 exercices max, société de moins de 5 ans). */
export function evaluerSASU_IR(benefice, S, foyer, P = PARAMS_2026, opts = {}) {
  const c = cotisationsAssimileSalarie(S, P, opts)
  if (c.coutTotal > benefice + 1e-6) return null
  const quotePart = benefice - c.coutTotal // imposée à l'IR au nom de l'associé (BIC/BNC)
  const f = fiscalitePersonnelle(
    {
      revenuActiviteImposable: c.netImposable,
      beneficeSASUIR: quotePart,
      revenusActiviteCSM: c.netImposable,
      revenusCapitalCSM: quotePart,
    },
    foyer,
    P,
  )
  const disponible = c.net + quotePart - f.prelevementsSociauxCapital - f.impotAttribuable - f.csm
  return resultat('SASU à l\'IR', {
    benefice,
    choix: { remuneration: S, dividendes: 0, quotePart },
    is: 0,
    cotisations: c.totalEmployeur + c.totalSalarie,
    detailCotisations: c,
    remunerationNette: c.net,
    dividendesBruts: 0,
    quotePartBenefice: quotePart,
    prelevementsSociaux: f.prelevementsSociauxCapital,
    impotRevenu: f.impotAttribuable,
    detailIR: f.ir,
    csm: f.csm,
    modeDividendes: '-',
    revenuDisponible: disponible,
    protection: S > 0 ? protectionAssimileSalarie(S, P, opts) : AUCUNE_PROTECTION,
  })
}

// ---------------------------------------------------------------------------
// 8. Optimisation (recherche par grille puis affinage)
// ---------------------------------------------------------------------------
function maximiser(f, a, b, critere, pas0 = 200) {
  let meilleur = null
  let xBest = a
  const essai = (x) => {
    const r = f(x)
    if (r && (!meilleur || critere(r) > critere(meilleur))) {
      meilleur = r
      xBest = x
    }
  }
  if (b <= a) {
    essai(a)
    return meilleur
  }
  const n = pas0
  for (let i = 0; i <= n; i++) essai(a + ((b - a) * i) / n)
  let h = (b - a) / n
  for (let k = 0; k < 4; k++) {
    const lo = Math.max(a, xBest - h)
    const hi = Math.min(b, xBest + h)
    for (let i = 0; i <= 40; i++) essai(lo + ((hi - lo) * i) / 40)
    h = (hi - lo) / 40
  }
  return meilleur
}

/**
 * Contraintes optionnelles : opts.salaireMin (brut assimilé salarié) ou
 * opts.revenuBrutTNSMin, pour imposer un niveau de protection sociale.
 */
export function optimiserSASU_IS(benefice, foyer, P = PARAMS_2026, opts = {}) {
  const Smax = brutDepuisCout(benefice, P, opts)
  const Smin = Math.min(opts.salaireMin || 0, Smax)
  const crit = opts.critere || ((r) => r.revenuDisponible)
  return maximiser((S) => evaluerSASU_IS(benefice, S, foyer, P, opts), Smin, Smax, crit, opts.pas0 || 200)
}

export function optimiserSASU_IR(benefice, foyer, P = PARAMS_2026, opts = {}) {
  const Smax = brutDepuisCout(benefice, P, opts)
  const Smin = Math.min(opts.salaireMin || 0, Smax)
  const crit = opts.critere || ((r) => r.revenuDisponible)
  return maximiser((S) => evaluerSASU_IR(benefice, S, foyer, P, opts), Smin, Smax, crit, opts.pas0 || 200)
}

export function optimiserEURL_IS(benefice, foyer, P = PARAMS_2026, opts = {}) {
  const crit = opts.critere || ((r) => r.revenuDisponible)
  const Rmin = Math.min(opts.revenuBrutTNSMin || 0, benefice)
  return maximiser((R) => evaluerEURL_IS(benefice, R, foyer, P, opts), Rmin, benefice, crit, opts.pas0 || 200)
}

export function comparer(benefice, foyer, P = PARAMS_2026, opts = {}) {
  const r = [
    scenarioEURL_IR(benefice, foyer, P, opts),
    optimiserEURL_IS(benefice, foyer, P, opts),
    optimiserSASU_IS(benefice, foyer, P, opts),
  ]
  if (opts.inclureSASU_IR !== false) r.push(optimiserSASU_IR(benefice, foyer, P, opts))
  return r.filter(Boolean)
}

// ---------------------------------------------------------------------------
// 9. Deux structures : le bénéfice total est réparti entre deux activités
//    (A = structure 1, B = structure 2). L'IR est calculé au niveau du foyer.
// ---------------------------------------------------------------------------
export function evaluerCombo(beneficeTotal, part1, conf, foyer, P = PARAMS_2026, opts = {}) {
  // conf : { type: 'EURL_IR+SASU_IS' | 'EURL_IS+SASU_IS' | 'SASU_IS+SASU_IS' }
  // part1 = bénéfice de la structure 1 ; la structure 2 reçoit le reste.
  // Variables internes : remunération dans 1 (R1) et salaire dans 2 (S2).
  const B1 = part1
  const B2 = beneficeTotal - part1
  const autres = foyer.autresRevenusImposables || 0
  return (R1, S2) => {
    let tns = null
    let sal1 = null
    let is1 = 0
    let D1 = 0
    let D1soumis = 0
    let net1 = 0
    let art62 = 0
    let bicbnc = 0
    if (conf.type === 'EURL_IR+SASU_IS') {
      tns = cotisationsTNS(B1, P, opts)
      net1 = B1 - tns.total
      bicbnc = net1 + tns.csgNonDeductible
    } else if (conf.type === 'EURL_IS+SASU_IS') {
      is1 = impotSocietes(B1 - R1, P)
      D1 = pos(B1 - R1 - is1)
      const Dl = Math.min(D1, 0.1 * (opts.capitalEtCCA ?? 1000))
      D1soumis = D1 - Dl
      tns = cotisationsTNS(R1 + D1soumis, P, opts)
      if (R1 < tns.total) return null
      net1 = R1 - tns.total
      art62 = net1 + tns.csgNonDeductible
    } else if (conf.type === 'SASU_IS+SASU_IS') {
      sal1 = cotisationsAssimileSalarie(R1, P, opts)
      if (sal1.coutTotal > B1) return null
      is1 = impotSocietes(B1 - sal1.coutTotal, P)
      D1 = pos(B1 - sal1.coutTotal - is1)
      net1 = sal1.net
      art62 = sal1.netImposable
    }
    const sal2 = cotisationsAssimileSalarie(S2, P, opts)
    if (sal2.coutTotal > B2) return null
    const is2 = impotSocietes(B2 - sal2.coutTotal, P)
    const D2 = pos(B2 - sal2.coutTotal - is2)
    const D = D1 + D2
    const Dps = D - D1soumis
    const salairesImposables = art62 + sal2.netImposable
    const f = fiscalitePersonnelle(
      {
        revenuActiviteImposable: salairesImposables,
        revenuProfessionnelBICBNC: bicbnc,
        dividendes: D,
        dividendesSoumisPS: Dps,
        revenusActiviteCSM: salairesImposables + bicbnc + D1soumis,
        revenusCapitalCSM: Dps,
      },
      foyer,
      P,
      opts.modeDividendes,
    )
    const cot = (tns ? tns.total : 0) + (sal1 ? sal1.totalEmployeur + sal1.totalSalarie : 0) + sal2.totalEmployeur + sal2.totalSalarie
    const disponible = net1 + sal2.net + D - f.prelevementsSociauxCapital - f.impotAttribuable - f.csm
    const prot = []
    if (tns) prot.push(protectionTNS(tns.revenuBrut, P))
    if (sal1 && R1 > 0) prot.push(protectionAssimileSalarie(R1, P, opts))
    if (S2 > 0) prot.push(protectionAssimileSalarie(S2, P, opts))
    return {
      structure: conf.type,
      benefice: beneficeTotal,
      choix: { beneficeStructure1: B1, beneficeStructure2: B2, remuneration1: R1, salaire2: S2, dividendes: D },
      is: is1 + is2,
      cotisations: cot,
      prelevementsSociaux: f.prelevementsSociauxCapital,
      impotRevenu: f.impotAttribuable,
      detailIR: f.ir,
      csm: f.csm,
      modeDividendes: f.modeDividendes,
      revenuDisponible: disponible,
      protections: prot,
    }
  }
}

export function optimiserCombo(beneficeTotal, type, foyer, P = PARAMS_2026, opts = {}) {
  const crit = (r) => r.revenuDisponible
  const pas = opts.pasRepartition || Math.max(1000, beneficeTotal / 60)
  let meilleur = null
  for (let B1 = 0; B1 <= beneficeTotal + 1e-6; B1 += pas) {
    const g = evaluerCombo(beneficeTotal, B1, { type }, foyer, P, opts)
    const B2 = beneficeTotal - B1
    const S2max = brutDepuisCout(B2, P, opts)
    let r
    if (type === 'EURL_IR+SASU_IS') {
      r = maximiser((S2) => g(0, S2), 0, S2max, crit, 60)
    } else {
      const R1max = type === 'SASU_IS+SASU_IS' ? brutDepuisCout(B1, P, opts) : B1
      // optimisation alternée sur (R1, S2)
      let R1 = 0
      let S2 = 0
      for (let it = 0; it < 3; it++) {
        const a = maximiser((x) => g(x, S2), 0, R1max, crit, 40)
        if (a) R1 = a.choix.remuneration1
        const b = maximiser((x) => g(R1, x), 0, S2max, crit, 40)
        if (b) S2 = b.choix.salaire2
        r = b || a
      }
    }
    if (r && (!meilleur || crit(r) > crit(meilleur))) meilleur = r
  }
  return meilleur
}

export { r2 as arrondi2 }
