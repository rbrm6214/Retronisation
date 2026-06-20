import { EventBus } from '../EventBus';
import { Scene } from 'phaser';

export class GameOver extends Scene
{
    constructor ()
    {
        super('GameOver');
    }

    create (data)
    {
        this.cameras.main.setBackgroundColor(0x14060a);

        this.add.image(512, 384, 'background').setAlpha(0.12);
        this.add.rectangle(512, 384, 680, 380, 0x120c12, 0.9).setStrokeStyle(2, 0xff8d8d, 0.4);

        this.add.text(512, 268, 'GAME OVER', {
            fontFamily: 'Arial Black', fontSize: 64, color: '#ffffff',
            stroke: '#000000', strokeThickness: 8,
            align: 'center'
        }).setOrigin(0.5).setDepth(100);

        this.add.text(512, 360, `Score ${data.score ?? 0}`, {
            fontFamily: 'Arial', fontSize: 28, color: '#ffd3d3'
        }).setOrigin(0.5);

        this.add.text(512, 404, `Manche atteinte ${data.wave ?? 1}`, {
            fontFamily: 'Arial', fontSize: 24, color: '#f0b8b8'
        }).setOrigin(0.5);

        this.add.text(512, 500, 'Cliquer ou appuyer sur ENTREE pour revenir au menu', {
            fontFamily: 'Arial Black', fontSize: 22, color: '#ff8d8d'
        }).setOrigin(0.5);

        this.input.once('pointerdown', () => this.changeScene());
        this.input.keyboard.once('keydown-ENTER', () => this.changeScene());
        this.input.keyboard.once('keydown-SPACE', () => this.changeScene());

        EventBus.emit('current-scene-ready', this);
    }

    changeScene ()
    {
        this.scene.start('MainMenu');
    }
}
