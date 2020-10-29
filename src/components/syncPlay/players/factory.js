/**
 * Module that creates wrappers for known players.
 * @module components/syncPlay/players/factory
 */

import SyncPlayGenericPlayer from 'syncPlayGenericPlayer';
import SyncPlayHtmlVideoPlayer from 'syncPlayHtmlVideoPlayer';
import SyncPlayHtmlAudioPlayer from 'syncPlayHtmlAudioPlayer';
import SyncPlayRemotePlayer from 'syncPlayRemotePlayer';
import SyncPlayChromecastPlayer from 'syncPlayChromecastPlayer';

/**
 * Class that creates wrappers for known players.
 */
class SyncPlayPlayerFactory {
    constructor() {
        this.wrappers = {};
        this.registerWrapper(SyncPlayHtmlVideoPlayer);
        this.registerWrapper(SyncPlayHtmlAudioPlayer);
        this.registerWrapper(SyncPlayRemotePlayer);
        this.registerWrapper(SyncPlayChromecastPlayer);
    }

    /**
     * Registers a wrapper to the list of players that can be managed.
     * @param {SyncPlayGenericPlayer} wrapperClass The wrapper to register.
     */
    registerWrapper(wrapperClass) {
        console.debug('SyncPlay WrapperFactory registerWrapper:', wrapperClass.type);
        this.wrappers[wrapperClass.type] = wrapperClass;
    }

    /**
     * Gets a player wrapper that manages the given player.
     * @param {Object} player The player to handle.
     * @param {SyncPlayManager} syncPlayManager The SyncPlay manager.
     * @returns The wrapper that handles the given player, if the latest is of known type, null otherwise.
     */
    getWrapper(player, syncPlayManager) {
        console.debug('SyncPlay WrapperFactory getWrapper:', player.id);
        const Wrapper = this.wrappers[player.id];
        if (Wrapper) {
            return new Wrapper(player, syncPlayManager);
        }

        return null;
    }

    /**
     * Gets a generic player wrapper.
     * @param {SyncPlayManager} syncPlayManager The SyncPlay manager.
     * @returns The generic player wrapper.
     */
    getGenericWrapper(syncPlayManager) {
        return new SyncPlayGenericPlayer(null, syncPlayManager);
    }
}

/** SyncPlayPlayerFactory singleton. */
const playerFactory = new SyncPlayPlayerFactory();
export default playerFactory;
