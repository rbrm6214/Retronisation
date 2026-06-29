import { EventBus } from '../EventBus';
import { GAME_BALANCE } from '../config/balance';
import { MINI_GAME_DEFS, MiniGameChallenge, getMiniGameTargetScore } from '../minigames/MiniGameChallenge';
import { Scene } from 'phaser';

export class MiniGamesMenu extends Scene
{
    constructor ()
    {
        super('MiniGamesMenu');
    }

    create (data = {})
    {
        const persistedDifficulty = typeof window !== 'undefined' ? window.localStorage.getItem('parsec.difficulty') : null;
        const levels = GAME_BALANCE.difficulty.levels ?? ['easy', 'normal', 'hard'];
        const requestedDifficulty = data.difficultyLevel || persistedDifficulty || GAME_BALANCE.difficulty.defaultLevel;
        this.selectedDifficulty = levels.includes(requestedDifficulty) ? requestedDifficulty : GAME_BALANCE.difficulty.defaultLevel;
        this.selectedRound = 1;
        this.activeChallenge = null;
        this.pendingGameId = null;
        this.pendingResult = null;

        // Garantit que l'acces mini-jeux reste actif au retour menu.
        if (typeof window !== 'undefined')
        {
            window.localStorage.setItem('parsec.minigame.unlocked', '1');
        }

        this.cameras.main.setBackgroundColor(0x071321);
        this.add.rectangle(512, 384, 930, 650, 0x081523, 0.9).setStrokeStyle(2, 0x7cf0ff, 0.45);

        this.add.text(512, 96, 'MINI JEUX', {
            fontFamily: 'Arial Black',
            fontSize: 42,
            color: '#f4f7fb'
        }).setOrigin(0.5);

        this.add.text(512, 140, 'Mode essai secret VINCENT', {
            fontFamily: 'Courier',
            fontSize: 20,
            color: '#9cd8ff'
        }).setOrigin(0.5);

        this.roundLabel = this.add.text(300, 190, '', {
            fontFamily: 'Courier',
            fontSize: 18,
            color: '#d9ecff'
        }).setOrigin(0.5);

        this.diffLabel = this.add.text(724, 190, '', {
            fontFamily: 'Courier',
            fontSize: 18,
            color: '#d9ecff'
        }).setOrigin(0.5);

        this.targetLabel = this.add.text(512, 228, '', {
            fontFamily: 'Courier',
            fontSize: 20,
            color: '#6cff98'
        }).setOrigin(0.5);

        const [roundMinusBg, roundMinusText] = this.createButton(220, 190, 56, 40, '-', () => {
            this.selectedRound = Math.max(1, this.selectedRound - 1);
            this.refreshMeta();
        });
        const [roundPlusBg, roundPlusText] = this.createButton(380, 190, 56, 40, '+', () => {
            this.selectedRound = Math.min(7, this.selectedRound + 1);
            this.refreshMeta();
        });

        const [diffPrevBg, diffPrevText] = this.createButton(644, 190, 56, 40, '<', () => {
            this.cycleDifficulty(-1);
        });
        const [diffNextBg, diffNextText] = this.createButton(804, 190, 56, 40, '>', () => {
            this.cycleDifficulty(1);
        });

        const btnNodes = [
            roundMinusBg,
            roundMinusText,
            roundPlusBg,
            roundPlusText,
            diffPrevBg,
            diffPrevText,
            diffNextBg,
            diffNextText
        ];

        let row = 0;
        for (const game of MINI_GAME_DEFS)
        {
            const y = 300 + row * 76;
            const [bg, text] = this.createButton(512, y, 700, 58, `${game.label} - ${game.intro}`, () => {
                this.openMiniGamePreview(game.id);
            }, 18);
            btnNodes.push(bg, text);
            row += 1;
        }

        const [backBg, backText] = this.createButton(512, 706, 260, 52, 'RETOUR MENU', () => {
            if (this.activeChallenge)
            {
                return;
            }

            this.scene.start('MainMenu', {
                difficultyLevel: this.selectedDifficulty,
                miniGameUnlocked: true
            });
        });

        btnNodes.push(backBg, backText);

        this.baseContainer = this.add.container(0, 0);
        this.baseContainer.add(btnNodes);

        this.resultText = this.add.text(512, 746, '', {
            fontFamily: 'Courier',
            fontSize: 16,
            color: '#ffd166'
        }).setOrigin(0.5);

        this.createMiniGamePreviewUI();
        this.createMiniGameResultUI();
        this.previewKeyHandler = (event) => {
            if (this.resultContainer?.visible)
            {
                if (event.code === 'Enter' || event.code === 'Space' || event.key === 'Enter' || event.key === ' ')
                {
                    this.closeMiniGameResult();
                }
                return;
            }

            if (!this.previewContainer?.visible || this.activeChallenge)
            {
                return;
            }

            if (event.code === 'Enter' || event.code === 'Space' || event.key === 'Enter' || event.key === ' ')
            {
                this.confirmStartMiniGame();
            }
        };
        this.input.keyboard.on('keydown', this.previewKeyHandler);
        this.events.once('shutdown', () => {
            if (this.input?.keyboard && this.previewKeyHandler)
            {
                this.input.keyboard.off('keydown', this.previewKeyHandler);
            }
        });

        this.refreshMeta();
        EventBus.emit('current-scene-ready', this);
    }

