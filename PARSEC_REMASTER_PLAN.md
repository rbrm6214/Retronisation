# Parsec Remaster - Plan de developpement

## 1. Vision produit

Objectif: recreer Parsec de 1982 sur TI-99/4A avec une boucle de jeu fidele, puis ajouter une presentation moderne sans casser le rythme ni la lisibilite de l'original.

Le projet doit etre pense en deux couches distinctes:

- Mode Arcade: reproduction la plus fidele possible du gameplay original.
- Mode Remaster: meme structure de jeu, mais avec presentation, confort et options modernes.

Le principe directeur est simple: tant que le mode Arcade n'est pas convaincant, aucune surcouche remaster ne doit dicter les choix de gameplay.

## 2. Piliers du jeu

Le jeu doit etre reconnaissable immediatement comme Parsec a travers ces piliers:

1. Pilotage simple mais tendu.
   Le joueur controle surtout l'altitude et la vitesse de son vaisseau.

2. Terrain au sol en defilement horizontal.
   Le relief, les obstacles et les tunnels font partie du gameplay, pas du decor.

3. Laser avec contrainte.
   Le tir ne doit pas etre gratuit. La surchauffe ou un equivalent est un element central du rythme.

4. Carburant et ravitaillement.
   Le fuel impose une pression constante et donne une fonction forte aux tunnels.

5. Vagues d'ennemis identifiables.
   Chaque type d'ennemi doit avoir une lecture immediate et un danger clair.

6. Transitions memorables.
   Les ceintures d'asteroides et les tunnels structurent le tempo de la partie.

7. Progression arcade.
   Le joueur doit sentir une acceleration de la pression, sans dilution de la boucle principale.

## 3. Scope de la version 1

La version 1 vise une reproduction jouable complete du jeu original, avec une finition visuelle moderne legere.

Inclus dans la v1:

- gameplay arcade complet
- progression multi-niveaux
- tous les ennemis principaux
- asteroides
- tunnels de ravitaillement
- score, vies, game over
- audio et alertes
- options de base
- rendu remaster simple activable

Exclus de la v1:

- coop local
- boss inedits
- campagne narrative
- mobile tactile si cela force des compromis sur le feeling arcade
- modes bonus non necessaires au coeur du jeu

## 4. Architecture recommandee dans ce projet

Le template actuel melange un peu demonstration React et base Phaser. Il faut recentrer l'application.

### 4.1 Repartition des responsabilites

React:

- menu principal
- options
- ecran d'accueil
- ecran de pause si besoin
- persistance locale des preferences

Phaser:

- boucle de jeu complete
- logique joueur
- ennemis
- collisions
- terrain
- score
- HUD temps reel
- transitions de niveau

### 4.2 Scenes Phaser cibles

- `Boot`
- `Preloader`
- `MainMenu`
- `Game`
- `HudOverlay`
- `PauseOverlay`
- `GameOver`

### 4.3 Arborescence cible

```text
src/game/
  config/
    gameConfig.js
    balance.js
  data/
    waves.js
    levels.js
    enemies.js
    scoring.js
  entities/
    PlayerShip.js
    enemies/
      Swooper.js
      LTF.js
      Saucer.js
      Urbite.js
      Dramite.js
      Bynite.js
      KillerSatellite.js
    projectiles/
      LaserShot.js
      EnemyShot.js
    hazards/
      Asteroid.js
  systems/
    InputSystem.js
    PlayerFlightSystem.js
    WeaponHeatSystem.js
    FuelSystem.js
    TerrainSystem.js
    TunnelSystem.js
    WaveDirector.js
    EnemySpawnSystem.js
    AsteroidBeltSystem.js
    CollisionSystem.js
    ScoreSystem.js
    DifficultySystem.js
    AudioSystem.js
  scenes/
    Boot.js
    Preloader.js
    MainMenu.js
    Game.js
    HudOverlay.js
    PauseOverlay.js
    GameOver.js
  ui/
    hudFormatter.js
  utils/
    math.js
    timers.js
```

### 4.4 Regle de conception importante

