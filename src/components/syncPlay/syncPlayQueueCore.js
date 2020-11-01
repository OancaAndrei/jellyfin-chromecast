/**
 * Module that manages the queue of SyncPlay.
 * @module components/syncPlay/syncPlayQueueCore
 */

import { Events as events } from 'jellyfin-apiclient';
import * as syncPlayHelper from './syncPlayHelper';
import syncPlaySettings from './settings/settings';
import SyncPlayQueueManager from './syncPlayQueueManager';

const playbackManager = {
    currentTime: () => {
        return 0;
    },
    getPlayerState: () => {
        return {
            PlayState: {
                IsPaused: true
            }
        }
    }
};

var syncPlayManager;

/**
 * Class that manages the queue of SyncPlay.
 */
class SyncPlayQueueCore {
    constructor(syncPlayManager) {
        this.manager = syncPlayManager;
        this.playQueueManager = new SyncPlayQueueManager();
    }

    /**
     * Handles the change in the play queue.
     * @param {Object} apiClient The ApiClient.
     * @param {Object} newPlayQueue The new play queue.
     */
    updatePlayQueue(apiClient, newPlayQueue) {
        newPlayQueue.LastUpdate = new Date(newPlayQueue.LastUpdate);

        if (newPlayQueue.LastUpdate.getTime() <= this.playQueueManager.getLastUpdateTime()) {
            console.debug('SyncPlay updatePlayQueue: ignoring old update', newPlayQueue);
            return;
        }

        console.debug('SyncPlay updatePlayQueue:', newPlayQueue);

        const serverId = apiClient.serverInfo().Id;

        this.playQueueManager.onPlayQueueUpdate(newPlayQueue, serverId).then(() => {
            if (newPlayQueue.LastUpdate.getTime() < this.playQueueManager.getLastUpdateTime()) {
                console.warn('SyncPlay updatePlayQueue: trying to apply old update.', newPlayQueue);
                throw new Error('Trying to apply old update');
            }

            // Ignore if remote self-managed player
            if (this.manager.isRemote()) {
                console.warn('SyncPlay updatePlayQueue: remote player has own SyncPlay manager.');
                return;
            }

            const playerWrapper = this.manager.getPlayerWrapper();

            switch (newPlayQueue.Reason) {
                case 'NewPlaylist': {
                    if (!this.manager.isFollowingGroupPlayback()) {
                        this.manager.followGroupPlayback(apiClient).then(() => {
                            this.startPlayback(apiClient);
                        });
                    } else {
                        this.startPlayback(apiClient);
                    }
                    break;
                }
                case 'SetCurrentItem':
                case 'NextTrack':
                case 'PreviousTrack': {
                    const playlistItemId = this.playQueueManager.getCurrentPlaylistItemId();
                    this.localSetCurrentPlaylistItem(playlistItemId);
                    break;
                }
                case 'RemoveItems': {
                    const player = playbackManager.getCurrentPlayer();
                    if (player) {
                        events.trigger(player, 'playlistitemadd');
                    }
                    const realPlaylistItemId = this.playQueueManager.getRealPlaylistItemId();
                    const playlistItemId = this.playQueueManager.getCurrentPlaylistItemId();
                    if (realPlaylistItemId !== playlistItemId) {
                        this.localSetCurrentPlaylistItem(playlistItemId);
                    }
                    break;
                }
                case 'MoveItem':
                case 'Queue':
                case 'QueueNext': {
                    const player = playbackManager.getCurrentPlayer();
                    if (player) {
                        events.trigger(player, 'playlistitemadd');
                    }
                    break;
                }
                case 'RepeatMode':
                    playerWrapper.localSetRepeatMode(this.playQueueManager.getRepeatMode());
                    break;
                case 'ShuffleMode':
                    playerWrapper.localSetQueueShuffleMode(this.playQueueManager.getShuffleMode());
                    break;
                default:
                    console.error('SyncPlay updatePlayQueue: unknown reason for update:', newPlayQueue.Reason);
                    break;
            }
        }).catch((error) => {
            console.warn('SyncPlay updatePlayQueue:', error);
        });
    }

