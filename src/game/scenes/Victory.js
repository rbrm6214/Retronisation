import { EventBus } from '../EventBus';
import { Scene } from 'phaser';

export class Victory extends Scene
{
    constructor ()
    {
        super('Victory');
    }

    create (data)
    {
        this.cameras.main.setBackgroundColor(0x06140c);

        this.add.image(512, 384, 'background').setAlpha(0.12);
        this.add.rectangle(512, 384, 760, 420, 0x081b12, 0.9).setStrokeStyle(2, 0x7dff9f, 0.42);

        this.add.text(512, 246, 'VICTOIRE', {
            fontFamily: 'Arial Black',
            fontSize: 66,
            color: '#effff3',
            stroke: '#000000',
            strokeThickness: 8
        }).setOrigin(0.5);

        const scoreLabel = data.godMode ? 'GOD' : data.bugUsed ? 'BUG' : `${data.score ?? 0}`;
        this.add.text(512, 320, `Score final : ${scoreLabel}`, {
            fontFamily: 'Arial',
            fontSize: 32,
            color: '#d7ffe3'
        }).setOrigin(0.5);

        this.add.text(512, 390, [
            'Bonne fête papa, tu as réussit ce jeu,',
            'j\'esperes que tu l\'a apprécié,',
            '',
            'voici ta récompense, un menu Bonus rien que pour toi',
            '(et pour le réactiver, il te suffit d\'ecrire ton',
            'prénom dans le menu titre ;p).',
            '',
            'Prend la photo de cette page et envoie la moi,',
            'ça me fera plaisir de voir ton score ^^.'
        ].join('\n'), {
            fontFamily: 'Arial',
            fontSize: 20,
            color: '#c5f6d2',
            align: 'center',
            lineSpacing: 6
        }).setOrigin(0.5);

        this.add.text(512, 570, 'Cliquer ou appuyer sur ENTREE pour revenir au menu', {
            fontFamily: 'Arial Black',
            fontSize: 22,
            color: '#8dffb0'
        }).setOrigin(0.5);

        this.input.once('pointerdown', () => this.changeScene());
        this.input.keyboard.once('keydown-ENTER', () => this.changeScene());
        this.input.keyboard.once('keydown-SPACE', () => this.changeScene());

        EventBus.emit('current-scene-ready', this);
    }

    changeScene ()
    {
        if (typeof window !== 'undefined')
        {
            window.localStorage.setItem('parsec.bonus.unlocked', '1');
        }

        this.scene.start('MainMenu');
    }
}
