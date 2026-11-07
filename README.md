# Rémunération du dirigeant en France : EI, EURL ou SASU ? (règles 2026)

Comparateur open source du **revenu disponible** et de la **protection sociale** d'un dirigeant selon la structure : EI / EURL à l'IR, EURL à l'IS, SASU à l'IS, SASU à l'IR, et combinaisons de deux structures. Chaque structure est optimisée (dosage rémunération / dividendes).

## Résultat principal (célibataire, 180 000 € de bénéfice, tout distribué)

| Structure optimisée | Revenu disponible | Pension « carrière complète » | IJ maladie |
|---|---|---|---|
| **EURL à l'IS** | **102 142 €** | ≈ 53 900 €/an | 65,84 €/j |
| SASU à l'IS | 97 239 € | ≈ 16 100 €/an | aucune |
| SASU à l'IR | 92 603 € | ≈ 8 100 €/an | aucune |
| EI / EURL à l'IR | 91 089 € | ≈ 55 100 €/an | 65,84 €/j |

Points de bascule (célibataire, structures durables) : EURL IS ≈ EI jusqu'à 30 k€, SASU IS de 30 k€ à 79 k€, EURL IS au-delà. Avec un salaire de SASU suffisant pour ouvrir les indemnités journalières, l'EURL IS est devant sur toute la plage 20 k€ à 400 k€. Détails et autres foyers : `resultats/resultats.md`.

## Contenu

| Chemin | Rôle |
|---|---|
| `article/eurl-sasu-ei-180k-2026.md` | Article de blog prêt à publier (+ graphiques SVG dans `article/img/`) |
| `simulateur/index.html` | Simulateur autonome (un seul fichier, aucune dépendance) |
| `src/moteur.js` | Moteur de calcul (cotisations TNS et assimilé salarié, IS, IR, PFU, taxe PUMa, protection sociale, optimisation) |
| `docs/methodologie.md` | Paramètres 2026, formules, sources, points d'incertitude |
| `resultats/` | Résultats générés : tableaux, balayages CSV, données JSON |
| `scripts/` | Validation Urssaf, analyse, graphiques, build du simulateur |

## Commandes

```bash
npm install          # installe les moteurs officiels Urssaf (validation uniquement)
npm run valider      # compare le moteur aux moteurs Urssaf modele-ti / modele-social
npm run analyse      # régénère resultats/
node scripts/graphiques.mjs   # régénère article/img/
npm run build        # régénère simulateur/index.html à partir de src/moteur.js
```

## Avertissement

Outil pédagogique. Il ne constitue ni un conseil fiscal ou juridique, ni une recommandation personnalisée. Les règles évoluent chaque année : faites valider votre situation par un expert-comptable ou un avocat fiscaliste.