    update (time, delta)
    {
        if (this.activeChallenge)
        {
            this.activeChallenge.update(delta / 1000);
        }
    }

    createButton (x, y, width, height, label, onClick, fontSize = 22)
    {
        const bg = this.add.rectangle(x, y, width, height, 0x123455, 0.88)
            .setStrokeStyle(2, 0x7cf0ff, 0.6)
            .setInteractive({ useHandCursor: true });
        const text = this.add.text(x, y, label, {
            fontFamily: 'Courier',
            fontSize,
            color: '#e9f7ff',
            align: 'center',
            wordWrap: { width: width - 20 }
        }).setOrigin(0.5);

        bg.on('pointerover', () => {
            bg.setFillStyle(0x1b4f75, 0.96);
            text.setColor('#ffffff');
        });

        bg.on('pointerout', () => {
            bg.setFillStyle(0x123455, 0.88);
            text.setColor('#e9f7ff');
        });

        bg.on('pointerdown', onClick);

        return [bg, text];
    }

    cycleDifficulty (direction)
    {
        const levels = GAME_BALANCE.difficulty.levels ?? ['easy', 'normal', 'hard'];
        const currentIndex = levels.indexOf(this.selectedDifficulty);
        let nextIndex = currentIndex + direction;

        if (nextIndex < 0)
        {
            nextIndex = levels.length - 1;
        }

        if (nextIndex >= levels.length)
        {
            nextIndex = 0;
        }

        this.selectedDifficulty = levels[nextIndex];

        if (typeof window !== 'undefined')
        {
            window.localStorage.setItem('parsec.difficulty', this.selectedDifficulty);
        }

        this.refreshMeta();
    }

    refreshMeta ()
    {
        this.roundLabel.setText(`Round: ${this.selectedRound}`);
        this.diffLabel.setText(`Difficulte: ${this.selectedDifficulty.toUpperCase()}`);

        const target = getMiniGameTargetScore(
            this.selectedRound,
            this.selectedDifficulty,
            GAME_BALANCE.difficulty.scoreMultiplier,
            GAME_BALANCE.miniGames
        );

        this.targetLabel.setText(`Objectif cible: ${target} pts`);
    }

    startMiniGame (gameId)
    {
        if (this.activeChallenge)
        {
            return;
        }

        const targetScore = getMiniGameTargetScore(
            this.selectedRound,
            this.selectedDifficulty,
            GAME_BALANCE.difficulty.scoreMultiplier,
            GAME_BALANCE.miniGames
        );

        this.activeChallenge = new MiniGameChallenge(this, {
            gameId,
            targetScore,
            roundIndex: this.selectedRound,
            difficultyLevel: this.selectedDifficulty,
            difficultyTable: GAME_BALANCE.difficulty.scoreMultiplier,
            miniGameBalance: GAME_BALANCE.miniGames,
            depth: 80,
            onComplete: (result) => {
                this.activeChallenge = null;
                this.pendingResult = result;
                this.openMiniGameResult(result);
            }
        });
    }

