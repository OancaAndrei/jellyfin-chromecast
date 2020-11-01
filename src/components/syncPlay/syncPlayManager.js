/**
 * Module that manages the SyncPlay feature.
 * @module components/syncPlay/syncPlayManager
 */

import { Events as events } from 'jellyfin-apiclient';
import * as syncPlayHelper from './syncPlayHelper';
import syncPlaySettings from './settings/settings';
import syncPlayPlayerFactory from './players/factory';
import TimeSyncCore from './timeSync/core';
import SyncPlayWebRTCCore from './webRTC/core';
import SyncPlayPlaybackCore from './syncPlayPlaybackCore';
import SyncPlayQueueCore from './syncPlayQueueCore';

const playbackManager = {};

/**
 * Class that manages the SyncPlay feature.
 */
class SyncPlayManager {
    constructor() {
        this.syncMethod = 'None'; // used for stats

        this.groupInfo = null;
        this.syncPlayEnabledAt = null; // Server time of when SyncPlay has been enabled
        this.syncPlayReady = false; // SyncPlay is ready after first ping to server
        this.queuedCommand = null; // Queued playback command, applied when SyncPlay is ready
        this.followingGroupPlayback = true; // Follow or ignore group playback
        this.lastPlaybackCommand = null; // Last received playback command from server, tracks state of group

        this.currentPlayer = null;
        this.playerWrapper = null;
    }

    init() {
        this.webRTCCore = new SyncPlayWebRTCCore(this);
        this.timeSyncCore = new TimeSyncCore(this.webRTCCore);
        this.playbackCore = new SyncPlayPlaybackCore(this);
        this.queueCore = new SyncPlayQueueCore(this);
        this.defaultPlayerWrapper = syncPlayPlayerFactory.getGenericWrapper(this);

        // TODO: bind to player or player manager...
        // this.bindToPlayer();

        events.on(this.timeSyncCore, 'time-sync-server-update', (event, timeOffset, ping) => {
            // Report ping
            if (this.syncEnabled) {
                apiClient.sendSyncPlayPing({
                    Ping: ping
                });
            }

        });
    }

    /**
     * Gets the last playback command, if any.
     * @returns {Object} The playback command.
     */
    getLastPlaybackCommand() {
        return this.lastPlaybackCommand;
    }

    /**
     * Called when the player changes.
     */
    onPlayerChange(newPlayer, newTarget, oldPlayer) {
        this.bindToPlayer(newPlayer);
    }

    /**
     * Binds to the player's events.
     * @param {Object} player The player.
     */
    bindToPlayer(player) {
        this.releaseCurrentPlayer();

        if (!player) {
            return;
        }

        this.currentPlayer = player;
        this.playerWrapper = syncPlayPlayerFactory.getWrapper(player, this);

        if (this.isSyncPlayEnabled()) {
            if (this.playerWrapper) {
                this.playerWrapper.bindToPlayer();
            } else {
                console.warn('SyncPlay bindToPlayer: player is not supported!', player);
            }
        }

        events.trigger(this, 'playerchange', [this.currentPlayer]);
    }

    /**
     * Removes the bindings from the current player's events.
     */
    releaseCurrentPlayer() {
        this.currentPlayer = null;
        if (this.playerWrapper !== null) {
            this.playerWrapper.unbindFromPlayer();
            this.playerWrapper = null;
        }

        events.trigger(this, 'playerchange', [this.currentPlayer]);
    }

    /**
     * Converts a given string to a Guid string.
     * @param {string} input The input string.
     * @returns {string} The Guid string.
     */
    stringToGuid(input) {
        return input.replace(/([0-z]{8})([0-z]{4})([0-z]{4})([0-z]{4})([0-z]{12})/, '$1-$2-$3-$4-$5');
    }

    /**
     * Whether the given user is an administrator for this group.
     * @param {string} userId The id of the user.
     * @returns {boolean} _true_ if the user is an administrator, _false_ otherwise.
     */
    isUserAdministrator(userId) {
        if (this.groupInfo) {
            return this.groupInfo.Administrators.indexOf(userId) !== -1;
        } else {
            return false;
        }
    }

