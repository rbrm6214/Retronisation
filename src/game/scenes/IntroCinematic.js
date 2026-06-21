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
        this.domOverlays = [];
        this.rightArrowWasDown = false;
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

        this.slides = [
            {
                text: 'Cette aventure commence le matin du dimanche 21 juin 2026, au marché aux puces de Mornas, petit village du Vaucluse.',
                draw: () => this.drawFleaMarketMorning()
            },
            {
                text: 'Fabien, 66 ans, collectionneur passionné de vieilles machines, chine tranquillement dans les allées de la brocante.',
                draw: () => this.drawFabienPortrait()
            },
            {
                text: 'C\'est alors qu\'il voit, au milieu de bibelots et de vaisselle, son Graal : un TI-99/4A en parfait état, en boîte, avec la cartouche Parsec et sa notice.',
                draw: () => this.drawTreasureFind()
            },
            {
                text: 'De retour chez lui, il file dans son garage-bureau-entrepôt et fait de la place pour sa dernière acquisition, bien décidé de l\'essayer.',
                draw: () => this.drawGarageRoom()
            },
            {
                text: 'Il le branche à une prise, y connecte un écran, insère la cartouche et allume la bête. Ahhh, cet écran de démarrage... que de souvenirs.',
                draw: () => this.drawPowerOn()
            },
            {
                text: 'Mais la nostalgie ne dure pas, une erreur critique surgit. Fabien est frustré et se demande s\'il ne s\'est pas fait avoir par le vendeur...',
                draw: () => this.drawCriticalError()
            },
            {
                text: 'Puis, un message parle d\'un besoin d\'aide. Fabien ne comprend pas il n\'avait encore jamais vue ça, il tapote le clavier mais pas de réactions',
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
                text: 'RETRONISATION. Aides Fabien à s\'en sortir en finissant ce jeu !',
                draw: () => this.drawTitleCard(),
                durationMs: 5600
            }
        ];

        SoundEffects.stopAmbientMusic();
        SoundEffects.startIntroMusic();

        this.registerSkipControls();
        this.events.once('shutdown', () => this.cleanupHandlers());
        this.events.once('destroy', () => this.cleanupHandlers());

        this.cameras.main.fadeIn(350, 0, 0, 0);
        this.showSlide(0);
    }

    registerSkipControls ()
    {
        this.pointerSkipHandler = () => this.skipCinematic();
        this.rightArrowKey = this.input.keyboard.addKey('RIGHT');

        this.input.on('pointerdown', this.pointerSkipHandler);
    }

    cleanupHandlers ()
    {
        SoundEffects.stopIntroMusic();

        this.destroyDomOverlays();

        if (this.slideTimer)
        {
            this.slideTimer.remove(false);
            this.slideTimer = null;
        }

        if (this.pointerSkipHandler)
        {
            this.input.off('pointerdown', this.pointerSkipHandler);
            this.pointerSkipHandler = null;
        }

        if (this.rightArrowKey)
        {
            this.input.keyboard.removeKey(this.rightArrowKey, true, true);
            this.rightArrowKey = null;
        }
    }

    advanceSlideWithRightArrow ()
    {
        if (this.isExiting)
        {
            return;
        }

        if (this.slideTimer)
        {
            this.slideTimer.remove(false);
            this.slideTimer = null;
        }

        this.nextSlide();
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

        this.destroyDomOverlays();
        this.illustrationContainer.removeAll(true);

        const slide = this.slides[index];
        slide.draw();

        this.storyText.setText(slide.text);

        const baseHold = slide.durationMs || this.slideDurationMs;
        const hold = baseHold * this.slideDurationMultiplier;
        this.slideTimer = this.time.delayedCall(hold, () => this.nextSlide());
    }

    update ()
    {
        if (this.isExiting || !this.rightArrowKey)
        {
            return;
        }

        const isDown = this.rightArrowKey.isDown;
        if (isDown && !this.rightArrowWasDown)
        {
            this.advanceSlideWithRightArrow();
        }

        this.rightArrowWasDown = isDown;
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

    registerDomOverlay (overlay)
    {
        if (!overlay)
        {
            return;
        }

        this.domOverlays.push(overlay);
    }

    destroyDomOverlay (overlay)
    {
        if (!overlay)
        {
            return;
        }

        this.domOverlays = this.domOverlays.filter((item) => item !== overlay);

        if (typeof HTMLElement !== 'undefined' && overlay instanceof HTMLElement)
        {
            if (overlay.parentNode)
            {
                overlay.parentNode.removeChild(overlay);
            }

            return;
        }

        if (overlay.active)
        {
            overlay.destroy();
        }
    }

    destroyDomOverlays ()
    {
        for (const overlay of this.domOverlays)
        {
            if (typeof HTMLElement !== 'undefined' && overlay instanceof HTMLElement)
            {
                if (overlay.parentNode)
                {
                    overlay.parentNode.removeChild(overlay);
                }

                continue;
            }

            if (overlay && overlay.active)
            {
                overlay.destroy();
            }
        }

        this.domOverlays = [];
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
        if (this.textures.exists('cinematic-fabien'))
        {
            const bg = this.add.rectangle(512, 220, 1024, 440, 0x1e2530);
            const portrait = this.add.image(512, 220, 'cinematic-fabien');
            const texture = this.textures.get('cinematic-fabien').getSourceImage();
            const maxWidth = 540;
            const maxHeight = 430;
            const scale = Math.min(maxWidth / texture.width, maxHeight / texture.height);
            portrait.setScale(scale);
            portrait.setStrokeStyle?.(2, 0x7cf0ff, 0.35);
            this.illustrationContainer.add([bg, portrait]);
            return;
        }

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

        if (this.textures.exists('cinematic-ti994a-parsec'))
        {
            const overlay = this.add.image(512, 252, 'cinematic-ti994a-parsec');
            const texture = this.textures.get('cinematic-ti994a-parsec').getSourceImage();
            const maxWidth = 520;
            const maxHeight = 320;
            const scale = Math.min(maxWidth / texture.width, maxHeight / texture.height);
            overlay.setScale(scale);
            overlay.setRotation(-0.035);
            this.illustrationContainer.add(overlay);
        }
    }

    drawGarageRoom ()
    {
        if (this.textures.exists('cinematic-bureau'))
        {
            const image = this.add.image(512, 220, 'cinematic-bureau');
            image.setDisplaySize(1024, 440);
            this.illustrationContainer.add([image]);
            return;
        }

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
        let signal = null;
        let bootImage = null;
        if (this.textures.exists('cinematic-boot-ti99'))
        {
            bootImage = this.add.image(640, 252, 'cinematic-boot-ti99');
            bootImage.setDisplaySize(238, 136);
        }
        else
        {
            signal = this.add.rectangle(640, 252, 180, 12, 0x69ffa1);
        }
        const cableA = this.add.line(0, 0, 530, 334, 600, 312, 0x262626).setLineWidth(3);
        const cableB = this.add.line(0, 0, 330, 296, 260, 360, 0x262626).setLineWidth(3);

        const sceneParts = [bg, desk, computer, monitor, screen, cableA, cableB];
        if (signal)
        {
            sceneParts.push(signal);
        }

        this.illustrationContainer.add(sceneParts);

        if (bootImage)
        {
            // Added after monitor/screen so it stays visible in front.
            this.illustrationContainer.add(bootImage);
        }
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
        const lines = this.add.text(512, 208, 'NEED HELP\nPLEASE COME ON\nNOW!!!!', {
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
        const bar = this.add.rectangle(512 - 216, 236, 8, 26, 0x7cf0ff).setOrigin(0, 0.5);
        const p1 = this.add.rectangle(760, 306, 20, 20, 0xffd37e);
        const p2 = this.add.rectangle(786, 288, 20, 20, 0xe6c39e);
        const p3 = this.add.rectangle(812, 320, 20, 20, 0x8ec5ff);

        this.illustrationContainer.add([bg, monitor, screen, label, barBg, bar, p1, p2, p3]);

        const slide = this.slides?.[7];
        const baseHold = slide?.durationMs || this.slideDurationMs;
        const fullSlideMs = baseHold * this.slideDurationMultiplier;
        const halfSlideMs = (baseHold * this.slideDurationMultiplier) / 2;

        let uploadRunning = null;
        let uploadCompleted = null;

        if (this.textures.exists('cinematic-upload-running'))
        {
            const runningTexture = this.textures.get('cinematic-upload-running').getSourceImage();
            const runningMaxWidth = 500;
            const runningMaxHeight = 192;
            const runningScale = Math.min(runningMaxWidth / runningTexture.width, runningMaxHeight / runningTexture.height);
            uploadRunning = this.add.image(236, 398, 'cinematic-upload-running').setScale(runningScale).setDepth(4);
            this.illustrationContainer.add(uploadRunning);

            this.tweens.add({
                targets: uploadRunning,
                x: uploadRunning.x + 150,
                duration: halfSlideMs,
                ease: 'Sine.easeInOut'
            });
        }

        this.tweens.add({
            targets: bar,
            width: 432,
            duration: fullSlideMs,
            ease: 'Linear'
        });

        const swapToCompleted = () => {
            if (this.currentSlide !== 7)
            {
                return;
            }

            if (uploadRunning)
            {
                uploadRunning.destroy();
                uploadRunning = null;
            }

            if (!this.textures.exists('cinematic-upload-completed') || uploadCompleted)
            {
                return;
            }

            const completedTexture = this.textures.get('cinematic-upload-completed').getSourceImage();
            const completedMaxWidth = 580;
            const completedMaxHeight = 220;
            const completedScale = Math.min(completedMaxWidth / completedTexture.width, completedMaxHeight / completedTexture.height);
            uploadCompleted = this.add.image(386, 398, 'cinematic-upload-completed').setScale(completedScale).setDepth(4);
            this.illustrationContainer.add(uploadCompleted);

            this.tweens.add({
                targets: uploadCompleted,
                x: uploadCompleted.x + 150,
                duration: halfSlideMs,
                ease: 'Sine.easeInOut'
            });
        };

        this.time.delayedCall(halfSlideMs, swapToCompleted);

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
        const monitor = this.add.rectangle(700, 220, 210, 160, 0x1f2c3a).setStrokeStyle(3, 0x6f8aa6);
        const screen = this.add.rectangle(700, 220, 186, 134, 0x0a1018);
        const beam = this.add.triangle(0, 0, 510, 175, 770, 145, 770, 295, 0x67d9ff, 0.35);
        let screenImage1 = null;
        let screenGifOverlay = null;

        if (this.textures.exists('cinematic-screen-1'))
        {
            screenImage1 = this.add.image(700, 220, 'cinematic-screen-1').setDisplaySize(182, 130);
        }

        const marker = this.add.rectangle(372, 260, 68, 68, 0xffd37e).setStrokeStyle(3, 0xfff1b5, 0.9);
        let tourneOverlay = null;

        const canUseDomGif = typeof document !== 'undefined';
        if (canUseDomGif)
        {
            const gameContainer = document.getElementById('game-container');
            const canvas = gameContainer?.querySelector('canvas');

            if (gameContainer && canvas)
            {
                if (window.getComputedStyle(gameContainer).position === 'static')
                {
                    gameContainer.style.position = 'relative';
                }

                const tourneGifImg = document.createElement('img');
                tourneGifImg.src = import.meta.env.BASE_URL + 'dist/images/Tourne.gif';
                tourneGifImg.alt = 'Tourne';
                tourneGifImg.style.width = '100%';
                tourneGifImg.style.height = '100%';
                tourneGifImg.style.objectFit = 'contain';
                tourneGifImg.style.pointerEvents = 'none';
                tourneGifImg.style.display = 'block';

                tourneOverlay = document.createElement('div');
                tourneOverlay.style.position = 'absolute';
                tourneOverlay.style.width = '60px';
                tourneOverlay.style.height = '60px';
                tourneOverlay.style.pointerEvents = 'none';
                tourneOverlay.style.zIndex = '30';
                tourneOverlay.style.transform = 'translate(-50%, -50%)';
                tourneOverlay.appendChild(tourneGifImg);
                gameContainer.appendChild(tourneOverlay);
                this.registerDomOverlay(tourneOverlay);

                tourneGifImg.onerror = () => {
                    console.warn('Impossible de charger /dist/images/Tourne.gif pour animation GIF.');
                };

                const panicGifImg = document.createElement('img');
                panicGifImg.src = import.meta.env.BASE_URL + 'dist/images/FabienPanique.gif';
                panicGifImg.alt = 'FabienPanique';
                panicGifImg.style.width = '100%';
                panicGifImg.style.height = '100%';
                panicGifImg.style.objectFit = 'cover';
                panicGifImg.style.pointerEvents = 'none';
                panicGifImg.style.display = 'block';

                screenGifOverlay = document.createElement('div');
                screenGifOverlay.style.position = 'absolute';
                screenGifOverlay.style.width = '182px';
                screenGifOverlay.style.height = '130px';
                screenGifOverlay.style.pointerEvents = 'none';
                screenGifOverlay.style.zIndex = '20';
                screenGifOverlay.style.transform = 'translate(-50%, -50%)';
                screenGifOverlay.style.display = 'none';
                screenGifOverlay.appendChild(panicGifImg);
                gameContainer.appendChild(screenGifOverlay);
                this.registerDomOverlay(screenGifOverlay);

                panicGifImg.onerror = () => {
                    console.warn('Impossible de charger /dist/images/FabienPanique.gif pour animation GIF.');
                };
            }
        }

        const updateTourneOverlayPosition = () => {
            if (!tourneOverlay)
            {
                return;
            }

            const gameContainer = document.getElementById('game-container');
            const canvas = gameContainer?.querySelector('canvas');
            if (!gameContainer || !canvas)
            {
                return;
            }

            const containerRect = gameContainer.getBoundingClientRect();
            const canvasRect = canvas.getBoundingClientRect();
            const scaleX = canvasRect.width / this.scale.width;
            const scaleY = canvasRect.height / this.scale.height;
            const left = (canvasRect.left - containerRect.left) + (marker.x * scaleX);
            const top = (canvasRect.top - containerRect.top) + (marker.y * scaleY);
            const overlaySize = Math.max(56, Math.round(60 * Math.min(scaleX, scaleY)));

            tourneOverlay.style.left = `${left}px`;
            tourneOverlay.style.top = `${top}px`;
            tourneOverlay.style.width = `${overlaySize}px`;
            tourneOverlay.style.height = `${overlaySize}px`;

            if (screenGifOverlay)
            {
                const monitorLeft = (canvasRect.left - containerRect.left) + (700 * scaleX);
                const monitorTop = (canvasRect.top - containerRect.top) + (220 * scaleY);
                const monitorWidth = Math.round(182 * scaleX);
                const monitorHeight = Math.round(130 * scaleY);

                screenGifOverlay.style.left = `${monitorLeft}px`;
                screenGifOverlay.style.top = `${monitorTop}px`;
                screenGifOverlay.style.width = `${monitorWidth}px`;
                screenGifOverlay.style.height = `${monitorHeight}px`;
            }
        };

        this.illustrationContainer.add([bg, ringA, ringB, ringC, beam, monitor, screen]);

        if (screenImage1)
        {
            this.illustrationContainer.add(screenImage1);
        }

        this.illustrationContainer.add(marker);
        updateTourneOverlayPosition();

        this.tweens.add({
            targets: [ringA, ringB, ringC],
            angle: 360,
            duration: 2400,
            repeat: -1
        });

        this.tweens.add({
            targets: marker,
            x: 700,
            y: 220,
            duration: 8200,
            ease: 'Sine.easeInOut',
            onUpdate: () => {
                updateTourneOverlayPosition();
            },
            onComplete: () => {
                marker.destroy();

                if (tourneOverlay)
                {
                    this.destroyDomOverlay(tourneOverlay);
                    tourneOverlay = null;
                }

                if (screenImage1)
                {
                    screenImage1.setVisible(false);
                }

                if (screenGifOverlay)
                {
                    screenGifOverlay.style.display = 'block';
                }
            }
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
