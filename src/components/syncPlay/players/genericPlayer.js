/**
 * Module that translates events from a player to SyncPlay events.
 * @module components/syncPlay/players/genericPlayer
 */

import events from 'events';
import playbackManager from 'playbackManager';

/**
 * Class that translates events from a player to SyncPlay events.
 */
class SyncPlayGenericPlayer {
    static type = 'generic';

    constructor(player, syncPlayManager) {
        this.player = player;
        this.syncPlayManager = syncPlayManager;
        this.playbackCore = syncPlayManager.playbackCore;
        this.queueCore = syncPlayManager.queueCore;
        this.bound = false;
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
     * Binds to the player's events. Overriden.
     */
    localBindToPlayer() {
        throw new Error('Override this method!');
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
     * Removes the bindings from the player's events. Overriden.
     */
    localUnbindFromPlayer() {
        throw new Error('Override this method!');
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
        return false;
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
        const apiClient = window.connectionManager.currentApiClient();
        apiClient.requestSyncPlayUnpause();
    }

    /**
     * Overrides PlaybackManager's pause method.
     */
    pauseRequest(player) {
        const apiClient = window.connectionManager.currentApiClient();
        apiClient.requestSyncPlayPause();
        // Pause locally as well, to give the user some little control
        this.playbackCore.localPause(player);
    }

    /**
     * Overrides PlaybackManager's seek method.
     */
    seekRequest(PositionTicks, player) {
        const apiClient = window.connectionManager.currentApiClient();
        apiClient.requestSyncPlaySeek({
            PositionTicks: PositionTicks
        });
    }

    /**
     * Overrides PlaybackManager's sendCommand method.
     */
    sendCommandRequest(cmd, player) {
        const defaultAction = (cmd, player) => {
            this.playbackCore.localSendCommand(cmd, player);
        };

        const ignoreCallback = (cmd, player) => {
            // Do nothing
        };

        const SetRepeatModeCallback = (cmd, player) => {
            this.queueCore.setRepeatModeRequest(cmd.Arguments.RepeatMode, player);
        };

        const SetShuffleQueueCallback = (cmd, player) => {
            this.queueCore.setQueueShuffleModeRequest(cmd.Arguments.ShuffleMode, player);
        };

        // Commands override
        const overrideCommands = {
            PlaybackRate: ignoreCallback,
            SetRepeatMode: SetRepeatModeCallback,
            SetShuffleQueue: SetShuffleQueueCallback
        };

        const commandHandler = overrideCommands[cmd.Name];
        if (typeof commandHandler === "function") {
            commandHandler(cmd, player);
        } else {
            defaultAction(cmd, player);
        }
    }

    /**
     * Overrides PlaybackManager's play method.
     */
    playRequest(options) {
        const apiClient = window.connectionManager.currentApiClient();
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
        const apiClient = window.connectionManager.currentApiClient();
        apiClient.requestSyncPlaySetPlaylistItem({
            PlaylistItemId: playlistItemId
        });
    }

    /**
     * Overrides PlaybackManager's removeFromPlaylist method.
     */
    removeFromPlaylistRequest(playlistItemIds, player) {
        const apiClient = window.connectionManager.currentApiClient();
        apiClient.requestSyncPlayRemoveFromPlaylist({
            PlaylistItemIds: playlistItemIds
        });
    }

    /**
     * Overrides PlaybackManager's movePlaylistItem method.
     */
    movePlaylistItemRequest(playlistItemId, newIndex, player) {
        const apiClient = window.connectionManager.currentApiClient();
        apiClient.requestSyncPlayMovePlaylistItem({
            PlaylistItemId: playlistItemId,
            NewIndex: newIndex
        });
    }

    /**
     * Internal method used to emulate PlaybackManager's queue method.
     */
    genericQueueRequest(options, player, mode) {
        const apiClient = window.connectionManager.currentApiClient();
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
        const apiClient = window.connectionManager.currentApiClient();
        apiClient.requestSyncPlayNextTrack({
            PlaylistItemId: this.queueCore.playQueueManager.getCurrentPlaylistItemId()
        });
    }

    /**
     * Overrides PlaybackManager's previousTrack method.
     */
    previousTrackRequest(player) {
        const apiClient = window.connectionManager.currentApiClient();
        apiClient.requestSyncPlayPreviousTrack({
            PlaylistItemId: this.queueCore.playQueueManager.getCurrentPlaylistItemId()
        });
    }

    /**
     * Overrides PlaybackManager's setRepeatMode method.
     */
    setRepeatModeRequest(mode, player) {
        const apiClient = window.connectionManager.currentApiClient();
        apiClient.requestSyncPlaySetRepeatMode({
            Mode: mode
        });
    }

    /**
     * Overrides PlaybackManager's setQueueShuffleMode method.
     */
    setQueueShuffleModeRequest(mode, player) {
        const apiClient = window.connectionManager.currentApiClient();
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

        const apiClient = window.connectionManager.currentApiClient();
        apiClient.requestSyncPlaySetShuffleMode({
            Mode: mode
        });
    }
}

export default SyncPlayGenericPlayer;
