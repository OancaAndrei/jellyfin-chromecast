/**
 * Module that translates events from the Cast player to SyncPlay events.
 * @module components/syncPlay/players/localPlayer
 */

import { Events as events } from 'jellyfin-apiclient';
// import playbackManager from 'playbackManager';

const playbackManager = {};

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

    /**
     * Overrides PlaybackManager's unpause method.
     */
    unpauseRequest(player) {
        apiClient.requestSyncPlayUnpause();
    }

    /**
     * Overrides PlaybackManager's pause method.
     */
    pauseRequest(player) {
        apiClient.requestSyncPlayPause();
        // Pause locally as well, to give the user some little control
        this.playbackCore.localPause(player);
    }

    /**
     * Overrides PlaybackManager's seek method.
     */
    seekRequest(PositionTicks, player) {
        apiClient.requestSyncPlaySeek({
            PositionTicks: PositionTicks
        });
    }

    /**
     * Overrides PlaybackManager's play method.
     */
    playRequest(options) {
        const sendPlayRequest = (items) => {
            const queue = items.map(item => item.Id);
            apiClient.requestSyncPlayPlay({
                PlayingQueue: queue.join(','),
                PlayingItemPosition: options.startIndex ? options.startIndex : 0,
                StartPositionTicks: options.startPositionTicks ? options.startPositionTicks : 0
            });
        };

        if (options.items) {
            playbackManager.translateItemsForPlayback(options.items, options).then(sendPlayRequest);
        } else {
            if (!options.serverId) {
                throw new Error('serverId required!');
            }

            playbackManager.getItemsForPlayback(options.serverId, {
                Ids: options.ids.join(',')
            }).then(function (result) {
                playbackManager.translateItemsForPlayback(result.Items, options).then(sendPlayRequest);
            });
        }
    }

    /**
     * Overrides PlaybackManager's setCurrentPlaylistItem method.
     */
    setCurrentPlaylistItemRequest(playlistItemId, player) {
        apiClient.requestSyncPlaySetPlaylistItem({
            PlaylistItemId: playlistItemId
        });
    }

    /**
     * Overrides PlaybackManager's removeFromPlaylist method.
     */
    removeFromPlaylistRequest(playlistItemIds, player) {
        apiClient.requestSyncPlayRemoveFromPlaylist({
            PlaylistItemIds: playlistItemIds
        });
    }

    /**
     * Overrides PlaybackManager's movePlaylistItem method.
     */
    movePlaylistItemRequest(playlistItemId, newIndex, player) {
        apiClient.requestSyncPlayMovePlaylistItem({
            PlaylistItemId: playlistItemId,
            NewIndex: newIndex
        });
    }

    /**
     * Internal method used to emulate PlaybackManager's queue method.
     */
    genericQueueRequest(options, player, mode) {
        if (options.items) {
            playbackManager.translateItemsForPlayback(options.items, options).then((items) => {
                const itemIds = items.map(item => item.Id);
                apiClient.requestSyncPlayQueue({
                    ItemIds: itemIds.join(','),
                    Mode: mode
                });
            });
        } else {
            if (!options.serverId) {
                throw new Error('serverId required!');
            }

            playbackManager.getItemsForPlayback(options.serverId, {
                Ids: options.ids.join(',')
            }).then(function (result) {
                playbackManager.translateItemsForPlayback(result.Items, options).then((items) => {
                    const itemIds = items.map(item => item.Id);
                    apiClient.requestSyncPlayQueue({
                        ItemIds: itemIds.join(','),
                        Mode: mode
                    });
                });
            });
        }
    }

    /**
     * Overrides PlaybackManager's queue method.
     */
    queueRequest(options, player) {
        this.queueCore.genericQueueRequest(options, player, 'default');
    }

    /**
     * Overrides PlaybackManager's queueNext method.
     */
    queueNextRequest(options, player) {
        this.queueCore.genericQueueRequest(options, player, 'next');
    }

    /**
     * Overrides PlaybackManager's nextTrack method.
     */
    nextTrackRequest(player) {
        apiClient.requestSyncPlayNextTrack({
            PlaylistItemId: this.queueCore.playQueueManager.getCurrentPlaylistItemId()
        });
    }

    /**
     * Overrides PlaybackManager's previousTrack method.
     */
    previousTrackRequest(player) {
        apiClient.requestSyncPlayPreviousTrack({
            PlaylistItemId: this.queueCore.playQueueManager.getCurrentPlaylistItemId()
        });
    }

    /**
     * Overrides PlaybackManager's setRepeatMode method.
     */
    setRepeatModeRequest(mode, player) {
        apiClient.requestSyncPlaySetRepeatMode({
            Mode: mode
        });
    }

    /**
     * Overrides PlaybackManager's setQueueShuffleMode method.
     */
    setQueueShuffleModeRequest(mode, player) {
        apiClient.requestSyncPlaySetShuffleMode({
            Mode: mode
        });
    }

    /**
     * Overrides PlaybackManager's toggleQueueShuffleMode method.
     */
    toggleQueueShuffleModeRequest(player) {
        let mode = this.queueCore.playQueueManager.getShuffleMode();
        mode = mode === 'Sorted' ? 'Shuffle' : 'Sorted';

        apiClient.requestSyncPlaySetShuffleMode({
            Mode: mode
        });
    }
}

export default SyncPlayLocalPlayer;
