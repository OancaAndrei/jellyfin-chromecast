/**
 * Module that exposes SyncPlay calls to external modules.
 * @module components/syncPlay/core/controller
 */

import * as syncPlayHelper from './helper';

/**
 * Class that exposes SyncPlay calls to external modules.
 */
class SyncPlayController {
    constructor() {
        this.manager = null;
    }

    /**
     * Initializes the controller.
     * @param {SyncPlayManager} syncPlayManager The SyncPlay manager.
     */
    init(syncPlayManager) {
        this.manager = syncPlayManager;
    }

    /**
     * Toggles playback status in SyncPlay group.
     */
    playPause() {
        if (this.manager.isPlaying()) {
            this.pause();
        } else {
            this.unpause();
        }
    }

    /**
     * Unpauses playback in SyncPlay group.
     */
    unpause() {
        if (!this.manager.hasPlaybackAccess()) {
            syncPlayHelper.showMessage(this.manager, 'MessageSyncPlayMissingPlaybackAccess');
            return;
        }

        const apiClient = this.manager.getApiClient();
        apiClient.requestSyncPlayUnpause();
    }

    /**
     * Pauses playback in SyncPlay group.
     */
    pause() {
        if (!this.manager.hasPlaybackAccess()) {
            syncPlayHelper.showMessage(this.manager, 'MessageSyncPlayMissingPlaybackAccess');
            return;
        }

        const apiClient = this.manager.getApiClient();
        apiClient.requestSyncPlayPause();

        // Pause locally as well, to give the user some little control
        const playerWrapper = this.manager.getPlayerWrapper();
        playerWrapper.localPause();
    }

    /**
     * Seeks playback to specified position in SyncPlay group.
     * @param {number} positionTicks The position.
     */
    seek(positionTicks) {
        if (!this.manager.hasPlaybackAccess()) {
            syncPlayHelper.showMessage(this.manager, 'MessageSyncPlayMissingPlaybackAccess');
            return;
        }

        const apiClient = this.manager.getApiClient();
        apiClient.requestSyncPlaySeek({
            PositionTicks: positionTicks
        });
    }

    /**
     * Starts playback in SyncPlay group.
     * @param {Object} options The play data.
     */
    play(options) {
        if (!this.manager.hasPlaylistAccess()) {
            syncPlayHelper.showMessage(this.manager, 'MessageSyncPlayMissingPlaylistAccess');
            return;
        }

        const apiClient = this.manager.getApiClient();
        const sendPlayRequest = (items) => {
            const queue = items.map(item => item.Id);
            apiClient.requestSyncPlayPlay({
                PlayingQueue: queue.join(','),
                PlayingItemPosition: options.startIndex ? options.startIndex : 0,
                StartPositionTicks: options.startPositionTicks ? options.startPositionTicks : 0
            });
        };

        if (options.items) {
            syncPlayHelper.translateItemsForPlayback(apiClient, options.items, options).then(sendPlayRequest);
        } else {
            syncPlayHelper.getItemsForPlayback(apiClient, {
                Ids: options.ids.join(',')
            }).then(function (result) {
                syncPlayHelper.translateItemsForPlayback(apiClient, result.Items, options).then(sendPlayRequest);
            });
        }
    }

    /**
     * Sets current playing item in SyncPlay group.
     * @param {string} playlistItemId The item playlist identifier.
     */
    setCurrentPlaylistItem(playlistItemId) {
        if (!this.manager.hasPlaybackAccess()) {
            syncPlayHelper.showMessage(this.manager, 'MessageSyncPlayMissingPlaybackAccess');
            return;
        }

        const apiClient = this.manager.getApiClient();
        apiClient.requestSyncPlaySetPlaylistItem({
            PlaylistItemId: playlistItemId
        });
    }

    /**
     * Removes items from SyncPlay group playlist.
     * @param {Array} playlistItemIds The items to remove.
     */
    removeFromPlaylist(playlistItemIds) {
        if (!this.manager.hasPlaylistAccess()) {
            syncPlayHelper.showMessage(this.manager, 'MessageSyncPlayMissingPlaylistAccess');
            return;
        }

        const apiClient = this.manager.getApiClient();
        apiClient.requestSyncPlayRemoveFromPlaylist({
            PlaylistItemIds: playlistItemIds
        });
    }

