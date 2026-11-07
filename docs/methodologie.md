# Méthodologie, paramètres et sources

Ce document décrit ce que calcule le moteur (`src/moteur.js`), avec quels paramètres, et où se situent les incertitudes. Date de référence : 7 novembre 2026.

## 1. Objet

Pour un bénéfice donné (chiffre d'affaires moins charges, **avant** rémunération et cotisations du dirigeant), comparer le **revenu disponible** du dirigeant :

> revenu disponible = rémunération nette + dividendes (ou quote-part de bénéfice) − prélèvements sociaux − impôt sur le revenu attribuable à l'activité (CEHR et CDHR comprises) − taxe PUMa

pour quatre structures, chacune optimisée (recherche par grille puis affinage sur la rémunération) :

| Structure | Statut social du dirigeant | Fiscalité | Variable optimisée |
|---|---|---|---|
| EI / EURL à l'IR | TNS (SSI) | BIC/BNC à l'IR | aucune |
| EURL à l'IS | TNS (gérant majoritaire) | IS, rémunération art. 62 CGI, dividendes RCM | rémunération (coût société) |
| SASU à l'IS | assimilé salarié | IS, salaire, dividendes RCM | salaire brut |
| SASU à l'IR (art. 239 bis AB CGI) | assimilé salarié | quote-part de bénéfice imposée à l'IR | salaire brut |

Plus trois combinaisons de deux structures (EI + SASU IS, EURL IS + SASU IS, deux SASU IS), avec optimisation de la répartition du bénéfice entre elles et IR calculé au niveau du foyer.

## 2. Paramètres 2026

| Paramètre | Valeur | Source |
|---|---|---|
| PASS | 48 060 € | arrêté du 22/12/2025, JO du 23/12/2025 |
| SMIC horaire | 12,02 € (1er janvier), 12,31 € (1er juin 2026) | revalorisation automatique +2,41 % (art. L3231-5 C. trav.) |
| Barème IR | 0 % ≤ 11 600 € ; 11 % ≤ 29 579 € ; 30 % ≤ 84 577 € ; 41 % ≤ 181 917 € ; 45 % | LF 2026 (revenus 2025), art. 197 CGI ; indexation 0,9 % |
| Plafond QF par demi-part | 1 807 € | LF 2026 |
| Décote | 897 € (seul) / 1 483 € (couple), taux 45,25 % | LF 2026 |
| Abattement 10 % | min 509 €, max 14 555 € | art. 83 CGI, LF 2026 |
| CEHR | 3 % / 4 % au-delà de 250 k€ / 500 k€ (seul), doublés pour un couple | art. 223 sexies CGI |
| CDHR | taux minimal 20 % au-delà de 250 k€ de RFR (seul) / 500 k€ (couple), prorogée par la LF 2026 | art. 224 CGI ; décote modélisée de façon simplifiée |
| PFU | 12,8 % d'IR + 18,6 % de prélèvements sociaux = 31,4 % | art. 200 A CGI ; LFSS 2026 art. 12 (CSG 9,2 % → 10,6 %, art. L136-8 CSS) |
| Option barème dividendes | abattement 40 %, CSG déductible 6,8 % | art. 158 CGI |
| IS | 15 % jusqu'à 42 500 €, 25 % au-delà | art. 219 CGI (inchangé par la LF 2026) |
| Taxe PUMa | 6,5 % × (revenus du capital − 50 % PASS) × (1 − revenus d'activité / 20 % PASS), assiette plafonnée à 8 PASS | art. L380-2 et D380-1 CSS |

### Cotisations TNS (réforme de l'assiette, revenus 2025 et suivants)

Décret n° 2024-688 du 5 juillet 2024, art. L131-6 CSS ; barèmes repris du moteur Urssaf `modele-ti` 0.1.0.

- **Assiette unique** = revenu brut × (1 − 26 %), l'abattement étant compris entre 1,76 % et 130 % du PASS. En EURL à l'IS : revenu brut = rémunération (coût société, cotisations incluses) + dividendes excédant 10 % du capital, des primes et des comptes courants.
- Maladie-maternité : taux progressif (0 % à 20 % PASS, 1,5 % à 40 %, 4 % à 60 %, 6,5 % à 110 %, 7,7 % à 200 %, 8,5 % à 300 %, interpolation linéaire) jusqu'à 3 PASS, 6,5 % au-delà.
- Indemnités journalières : 0,5 % (assiette entre 40 % PASS et 5 PASS).
- Allocations familiales : 0 % jusqu'à 110 % PASS, progressif jusqu'à 3,1 % à 140 % PASS.
- Retraite de base : 17,87 % jusqu'au PASS, 0,72 % au-delà (assiette minimale 450 h de SMIC).
- Retraite complémentaire (RCI) : 8,1 % jusqu'au PASS, 9,1 % de 1 à 4 PASS.
- Invalidité-décès : 1,3 % (assiette entre 11,5 % PASS et 1 PASS).
- CSG-CRDS : 9,7 % de l'assiette, dont 6,8 % déductible.
- Formation professionnelle : 0,25 % du PASS (0,29 % pour un artisan).

### Cotisations de l'assimilé salarié (président de SASU sans contrat de travail)

Barèmes repris du moteur Urssaf `modele-social` 11.1.0.

- Employeur : maladie 13 %, allocations familiales 5,25 %, vieillesse 8,55 % (plafonnée) + 2,11 %, AT/MP 1,25 % (code risque 70.3AD, arrêté du 30/12/2025), FNAL 0,10 %, CSA 0,30 %, formation 0,55 %, taxe d'apprentissage 0,68 %, dialogue social 0,016 %, Agirc-Arrco 4,72 % (T1) / 12,95 % (T2), CEG 1,29 % / 1,62 %, CET 0,21 % au-delà du PASS, prévoyance cadre 1,50 % sur T1.
- Salarié : vieillesse 6,90 % + 0,40 %, Agirc-Arrco 3,15 % / 8,64 %, CEG 0,86 % / 1,08 %, CET 0,14 %, CSG 9,2 % (dont 6,8 % déductible) et CRDS 0,5 % sur 98,25 % du brut.
- Pas d'assurance chômage ni d'AGS. Pas de RGDU (réservée aux rémunérations soumises à l'assurance chômage). Les taux réduits maladie (7 %) et famille (3,45 %) ont disparu au 1er janvier 2026 avec la réforme des allègements généraux (le moteur Urssaf ne les applique plus hors LODEOM).
- Mutuelle santé collective non incluse (pas d'obligation pour un mandataire sans contrat de travail).

### Protection sociale (indicateurs)

- Trimestres : un trimestre par tranche de 150 h de SMIC (1 803 € en 2026), 4 au maximum.
- Retraite de base : 50 % du revenu retenu plafonné au PASS (carrière complète supposée).
- Retraite complémentaire : Agirc-Arrco 20,1877 € (achat) / 1,4386 € (service) ; RCI 21,726 € / 1,347 €. Pension « carrière complète » = points annuels × 43 × valeur de service.
- IJ assimilé salarié : 50 % du salaire journalier plafonné à 1,4 SMIC, sous condition de cotisation sur 2 030 h de SMIC sur 12 mois (24 990 € brut).
- IJ TNS : revenu (plafonné au PASS) / 730, si revenu ≥ 10 % du PASS.
- Invalidité totale : 50 % du revenu plafonné au PASS. Capital décès : 20 % PASS (TNS), forfait d'environ 3 700 € (régime général).

## 3. Validation

`npm run valider` compare le moteur aux moteurs officiels de l'Urssaf :

- cotisations TNS (EI/EURL IR, 9 niveaux de 5 k€ à 400 k€) et EURL IS (rémunération + dividendes) : écart maximal 0,04 % ;
- cotisations et net de l'assimilé salarié (7 niveaux de 7 212 € à 150 000 €) : écart 0,01 % (contribution dialogue social) ;
- impôt sur le revenu (quotient familial, décote) : écart nul sur 8 foyers.

## 4. Hypothèses et points d'incertitude

1. **Barème IR** : celui de la LF 2026 (revenus 2025), utilisé pour les revenus 2026 en attendant la LF 2027.
2. **EURL IS, cotisations sur dividendes** : par défaut, la société paie l'ensemble des cotisations du gérant et les déduit (choix du simulateur Urssaf, pratique courante). Une variante prudente (`cotisationsDividendesPersonnelles`) les met à la charge du gérant sans déduction ; l'EURL IS reste devant la SASU IS jusque vers 250 k€ de bénéfice (célibataire).
3. **SASU à l'IR** : quote-part soumise aux prélèvements sociaux du patrimoine (18,6 %) selon la RM n° 12673 (JO AN du 2 juin 2026), étendue au président rémunéré. Position contestée par une partie de la doctrine. CSG déductible de 6,8 % prise en compte l'année même (équivalent en régime de croisière).
4. **Taxe PUMa** : « revenus d'activité » = salaire net imposable (hypothèse prudente). Non due si le conjoint a des revenus d'activité au-dessus du seuil (option `conjointActif`).
5. **CDHR** : décote modélisée par 82,5 % × (330 000 € − RFR) pour un célibataire (660 000 € pour un couple), non vérifiée sur le texte ; sans effet dans les cas présentés (RFR inférieur à 250 000 €).
6. **Non modélisé** : frais de fonctionnement des sociétés, CFE, PER et contrats Madelin, frais réels, mise en réserve, revenus exceptionnels, ACRE, professions libérales réglementées, Alsace-Moselle, outre-mer.

## 5. Sources consultées

- Moteurs Urssaf : paquets npm `modele-ti` 0.1.0 et `modele-social` 11.1.0 (dépôt public betagouv/mon-entreprise, état du 5 novembre 2026).
- PASS 2026 : https://www.previssima.fr/actualite/cest-officiel-le-pass-setablira-bien-a-48-060-au-1er-janvier-2026.html
- SMIC 1er juin 2026 : https://www.legisocial.fr/actualites-sociales/7944-revalorisation-automatique-smic-1er-juin-2026.html
- Hausse de la CSG sur le capital (LFSS 2026) : https://www.legifiscal.fr/actualites-fiscales/4369-janvier-2026-hausse-csg-appliquera-certains-placements-financiers.html ; art. L136-8 CSS : https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000051287395
- Réforme de l'assiette des indépendants : https://www.urssaf.fr/accueil/independant/comprendre-payer-cotisations/reforme-cotisations-independants.html
- SASU à l'IR, RM n° 12673 : https://www.harvest.fr/sasu-a-lir-les-prelevements-sociaux-a-186-sont-confirmes-sur-les-benefices-bic-bnc-du-dirigeant-non-remunere/ ; https://www.actu-juridique.fr/fiscalite/fiscal-finances/sasu-a-lir-bercy-tranche-les-dirigeants-non-remuneres-taxes-comme-rentiers/
- Taux AT/MP 70.3AD : https://travail-industrie.com/accidents-travail/taux-cotisation/70-3ad-promotion-vente-location-ou-administration-de-biens-immobiliers
- IS 2026 et amendement PLF 2027 : https://fiscalonline.com/outils-fiscaux/taux-reduit-impot-societes-pme-plf2027-plafond-porte-49-000-commission
- Art. L131-6 CSS : https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000048683707 ; art. 83 CGI : https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000037985819/

Le site Légifrance n'était pas accessible depuis l'environnement de calcul : les textes cités sans lien n'ont pas pu être relus dans leur version consolidée. Les valeurs chiffrées ont été recoupées avec les moteurs Urssaf et au moins une source secondaire.