Les comportements doivent etre data-driven quand c'est utile. Les vagues, points, niveaux et progression doivent venir de fichiers de donnees simples, pas de valeurs dispersees dans les scenes.

## 5. Systeme par systeme

## 5.1 Joueur

Responsabilites:

- altitude du vaisseau
- vitesse avant et arriere selon les regles retenues
- hitbox et collisions
- etat de vie
- invulnerabilite temporaire apres respawn si necessaire

Questions de fidelite a trancher:

- niveau exact d'inertie
- amplitude verticale exacte
- vitesse minimale et maximale
- comportement exact du wrap joueur si reproduit

## 5.2 Arme et surchauffe

Le laser doit creer une tension d'usage. Le joueur doit sentir qu'il peut se sauver avec le tir, mais pas spammer sans consequence.

Variables a regler:

- cadence de tir
- jauge de chaleur
- vitesse de refroidissement
- feedback UI et audio de surchauffe

## 5.3 Carburant

Le fuel ne doit pas etre une jauge decorative. Il doit pousser le joueur a maintenir un bon tempo.

Variables a regler:

- consommation passive
- comportement en tunnel
- alerte low fuel
- penalite si plus de carburant

## 5.4 Terrain et tunnels

Le terrain au sol est un acteur de gameplay. Il faut donc separer:

- rendu du relief
- geometrie de collision
- objets remarquables
- zones de ravitaillement

Les tunnels doivent avoir:

- annonce visuelle ou audio
- logique d'entree et de sortie
- gel ou reduction de consommation selon les regles retenues
- trois variantes de profils si reproduction complete

## 5.5 Ennemis

Groupes cibles:

- non tireurs: Swoopers, LTFs, Saucers
- tireurs: Urbites, Dramites, Bynites
- special: Killer Satellites

Chaque ennemi doit etre defini par:

- silhouette
- pattern de deplacement
- mode d'apparition
- mode d'attaque
- nombre de coups requis
- score accorde

## 5.6 Asteroides

Les ceintures d'asteroides servent de respiration sous pression entre vagues. Elles doivent etre simples a comprendre mais severes si le joueur perd le rythme.

## 5.7 Score et progression

Le score doit encourager la maitrise et l'endurance. La progression doit reproduire les paliers de difficulte originaux avant toute reinterpretation moderne.

## 6. Backlog par epics

## Epic A - Nettoyage du template

Objectif: remplacer le contenu de demo par une base de jeu propre.

Tickets:

- retirer les interactions de demo React inutiles
- simplifier `App.jsx` pour en faire un shell produit
- transformer `Game.js` en scene de gameplay reelle
- preparer les scenes overlay necessaires
- ajouter une structure de dossiers cible

Definition of done:

- plus aucun texte ou comportement de template visible a l'ecran
- lancement direct vers un menu ou une scene de test propre

## Epic B - Core flight

Objectif: obtenir un pilotage deja convaincant.

Tickets:

- input clavier et gamepad
- altitude du joueur
- vitesse du joueur
- contraintes d'ecran
- collisions de base avec le sol
- feedback visuel reactif sur le vaisseau

Definition of done:

- le vaisseau est agreable a controler sans ennemi
- la lecture de la hauteur et du danger est immediate

## Epic C - Combat de base

Objectif: poser le rythme de survie de Parsec.

Tickets:

- tir laser
- collisions projectile vs ennemi
- surchauffe
- feedback d'impact
- explosion joueur
- respawn

Definition of done:

- le joueur peut detruire des cibles et subir une sanction claire en cas d'exces de tir

## Epic D - Ressources et HUD

Objectif: rendre lisibles les tensions du jeu.

Tickets:

- score
- vies ou lifts
- carburant
- temperature du laser
- niveau
- messages d'alerte

Definition of done:

- toutes les ressources critiques sont visibles et comprehensibles en moins d'une seconde

## Epic E - Ennemis

Objectif: reproduire les familles de menaces du jeu original.

Tickets:

- impler Swoopers
- impler LTFs
- impler Saucers
- impler Urbites
- impler Dramites
- impler Bynites
- impler Killer Satellites
- definir les tables de spawn
- gerer le wrap et le re-engagement

Definition of done:

