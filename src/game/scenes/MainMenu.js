import { EventBus } from '../EventBus';
import { GAME_BALANCE } from '../config/balance';
import { Scene } from 'phaser';

export class MainMenu extends Scene
{
    constructor ()
    {
        super('MainMenu');
    }

    create (data = {})
    {
        const persisted = typeof window !== 'undefined' ? window.localStorage.getItem('parsec.difficulty') : null;
        this.selectedDifficulty = data.difficultyLevel || persisted || GAME_BALANCE.difficulty.defaultLevel;
        this.secretCode = 'VINCENT';
        this.secretProgress = 0;
        this.miniGameUnlocked = true;

        if (typeof window !== 'undefined')
        {
            window.localStorage.setItem('parsec.minigame.unlocked', '1');
        }

        this.cameras.main.setBackgroundColor(0x06111f);

        this.add.image(512, 384, 'background').setAlpha(0.18);
        this.add.rectangle(512, 384, 720, 420, 0x081523, 0.86).setStrokeStyle(2, 0x7cf0ff, 0.45);

        this.add.text(512, 248, 'PARSEC REMASTER', {
            fontFamily: 'Arial Black', fontSize: 44, color: '#f4f7fb',
            stroke: '#091018', strokeThickness: 8,
            align: 'center'
        }).setOrigin(0.5);

        this.add.text(512, 330, 'Prototype de base pour reconstruire le gameplay arcade.', {
            fontFamily: 'Arial', fontSize: 22, color: '#a9c6d8',
            align: 'center'
        }).setOrigin(0.5);

        this.add.text(512, 415, 'Objectif du sprint: supprimer le template et poser une vraie scene de jeu.', {
            fontFamily: 'Arial', fontSize: 20, color: '#dbe7ef',
            align: 'center'
        }).setOrigin(0.5);

        this.startText = this.add.text(512, 500, 'Demarrer', {
            fontFamily: 'Arial Black', fontSize: 28, color: '#7cf0ff',
            align: 'center'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        this.optionsText = this.add.text(512, 548, '', {
            fontFamily: 'Arial', fontSize: 22, color: '#ffd166',
            align: 'center'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        this.add.text(512, 596, 'Options: cliquer pour changer la difficulte', {
            fontFamily: 'Arial', fontSize: 16, color: '#a9c6d8',
            align: 'center'
        }).setOrigin(0.5);

        this.refreshOptionsLabel();

        if (this.miniGameUnlocked)
        {
            this.showMiniGameButton();
        }

        this.startText.on('pointerdown', () => this.startGame());
        this.optionsText.on('pointerdown', () => this.cycleDifficulty());
        this.input.keyboard.once('keydown-ENTER', () => this.startGame());
        this.input.keyboard.once('keydown-SPACE', () => this.startGame());
        this.input.keyboard.on('keydown', (event) => this.updateVincentSequence(event.key));
        
        EventBus.emit('current-scene-ready', this);
    }

    showMiniGameButton ()
    {
        if (this.miniGameText)
        {
            return;
        }

        this.miniGameText = this.add.text(512, 642, 'Mini jeu', {
            fontFamily: 'Arial Black',
            fontSize: 24,
            color: '#6cff98',
            align: 'center'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        this.miniGameText.on('pointerdown', () => {
            this.scene.start('MiniGamesMenu', { difficultyLevel: this.selectedDifficulty });
        });
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

        this.miniGameUnlocked = true;

        if (typeof window !== 'undefined')
        {
            window.localStorage.setItem('parsec.minigame.unlocked', '1');
        }

        this.showMiniGameButton();
    }

    startGame ()
    {
        this.scene.start('Game', { difficultyLevel: this.selectedDifficulty });
    }

    cycleDifficulty ()
    {
        const levels = ['easy', 'normal', 'hard'];
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
        this.optionsText.setText(`Difficulte: ${this.selectedDifficulty.toUpperCase()}`);
    }
}
