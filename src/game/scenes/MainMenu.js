import { EventBus } from '../EventBus';
import { SoundEffects } from '../audio/SoundEffects';
import { GAME_BALANCE } from '../config/balance';
import { Scene } from 'phaser';

const BONUS_GAME_OVER_URL = `${import.meta.env.BASE_URL}dist/bonus/GameOver.png`;
const BONUS_JAQUETTE_RETRONISATION_URL = `${import.meta.env.BASE_URL}dist/bonus/JaquetteRetronisation.png`;
const BONUS_ZE_NEXT_KEEN_URL = `${import.meta.env.BASE_URL}dist/bonus/ZeNextKeen.png`;
const BONUS_ZE_NEXT_PREHISTORIK_URL = `${import.meta.env.BASE_URL}dist/bonus/ZeNextPrehistorik.png`;

export class MainMenu extends Scene
{
    constructor ()
    {
        super('MainMenu');
        this.marcheGifOverlay = null;
        this.marcheGifResizeHandler = null;
        this.bonusMediaItems = [];
        this.bonusMediaIndex = 0;
        this.bonusMediaOverlay = null;
        this.bonusMediaLabel = null;
        this.startVideoOverlay = null;
        this.startVideoSkipKeyHandler = null;
        this.startVideoSkipPointerHandler = null;
        this.isStartTransitionRunning = false;
        this.optionsDifficultyLabel = null;
    }

    create (data = {})
    {
        const persisted = typeof window !== 'undefined' ? window.localStorage.getItem('parsec.difficulty') : null;
        this.newbieCode = 'NEWBIE';
        this.newbieProgress = 0;
        this.newbieUnlocked = data.difficultyLevel === 'newbie';
        const allowedDifficulties = this.getAvailableDifficultyLevels();
        const requestedDifficulty = data.difficultyLevel || persisted || GAME_BALANCE.difficulty.defaultLevel;
        this.selectedDifficulty = allowedDifficulties.includes(requestedDifficulty) ? requestedDifficulty : GAME_BALANCE.difficulty.defaultLevel;
        this.secretCode = 'VINCENT';
        this.secretProgress = 0;
        this.bonusCode = 'FABIEN';
        this.bonusProgress = 0;
        this.helpPanel = null;
        this.optionsPanel = null;
        this.bonusPanel = null;

        const miniGamePersisted = typeof window !== 'undefined' ? window.localStorage.getItem('parsec.minigame.unlocked') === '1' : false;
        const bonusPersisted = typeof window !== 'undefined' ? window.localStorage.getItem('parsec.bonus.unlocked') === '1' : false;
        this.miniGameUnlocked = !!miniGamePersisted;
        this.bonusUnlocked = !!bonusPersisted;

        this.cameras.main.setBackgroundColor(0x06111f);

        this.drawTitleBackground();
        this.createMainButtons();
        this.refreshOptionsLabel();
        this.updateUnlockButtons();

        this.events.once('shutdown', () => this.shutdown());

        this.input.keyboard.on('keydown', (event) => this.handleMenuKey(event));
        this.input.keyboard.once('keydown-ENTER', () => this.startGame());
        this.input.keyboard.once('keydown-SPACE', () => this.startGame());

        if (typeof window !== 'undefined')
        {
            window.localStorage.setItem('parsec.difficulty', this.selectedDifficulty);
        }

        SoundEffects.stopIntroMusic();
        SoundEffects.stopAmbientMusic();
        
        EventBus.emit('current-scene-ready', this);
    }