    /**
     * Whether the current user is an administrator for this group.
     * @returns {boolean} _true_ if the user is an administrator, _false_ otherwise.
     */
    isAdministrator() {
        const userId = this.stringToGuid(apiClient.getCurrentUserId());
        return this.isUserAdministrator(userId);
    }

    /**
     * Whether the given user has playback access for this group.
     * @param {string} userId The id of the user.
     * @returns {boolean} _true_ if the user has playback access, _false_ otherwise.
     */
    hasUserPlaybackAccess(userId) {
        if (this.groupInfo && this.groupInfo.AccessList && this.groupInfo.AccessList[userId]) {
            return this.groupInfo.AccessList[userId].PlaybackAccess;
        } else {
            return false;
        }
    }

    /**
     * Whether the current user has playback access for this group.
     * @returns {boolean} _true_ if the user has playback access, _false_ otherwise.
     */
    hasPlaybackAccess() {
        const userId = this.stringToGuid(apiClient.getCurrentUserId());
        return this.hasUserPlaybackAccess(userId);
    }

    /**
     * Whether the given user has playlist access for this group.
     * @param {string} userId The id of the user.
     * @returns {boolean} _true_ if the user has playlist access, _false_ otherwise.
     */
    hasUserPlaylistAccess(userId) {
        if (this.groupInfo && this.groupInfo.AccessList && this.groupInfo.AccessList[userId]) {
            return this.groupInfo.AccessList[userId].PlaylistAccess;
        } else {
            return false;
        }
    }

    /**
     * Whether the current user has playlist access for this group.
     * @returns {boolean} _true_ if the user has playlist access, _false_ otherwise.
     */
    hasPlaylistAccess() {
        const userId = this.stringToGuid(apiClient.getCurrentUserId());
        return this.hasUserPlaylistAccess(userId);
    }

    /**
     * Handles a group update from the server.
     * @param {Object} cmd The group update.
     * @param {Object} apiClient The ApiClient.
     */
    processGroupUpdate(cmd, apiClient) {
        switch (cmd.Type) {
            case 'PlayQueue':
                this.queueCore.updatePlayQueue(apiClient, cmd.Data);
                break;
            case 'UserJoined':
                // TODO: show fancy list of joined users if idle.
                break;
            case 'UserLeft':
                // TODO: show fancy list of joined users if idle.
                break;
            case 'GroupJoined':
                this.enableSyncPlay(apiClient, cmd.Data, true);
                break;
            case 'SyncPlayIsDisabled':
                // Do nothing.
                break;
            case 'NotInGroup':
            case 'GroupLeft':
                this.disableSyncPlay(true);
                break;
            case 'GroupUpdate':
                cmd.Data.LastUpdatedAt = new Date(cmd.Data.LastUpdatedAt);
                this.groupInfo = cmd.Data;
                break;
            case 'StateUpdate':
                events.trigger(syncPlayManager, 'group-state-update', [cmd.Data.State, cmd.Data.Reason]);
                break;
            case 'GroupDoesNotExist':
                // Do nothing.
                break;
            case 'CreateGroupDenied':
                // Do nothing.
                break;
            case 'JoinGroupDenied':
                // Do nothing.
                break;
            case 'LibraryAccessDenied':
                // Do nothing.
                break;
            case 'WebRTC':
                this.webRTCCore.handleSignalingMessage(apiClient, cmd.Data);
                break;
            default:
                console.debug(`SyncPlay processSyncPlayGroupUpdate: unknown command ${cmd.Type}.`);
                break;
        }
    }