    createMiniGameResultUI ()
    {
        this.resultContainer = this.add.container(0, 0).setDepth(520).setVisible(false);

        const overlay = this.add.rectangle(512, 384, 1024, 768, 0x010911, 0.74)
            .setInteractive({ useHandCursor: false });
        const panel = this.add.rectangle(512, 384, 760, 470, 0x0a1b2b, 0.97)
            .setStrokeStyle(2, 0x7cf0ff, 0.65);

        this.resultTitle = this.add.text(512, 214, '', {
            fontFamily: 'Arial Black',
            fontSize: 40,
            color: '#f4f7fb'
        }).setOrigin(0.5);

        this.resultSummary = this.add.text(512, 330, '', {
            fontFamily: 'Courier',
            fontSize: 20,
            color: '#d9ecff',
            align: 'center',
            lineSpacing: 8
        }).setOrigin(0.5);

        this.resultGain = this.add.text(512, 448, '+1 point d\'amelioration', {
            fontFamily: 'Arial Black',
            fontSize: 28,
            color: '#6cff98'
        }).setOrigin(0.5);

        this.resultContinueBg = this.add.rectangle(512, 560, 260, 54, 0x123455, 0.95)
            .setStrokeStyle(2, 0x7cf0ff, 0.7)
            .setInteractive({ useHandCursor: true });
        this.resultContinueText = this.add.text(512, 560, 'CONTINUER', {
            fontFamily: 'Arial Black',
            fontSize: 22,
            color: '#e9f7ff'
        }).setOrigin(0.5);

        this.resultContinueBg.on('pointerover', () => {
            this.resultContinueBg.setFillStyle(0x1b4f75, 0.98);
            this.resultContinueText.setColor('#ffffff');
        });
        this.resultContinueBg.on('pointerout', () => {
            this.resultContinueBg.setFillStyle(0x123455, 0.95);
            this.resultContinueText.setColor('#e9f7ff');
        });
        this.resultContinueBg.on('pointerdown', () => this.closeMiniGameResult());

        this.resultContainer.add([
            overlay,
            panel,
            this.resultTitle,
            this.resultSummary,
            this.resultGain,
            this.resultContinueBg,
            this.resultContinueText
        ]);
    }

    openMiniGameResult (result)
    {
        const title = result.success ? 'SUCCES' : 'ECHEC';
        const titleColor = result.success ? '#6cff98' : '#ff8f8f';
        const gainText = result.success ? '+1 point d\'amelioration' : '+0 point d\'amelioration';
        const gainColor = result.success ? '#6cff98' : '#ffd166';
        const attemptScores = Array.isArray(result.attemptScores) ? result.attemptScores : [result.score];
        const scoreLines = attemptScores.map((score, index) => `Score essai ${index + 1}: ${score}`).join('\n');

        this.resultTitle.setText(title).setColor(titleColor);
        this.resultSummary.setText([
            scoreLines,
            `Objectif: ${result.targetScore} pts`
        ]);
        this.resultGain.setText(gainText).setColor(gainColor);
        this.resultContainer.setVisible(true);
    }

    closeMiniGameResult ()
    {
        if (!this.resultContainer?.visible)
        {
            return;
        }

        this.resultContainer.setVisible(false);

        if (this.pendingResult)
        {
            this.resultText.setText(`${this.pendingResult.label}: ${this.pendingResult.score}/${this.pendingResult.targetScore} - ${this.pendingResult.success ? 'REUSSI' : 'ECHEC'}`);
            this.pendingResult = null;
        }
    }