    drawTitleBackground ()
    {
        const bg = this.add.rectangle(512, 220, 1024, 440, 0x000000);
        const glow = this.add.ellipse(512, 220, 760, 210, 0x215083, 0.45);
        const title = this.add.text(512, 176, 'RETRONISATION', {
            fontFamily: 'Arial Black',
            fontSize: 86,
            color: '#9de3ff',
            stroke: '#0b1624',
            strokeThickness: 12,
            align: 'center'
        }).setOrigin(0.5);
        const subtitle = this.add.text(512, 252, 'Aides Fabien à sortir de la machine', {
            fontFamily: 'Arial',
            fontSize: 32,
            color: '#d8efff'
        }).setOrigin(0.5);

        this.add.tween({
            targets: [title, subtitle],
            alpha: 0.55,
            yoyo: true,
            repeat: -1,
            duration: 620
        });

        this.add.rectangle(512, 604, 1024, 328, 0x000000, 0.9)
            .setStrokeStyle(2, 0x000000, 1);

        const canUseDomGif = typeof document !== 'undefined';
        if (canUseDomGif)
        {
            if (this.marcheGifOverlay && this.marcheGifOverlay.parentNode)
            {
                this.marcheGifOverlay.parentNode.removeChild(this.marcheGifOverlay);
                this.marcheGifOverlay = null;
            }

            const marcheGifPath = import.meta.env.BASE_URL + 'dist/images/Marche.gif';
            const gameContainer = document.getElementById('game-container');
            if (!gameContainer)
            {
                console.warn('Element #game-container introuvable pour ancrer Marche.gif.');
            }

            if (gameContainer && window.getComputedStyle(gameContainer).position === 'static')
            {
                gameContainer.style.position = 'relative';
            }

            if (gameContainer)
            {
                const overlay = document.createElement('div');
                overlay.style.position = 'absolute';
                overlay.style.pointerEvents = 'none';
                overlay.style.zIndex = '9999';
                overlay.style.display = 'flex';
                overlay.style.alignItems = 'center';
                overlay.style.justifyContent = 'center';

                const marcheGifImg = document.createElement('img');
                marcheGifImg.src = marcheGifPath;
                marcheGifImg.alt = 'Marche';
                marcheGifImg.style.width = '100%';
                marcheGifImg.style.height = '100%';
                marcheGifImg.style.objectFit = 'contain';
                marcheGifImg.style.pointerEvents = 'none';
                marcheGifImg.style.display = 'block';

                overlay.appendChild(marcheGifImg);
                gameContainer.appendChild(overlay);
                this.marcheGifOverlay = overlay;

                this.updateMarcheGifResponsiveLayout();

                this.marcheGifResizeHandler = () => {
                    this.updateMarcheGifResponsiveLayout();
                };
                window.addEventListener('resize', this.marcheGifResizeHandler);

                marcheGifImg.onerror = () => {
                    // Keep the broken image visible as an explicit signal rather than silently replacing with a static frame.
                    console.warn('Impossible de charger /dist/images/Marche.gif pour animation GIF.');
                };
            }
        }

        bg.setDepth(0);
        glow.setDepth(1);
        title.setDepth(2);
        subtitle.setDepth(2);
    }

    createMainButtons ()
    {
        this.startButton = this.createMenuButton(338, 'START', () => this.startGame(), 260, 56, 0x123455);
        this.optionsButton = this.createMenuButton(406, 'OPTION', () => this.openOptionsPanel(), 260, 56, 0x234f36);
        this.helpButton = this.createMenuButton(474, 'HELP', () => this.openHelpPanel(), 260, 56, 0x503d1d);
        this.miniGameButton = this.createMenuButton(542, 'MINI GAME', () => {
            this.scene.start('MiniGamesMenu', { difficultyLevel: this.selectedDifficulty });
        }, 260, 56, 0x174b2e);
        this.bonusButton = this.createMenuButton(610, 'BONUS', () => this.openBonusPanel(), 260, 56, 0x4a1e4c);

        this.optionsHint = this.add.text(512, 736, '', {
            fontFamily: 'Arial',
            fontSize: 16,
            color: '#ffd166'
        }).setOrigin(0.5);
    }

    createMenuButton (y, label, onClick, width, height, color)
    {
        const bg = this.add.rectangle(512, y, width, height, color, 0.9)
            .setStrokeStyle(2, 0x7cf0ff, 0.65)
            .setInteractive({ useHandCursor: true });
        const text = this.add.text(512, y, label, {
            fontFamily: 'Arial Black',
            fontSize: 24,
            color: '#e9f7ff'
        }).setOrigin(0.5);

        bg.on('pointerover', () => {
            bg.setFillStyle(color + 0x111111, 0.95);
            text.setColor('#ffffff');
        });

        bg.on('pointerout', () => {
            bg.setFillStyle(color, 0.9);
            text.setColor('#e9f7ff');
        });

        bg.on('pointerdown', onClick);

        return { bg, text };
    }

    handleMenuKey (event)
    {
        this.updateNewbieSequence(event.key);
        this.updateVincentSequence(event.key);
        this.updateFabienSequence(event.key);
    }

    getAvailableDifficultyLevels ()
    {
        const levels = GAME_BALANCE.difficulty.levels ?? ['easy', 'normal', 'hard'];

        return this.newbieUnlocked ? levels : levels.filter((level) => level !== 'newbie');
    }

    openOptionsPanel ()
    {
        this.closeTransientPanels();
        this.setMarcheGifVisible(false);

        const panel = this.add.container(0, 0).setDepth(120);
        const bg = this.add.rectangle(512, 384, 700, 430, 0x061124, 0.95).setStrokeStyle(2, 0x7cf0ff, 0.5);
        const title = this.add.text(512, 228, 'OPTIONS', {
            fontFamily: 'Arial Black',
            fontSize: 40,
            color: '#f4f7fb'
        }).setOrigin(0.5);

        const diffLabel = this.add.text(512, 302, '', {
            fontFamily: 'Courier',
            fontSize: 26,
            color: '#ffd166'
        }).setOrigin(0.5);
        this.optionsDifficultyLabel = diffLabel;

        const updateDiff = () => {
            this.refreshOptionsLabel();
        };

        const [cycleBg, cycleText] = this.createSummaryButton(512, 352, 320, 52, 'CHANGER DIFFICULTE', () => {
            this.cycleDifficulty();
            updateDiff();
        });

        const [audioBg, audioText] = this.createSummaryButton(512, 420, 320, 52, 'CONFIG AUDIO', () => {
            this.openAudioPanelFromMenu(panel);
        });

        const [closeBg, closeText] = this.createSummaryButton(512, 488, 320, 52, 'FERMER', () => {
            this.closeTransientPanels();
        });

        panel.add([bg, title, diffLabel, cycleBg, cycleText, audioBg, audioText, closeBg, closeText]);
        this.optionsPanel = panel;
        updateDiff();
    }

