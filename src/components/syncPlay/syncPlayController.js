/**
 * Module that exposes SyncPlay calls to external modules.
 * @module components/syncPlay/syncPlayController
 */

import playbackManager from 'playbackManager'; // TODO: remove this dependency.

class SyncPlayController {
    constructor(syncPlayManager) {
        this.manager = syncPlayManager;
    }

    playPause() {
        if (this.manager.isPlaying()) {
            this.pause();
        } else {
            this.unpause();
        }
    }

    unpause() {
        if (!this.manager.hasPlaybackAccess()) {
            // TODO: show message.
            return;
        }

        apiClient.requestSyncPlayUnpause();
    }

    pause() {
        if (!this.manager.hasPlaybackAccess()) {
            // TODO: show message.
            return;
        }

        apiClient.requestSyncPlayPause();

        // Pause locally as well, to give the user some little control
        const playerWrapper = this.manager.getPlayerWrapper();
        playerWrapper.localPause();
    }

    seek(positionTicks) {
        if (!this.manager.hasPlaybackAccess()) {
            // TODO: show message.
            return;
        }

        apiClient.requestSyncPlaySeek({
            PositionTicks: positionTicks
        });
    }

    sendCommandRequest(cmd) {
        // TODO: ?
        console.debug('SyncPlay sendCommandRequest:', cmd.Name, cmd);

        const defaultAction = (cmd, player) => {
            this.manager.getPlaybackCore().localSendCommand(cmd, player);
        };

        const ignoreCallback = (cmd, player) => {
            // Do nothing
        };

        const SetRepeatModeCallback = (cmd, player) => {
            this.manager.getQueueCore().setRepeatModeRequest(cmd.Arguments.RepeatMode, player);
        };

        const SetShuffleQueueCallback = (cmd, player) => {
            this.manager.getQueueCore().setQueueShuffleModeRequest(cmd.Arguments.ShuffleMode, player);
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

    play(options) {
        if (!this.manager.hasPlaylistAccess()) {
            // TODO: show message.
            return;
        }

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

    setCurrentPlaylistItem(playlistItemId) {
        if (!this.manager.hasPlaybackAccess()) {
            // TODO: show message.
            return;
        }

        apiClient.requestSyncPlaySetPlaylistItem({
            PlaylistItemId: playlistItemId
        });
    }

    removeFromPlaylist(playlistItemIds) {
        if (!this.manager.hasPlaylistAccess()) {
            // TODO: show message.
            return;
        }

        apiClient.requestSyncPlayRemoveFromPlaylist({
            PlaylistItemIds: playlistItemIds
        });
    }

    movePlaylistItem(playlistItemId, newIndex) {
        if (!this.manager.hasPlaylistAccess()) {
            // TODO: show message.
            return;
        }

        apiClient.requestSyncPlayMovePlaylistItem({
            PlaylistItemId: playlistItemId,
            NewIndex: newIndex
        });
    }

    genericQueue(options, mode) {
        if (!this.manager.hasPlaylistAccess()) {
            // TODO: show message.
            return;
        }

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

    queue(options) {
        this.genericQueue(options, 'default');
    }

    queueNext(options) {
        this.genericQueue(options, 'next');
    }

    nextTrack() {
        if (!this.manager.hasPlaybackAccess()) {
            // TODO: show message.
            return;
        }

        apiClient.requestSyncPlayNextTrack({
            PlaylistItemId: this.manager.getQueueCore().playQueueManager.getCurrentPlaylistItemId()
        });
    }

    previousTrack() {
        if (!this.manager.hasPlaybackAccess()) {
            // TODO: show message.
            return;
        }

        apiClient.requestSyncPlayPreviousTrack({
            PlaylistItemId: this.manager.getQueueCore().playQueueManager.getCurrentPlaylistItemId()
        });
    }

    setRepeatMode(mode) {
        if (!this.manager.hasPlaylistAccess()) {
            // TODO: show message.
            return;
        }

        apiClient.requestSyncPlaySetRepeatMode({
            Mode: mode
        });
    }

    setQueueShuffleMode(mode) {
        if (!this.manager.hasPlaylistAccess()) {
            // TODO: show message.
            return;
        }

        apiClient.requestSyncPlaySetShuffleMode({
            Mode: mode
        });
    }

    toggleQueueShuffleMode() {
        if (!this.manager.hasPlaylistAccess()) {
            // TODO: show message.
            return;
        }

        let mode = this.manager.getQueueCore().playQueueManager.getShuffleMode();
        mode = mode === 'Sorted' ? 'Shuffle' : 'Sorted';

        apiClient.requestSyncPlaySetShuffleMode({
            Mode: mode
        });
    }
}

export default SyncPlayController;
