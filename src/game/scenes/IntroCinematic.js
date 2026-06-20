import { Scene } from 'phaser';
import { SoundEffects } from '../audio/SoundEffects';

export class IntroCinematic extends Scene
{
    constructor ()
    {
        super('IntroCinematic');

        this.currentSlide = 0;
        this.slideTimer = null;
        this.isExiting = false;
        this.slideDurationMs = 4600;
        this.slideDurationMultiplier = 3;
    }

    create ()
    {
        this.cameras.main.setBackgroundColor(0x05070d);

        this.illustrationContainer = this.add.container(0, 0);

        this.overlay = this.add.rectangle(512, 620, 940, 230, 0x03060a, 0.84)
            .setStrokeStyle(2, 0x86e2ff, 0.35);

        this.storyText = this.add.text(84, 545, '', {
            fontFamily: 'Arial',
            fontSize: 27,
            color: '#edf4ff',
            align: 'left',
            wordWrap: { width: 856 }
        });

        this.progressText = this.add.text(940, 515, '', {
            fontFamily: 'Arial Black',
            fontSize: 16,
            color: '#86e2ff'
        }).setOrigin(1, 0);

        this.skipText = this.add.text(512, 718, 'Cliquez ou appuyez sur une touche pour passer', {
            fontFamily: 'Arial',
            fontSize: 18,
            color: '#b6cadc'
        }).setOrigin(0.5, 0.5);

        this.slides = [
            {
                text: 'Cette aventure commence le matin du dimanche 21 juin 2026, au marché aux puces de Mornas, petit village du Vaucluse.',
                draw: () => this.drawFleaMarketMorning()
            },
            {
                text: 'Fabien, 66 ans, cheveux blancs, barbe courte et lunettes, collectionneur passionné de vieilles machines, chine tranquillement dans les allées de la brocante.',
                draw: () => this.drawFabienPortrait()
            },
            {
                text: 'C\'est alors qu\'il voit, au milieu de bibelots et de vaisselle, son Graal : un TI-99/4A en parfait état, en boîte, avec la cartouche Parsec et sa notice.',
                draw: () => this.drawTreasureFind()
            },
            {
                text: 'De retour chez lui, il file dans son garage-bureau-entrepôt et fait de la place pour sa dernière acquisition, bien décidé à l\'essayer.',
                draw: () => this.drawGarageRoom()
            },
            {
                text: 'Il le branche à une prise, y connecte un écran, insère la cartouche et allume la bête.',
                draw: () => this.drawPowerOn()
            },
            {
                text: 'Ahhh, cet écran de démarrage... que de souvenirs. Mais la nostalgie ne dure pas : une erreur critique surgit.',
                draw: () => this.drawCriticalError()
            },
            {
                text: 'Un message parle d\'un besoin d\'aide. Fabien ne comprend pas, tapote le clavier et commence à douter du vendeur.',
                draw: () => this.drawHelpMessage()
            },
            {
                text: 'Une jauge apparaît avec Upload en cours. Il sent un changement en lui : sans le savoir, il est en train d\'être pixelisé.',
                draw: () => this.drawUploadAndPixelation()
            },
            {
                text: 'Arrivé à 100 %, il se fait littéralement aspirer dans l\'ordinateur et se retrouve coincé de l\'autre côté de l\'écran.',
                draw: () => this.drawDigitalVortex()
            },
            {
                text: 'Le titre apparaît : RETRONISATION. Aidez Fabien à s\'en sortir en finissant ce jeu !',
                draw: () => this.drawTitleCard(),
                durationMs: 5600
            }
        ];

        SoundEffects.startIntroMusic();

        this.registerSkipControls();
        this.events.once('shutdown', () => this.cleanupHandlers());
        this.events.once('destroy', () => this.cleanupHandlers());

        this.cameras.main.fadeIn(350, 0, 0, 0);
        this.showSlide(0);
    }

    registerSkipControls ()
    {
        this.skipHandler = () => this.skipCinematic();

        this.input.on('pointerdown', this.skipHandler);
        this.input.keyboard.on('keydown', this.skipHandler);
    }

