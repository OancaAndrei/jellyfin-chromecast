/**
 * Module that manages the RemotePlayer for SyncPlay.
 * @module components/syncPlay/players/remotePlayer
 */

import playbackManager from 'playbackManager';
import SyncPlayHtmlVideoPlayer from 'syncPlayHtmlVideoPlayer';

/**
 * Class that manages the RemotePlayer for SyncPlay.
 */
class SyncPlayRemotePlayer extends SyncPlayHtmlVideoPlayer {
    static type = 'remoteplayer';

    constructor(player, syncPlayManager) {
        super(player, syncPlayManager);
    }

    getRemoteSessionId() {
        const info = playbackManager.getPlayerInfo();
        return info ? info.id : null;
    }

    /**
     * Binds to the player's events. Overrides parent method.
     * @param {Object} player The player.
     */
    localBindToPlayer() {
        super.localBindToPlayer();

        const apiClient = window.connectionManager.currentApiClient();
        const sessionId = this.getRemoteSessionId();
        const groupInfo = this.syncPlayManager.getGroupInfo();
        this.remoteSessionId = sessionId;

        apiClient.joinSyncPlayGroup({
            GroupId: groupInfo.GroupId,
            RemoteSessionId: this.remoteSessionId
        });
    }

    /**
     * Removes the bindings from the player's events. Overrides parent method.
     */
    localUnbindFromPlayer() {
        super.localUnbindFromPlayer();

        const apiClient = window.connectionManager.currentApiClient();
        apiClient.leaveSyncPlayGroup({
            RemoteSessionId: this.remoteSessionId
        });
    }

    /**
     * Gets playback status.
     * @returns {boolean} Whether the player has some media loaded.
     */
    isPlaybackActive() {
        return true;
    }

    /**
     * Whether the player is remotely self-managed.
     * @returns {boolean} _true_ if the player is remotely self-managed, _false_ otherwise.
     */
    isRemote() {
        return true;
    }

    /**
     * Overrides PlaybackManager's unpause method.
     */
    unpauseRequest(player) {
        this.playbackCore.localUnpause(player);
    }

    /**
     * Overrides PlaybackManager's pause method.
     */
    pauseRequest(player) {
        this.playbackCore.localPause(player);
    }

    /**
     * Overrides PlaybackManager's seek method.
     */
    seekRequest(PositionTicks, player) {
        this.playbackCore.localSeek(PositionTicks, player);
    }

    /**
     * Overrides PlaybackManager's sendCommand method.
     */
    sendCommandRequest(cmd, player) {
        this.playbackCore.localSendCommand(cmd, player);
    }

    /**
     * Overrides PlaybackManager's play method.
     */
    playRequest(options) {
        this.queueCore.localPlay(options);
    }

    /**
     * Overrides PlaybackManager's setCurrentPlaylistItem method.
     */
    setCurrentPlaylistItemRequest(playlistItemId, player) {
        this.queueCore.localSetCurrentPlaylistItem(playlistItemId, player);
    }

    /**
     * Overrides PlaybackManager's removeFromPlaylist method.
     */
    removeFromPlaylistRequest(playlistItemIds, player) {
        this.queueCore.localRemoveFromPlaylist(playlistItemIds, player);
    }

    /**
     * Overrides PlaybackManager's movePlaylistItem method.
     */
    movePlaylistItemRequest(playlistItemId, newIndex, player) {
        this.queueCore.localMovePlaylistItem(playlistItemId, newIndex, player);
    }

    /**
     * Overrides PlaybackManager's queue method.
     */
    queueRequest(options, player) {
        this.queueCore.localQueue(options, player);
    }

    /**
     * Overrides PlaybackManager's queueNext method.
     */
    queueNextRequest(options, player) {
        this.queueCore.localQueueNext(options, player);
    }

    /**
     * Overrides PlaybackManager's nextTrack method.
     */
    nextTrackRequest(player) {
        this.queueCore.localNextTrack(player);
    }

    /**
     * Overrides PlaybackManager's previousTrack method.
     */
    previousTrackRequest(player) {
        this.queueCore.localPreviousTrack(player);
    }

    /**
     * Overrides PlaybackManager's setRepeatMode method.
     */
    setRepeatModeRequest(mode, player) {
        this.queueCore.localSetRepeatMode(mode, player);
    }

    /**
     * Overrides PlaybackManager's setQueueShuffleMode method.
     */
    setQueueShuffleModeRequest(mode, player) {
        this.queueCore.localSetQueueShuffleMode(mode, player);
    }

    /**
     * Overrides PlaybackManager's toggleQueueShuffleMode method.
     */
    toggleQueueShuffleModeRequest(player) {
        this.queueCore.localToggleQueueShuffleMode(player);
    }
}

export default SyncPlayRemotePlayer;