    /**
     * Handles a playback command from the server.
     * @param {Object} cmd The playback command.
     * @param {Object} apiClient The ApiClient.
     */
    processCommand(cmd, apiClient) {
        if (cmd === null) return;

        if (typeof cmd.When === 'string') {
            cmd.When = new Date(cmd.When);
            cmd.EmittedAt = new Date(cmd.EmittedAt);
            cmd.PositionTicks = cmd.PositionTicks ? parseInt(cmd.PositionTicks) : null;
        }

        if (!this.isSyncPlayEnabled()) {
            console.debug('SyncPlay processCommand: SyncPlay not enabled, ignoring command', cmd);
            return;
        }

        if (cmd.EmittedAt.getTime() < this.syncPlayEnabledAt.getTime()) {
            console.debug('SyncPlay processCommand: ignoring old command', cmd);
            return;
        }

        if (!this.syncPlayReady) {
            console.debug('SyncPlay processCommand: SyncPlay not ready, queued command', cmd);
            this.queuedCommand = cmd;
            return;
        }

        this.lastPlaybackCommand = cmd;

        if (!this.isPlaybackActive()) {
            console.debug('SyncPlay processCommand: no active player!');
            return;
        }

        // Make sure command matches playing item in playlist
        const playlistItemId = this.queueCore.getCurrentPlaylistItemId();
        if (cmd.PlaylistItemId !== playlistItemId) {
            console.warn('SyncPlay processCommand: playlist item does not match!', cmd);
            return;
        }

        if (cmd.PositionTicks) {
            console.log('SyncPlay will', cmd.Command, 'at', cmd.When, '(in', cmd.When.getTime() - Date.now(), 'ms)', 'PositionTicks', cmd.PositionTicks);
        } else {
            console.log('SyncPlay will', cmd.Command, 'at', cmd.When, '(in', cmd.When.getTime() - Date.now(), 'ms)');
        }

        this.playbackCore.applyCommand(cmd);
    }

    /**
     * Handles a group state change.
     * @param {Object} update The group state update.
     * @param {Object} apiClient The ApiClient.
     */
    processStateChange(update, apiClient) {
        if (update === null || update.State === null || update.Reason === null) return;

        if (!this.isSyncPlayEnabled()) {
            console.debug('SyncPlay processStateChange: SyncPlay not enabled, ignoring group state update', update);
            return;
        }

        events.trigger(syncPlayManager, 'group-state-change', [update.State, update.Reason]);
    }

    /**
     * Notifies server that this client is following group's playback.
     * @param {Object} apiClient The ApiClient.
     * @returns {Promise} A Promise fulfilled upon request completion.
     */
    followGroupPlayback(apiClient) {
        this.followingGroupPlayback = true;

        return apiClient.requestSyncPlaySetIgnoreWait({
            IgnoreWait: false
        });
    }

    /**
     * Starts this client's playback and loads the group's play queue.
     * @param {Object} apiClient The ApiClient.
     */
    resumeGroupPlayback(apiClient) {
        this.followGroupPlayback(apiClient).then(() => {
            this.queueCore.startPlayback(apiClient);
        });
    }

    /**
     * Stops this client's playback and notifies server to be ignored in group wait.
     * @param {Object} apiClient The ApiClient.
     */
    haltGroupPlayback(apiClient) {
        this.followingGroupPlayback = false;

        apiClient.requestSyncPlaySetIgnoreWait({
            IgnoreWait: true
        });
        this.playbackCore.localStop();
    }

    /**
     * Whether this client is following group playback.
     * @returns {boolean} _true_ if client should play group's content, _false_ otherwise.
     */
    isFollowingGroupPlayback() {
        return this.followingGroupPlayback;
    }

    /**
     * Enables SyncPlay.
     * @param {Object} apiClient The ApiClient.
     * @param {Object} groupInfo The joined group's info.
     * @param {boolean} showMessage Display message.
     */
    enableSyncPlay(apiClient, groupInfo, showMessage = false) {
        // Convert string to date
        groupInfo.LastUpdatedAt = new Date(groupInfo.LastUpdatedAt);
        this.groupInfo = groupInfo;

        this.syncPlayEnabledAt = groupInfo.LastUpdatedAt;
        this.injectPlaybackManager();
        if (this.playerWrapper) {
            this.playerWrapper.bindToPlayer();
        }

        events.trigger(this, 'enabled', [true]);

        // Wait for time sync to be ready
        syncPlayHelper.waitForEventOnce(this.timeSyncCore, 'time-sync-server-update').then(() => {
            this.syncPlayReady = true;
            this.processCommand(this.queuedCommand, apiClient);
            this.queuedCommand = null;
        });

        this.syncPlayReady = false;
        this.followingGroupPlayback = true;

        this.timeSyncCore.forceUpdate();

        const enableWebRTC = syncPlaySettings.getBool('enableWebRTC');
        if (enableWebRTC) {
            this.webRTCCore.enable();
        }

        // TODO: update with fancy view of users.
    }

