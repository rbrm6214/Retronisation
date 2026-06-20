import { Boot } from './scenes/Boot';
import { Game } from './scenes/Game';
import { GameOver } from './scenes/GameOver';
import { IntroCinematic } from './scenes/IntroCinematic';
import { MainMenu } from './scenes/MainMenu';
import { MiniGamesMenu } from './scenes/MiniGamesMenu';
import * as Phaser from 'phaser';
import { Preloader } from './scenes/Preloader';
import { Victory } from './scenes/Victory';

// Find out more information about the Game Config at:
// https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig
const config = {
    type: Phaser.AUTO,
    width: 1024,
    height: 768,
    parent: 'game-container',
    backgroundColor: '#028af8',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: [
        Boot,
        Preloader,
        IntroCinematic,
        MainMenu,
        MiniGamesMenu,
        Game,
        GameOver,
        Victory
    ]
};

const StartGame = (parent) => {

    return new Phaser.Game({ ...config, parent });

}

export default StartGame;
