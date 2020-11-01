/**
 * Module that creates wrappers for known players.
 * @module components/syncPlay/players/factory
 */

import SyncPlayLocalPlayer from './localPlayer';

/**
 * Class that creates wrappers for known players.
 */
class SyncPlayPlayerFactory {
    constructor() {
        // Do nothing.
    }

    /**
     * Gets a generic player wrapper.
     * @param {SyncPlayManager} syncPlayManager The SyncPlay manager.
     * @returns The generic player wrapper.
     */
    getGenericWrapper(syncPlayManager) {
        return new SyncPlayLocalPlayer(null, syncPlayManager);
    }
}

/** SyncPlayPlayerFactory singleton. */
const playerFactory = new SyncPlayPlayerFactory();
export default playerFactory;
