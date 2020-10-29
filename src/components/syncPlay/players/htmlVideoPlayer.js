/**
 * Module that manages the HtmlVideoPlayer for SyncPlay.
 * @module components/syncPlay/players/htmlVideoPlayer
 */

import events from 'events';
import SyncPlayGenericPlayer from 'syncPlayGenericPlayer';

/**
 * Class that manages the HtmlVideoPlayer for SyncPlay.
 */
class SyncPlayHtmlVideoPlayer extends SyncPlayGenericPlayer {
    static type = 'htmlvideoplayer';

    constructor(player, syncPlayManager) {
        super(player, syncPlayManager);
        this.isPlayerActive = false;
    }

    /**
     * Binds to the player's events. Overrides parent method.
     * @param {Object} player The player.
     */
    localBindToPlayer() {
        // FIXME: the following are needed because the 'events' module
        // is changing the scope when executing the callbacks.
        // For instance, calling 'onPlayerUnpause' from the wrong scope breaks things because 'this'
        // points to 'player' (the event emitter) instead of pointing to the SyncPlayManager singleton.
        const self = this;

        this._onPlaybackStart = (player, state) => {
            self.isPlayerActive = true;
            self.onPlaybackStart(player, state);
        };

        this._onPlaybackStop = (stopInfo) => {
            self.isPlayerActive = false;
            self.onPlaybackStop(stopInfo);
        };

        this._onUnpause = () => {
            self.onUnpause();
        };

        this._onPause = () => {
            self.onPause();
        };

        this._onTimeUpdate = (e) => {
            self.onTimeUpdate(e);
        };

        this._onPlaying = () => {
            self.onPlaying();
        };

        this._onWaiting = (e) => {
            self.onWaiting(e);
        };

        events.on(this.player, 'playbackstart', this._onPlaybackStart);
        events.on(this.player, 'playbackstop', this._onPlaybackStop);
        events.on(this.player, 'unpause', this._onUnpause);
        events.on(this.player, 'pause', this._onPause);
        events.on(this.player, 'timeupdate', this._onTimeUpdate);
        events.on(this.player, 'playing', this._onPlaying);
        events.on(this.player, 'waiting', this._onWaiting);
    }

    /**
     * Removes the bindings from the player's events. Overrides parent method.
     */
    localUnbindFromPlayer() {
        events.off(this.player, 'playbackstart', this._onPlaybackStart);
        events.off(this.player, 'playbackstop', this._onPlaybackStop);
        events.off(this.player, 'unpause', this._onPlayerUnpause);
        events.off(this.player, 'pause', this._onPlayerPause);
        events.off(this.player, 'timeupdate', this._onTimeUpdate);
        events.off(this.player, 'playing', this._onPlaying);
        events.off(this.player, 'waiting', this._onWaiting);
    }

    /**
     * Gets playback status.
     * @returns {boolean} Whether the player has some media loaded.
     */
    isPlaybackActive() {
        return this.isPlayerActive;
    }
}

export default SyncPlayHtmlVideoPlayer;
