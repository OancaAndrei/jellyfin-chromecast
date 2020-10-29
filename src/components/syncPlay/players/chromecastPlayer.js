/**
 * Module that manages the ChromecastPlayer for SyncPlay.
 * @module components/syncPlay/players/chromecastPlayer
 */

import SyncPlayRemotePlayer from 'syncPlayRemotePlayer';

/**
 * Class that manages the ChromecastPlayer for SyncPlay.
 */
class SyncPlayChromecastPlayer extends SyncPlayRemotePlayer {
    static type = 'chromecast';

    constructor(player, syncPlayManager) {
        super(player, syncPlayManager);
    }

    getRemoteSessionId() {
        return this.player.sessionInfo.Id;
    }
}

export default SyncPlayChromecastPlayer;