    openAudioPanelFromMenu (parentPanel)
    {
        const flags = SoundEffects.getAudioMuteFlags();
        const makeToggle = (y, label, mode) => this.createSummaryButton(512, y, 360, 48, label, () => {
            if (mode === 'all' || mode === 'mute')
            {
                SoundEffects.setSoundMode(mode);
            }
            else
            {
                const nextFlags = SoundEffects.getAudioMuteFlags();
                if (mode === 'shots') { nextFlags.shots = !nextFlags.shots; }
                if (mode === 'thrusters') { nextFlags.thrusters = !nextFlags.thrusters; }
                if (mode === 'ambient') { nextFlags.ambient = !nextFlags.ambient; }
                nextFlags.all = false;
                SoundEffects.setAudioMuteFlags(nextFlags);
            }
        });

        const [allBg, allText] = makeToggle(548, 'TOUT ACTIVER', 'all');
        const [shotBg, shotText] = makeToggle(596, `TIRS ${flags.shots ? 'OFF' : 'ON'}`, 'shots');
        const [thrBg, thrText] = makeToggle(644, `REACTEURS ${flags.thrusters ? 'OFF' : 'ON'}`, 'thrusters');
        const [ambBg, ambText] = makeToggle(692, `MUSIQUE ${flags.ambient ? 'OFF' : 'ON'}`, 'ambient');

        parentPanel.add([allBg, allText, shotBg, shotText, thrBg, thrText, ambBg, ambText]);
    }