    /**
     * Disables SyncPlay.
     * @param {boolean} showMessage Display message.
     */
    disableSyncPlay(showMessage = false) {
        this.syncPlayEnabledAt = null;
        this.syncPlayReady = false;
        this.followingGroupPlayback = true;
        this.lastPlaybackCommand = null;
        this.queuedCommand = null;
        this.playbackCore.syncEnabled = false;
        events.trigger(this, 'enabled', [false]);
        this.restorePlaybackManager();
        if (this.playerWrapper) {
            this.playerWrapper.unbindFromPlayer();
        }

        this.webRTCCore.disable();

        // TODO: return to default view.
    }

    /**
     * Gets SyncPlay status.
     * @returns {boolean} _true_ if user joined a group, _false_ otherwise.
     */
    isSyncPlayEnabled() {
        return this.syncPlayEnabledAt !== null;
    }

    /**
     * Overrides some PlaybackManager's methods to intercept playback commands.
     */
    injectPlaybackManager() {
        if (!this.isSyncPlayEnabled()) return;
        if (playbackManager.syncPlayEnabled) return;

        // TODO: make this less hacky
        this.playbackCore.injectPlaybackManager();
        this.queueCore.injectPlaybackManager();

        playbackManager.syncPlayEnabled = true;
    }

    /**
     * Restores original PlaybackManager's methods.
     */
    restorePlaybackManager() {
        if (this.isSyncPlayEnabled()) return;
        if (!playbackManager.syncPlayEnabled) return;

        this.playbackCore.restorePlaybackManager();
        this.queueCore.restorePlaybackManager();

        playbackManager.syncPlayEnabled = false;
    }

    /**
     * Gets the group information.
     * @returns {Object} The group information, null if SyncPlay is disabled.
     */
    getGroupInfo() {
        return this.groupInfo;
    }

    /**
     * Gets SyncPlay stats.
     * @returns {Object} The SyncPlay stats.
     */
    getStats() {
        return {
            TimeOffset: this.timeSyncCore.getTimeOffset().toFixed(2),
            PlaybackDiff: this.playbackCore.playbackDiffMillis.toFixed(2),
            SyncMethod: this.syncMethod
        };
    }

    getPlayerWrapper() {
        if (this.playerWrapper) {
            return this.playerWrapper;
        } else {
            return this.defaultPlayerWrapper;
        }
    }

    /**
     * Gets playback status.
     * @returns {boolean} Whether a player is active.
     */
    isPlaybackActive() {
        return this.getPlayerWrapper().isPlaybackActive();
    }

    /**
     * Whether the player is remotely self-managed.
     * @returns {boolean} _true_ if the player is remotely self-managed, _false_ otherwise.
     */
    isRemote() {
        return this.getPlayerWrapper().isRemote();
    }

    /**
     * Checks if playlist is empty.
     * @returns {boolean} _true_ if playlist is empty, _false_ otherwise.
     */
    isPlaylistEmpty() {
        return this.queueCore.isPlaylistEmpty();
    }

    /**
     * Checks if playback is unpaused.
     * @returns {boolean} _true_ if media is playing, _false_ otherwise.
     */
    isPlaying() {
        if (!this.lastPlaybackCommand) {
            return false;
        } else {
            return this.lastPlaybackCommand.Command === 'Unpause';
        }
    }

    /**
     * Emits an event to update the SyncPlay status icon.
     */
    showSyncIcon(syncMethod) {
        this.syncMethod = syncMethod;
        events.trigger(this, 'syncing', [true, this.syncMethod]);
    }

    /**
     * Emits an event to clear the SyncPlay status icon.
     */
    clearSyncIcon() {
        this.syncMethod = 'None';
        events.trigger(this, 'syncing', [false, this.syncMethod]);
    }
}

/** SyncPlayManager singleton. */
const syncPlayManager = new SyncPlayManager();
export default syncPlayManager;