- chaque ennemi possede un pattern stable, testable et reglable

## Epic F - Progression et vagues

Objectif: reconstruire le tempo arcade.

Tickets:

- systeme de vagues data-driven
- alternance fighters et cruisers
- transitions d'etat de niveau
- augmentation de difficulte
- boucle de niveaux

Definition of done:

- une partie complete se deroule sans script code en dur dans la scene principale

## Epic G - Asteroides et tunnels

Objectif: integrer les transitions majeures de Parsec.

Tickets:

- ceinture d'asteroides
- collisions avec asteroides
- destruction des asteroides
- tunnel de ravitaillement type 1
- tunnel de ravitaillement type 2
- tunnel de ravitaillement type 3
- logique d'entree, ravitaillement et sortie

Definition of done:

- le passage entre vagues, asteroides et ravitaillement est fluide et sans exception bloquante

## Epic H - Audio et presentation

Objectif: retrouver la tension et la lisibilite de l'original, puis moderniser.

Tickets:

- SFX tir et impacts
- alertes vocales ou textuelles
- musique de menu
- variation visuelle par niveau
- mode classic
- mode remaster

Definition of done:

- le jeu est lisible sans musique et meilleur avec audio

## Epic I - Finition produit

Objectif: rendre la build presentable et testable.

Tickets:

- menu principal
- options audio et video
- pause
- game over et restart
- sauvegarde locale des options
- credits

Definition of done:

- le jeu se lance, se joue, se relance et se regle sans outil de dev

## 7. Roadmap en sprints

## Sprint 1 - Faire disparaitre le template

Objectif:

- nettoyer l'interface existante
- poser une scene de test gameplay
- afficher un vaisseau et un terrain de base

Sortie attendue:

- build propre sans vestige de template
- scene de jeu minimale controllable

## Sprint 2 - Le feeling avant le contenu

Objectif:

- altitude
- vitesse
- collisions sol
- tir laser
- surchauffe
- HUD minimal

Sortie attendue:

- prototype pilotable deja interessant sans contenu complet

## Sprint 3 - Premiere boucle jouable

Objectif:

- premier ennemi non tireur
- premier ennemi tireur
- score et vies
- game over

Sortie attendue:

- boucle courte de survie jouable

## Sprint 4 - Systeme de vagues

Objectif:

- spawn data-driven
- enchainement de vagues
- alertes
- progression de difficulte

Sortie attendue:

- une micro-partie commence a ressembler a Parsec

## Sprint 5 - Asteroides et ravitaillement

Objectif:

- asteroides
- tunnel de ravitaillement
- carburant complet

Sortie attendue:

- vertical slice fidele du jeu

## Sprint 6 - Contenu complet arcade

Objectif:

- tous les ennemis
- Killer Satellites
- niveaux complets
- tuning global

Sortie attendue:

- mode Arcade complet de bout en bout

## Sprint 7 - Remaster pass

Objectif:

- polish visuel
- options
- audio complet
- mode classic et remaster

Sortie attendue:

- premiere beta presentable

## 8. Regles de production

1. Toujours valider le feeling avant de produire du contenu.
2. Toujours separer logique de jeu et presentation.
3. Toujours garder les valeurs critiques dans des fichiers de balance.
4. Toujours ajouter des outils debug pour accelerer le tuning.
5. Toujours tester en sessions courtes et en sessions longues.

## 9. Outils debug a prevoir des le debut

- hitboxes visibles
- carburant infini
- pas de surchauffe
- saut de vague
- saut de niveau
- ralentissement du temps
- affichage des spawns et patterns
- compteur FPS

## 10. Definition de reussite

Le projet est sur la bonne voie si, tres tot, un testeur peut dire:

"Je reconnais immediatement Parsec, meme sans tous les assets finaux."

Le projet echoue si le rendu est joli mais que la boucle ressemble a un shooter horizontal generique.

## 11. Prochaine etape recommandee

Transformer ce plan en taches concretes dans le code, en commencant par:

1. nettoyage du template
2. creation de la vraie scene `Game`
3. implementation du pilotage du vaisseau
4. ajout du HUD minimal
5. premier prototype de terrain collisionnable
