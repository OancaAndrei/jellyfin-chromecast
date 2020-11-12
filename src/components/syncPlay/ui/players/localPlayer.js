/**
 * Module that translates events from the Cast player to SyncPlay events.
 * @module components/syncPlay/players/localPlayer
 */

import syncPlay from 'syncPlay';
import { playbackManager } from './../../../playbackManager';
import {
    tagItems
} from "./../../../../helpers";

/**
 * Class that translates events from the Cast player to SyncPlay events.
 */
class SyncPlayLocalPlayer extends syncPlay.Players.GenericPlayer {
    constructor(player, syncPlayManager) {
        super(player, syncPlayManager);
        this.isPlayerActive = false;
    }

    /**
     * Binds to the player's events. Overriden.
     */
    localBindToPlayer() {
        this.playbackMgr = new playbackManager(window.castReceiverContext, window.mediaManager);
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
            const currentTime = new Date();
            const currentPosition = window.mediaManager.getCurrentTimeSec() * 1000.0;
            self.onTimeUpdate(e, {
                currentTime: currentTime,
                currentPosition: currentPosition
            });
        };

        // this._onPlaying = (e) => {
        //     self.onPlaying();
        // };

        // this._onWaiting = (e) => {
        //     self.onWaiting(e);
        // };

        this._onBuffering = (e) => {
            if (e.isBuffering) {
                self.onBuffering();
            } else {
                self.onReady();
            }
        };

