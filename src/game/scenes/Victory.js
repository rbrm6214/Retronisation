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

        this.add.text(512, 344, `Score final ${data.score ?? 0}`, {
            fontFamily: 'Arial',
            fontSize: 32,
            color: '#d7ffe3'
        }).setOrigin(0.5);

        this.add.text(512, 390, `Round termine ${data.round ?? 7}`, {
            fontFamily: 'Arial',
            fontSize: 24,
            color: '#c5f6d2'
        }).setOrigin(0.5);

        this.add.text(512, 502, 'Cliquer ou appuyer sur ENTREE pour revenir au menu', {
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
        this.scene.start('MainMenu');
    }
}
