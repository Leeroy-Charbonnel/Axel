# Checklist
Maj 03:05 - 10/20

## En cours
- [~] W4a refonte de l'accueil + responsive telephone/tablette (agent)
- [~] W4b page projet, editeur bento, styleguide, pages de test pleines de composants (agent)
- [~] W5 editeur 3D refait avec bouton de reglage auto + optimiseur GLB branche (agent)

## A faire
- [ ] Fusionner W4a, W4b, W5 et verifier
- [ ] Ajouter les traductions du viewer (14 cles W2)
- [ ] Retirer l'heritage (Sketchfab, champs viewer legacy, colonnes mortes)
- [ ] Passe navigateur desktop / tablette / telephone
- [ ] Audit design a l'aveugle (agent sans contexte)
- [ ] Corrections de l'audit
- [ ] Verifier SEO / robots / llms.txt sur le build servi par Express
- [ ] Tester une vraie sauvegarde admin (inspecteur, bento, editeur 3D)
- [ ] Mettre a jour CLAUDE.md / SETUP.md (etat constate)

## Bloque

## Fait
- [x] Copier la base de prod sur la dev (93 fichiers, 4 projets, 9 galerie, 4 experiences)
- [x] Copier les medias de prod dans storage/files local (93/93, 514 Mo)
- [x] Cartographier le code et auditer le site (4 audits croises + passe visuelle)
- [x] Rechercher ce qu'offrent les portfolios 3D pro
- [x] Phase 0 : branche overhaul, 87 Mo d'assets morts retires, deps nettoyees, routes lazy
- [x] Contrats partages : types, plan, dependances pre-installees, tokens du site
- [x] W1 serveur : modules, zod, CSP, cache, publication, ordre, SEO + robots + sitemap + llms.txt
- [x] W3 edition : barre d'edition, inspecteur, brouillons, undo/redo, mediatheque, /settings
- [x] W2 coeur 3D : chargement paresseux, poster, rendu a la demande, modes rendu/fil de fer/argile, reglage auto, optimiseur (22 Mo -> 0.9 Mo)
- [x] Uploads acceptes en dev (base + fichiers locaux)