    openHelpPanel ()
    {
        this.closeTransientPanels();
        this.setMarcheGifVisible(false);

        const panel = this.add.container(0, 0).setDepth(120);
        const bg = this.add.rectangle(512, 384, 860, 560, 0x061124, 0.95).setStrokeStyle(2, 0x7cf0ff, 0.5);
        const title = this.add.text(512, 212, 'HELP', {
            fontFamily: 'Arial Black',
            fontSize: 40,
            color: '#f4f7fb'
        }).setOrigin(0.5);
        const content = this.add.text(512, 312, '', {
            fontFamily: 'Courier',
            fontSize: 14,
            color: '#d9ecff',
            lineSpacing: 4,
            align: 'left',
            wordWrap: { width: 760 }
        }).setOrigin(0.5, 0);

        const setContent = (value) => content.setText(value);

        const rulesPage1 = [
            'OBJECTIF',
            '- Survivre aux 7 rounds pour liberer Fabien.',
            '',
            'ROUND ET MANCHES',
            '- Round: 7 manches (sauf round 7: 1 seule derniere manche).',
            '- Manche: 1 vague d ennemies puis 1 vague d asteroids.',
            '',
            'STATION ENTRE LES ROUNDS',
            '- Reparer le vaisseau contre des points de score.',
            '- Ameliorer le vaisseau avec des points d amelioration.',
            '- Gain fixe: 2 points d amelioration par round.',
            '',
            'CARBURANT',
            '- Tir, acceleration, freinage, montee/descente et boost consomment du fuel.',
            '- Sans fuel: vitesse constante, plus de tir, plus d accel/frein.',
            '- Le systeme de survie permet encore de monter/descendre lentement.'
        ].join('\n');

        const rulesPage2 = [
            'TUNNELS ET RAIL DE LANCEMENT',
            '- Tunnel: fuel interieur (ralentis pour bien remplir le reservoir).',
            '- Rail (dessus): boost gratuit + recharge de la jauge boost.',
            '',
            'BOOST ET JAUGE BOOST',
            '- Boost: si jauge pleine + fuel suffisant, vitesse au-dessus de la limite reacteur.',
            '- Plus la vitesse est elevee, plus les vagues defilent vite.',
            '- Jauge boost: se recharge en frolant ennemis/asteroids ou via un rail de lancement.',
            '',
            'CONSEIL DE SURVIE',
            '- Amélioration manuelle: A chaque round, il est possible de gagner un point d\'amélioration supplémentaire en jouant à un mini-jeu (aléatoire parmis 5) et en remportant l\'objectif!',
            '- Pour les plus joueurs, il est aussi possible de gagner un point d\'amélioration bonus si vous ne faites pas d\'amélioration sur votre vaisseau à la manche précédente.' 
        ].join('\n');

        const scorePage1 = [
            'Valeurs de score (general):',
            '- Ennemis detruits: score selon type de vaisseau.',
            '- Asteroids detruits: score selon taille',
            '',
            'Bonus possibles par manche:',
            '- +150 points si pas de tirs effectués.',
            '- +100 points si beaucoup d\'astéroids détruits.',
            '- +100 points si beaucoup de vaisseaux ennemis détruits.',
            '- +100 points si le boost est utilisé plusieurs fois.'
        ].join('\n');

        const scorePage2 = [
            'Bonus possibles par Round:',
            '- Pilote (+1500): Avoir utilisé souvent le boost dans le round.',
            '- Pacifiste (+1000): Pas de bombe utilisée dans le round.',
            '- Chameau (+1000): Ne prend aucun tunnel fuel sur le round.',
            '- Anguille (+1000): Ne fait aucuns tir sur le round.',
            '- Panne (+1000): Avoir été en panne sur au moins une manche complete du round.',
            '- Destructeur (+1500): Avoir détruit beaucoup d\'astéroides sur chaque mhanches du round.',
            '- Nettoyeur (+1750): Avoir détruit pratiquement tout les vaisseaux ennemis sur chaques manches du Rounds.',
            '- Survivant (+1000): Avoir fait le round sans perdre un coque/vie.',
            '- Lievre, Cheval, Guépard (+1000/2000/3000): Avoir fait le round rapidement.'
        ].join('\n');

        let rulesPage = 1;
        let scorePage = 1;

        const [rulesPageBg, rulesPageText] = this.createSummaryButton(512, 616, 340, 34, 'RULES: PAGE 2', () => {
            if (rulesPage === 1)
            {
                rulesPage = 2;
                setContent(rulesPage2);
                rulesPageText.setText('RULES: RETOUR PAGE 1');
            }
            else
            {
                rulesPage = 1;
                setContent(rulesPage1);
                rulesPageText.setText('RULES: PAGE 2');
            }
        });

        const setRulesPaginationVisible = (visible) => {
            rulesPageBg.setVisible(visible);
            rulesPageText.setVisible(visible);

            if (visible)
            {
                rulesPageBg.setInteractive({ useHandCursor: true });
            }
            else
            {
                rulesPageBg.disableInteractive();
            }
        };

        const [scorePageBg, scorePageText] = this.createSummaryButton(512, 616, 340, 34, 'SCORE: PAGE 2', () => {
            if (scorePage === 1)
            {
                scorePage = 2;
                setContent(scorePage2);
                scorePageText.setText('SCORE: RETOUR PAGE 1');
            }
            else
            {
                scorePage = 1;
                setContent(scorePage1);
                scorePageText.setText('SCORE: PAGE 2');
            }
        });

        const setScorePaginationVisible = (visible) => {
            scorePageBg.setVisible(visible);
            scorePageText.setVisible(visible);

            if (visible)
            {
                scorePageBg.setInteractive({ useHandCursor: true });
            }
            else
            {
                scorePageBg.disableInteractive();
            }
        };

        const [cmdBg, cmdText] = this.createSummaryButton(260, 270, 170, 48, 'COMMAND', () => {
            setRulesPaginationVisible(false);
            setScorePaginationVisible(false);
            setContent([
                'Vol principal:',
                '- Monter: Fleche Haut / Z',
                '- Descendre: Fleche Bas / S',
                '- Freiner: Fleche Gauche / Q',
                '- Accelerer: Fleche Droite / D',
                '- Tir: SPACE',
                '- Bombe: E / A / ENTER',
                '- Boost: SHIFT',
                '- Pause: P'
            ].join('\n'));
        });

        const [rulesBg, rulesText] = this.createSummaryButton(430, 270, 170, 48, 'RULES', () => {
            rulesPage = 1;
            rulesPageText.setText('RULES: PAGE 2');
            setRulesPaginationVisible(true);
            setScorePaginationVisible(false);
            setContent(rulesPage1);
        });

        const [shipBg, shipText] = this.createSummaryButton(594, 270, 150, 48, 'SHIP', () => {
            setRulesPaginationVisible(false);
            setScorePaginationVisible(false);
            setContent([
                'Ameliorations du vaisseau:',
                '- Canon: augmente le nombre de tirs et légèrement la consomation',
                '- Reacteur: augmente la vitesse max, la vitesse de déplacement verticale, la durée du boost et la consommation',
                '- Coque: augmente les points de vie max',
                '- Bouclier: absorption des tirs ennemis, chaque niveau ajoute augmente le nombre d\'impacts absorbables, légère consomation',
                '- Refroidissement: optimise votre systeme et réduit la consomation de fuel total de votre vaisseau',
                '- Reservoir: capacite de fuel max, attention pensez à faire le plein',
                '- Bombe: permet d\'augmenter le nombre max de bombes mais augmente aussi la durée de l\'explosion'
            ].join('\n'));
        });

        const [scoreBg, scoreText] = this.createSummaryButton(748, 270, 150, 48, 'SCORE', () => {
            setRulesPaginationVisible(false);
            scorePage = 1;
            scorePageText.setText('SCORE: PAGE 2');
            setScorePaginationVisible(true);
            setContent(scorePage1);
        });

        const [closeBg, closeText] = this.createSummaryButton(512, 668, 280, 52, 'FERMER', () => {
            this.closeTransientPanels();
        });

        panel.add([bg, title, cmdBg, cmdText, rulesBg, rulesText, shipBg, shipText, scoreBg, scoreText, content, rulesPageBg, rulesPageText, scorePageBg, scorePageText, closeBg, closeText]);
        this.helpPanel = panel;

        setRulesPaginationVisible(false);
        setScorePaginationVisible(false);
        setContent('Selectionnez COMMAND, RULES, SHIP ou SCORE.');
    }

