import { useRef } from 'react';
import { PhaserGame } from './PhaserGame';

function App ()
{
    const phaserRef = useRef();

    return (
        <div id="app">
            <main className="game-only-shell">
                <section className="game-frame">
                    <PhaserGame ref={phaserRef} />
                </section>
            </main>
        </div>
    )
}

export default App