        window.mediaManager.addEventListener(cast.framework.events.EventType.LOADED_DATA, this._onPlaybackStart);
        window.mediaManager.addEventListener(cast.framework.events.EventType.ENDED, this._onPlaybackStop);
        window.mediaManager.addEventListener(cast.framework.events.EventType.PLAY, this._onUnpause);
        window.mediaManager.addEventListener(cast.framework.events.EventType.PAUSE, this._onPause);
        window.mediaManager.addEventListener(cast.framework.events.EventType.TIME_UPDATE, this._onTimeUpdate);
        window.mediaManager.addEventListener(cast.framework.events.EventType.BUFFERING, this._onBuffering);
        // window.mediaManager.addEventListener(cast.framework.events.EventType.CAN_PLAY, this._onPlaying);
        // window.mediaManager.addEventListener(cast.framework.events.EventType.PLAYING, this._onPlaying);
        // window.mediaManager.addEventListener(cast.framework.events.EventType.SEEKED, this._onPlaying);
        // window.mediaManager.addEventListener(cast.framework.events.EventType.WAITING, this._onWaiting);
        // window.mediaManager.addEventListener(cast.framework.events.EventType.SEEKING, this._onWaiting);
    }

    /**
     * Removes the bindings from the player's events. Overriden.
     */
    localUnbindFromPlayer() {
        window.mediaManager.removeEventListener(cast.framework.events.EventType.LOADED_DATA, this._onPlaybackStart);
        window.mediaManager.removeEventListener(cast.framework.events.EventType.ENDED, this._onPlaybackStop);
        window.mediaManager.removeEventListener(cast.framework.events.EventType.PLAY, this._onUnpause);
        window.mediaManager.removeEventListener(cast.framework.events.EventType.PAUSE, this._onPause);
        window.mediaManager.removeEventListener(cast.framework.events.EventType.TIME_UPDATE, this._onTimeUpdate);
        window.mediaManager.removeEventListener(cast.framework.events.EventType.BUFFERING, this._onBuffering);
        // window.mediaManager.removeEventListener(cast.framework.events.EventType.CAN_PLAY, this._onPlaying);
        // window.mediaManager.removeEventListener(cast.framework.events.EventType.WAITING, this._onWaiting);
    }

    /**
     * Gets player status.
     * @returns {boolean} Whether the player has some media loaded.
     */
    isPlaybackActive() {
        return this.isPlayerActive;
    }

    /**
     * Gets playback status.
     * @returns {boolean} Whether the playback is unpaused.
     */
    isPlaying() {
        return window.mediaManager.getPlayerState() !== cast.framework.messages.PlayerState.PAUSED
    }

    /**
     * Gets playback position.
     * @returns {number} The player position, in milliseconds.
     */
    currentTime() {
        return window.mediaManager.getCurrentTimeSec() * 1000.0;
    }

    /**
     * Unpauses the player.
     */
    localUnpause() {
        window.mediaManager.play();
        return Promise.resolve();
    }

    /**
     * Pauses the player.
     */
    localPause() {
        window.mediaManager.pause();
        return Promise.resolve();
    }

    /**
     * Seeks the player to the specified position.
     * @param {number} positionTicks The new position.
     */
    localSeek(positionTicks) {
        // TODO: should this be handled server side as well?
        if (window.mediaManager.getMediaInformation().customData.canClientSeek) {
            window.mediaManager.seek(positionTicks / 10000000);
            return Promise.resolve();
        } else {
            return Promise.reject();
        }
    }

    /**
     * Stops the player.
     */
    localStop() {
        window.mediaManager.stop();
        return Promise.resolve();
    }

    /**
     * Sends a command to the player.
     * @param {Object} command The command.
     */
    localSendCommand(command) {
        return Promise.resolve();
    }

    /**
     * Starts playback.
     * @param {Object} options Playback data.
     */
    localPlay(items, startPositionTicks, startIndex, serverId) {
        const options = {
            items: items,
            startPositionTicks: startPositionTicks,
            startIndex: startIndex,
            serverId: serverId
        };

        tagItems(options.items, {
            userId: window.apiClient.getCurrentUserId(),
            accessToken: window.apiClient.accessToken(),
            serverAddress: window.apiClient.serverAddress()
        });

        this.playbackMgr.playFromOptions(options);
    }

    /**
     * Sets playing item from playlist.
     * @param {string} playlistItemId The item to play.
     */
    localSetCurrentPlaylistItem(playlistItemId, item) {
        console.log('SyncPlay localPlayer:localSetCurrentPlaylistItem:', playlistItemId, item);

        const options = {
            items: [item],
            startPositionTicks: 0,
            startIndex: 0,
            // serverId: serverId
        };

        tagItems(options.items, {
            userId: window.apiClient.getCurrentUserId(),
            accessToken: window.apiClient.accessToken(),
            serverAddress: window.apiClient.serverAddress()
        });

        this.playbackMgr.playFromOptions(options);
        return Promise.resolve();
    }

    /**
     * Removes items from playlist.
     * @param {Array} playlistItemIds The items to remove.
     */
    localRemoveFromPlaylist(playlistItemIds) {
        return Promise.resolve();
    }

    /**
     * Moves an item in the playlist.
     * @param {string} playlistItemId The item to move.
     * @param {number} newIndex The new position.
     */
    localMovePlaylistItem(playlistItemId, newIndex) {
        return Promise.resolve();
    }

    /**
     * Queues in the playlist.
     * @param {Object} options Queue data.
     */
    localQueue(options) {
        return Promise.resolve();
    }

    /**
     * Queues after the playing item in the playlist.
     * @param {Object} options Queue data.
     */
    localQueueNext(options) {
        return Promise.resolve();
    }

    /**
     * Picks next item in playlist.
     */
    localNextTrack() {
        return Promise.resolve();
    }

    /**
     * Picks previous item in playlist.
     */
    localPreviousTrack() {
        return Promise.resolve();
    }

    /**
     * Sets repeat mode.
     * @param {string} value The repeat mode.
     */
    localSetRepeatMode(value) {
        window.repeatMode = value;
        window.reportEventType = 'repeatmodechange';
        return Promise.resolve();
    }

    /**
     * Sets shuffle mode.
     * @param {string} value The shuffle mode.
     */
    localSetQueueShuffleMode(value) {
        return Promise.resolve();
    }

    /**
     * Toggles shuffle mode.
     */
    localToggleQueueShuffleMode() {
        return Promise.resolve();
    }
}

export default SyncPlayLocalPlayer;