    openBonusPanel ()
    {
        if (!this.bonusUnlocked)
        {
            return;
        }

        this.closeTransientPanels();
        this.setMarcheGifVisible(false);

        this.bonusMediaItems = this.getBonusMediaItems();
        this.bonusMediaIndex = 0;

        const panel = this.add.container(0, 0).setDepth(120);
        const bg = this.add.rectangle(512, 384, 920, 620, 0x0f0824, 0.95).setStrokeStyle(2, 0xd78dff, 0.6);
        const title = this.add.text(512, 106, 'BONUS PLAYER', {
            fontFamily: 'Arial Black',
            fontSize: 38,
            color: '#f0ddff'
        }).setOrigin(0.5);

        const frame = this.add.rectangle(512, 360, 780, 430, 0x070910, 0.96)
            .setStrokeStyle(2, 0x7cf0ff, 0.45);

        const [prevBg, prevText] = this.createSummaryButton(280, 616, 180, 50, 'PRECEDENT', () => {
            this.changeBonusMedia(-1);
        });

        const [nextBg, nextText] = this.createSummaryButton(744, 616, 180, 50, 'SUIVANT', () => {
            this.changeBonusMedia(1);
        });

        const [closeBg, closeText] = this.createSummaryButton(512, 676, 240, 50, 'FERMER', () => {
            this.closeTransientPanels();
        });

        this.bonusMediaLabel = this.add.text(512, 598, '', {
            fontFamily: 'Courier',
            fontSize: 20,
            color: '#e6cfff',
            align: 'center'
        }).setOrigin(0.5);

        panel.add([bg, title, frame, prevBg, prevText, nextBg, nextText, closeBg, closeText, this.bonusMediaLabel]);
        this.bonusPanel = panel;

        this.createBonusMediaOverlay();
        this.renderBonusMediaItem();
    }

    createSummaryButton (x, y, width, height, label, onClick)
    {
        const background = this.add.rectangle(x, y, width, height, 0x123455, 0.85)
            .setStrokeStyle(2, 0x7cf0ff, 0.65)
            .setInteractive({ useHandCursor: true });
        const text = this.add.text(x, y, label, {
            fontFamily: 'Arial Black',
            fontSize: 18,
            color: '#e9f7ff'
        }).setOrigin(0.5);

        background.on('pointerover', () => {
            background.setFillStyle(0x1b4f75, 0.95);
            text.setColor('#ffffff');
        });

        background.on('pointerout', () => {
            background.setFillStyle(0x123455, 0.85);
            text.setColor('#e9f7ff');
        });

        background.on('pointerdown', onClick);

        return [background, text];
    }

    closeTransientPanels ()
    {
        if (this.helpPanel)
        {
            this.helpPanel.destroy(true);
            this.helpPanel = null;
        }

        if (this.optionsPanel)
        {
            this.optionsPanel.destroy(true);
            this.optionsPanel = null;
        }

        this.optionsDifficultyLabel = null;

        if (this.bonusPanel)
        {
            this.bonusPanel.destroy(true);
            this.bonusPanel = null;
        }

        this.destroyBonusMediaOverlay();
        this.bonusMediaLabel = null;

        this.setMarcheGifVisible(true);
    }

