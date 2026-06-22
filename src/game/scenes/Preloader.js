import { Scene } from 'phaser';

const BONUS_GAME_OVER_URL = `${import.meta.env.BASE_URL}dist/bonus/GameOver.png`;
const BONUS_JAQUETTE_RETRONISATION_URL = `${import.meta.env.BASE_URL}dist/bonus/JaquetteRetronisation.png`;
const BONUS_ZE_NEXT_KEEN_URL = `${import.meta.env.BASE_URL}dist/bonus/ZeNextKeen.png`;
const BONUS_ZE_NEXT_PREHISTORIK_URL = `${import.meta.env.BASE_URL}dist/bonus/ZeNextPrehistorik.png`;

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

        // User-provided cinematic images (kept in dist/images).
        this.load.image('cinematic-fabien', '../dist/images/fabien.png');
        this.load.image('cinematic-ti994a-parsec', '../dist/images/TI994a et parsec.png');
        this.load.image('cinematic-bureau', '../dist/images/bureau.jpg');
        this.load.image('cinematic-boot-ti99', '../dist/images/bootTi99.jpg');
        this.load.image('cinematic-screen-1', '../dist/images/InTheScreen1.png');
        this.load.image('cinematic-screen-2', '../dist/images/InTheScreen2.png');
        this.load.image('cinematic-fabien-panique-gif', '../dist/images/FabienPanique.gif');
        this.load.image('cinematic-tourne-gif', '../dist/images/Tourne.gif');
        this.load.image('cinematic-marche-gif', '../dist/images/Marche.gif');
        this.load.image('cinematic-upload-running', '../dist/images/uploadRunning.png');
        this.load.image('cinematic-upload-completed', '../dist/images/uploadCompleted.png');

        // Bonus viewer media from dist/bonus.
        this.load.image('bonus-fabien-hangar', '../dist/bonus/FabienAuHangar.png');
        this.load.image('bonus-fabien-hangar-retro', '../dist/bonus/FabienAuHangarRetro.png');
        this.load.image('bonus-fabien-pilote', '../dist/bonus/FabienPilote.png');
        this.load.image('bonus-game-over', BONUS_GAME_OVER_URL);
        this.load.image('bonus-in-the-screen', '../dist/bonus/InTheScreen.png');
        this.load.image('bonus-jaquette-retronisation', BONUS_JAQUETTE_RETRONISATION_URL);
        this.load.image('bonus-pixelise', '../dist/bonus/Pixelisé.png');
        this.load.image('bonus-sur-son-joujou', '../dist/bonus/SurSonJoujou.png');
        this.load.image('bonus-ze-next-keen', BONUS_ZE_NEXT_KEEN_URL);
        this.load.image('bonus-ze-next-prehistorik', BONUS_ZE_NEXT_PREHISTORIK_URL);
    }

    create ()
    {
        const b = import.meta.env.BASE_URL;
        this.registry.set('bonusMediaManifest', [
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
        ]);

        this.scene.start('IntroCinematic');
    }
}