    cleanupHandlers ()
    {
        SoundEffects.stopIntroMusic();

        if (this.slideTimer)
        {
            this.slideTimer.remove(false);
            this.slideTimer = null;
        }

        if (this.skipHandler)
        {
            this.input.off('pointerdown', this.skipHandler);
            this.input.keyboard.off('keydown', this.skipHandler);
            this.skipHandler = null;
        }
    }

    showSlide (index)
    {
        if (this.isExiting)
        {
            return;
        }

        this.currentSlide = index;

        if (this.slideTimer)
        {
            this.slideTimer.remove(false);
            this.slideTimer = null;
        }

        this.illustrationContainer.removeAll(true);

        const slide = this.slides[index];
        slide.draw();

        this.storyText.setText(slide.text);
        this.progressText.setText(`${index + 1}/${this.slides.length}`);

        const baseHold = slide.durationMs || this.slideDurationMs;
        const hold = baseHold * this.slideDurationMultiplier;
        this.slideTimer = this.time.delayedCall(hold, () => this.nextSlide());
    }

    nextSlide ()
    {
        if (this.isExiting)
        {
            return;
        }

        const nextIndex = this.currentSlide + 1;

        if (nextIndex >= this.slides.length)
        {
            this.finishCinematic();
            return;
        }

        this.tweens.add({
            targets: this.illustrationContainer,
            alpha: 0,
            duration: 220,
            onComplete: () => {
                this.illustrationContainer.alpha = 1;
                this.showSlide(nextIndex);
            }
        });
    }

    skipCinematic ()
    {
        if (this.isExiting)
        {
            return;
        }

        this.finishCinematic();
    }

    finishCinematic ()
    {
        if (this.isExiting)
        {
            return;
        }

        this.isExiting = true;

        if (this.slideTimer)
        {
            this.slideTimer.remove(false);
            this.slideTimer = null;
        }

        this.input.enabled = false;

        this.cameras.main.once('camerafadeoutcomplete', () => {
            SoundEffects.stopIntroMusic();
            this.scene.start('MainMenu');
        });

        this.cameras.main.fadeOut(350, 0, 0, 0);
    }

    drawFleaMarketMorning ()
    {
        const sky = this.add.rectangle(512, 220, 1024, 440, 0x385d86);
        const sun = this.add.circle(860, 102, 52, 0xffd57a);
        const ground = this.add.rectangle(512, 404, 1024, 184, 0x5f6040);
        const standLeft = this.add.rectangle(230, 350, 280, 122, 0x6e4d34).setStrokeStyle(2, 0x2e2015);
        const standRight = this.add.rectangle(795, 350, 330, 130, 0x795437).setStrokeStyle(2, 0x2e2015);
        const sign = this.add.text(100, 112, 'MARCHE AUX PUCES\nMORNAS', {
            fontFamily: 'Arial Black',
            fontSize: 28,
            color: '#fff4cc',
            align: 'left'
        });

        this.illustrationContainer.add([sky, sun, ground, standLeft, standRight, sign]);
    }

    drawFabienPortrait ()
    {
        const bg = this.add.rectangle(512, 220, 1024, 440, 0x2b313a);
        const halo = this.add.circle(512, 230, 152, 0x4e647f, 0.6);
        const head = this.add.circle(512, 214, 78, 0xe6c39e);
        const hair = this.add.ellipse(512, 156, 166, 74, 0xd9dce2);
        const beard = this.add.ellipse(512, 262, 126, 54, 0xe7e9ed);
        const leftGlasses = this.add.circle(482, 208, 23).setStrokeStyle(4, 0x2e3138);
        const rightGlasses = this.add.circle(542, 208, 23).setStrokeStyle(4, 0x2e3138);
        const bridge = this.add.rectangle(512, 208, 20, 4, 0x2e3138);
        const text = this.add.text(512, 382, 'FABIEN\nCollectionneur rétro', {
            fontFamily: 'Arial Black',
            fontSize: 30,
            color: '#dbe8ff',
            align: 'center'
        }).setOrigin(0.5);

        this.illustrationContainer.add([bg, halo, head, hair, beard, leftGlasses, rightGlasses, bridge, text]);
    }