    getBonusMediaItems ()
    {
        const b = import.meta.env.BASE_URL;
        const fallback = [
            { name: 'Intro', type: 'video', url: b + 'dist/bonus/Intro.mp4' },
            { name: 'Start', type: 'video', url: b + 'dist/bonus/Start.mp4' },
            { name: 'FabienAuHangar', type: 'image', url: b + 'dist/bonus/FabienAuHangar.png' },
            { name: 'FabienAuHangarRetro', type: 'image', url: b + 'dist/bonus/FabienAuHangarRetro.png' },
            { name: 'FabienPilote', type: 'image', url: b + 'dist/bonus/FabienPilote.png' },
            { name: 'GameOver', type: 'image', url: BONUS_GAME_OVER_URL },
            { name: 'InTheScreen', type: 'image', url: b + 'dist/bonus/InTheScreen.png' },
            { name: 'JaquetteRetronisation', type: 'image', url: BONUS_JAQUETTE_RETRONISATION_URL },
            { name: 'Pixelisé', type: 'image', url: b + 'dist/bonus/Pixelisé.png' },
            { name: 'SurSonJoujou', type: 'image', url: b + 'dist/bonus/SurSonJoujou.png' },
            { name: 'ZeNextKeen', type: 'image', url: BONUS_ZE_NEXT_KEEN_URL },
            { name: 'ZeNextPrehistorik', type: 'image', url: BONUS_ZE_NEXT_PREHISTORIK_URL }
        ];

        const manifest = this.registry.get('bonusMediaManifest');
        const rawItems = Array.isArray(manifest) && manifest.length > 0 ? manifest : fallback;
        const ordered = [...rawItems].sort((a, b) => {
            const aName = `${a?.name ?? ''}`.toLowerCase();
            const bName = `${b?.name ?? ''}`.toLowerCase();

            if (aName === 'intro') { return -1; }
            if (bName === 'intro') { return 1; }
            if (aName === 'start') { return -1; }
            if (bName === 'start') { return 1; }

            return aName.localeCompare(bName, 'fr');
        });

        return ordered;
    }

    createBonusMediaOverlay ()
    {
        this.destroyBonusMediaOverlay();

        if (typeof document === 'undefined')
        {
            return;
        }

        const gameContainer = document.getElementById('game-container');
        if (!gameContainer)
        {
            return;
        }

        if (window.getComputedStyle(gameContainer).position === 'static')
        {
            gameContainer.style.position = 'relative';
        }

        const overlay = document.createElement('div');
        overlay.style.position = 'absolute';
        overlay.style.left = '50%';
        overlay.style.top = '47%';
        overlay.style.transform = 'translate(-50%, -50%)';
        overlay.style.width = '760px';
        overlay.style.height = '410px';
        overlay.style.background = '#03050a';
        overlay.style.border = '1px solid rgba(124,240,255,0.28)';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.pointerEvents = 'auto';
        overlay.style.zIndex = '1300';

        gameContainer.appendChild(overlay);
        this.bonusMediaOverlay = overlay;
    }

    destroyBonusMediaOverlay ()
    {
        if (!this.bonusMediaOverlay)
        {
            return;
        }

        if (this.bonusMediaOverlay.parentNode)
        {
            this.bonusMediaOverlay.parentNode.removeChild(this.bonusMediaOverlay);
        }

        this.bonusMediaOverlay = null;
    }

    changeBonusMedia (direction)
    {
        if (!this.bonusMediaItems || this.bonusMediaItems.length === 0)
        {
            return;
        }

        const size = this.bonusMediaItems.length;
        this.bonusMediaIndex = (this.bonusMediaIndex + direction + size) % size;
        this.renderBonusMediaItem();
    }

    renderBonusMediaItem ()
    {
        if (!this.bonusMediaOverlay || !this.bonusMediaItems || this.bonusMediaItems.length === 0)
        {
            if (this.bonusMediaLabel)
            {
                this.bonusMediaLabel.setText('Aucun media bonus');
            }

            return;
        }

        this.bonusMediaOverlay.innerHTML = '';

        const item = this.bonusMediaItems[this.bonusMediaIndex];
        const isVideo = (item.type === 'video') || /\.(mp4|webm|ogg)$/i.test(item.url);
        const total = this.bonusMediaItems.length;

        if (this.bonusMediaLabel)
        {
            this.bonusMediaLabel.setText(`${item.name} (${this.bonusMediaIndex + 1}/${total})`);
        }

        if (isVideo)
        {
            const video = document.createElement('video');
            video.src = item.url;
            video.controls = true;
            video.autoplay = true;
            video.loop = true;
            video.muted = true;
            video.playsInline = true;
            video.style.width = '100%';
            video.style.height = '100%';
            video.style.objectFit = 'contain';
            video.style.background = '#000000';
            this.bonusMediaOverlay.appendChild(video);
            return;
        }

        const image = document.createElement('img');
        image.src = item.url;
        image.alt = item.name;
        image.style.width = '100%';
        image.style.height = '100%';
        image.style.objectFit = 'contain';
        image.style.display = 'block';
        this.bonusMediaOverlay.appendChild(image);
    }

    setMarcheGifVisible (visible)
    {
        if (!this.marcheGifOverlay)
        {
            return;
        }

        this.marcheGifOverlay.style.display = visible ? 'flex' : 'none';
    }

    showMiniGameButton ()
    {
        this.miniGameUnlocked = true;

        if (typeof window !== 'undefined')
        {
            window.localStorage.setItem('parsec.minigame.unlocked', '1');
        }

        this.updateUnlockButtons();
    }

