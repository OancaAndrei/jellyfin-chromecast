/**
 * Module that translates events from the Cast player to SyncPlay events.
 * @module components/syncPlay/players/localPlayer
 */

import { Events as events } from 'jellyfin-apiclient';

/**
 * Class that translates events from the Cast player to SyncPlay events.
 */
class SyncPlayLocalPlayer {
    constructor(player, syncPlayManager) {
        this.player = player;
        this.syncPlayManager = syncPlayManager;
        this.playbackCore = syncPlayManager.playbackCore;
        this.queueCore = syncPlayManager.queueCore;
        this.bound = false;
        this.isPlayerActive = false;
    }

    /**
     * Binds to the player's events.
     */
    bindToPlayer() {
        if (this.bound) {
            return;
        }

        this.localBindToPlayer();
        this.bound = true;
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
     * Removes the bindings from the player's events.
     */
    unbindFromPlayer() {
        if (!this.bound) {
            return;
        }

        this.localUnbindFromPlayer();
        this.bound = false;
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
     * Called when playback starts.
     */
    onPlaybackStart(player, state) {
        this.playbackCore.onPlaybackStart(player, state);
        events.trigger(this, 'playbackstart', [player, state]);
    }

    /**
     * Called when playback stops.
     */
    onPlaybackStop(stopInfo) {
        this.playbackCore.onPlaybackStop(stopInfo);
        events.trigger(this, 'playbackstop', [stopInfo]);
    }

    /**
     * Called when playback unpauses.
     */
    onUnpause() {
        this.playbackCore.onUnpause();
        events.trigger(this, 'unpause', [this.currentPlayer]);
    }

    /**
     * Called when playback pauses.
     */
    onPause() {
        this.playbackCore.onPause();
        events.trigger(this, 'pause', [this.currentPlayer]);
    }

    /**
     * Called on playback progress.
     * @param {Object} event The time update event.
     */
    onTimeUpdate(event) {
        this.playbackCore.onTimeUpdate(event);
        events.trigger(this, 'timeupdate', [event]);
    }

    /**
     * Called when playback is resumed.
     */
    onPlaying() {
        this.playbackCore.onPlaying();
        events.trigger(this, 'playing');
    }

    /**
     * Called when playback is buffering.
     */
    onWaiting(event) {
        this.playbackCore.onWaiting(event);
        events.trigger(this, 'waiting', [event]);
    }

    /**
     * Gets playback status.
     * @returns {boolean} Whether the player has some media loaded.
     */
    isPlaybackActive() {
        return this.isPlayerActive;
    }

    /**
     * Whether the player is remotely self-managed.
     * @returns {boolean} _true_ if the player is remotely self-managed, _false_ otherwise.
     */
    isRemote() {
        return false;
    }

    localUnpause() {

    }

    localPause() {

    }

    localSeek(positionTicks) {

    }

    localStop() {

    }

    localSendCommand(cmd) {

    }

    localPlay(options) {

    }

    localSetCurrentPlaylistItem(playlistItemId) {

    }

    localRemoveFromPlaylist(playlistItemIds) {

    }

    localMovePlaylistItem(playlistItemId, newIndex) {

    }

    localQueue(options) {

    }

    localQueueNext(options) {

    }

    localNextTrack() {

    }

    localPreviousTrack() {

    }

    localSetRepeatMode(value) {

    }

    localSetQueueShuffleMode(value) {

    }

    localToggleQueueShuffleMode() {

    }
}

export default SyncPlayLocalPlayer;
