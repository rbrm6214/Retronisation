import { Scene } from 'phaser';

export class Preloader extends Scene
{
    constructor ()
    {
        super('Preloader');
    }

    init ()
    {
        this.cameras.main.setBackgroundColor(0x03070d);
        this.add.image(512, 384, 'background');
        this.add.rectangle(512, 384, 620, 220, 0x07111d, 0.84).setStrokeStyle(2, 0x7cf0ff, 0.35);

        this.add.text(512, 304, 'INITIALISATION DU PROTOTYPE', {
            fontFamily: 'Arial Black', fontSize: 28, color: '#f4f7fb'
        }).setOrigin(0.5);

        this.add.text(512, 350, 'Chargement des ressources de base', {
            fontFamily: 'Arial', fontSize: 18, color: '#a9c6d8'
        }).setOrigin(0.5);

        this.add.rectangle(512, 414, 468, 32).setStrokeStyle(1, 0xffffff);

        const bar = this.add.rectangle(512 - 230, 414, 4, 28, 0x7cf0ff).setOrigin(0, 0.5);

        this.load.on('progress', (progress) => {
            bar.width = 4 + (460 * progress);
        });
    }

    preload ()
    {
        this.load.setPath('assets');

        this.load.image('logo', 'logo.png');
    }

    create ()
    {
        this.scene.start('IntroCinematic');
    }
}