    updateVincentSequence (key)
    {
        const pressed = `${key}`.toUpperCase();
        const expected = this.secretCode[this.secretProgress];

        if (pressed === expected)
        {
            this.secretProgress += 1;
        }
        else
        {
            this.secretProgress = pressed === this.secretCode[0] ? 1 : 0;
        }

        if (this.secretProgress < this.secretCode.length)
        {
            return;
        }

        this.secretProgress = 0;

        if (this.miniGameUnlocked)
        {
            return;
        }

        this.showMiniGameButton();
    }

    updateNewbieSequence (key)
    {
        const pressed = `${key}`.toUpperCase();
        const expected = this.newbieCode[this.newbieProgress];

        if (pressed === expected)
        {
            this.newbieProgress += 1;
        }
        else
        {
            this.newbieProgress = pressed === this.newbieCode[0] ? 1 : 0;
        }

        if (this.newbieProgress < this.newbieCode.length)
        {
            return;
        }

        this.newbieProgress = 0;
        this.newbieUnlocked = true;
        this.selectedDifficulty = 'newbie';

        if (typeof window !== 'undefined')
        {
            window.localStorage.setItem('parsec.difficulty', this.selectedDifficulty);
        }

        this.refreshOptionsLabel();
    }

    updateFabienSequence (key)
    {
        const pressed = `${key}`.toUpperCase();
        const expected = this.bonusCode[this.bonusProgress];

        if (pressed === expected)
        {
            this.bonusProgress += 1;
        }
        else
        {
            this.bonusProgress = pressed === this.bonusCode[0] ? 1 : 0;
        }

        if (this.bonusProgress < this.bonusCode.length)
        {
            return;
        }

        this.bonusProgress = 0;

        if (this.bonusUnlocked)
        {
            return;
        }

        this.bonusUnlocked = true;

        if (typeof window !== 'undefined')
        {
            window.localStorage.setItem('parsec.bonus.unlocked', '1');
        }

        this.updateUnlockButtons();
    }

    updateUnlockButtons ()
    {
        if (this.miniGameButton)
        {
            this.miniGameButton.bg.setVisible(this.miniGameUnlocked);
            this.miniGameButton.text.setVisible(this.miniGameUnlocked);
            if (!this.miniGameUnlocked)
            {
                this.miniGameButton.bg.disableInteractive();
            }
            else
            {
                this.miniGameButton.bg.setInteractive({ useHandCursor: true });
            }
        }

        if (this.bonusButton)
        {
            this.bonusButton.bg.setVisible(this.bonusUnlocked);
            this.bonusButton.text.setVisible(this.bonusUnlocked);
            if (!this.bonusUnlocked)
            {
                this.bonusButton.bg.disableInteractive();
            }
            else
            {
                this.bonusButton.bg.setInteractive({ useHandCursor: true });
            }
        }
    }

    startGame ()
    {
        if (this.isStartTransitionRunning)
        {
            return;
        }

        this.isStartTransitionRunning = true;
        this.destroyMarcheGifOverlay();
        this.closeTransientPanels();
        this.disableAllMenuButtons();
        this.input.keyboard.removeAllListeners();
        this.input.off('pointerdown');
        this.playStartVideoThenLaunchGame();
    }

    disableAllMenuButtons ()
    {
        const allButtons = [
            this.startButton,
            this.optionsButton,
            this.helpButton,
            this.miniGameButton,
            this.bonusButton
        ];

        for (const btn of allButtons)
        {
            if (!btn)
            {
                continue;
            }

            if (btn.bg)
            {
                btn.bg.disableInteractive();
                btn.bg.setVisible(false);
            }

            if (btn.text)
            {
                btn.text.setVisible(false);
            }
        }
    }