    createMiniGamePreviewUI ()
    {
        this.previewContainer = this.add.container(0, 0).setDepth(500).setVisible(false);

        const overlay = this.add.rectangle(512, 384, 1024, 768, 0x010911, 0.72)
            .setInteractive({ useHandCursor: false });
        const panel = this.add.rectangle(512, 384, 760, 520, 0x0a1b2b, 0.96)
            .setStrokeStyle(2, 0x7cf0ff, 0.65);

        this.previewTitle = this.add.text(512, 176, '', {
            fontFamily: 'Arial Black',
            fontSize: 38,
            color: '#f4f7fb'
        }).setOrigin(0.5);

        this.previewIntro = this.add.text(512, 228, '', {
            fontFamily: 'Courier',
            fontSize: 17,
            color: '#9cd8ff',
            align: 'center',
            wordWrap: { width: 680 }
        }).setOrigin(0.5);

        this.previewMeta = this.add.text(512, 302, '', {
            fontFamily: 'Courier',
            fontSize: 18,
            color: '#d9ecff',
            align: 'center',
            lineSpacing: 6
        }).setOrigin(0.5);

        this.previewControlsTitle = this.add.text(512, 372, 'Touches', {
            fontFamily: 'Arial Black',
            fontSize: 24,
            color: '#6cff98'
        }).setOrigin(0.5);

        this.previewControls = this.add.text(512, 430, '', {
            fontFamily: 'Courier',
            fontSize: 17,
            color: '#e9f7ff',
            align: 'center',
            lineSpacing: 4
        }).setOrigin(0.5);

        this.previewStartBg = this.add.rectangle(512, 558, 290, 56, 0x123455, 0.95)
            .setStrokeStyle(2, 0x7cf0ff, 0.7)
            .setInteractive({ useHandCursor: true });
        this.previewStartText = this.add.text(512, 558, 'DEMARRER', {
            fontFamily: 'Arial Black',
            fontSize: 20,
            color: '#e9f7ff'
        }).setOrigin(0.5);

        this.previewStartBg.on('pointerover', () => {
            this.previewStartBg.setFillStyle(0x1b4f75, 0.98);
            this.previewStartText.setColor('#ffffff');
        });

        this.previewStartBg.on('pointerout', () => {
            this.previewStartBg.setFillStyle(0x123455, 0.95);
            this.previewStartText.setColor('#e9f7ff');
        });

        this.previewStartBg.on('pointerdown', () => this.confirmStartMiniGame());

        this.previewContainer.add([
            overlay,
            panel,
            this.previewTitle,
            this.previewIntro,
            this.previewMeta,
            this.previewControlsTitle,
            this.previewControls,
            this.previewStartBg,
            this.previewStartText
        ]);
    }

    openMiniGamePreview (gameId)
    {
        if (this.activeChallenge)
        {
            return;
        }

        const game = MINI_GAME_DEFS.find((entry) => entry.id === gameId) ?? MINI_GAME_DEFS[0];
        const targetScore = getMiniGameTargetScore(
            this.selectedRound,
            this.selectedDifficulty,
            GAME_BALANCE.difficulty.scoreMultiplier,
            GAME_BALANCE.miniGames
        );
        const timeSeconds = 300;
        const attempts = this.selectedDifficulty === 'normal' ? 2 : 1;
        const lives = ['newbie', 'easy'].includes(this.selectedDifficulty) ? 2 : 1;
        const controls = this.getMiniGameControlLines(game.id).join('\n');

        this.pendingGameId = game.id;
        this.previewTitle.setText(game.label.toUpperCase());
        this.previewIntro.setText(game.intro);
        this.previewMeta.setText([
            `Vies: ${lives}   Essais: ${attempts}`,
            `Objectif: ${targetScore} pts`,
            `Temps max: ${Math.floor(timeSeconds / 60)}:${(timeSeconds % 60).toString().padStart(2, '0')}`
        ]);
        this.previewControls.setText(controls);
        this.previewContainer.setVisible(true);
    }

    confirmStartMiniGame ()
    {
        if (this.activeChallenge || !this.previewContainer?.visible || !this.pendingGameId)
        {
            return;
        }

        const gameId = this.pendingGameId;
        this.pendingGameId = null;
        this.previewContainer.setVisible(false);
        this.startMiniGame(gameId);
    }

    getMiniGameControlLines (gameId)
    {
        switch (gameId)
        {
            case 'space-invaders':
                return ['Deplacement: Fleches Gauche / Droite (Q / D)', 'Tir: SPACE'];
            case 'tetris':
                return ['Deplacement: Fleches Gauche / Droite', 'Rotation: Fleche Haut ou Bas', 'Drop instantane: SPACE'];
            case 'pacman':
                return ['Deplacement: Fleches directionnelles'];
            case 'arkanoid':
                return ['Deplacement raquette: Fleches Gauche / Droite (Q / D)'];
            case 'pinball':
                return ['Flippers: Fleches Gauche / Droite (Q / D)', 'Lanceur: maintenir puis relacher SPACE'];
            default:
                return ['Commandes: Fleches et SPACE'];
        }
    }
}