    drawTreasureFind ()
    {
        const bg = this.add.rectangle(512, 220, 1024, 440, 0x3f4137);
        const table = this.add.rectangle(512, 334, 760, 92, 0x6f5136);
        const box = this.add.rectangle(512, 232, 236, 160, 0xefe3cc).setStrokeStyle(3, 0x4e4030);
        const computer = this.add.rectangle(512, 232, 168, 82, 0xbfc6ce).setStrokeStyle(2, 0x343944);
        const cart = this.add.rectangle(650, 272, 60, 70, 0x2d2f32).setStrokeStyle(2, 0xb18b47);
        const sparkleA = this.add.star(412, 188, 5, 10, 20, 0xffe27f);
        const sparkleB = this.add.star(616, 172, 5, 10, 20, 0xffe27f);
        const label = this.add.text(512, 235, 'TI-99/4A', {
            fontFamily: 'Arial Black',
            fontSize: 28,
            color: '#212a35'
        }).setOrigin(0.5);

        this.illustrationContainer.add([bg, table, box, computer, cart, sparkleA, sparkleB, label]);
    }

    drawGarageRoom ()
    {
        const wall = this.add.rectangle(512, 200, 1024, 400, 0x242c37);
        const floor = this.add.rectangle(512, 390, 1024, 210, 0x3b2d24);
        const shelfA = this.add.rectangle(220, 228, 230, 230, 0x4d3a2d).setStrokeStyle(2, 0x1e150f);
        const shelfB = this.add.rectangle(796, 228, 220, 230, 0x4d3a2d).setStrokeStyle(2, 0x1e150f);
        const desk = this.add.rectangle(512, 334, 358, 112, 0x60412a);
        const machine = this.add.rectangle(512, 286, 180, 76, 0xb8c0cc).setStrokeStyle(2, 0x2c313a);
        const lamp = this.add.circle(360, 148, 20, 0xffdf92);

        this.illustrationContainer.add([wall, floor, shelfA, shelfB, desk, machine, lamp]);
    }

    drawPowerOn ()
    {
        const bg = this.add.rectangle(512, 220, 1024, 440, 0x1d2530);
        const desk = this.add.rectangle(512, 340, 620, 120, 0x5a3f2a);
        const computer = this.add.rectangle(430, 296, 210, 84, 0xbec6cf).setStrokeStyle(2, 0x27313c);
        const monitor = this.add.rectangle(640, 252, 250, 152, 0x1f2c38).setStrokeStyle(3, 0x536c84);
        const screen = this.add.rectangle(640, 252, 220, 122, 0x0d1721);
        const signal = this.add.rectangle(640, 252, 180, 12, 0x69ffa1);
        const cableA = this.add.line(0, 0, 530, 334, 600, 312, 0x262626).setLineWidth(3);
        const cableB = this.add.line(0, 0, 330, 296, 260, 360, 0x262626).setLineWidth(3);

        this.illustrationContainer.add([bg, desk, computer, monitor, screen, signal, cableA, cableB]);
    }

    drawCriticalError ()
    {
        const bg = this.add.rectangle(512, 220, 1024, 440, 0x121820);
        const monitor = this.add.rectangle(512, 232, 620, 320, 0x1f2b37).setStrokeStyle(3, 0x6d8aa6);
        const screen = this.add.rectangle(512, 232, 560, 260, 0x05090f);
        const alert = this.add.rectangle(512, 232, 420, 150, 0x5f0b14).setStrokeStyle(3, 0xf36c6c);
        const title = this.add.text(512, 194, 'ERREUR CRITIQUE', {
            fontFamily: 'Arial Black',
            fontSize: 40,
            color: '#ffd8d8'
        }).setOrigin(0.5);
        const code = this.add.text(512, 250, 'CODE: PARSEC-0x99', {
            fontFamily: 'Arial',
            fontSize: 24,
            color: '#ffe9e9'
        }).setOrigin(0.5);

        this.illustrationContainer.add([bg, monitor, screen, alert, title, code]);
    }

