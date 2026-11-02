# Checklist
Maj 08:05 - 26/26

## En cours

## A faire

## Bloque
- [!] Contenu a reecrire par Axel : textes humoristiques, lorem du projet 1, stats copiees de 6 cartes galerie, SOFTWARE 6, interets en anglais (contenu, pas du code)

## Fait
- [x] W8 correctifs : modeles des projets non publies masques, schema strict par type de bloc, cache protege, optimisation GLB en worker, encodages limites et caches sur le volume, CSRF par Origin, brouillons orphelins, course a l'optimisation
- [x] Sauvegardes admin testees par les agents (inspecteur, bento, editeur 3D) sur leurs ports
- [x] SETUP.md et CLAUDE.md decrivent l'etat actuel
- [x] W7 corrections design : blocs qui grandissent avec leur contenu, blocs vides caches au public, pages projet sans blocs illustrees, vrai 404, pied de page partout, email sur une ligne, rythme des sections, cartes alignees, rail lisible
- [x] Passe visuelle 375 / 768 / 1024 / 1440 (captures CDP relues)
- [x] Audit de code et securite a froid (1 haute, 4 moyennes, 7 basses ; traversal, injection HTML, filtrage publication et auth tiennent)
- [x] W6 images responsives : route WebP/JPEG redimensionnee + cache, dimensions stockees, SiteImage partout, accueil 53.7 Mo -> 177 Ko (1440 px), heritage supprime (5 colonnes + layout), avatar rapatrie, avertissements 3D traduits
- [x] Audit design a l'aveugle (captures CDP a 375 / 768 / 1024 / 1440)
- [x] SEO verifie sur le build Express : meta, OG, JSON-LD, instantane HTML, robots (robots IA autorises), sitemap, llms.txt, 404 pour projet inconnu ou non publie
- [x] W4b page projet en etude de cas, editeur bento (reflow, undo complet, onglet telephone), 14 blocs revus, /styleguide, 3 pages Showcase de test (projets 10, 11, 12, non publies)
- [x] Traductions du viewer (14 cles)
- [x] W5 editeur 3D refait : Reglage automatique, 4 panneaux, vues en bandeau, une seule sauvegarde, optimiseur branche, 4 modeles optimises (22->0.9, 25.7->4.7, 16.1->2.6, 39.4->9.9 Mo)
- [x] Apparition au scroll verifiee : contenu visible par defaut, faux positif de la capture
- [x] W4a accueil refait : hero, etudes de cas, galerie, parcours, a propos, contact, pied de page, menu mobile, Montserrat local, grain 41 Ko
- [x] Un seul tap pour la 3D sur tactile
- [x] Brouillons de test depublies en dev (experience Poste, galerie Nouvel element, projet Dragon)
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