    /**
     * Sends a SyncPlayBuffering request on playback start.
     */
    scheduleReadyRequestOnPlaybackStart(origin) {
        syncPlayHelper.waitForEventOnce(this.manager, 'playbackstart', syncPlayHelper.WaitForEventDefaultTimeout, ['playbackerror']).then(() => {
            console.debug('SyncPlay scheduleReadyRequestOnPlaybackStart: local pause and notify server.');
            this.manager.playbackCore.localPause();

            const currentTime = new Date();
            const now = this.manager.timeSyncCore.localDateToRemote(currentTime);
            const currentPosition = playbackManager.currentTime();
            const currentPositionTicks = Math.round(currentPosition) * syncPlayHelper.TicksPerMillisecond;
            const state = playbackManager.getPlayerState();

            apiClient.requestSyncPlayBuffering({
                When: now.toISOString(),
                PositionTicks: currentPositionTicks,
                IsPlaying: !state.PlayState.IsPaused,
                PlaylistItemId: this.getCurrentPlaylistItemId(),
                BufferingDone: true
            });
        }).catch((error) => {
            console.error('Error while waiting for `playbackstart` event!', origin, error);
            if (!syncPlayManager.isSyncPlayEnabled()) {
                // TODO: do something?
            }
            this.manager.haltGroupPlayback(apiClient);
            return;
        });
    }

    /**
     * Prepares this client for playback by loading the group's content.
     * @param {Object} apiClient The ApiClient.
     */
    startPlayback(apiClient) {
        // Ignore command when client is not following playback
        if (!this.manager.isFollowingGroupPlayback()) {
            console.debug('SyncPlay startPlayback: ignoring, not following playback.');
            return Promise.reject();
        }

        if (this.isPlaylistEmpty()) {
            console.debug('SyncPlay startPlayback: empty playlist.');
            return;
        }

        // Estimate start position ticks from last playback command, if available
        const playbackCommand = this.manager.getLastPlaybackCommand();
        const lastQueueUpdateDate = this.playQueueManager.getLastUpdate();
        let startPositionTicks = 0;

        if (playbackCommand && playbackCommand.EmittedAt.getTime() >= lastQueueUpdateDate.getTime()) {
            // Prefer playback commands as they're more frequent (and also because playback position is PlaybackCore's concern)
            startPositionTicks = this.manager.playbackCore.estimateCurrentTicks(playbackCommand.PositionTicks, playbackCommand.When);
        } else {
            // A PlayQueueUpdate is emited only on queue changes so it's less reliable for playback position syncing
            const oldStartPositionTicks = this.playQueueManager.getStartPositionTicks();
            startPositionTicks = this.manager.playbackCore.estimateCurrentTicks(oldStartPositionTicks, lastQueueUpdateDate);
        }

        const serverId = apiClient.serverInfo().Id;
        const p2pTracker = syncPlaySettings.get('p2pTracker');

        const playerWrapper = this.manager.getPlayerWrapper();
        playerWrapper.localPlay({
            ids: this.playQueueManager.getPlaylistAsItemIds(),
            startPositionTicks: startPositionTicks,
            startIndex: this.playQueueManager.getCurrentPlaylistIndex(),
            serverId: serverId,
            enableP2P: p2pTracker !== '',
            trackers: [
                p2pTracker
            ]
        }).then(() => {
            this.scheduleReadyRequestOnPlaybackStart('startPlayback');
        }).catch((error) => {
            console.error(error);
        });
    }

    /**
     * Calls original PlaybackManager's setCurrentPlaylistItem method.
     */
    localSetCurrentPlaylistItem(playlistItemId) {
        // Ignore command when client is not following playback
        if (!this.manager.isFollowingGroupPlayback()) {
            console.debug('SyncPlay localSetCurrentPlaylistItem: ignoring, not following playback.');
            return;
        }

        this.manager.queueCore.scheduleReadyRequestOnPlaybackStart('localSetCurrentPlaylistItem');

        const playerWrapper = this.manager.getPlayerWrapper();
        return playerWrapper.localSetCurrentPlaylistItem(playlistItemId);
    }

    /**
     * Checks if playlist is empty.
     * @returns {boolean} _true_ if playlist is empty, _false_ otherwise.
     */
    isPlaylistEmpty() {
        return this.playQueueManager.isPlaylistEmpty();
    }

    /**
     * Gets the playlist item id of the playing item.
     * @returns {string} The playlist item id.
     */
    getCurrentPlaylistItemId() {
        return this.playQueueManager.getCurrentPlaylistItemId();
    }
}

export default SyncPlayQueueCore;