    drawHelpMessage ()
    {
        const bg = this.add.rectangle(512, 220, 1024, 440, 0x181d2a);
        const monitor = this.add.rectangle(512, 225, 640, 330, 0x202a38).setStrokeStyle(3, 0x6a86a1);
        const screen = this.add.rectangle(512, 225, 590, 275, 0x05080f);
        const lines = this.add.text(512, 208, 'NEED HELP\nPLEASE REPAIR SYSTEM\nKEYBOARD RESPONSE REQUIRED', {
            fontFamily: 'Courier New',
            fontSize: 30,
            color: '#8afcc0',
            align: 'center'
        }).setOrigin(0.5);
        const keyboard = this.add.rectangle(512, 390, 410, 64, 0x2b3240).setStrokeStyle(2, 0x4e5f74);
        const hand = this.add.rectangle(640, 380, 84, 42, 0xe6c39e);

        this.illustrationContainer.add([bg, monitor, screen, lines, keyboard, hand]);
    }

    drawUploadAndPixelation ()
    {
        const bg = this.add.rectangle(512, 220, 1024, 440, 0x0e1420);
        const monitor = this.add.rectangle(512, 232, 610, 310, 0x1d2736).setStrokeStyle(3, 0x6c86a5);
        const screen = this.add.rectangle(512, 232, 560, 250, 0x050912);
        const label = this.add.text(512, 168, 'UPLOAD EN COURS', {
            fontFamily: 'Arial Black',
            fontSize: 34,
            color: '#9fd9ff'
        }).setOrigin(0.5);
        const barBg = this.add.rectangle(512, 236, 440, 36, 0x1c2736).setStrokeStyle(2, 0x7dd5ff);
        const bar = this.add.rectangle(512 - 216, 236, 432, 26, 0x7cf0ff).setOrigin(0, 0.5);
        const p1 = this.add.rectangle(760, 306, 20, 20, 0xffd37e);
        const p2 = this.add.rectangle(786, 288, 20, 20, 0xe6c39e);
        const p3 = this.add.rectangle(812, 320, 20, 20, 0x8ec5ff);

        this.illustrationContainer.add([bg, monitor, screen, label, barBg, bar, p1, p2, p3]);

        this.tweens.add({
            targets: [p1, p2, p3],
            alpha: 0.25,
            yoyo: true,
            repeat: -1,
            duration: 260
        });
    }

    drawDigitalVortex ()
    {
        const bg = this.add.rectangle(512, 220, 1024, 440, 0x080b12);
        const ringA = this.add.circle(512, 220, 180).setStrokeStyle(6, 0x6ab7ff, 0.7);
        const ringB = this.add.circle(512, 220, 132).setStrokeStyle(4, 0x4a92ea, 0.7);
        const ringC = this.add.circle(512, 220, 90).setStrokeStyle(3, 0x8be7ff, 0.7);
        const fabien = this.add.rectangle(372, 260, 68, 112, 0xe6c39e);
        const monitor = this.add.rectangle(700, 220, 210, 160, 0x1f2c3a).setStrokeStyle(3, 0x6f8aa6);
        const beam = this.add.triangle(0, 0, 510, 175, 770, 145, 770, 295, 0x67d9ff, 0.35);

        this.illustrationContainer.add([bg, ringA, ringB, ringC, beam, fabien, monitor]);

        this.tweens.add({
            targets: [ringA, ringB, ringC],
            angle: 360,
            duration: 2400,
            repeat: -1
        });

        this.tweens.add({
            targets: fabien,
            x: 560,
            y: 220,
            scaleX: 0.45,
            scaleY: 0.45,
            duration: 2100,
            ease: 'Sine.easeIn'
        });
    }

    drawTitleCard ()
    {
        const bg = this.add.rectangle(512, 220, 1024, 440, 0x04060b);
        const glow = this.add.ellipse(512, 220, 760, 210, 0x215083, 0.45);
        const title = this.add.text(512, 210, 'RETRONISATION', {
            fontFamily: 'Arial Black',
            fontSize: 86,
            color: '#9de3ff',
            stroke: '#0b1624',
            strokeThickness: 12,
            align: 'center'
        }).setOrigin(0.5);
        const subtitle = this.add.text(512, 302, 'Aidez Fabien à sortir de la machine', {
            fontFamily: 'Arial',
            fontSize: 32,
            color: '#d8efff'
        }).setOrigin(0.5);

        this.illustrationContainer.add([bg, glow, title, subtitle]);

        this.tweens.add({
            targets: [title, subtitle],
            alpha: 0.55,
            yoyo: true,
            repeat: -1,
            duration: 620
        });
    }
}