    playStartVideoThenLaunchGame ()
    {
        if (typeof document === 'undefined')
        {
            this.launchGameAfterStartVideo();
            return;
        }

        const gameContainer = document.getElementById('game-container');
        if (!gameContainer)
        {
            this.launchGameAfterStartVideo();
            return;
        }

        if (window.getComputedStyle(gameContainer).position === 'static')
        {
            gameContainer.style.position = 'relative';
        }

        this.destroyStartVideoOverlay();

        const overlay = document.createElement('div');
        overlay.style.position = 'absolute';
        overlay.style.left = '0';
        overlay.style.top = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.background = '#000000';
        overlay.style.zIndex = '1400';
        overlay.style.pointerEvents = 'auto';

        const video = document.createElement('video');
        video.src = import.meta.env.BASE_URL + 'dist/bonus/Start.mp4';
        video.autoplay = true;
        video.controls = false;
        video.loop = false;
        video.muted = false;
        video.playsInline = true;
        video.style.width = '100%';
        video.style.height = '100%';
        video.style.objectFit = 'contain';
        video.style.background = '#000000';

        overlay.appendChild(video);
        gameContainer.appendChild(overlay);
        this.startVideoOverlay = overlay;

        let finished = false;
        const finish = () => {
            if (finished)
            {
                return;
            }

            finished = true;
            this.launchGameAfterStartVideo();
        };

        this.startVideoSkipPointerHandler = () => finish();
        this.startVideoSkipKeyHandler = (event) => {
            if (event.code === 'Space' || event.code === 'Enter' || event.key === ' ' || event.key === 'Enter')
            {
                event.preventDefault();
                finish();
            }
        };

        overlay.addEventListener('pointerdown', this.startVideoSkipPointerHandler);
        window.addEventListener('keydown', this.startVideoSkipKeyHandler, true);

        video.onended = finish;
        video.onerror = finish;

        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === 'function')
        {
            playPromise.catch(() => finish());
        }
    }

    launchGameAfterStartVideo ()
    {
        this.destroyStartVideoOverlay();
        this.isStartTransitionRunning = false;
        this.scene.start('Game', { difficultyLevel: this.selectedDifficulty });
    }

    destroyStartVideoOverlay ()
    {
        if (!this.startVideoOverlay)
        {
            return;
        }

        const video = this.startVideoOverlay.querySelector('video');
        if (video)
        {
            video.onended = null;
            video.onerror = null;

            try
            {
                video.pause();
            }
            catch (_error)
            {
                // no-op
            }
        }

        if (this.startVideoSkipPointerHandler)
        {
            this.startVideoOverlay.removeEventListener('pointerdown', this.startVideoSkipPointerHandler);
            this.startVideoSkipPointerHandler = null;
        }

        if (this.startVideoSkipKeyHandler)
        {
            window.removeEventListener('keydown', this.startVideoSkipKeyHandler, true);
            this.startVideoSkipKeyHandler = null;
        }

        if (this.startVideoOverlay.parentNode)
        {
            this.startVideoOverlay.parentNode.removeChild(this.startVideoOverlay);
        }

        this.startVideoOverlay = null;
    }

    destroyMarcheGifOverlay ()
    {
        if (!this.marcheGifOverlay)
        {
            return;
        }

        if (this.marcheGifOverlay.parentNode)
        {
            this.marcheGifOverlay.parentNode.removeChild(this.marcheGifOverlay);
        }

        this.marcheGifOverlay = null;
    }

    cycleDifficulty ()
    {
        const levels = this.getAvailableDifficultyLevels();
        const currentIndex = levels.indexOf(this.selectedDifficulty);
        const nextIndex = (currentIndex + 1) % levels.length;

        this.selectedDifficulty = levels[nextIndex];

        if (typeof window !== 'undefined')
        {
            window.localStorage.setItem('parsec.difficulty', this.selectedDifficulty);
        }

        this.refreshOptionsLabel();
    }

    refreshOptionsLabel ()
    {
        if (this.optionsDifficultyLabel)
        {
            this.optionsDifficultyLabel.setText(`Difficulte: ${this.selectedDifficulty.toUpperCase()}`);
        }

        if (this.optionsHint)
        {
            this.optionsHint.setText(`Difficulty: ${this.selectedDifficulty.toUpperCase()}`);
        }
    }

    updateMarcheGifResponsiveLayout ()
    {
        if (!this.marcheGifOverlay || typeof document === 'undefined')
        {
            return;
        }

        const gameContainer = document.getElementById('game-container');
        if (!gameContainer)
        {
            return;
        }

        // Scale against the base game resolution so the GIF follows the same visual rhythm as UI/canvas scaling.
        const baseWidth = 1024;
        const baseHeight = 768;
        const containerWidth = gameContainer.clientWidth || baseWidth;
        const containerHeight = gameContainer.clientHeight || baseHeight;
        const scale = Math.min(containerWidth / baseWidth, containerHeight / baseHeight);

        const width = Math.max(240, Math.round(600 * scale));
        const height = Math.max(168, Math.round(420 * scale));
        const right = Math.round(-200 * scale);
        const bottom = Math.max(8, Math.round(40 * scale));

        this.marcheGifOverlay.style.width = `${width}px`;
        this.marcheGifOverlay.style.height = `${height}px`;
        this.marcheGifOverlay.style.right = `${right}px`;
        this.marcheGifOverlay.style.bottom = `${bottom}px`;
    }

    shutdown ()
    {
        this.destroyStartVideoOverlay();
        this.isStartTransitionRunning = false;

        this.destroyBonusMediaOverlay();

        if (this.marcheGifResizeHandler)
        {
            window.removeEventListener('resize', this.marcheGifResizeHandler);
            this.marcheGifResizeHandler = null;
        }

        if (this.marcheGifOverlay)
        {
            if (this.marcheGifOverlay.parentNode)
            {
                this.marcheGifOverlay.parentNode.removeChild(this.marcheGifOverlay);
            }

            this.marcheGifOverlay = null;
        }
    }
}