    /**
     * Moves an item in the SyncPlay group playlist.
     * @param {string} playlistItemId The item playlist identifier.
     * @param {number} newIndex The new position.
     */
    movePlaylistItem(playlistItemId, newIndex) {
        if (!this.manager.hasPlaylistAccess()) {
            syncPlayHelper.showMessage(this.manager, 'MessageSyncPlayMissingPlaylistAccess');
            return;
        }

        const apiClient = this.manager.getApiClient();
        apiClient.requestSyncPlayMovePlaylistItem({
            PlaylistItemId: playlistItemId,
            NewIndex: newIndex
        });
    }

    /**
     * Adds items to the SyncPlay group playlist.
     * @param {Object} options The items to add.
     * @param {string} mode The queue mode, optional.
     */
    queue(options, mode = 'default') {
        if (!this.manager.hasPlaylistAccess()) {
            syncPlayHelper.showMessage(this.manager, 'MessageSyncPlayMissingPlaylistAccess');
            return;
        }

        const apiClient = this.manager.getApiClient();
        if (options.items) {
            syncPlayHelper.translateItemsForPlayback(apiClient, options.items, options).then((items) => {
                const itemIds = items.map(item => item.Id);
                apiClient.requestSyncPlayQueue({
                    ItemIds: itemIds.join(','),
                    Mode: mode
                });
            });
        } else {
            syncPlayHelper.getItemsForPlayback(apiClient, {
                Ids: options.ids.join(',')
            }).then(function (result) {
                syncPlayHelper.translateItemsForPlayback(apiClient, result.Items, options).then((items) => {
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
     * Adds items to the SyncPlay group playlist after the playing item.
     * @param {Object} options The items to add.
     */
    queueNext(options) {
        this.queue(options, 'next');
    }

    /**
     * Plays next track from playlist in SyncPlay group.
     */
    nextTrack() {
        if (!this.manager.hasPlaybackAccess()) {
            syncPlayHelper.showMessage(this.manager, 'MessageSyncPlayMissingPlaybackAccess');
            return;
        }

        const apiClient = this.manager.getApiClient();
        apiClient.requestSyncPlayNextTrack({
            PlaylistItemId: this.manager.getQueueCore().getCurrentPlaylistItemId()
        });
    }

    /**
     * Plays previous track from playlist in SyncPlay group.
     */
    previousTrack() {
        if (!this.manager.hasPlaybackAccess()) {
            syncPlayHelper.showMessage(this.manager, 'MessageSyncPlayMissingPlaybackAccess');
            return;
        }

        const apiClient = this.manager.getApiClient();
        apiClient.requestSyncPlayPreviousTrack({
            PlaylistItemId: this.manager.getQueueCore().getCurrentPlaylistItemId()
        });
    }

    /**
     * Sets the repeat mode in SyncPlay group.
     * @param {string} mode The repeat mode.
     */
    setRepeatMode(mode) {
        if (!this.manager.hasPlaylistAccess()) {
            syncPlayHelper.showMessage(this.manager, 'MessageSyncPlayMissingPlaylistAccess');
            return;
        }

        const apiClient = this.manager.getApiClient();
        apiClient.requestSyncPlaySetRepeatMode({
            Mode: mode
        });
    }

    /**
     * Sets the shuffle mode in SyncPlay group.
     * @param {string} mode The shuffle mode.
     */
    setShuffleMode(mode) {
        if (!this.manager.hasPlaylistAccess()) {
            syncPlayHelper.showMessage(this.manager, 'MessageSyncPlayMissingPlaylistAccess');
            return;
        }

        const apiClient = this.manager.getApiClient();
        apiClient.requestSyncPlaySetShuffleMode({
            Mode: mode
        });
    }

    /**
     * Toggles the shuffle mode in SyncPlay group.
     */
    toggleShuffleMode() {
        if (!this.manager.hasPlaylistAccess()) {
            syncPlayHelper.showMessage(this.manager, 'MessageSyncPlayMissingPlaylistAccess');
            return;
        }

        let mode = this.manager.getQueueCore().getShuffleMode();
        mode = mode === 'Sorted' ? 'Shuffle' : 'Sorted';

        const apiClient = this.manager.getApiClient();
        apiClient.requestSyncPlaySetShuffleMode({
            Mode: mode
        });
    }
}

export default SyncPlayController;