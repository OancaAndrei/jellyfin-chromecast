/**
 * Module that manages the playback of SyncPlay.
 * @module components/syncPlay/syncPlayPlaybackCore
 */

import { Events as events } from 'jellyfin-apiclient';
import * as syncPlayHelper from './syncPlayHelper';
import syncPlaySettings from './settings/settings';

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

/**
 * Globals
 */
var syncPlayManager;

/**
 * Class that manages the playback of SyncPlay.
 */
class SyncPlayPlaybackCore {
    constructor(_syncPlayManager) {
        // FIXME: kinda ugly but does its job (it avoids circular dependencies)
        syncPlayManager = _syncPlayManager;
        this.timeSyncCore = syncPlayManager.timeSyncCore;

        this.playbackRateSupported = false;
        this.syncEnabled = false;
        this.playbackDiffMillis = 0; // used for stats
        this.syncAttempts = 0;
        this.lastSyncTime = new Date();
        this.syncWatcherTimeout = null; // interval that watches playback time and syncs it
        this.syncLevel = 1; // Multiplier for default values, 1 being the most demanding one
        this.enableSyncCorrection = true; // user setting to disable sync during playback

        this.lastPlaybackWaiting = null; // used to determine if player's buffering
        this.minBufferingThresholdMillis = 1000;

        this.currentPlayer = null;
        this.localPlayerPlaybackRate = 1.0; // used to restore user PlaybackRate

        this.lastCommand = null; // Last scheduled playback command, might not be the latest one
        this.scheduledCommandTimeout = null;
        this.syncTimeout = null;

        this.loadPreferences();

        events.on(syncPlaySettings, 'update', (event) => {
            this.loadPreferences();
        });

        events.on(syncPlayManager, 'playerchange', (event, player) => {
            this.onPlayerChange(player);
        });
    }

    loadPreferences() {
        // Minimum required delay for SpeedToSync to kick in, in milliseconds
        this.minDelaySpeedToSync = syncPlaySettings.getFloat('minDelaySpeedToSync', 60.0);
        // Maximum delay after which SkipToSync is used instead of SpeedToSync, in milliseconds
        this.maxDelaySpeedToSync = syncPlaySettings.getFloat('maxDelaySpeedToSync', 3000.0);
        // Time during which the playback is sped up, in milliseconds
        this.speedToSyncDuration = syncPlaySettings.getFloat('speedToSyncDuration', 1000.0);
        // Minimum required delay for SkipToSync to kick in, in milliseconds
        this.minDelaySkipToSync = syncPlaySettings.getFloat('minDelaySkipToSync', 400.0);
        // Whether SpeedToSync should be used
        this.useSpeedToSync = syncPlaySettings.getBool('useSpeedToSync');
        // Whether SkipToSync should be used
        this.useSkipToSync = syncPlaySettings.getBool('useSkipToSync');
        // Whether sync correction during playback is active
        this.enableSyncCorrection = syncPlaySettings.getBool('enableSyncCorrection');
    }

    /**
     * Called when the player changes.
     */
    onPlayerChange(player) {
        if (this.currentPlayer) {
            // Restore player original PlaybackRate value
            if (this.playbackRateSupported) {
                this.currentPlayer.setPlaybackRate(this.localPlayerPlaybackRate);
                this.localPlayerPlaybackRate = 1.0;
            }

            this.currentPlayer = null;
            this.playbackRateSupported = false;
        }

        this.currentPlayer = player;

        if (this.currentPlayer) {
            // Save player current PlaybackRate value
            if (player.supports && player.supports('PlaybackRate')) {
                this.localPlayerPlaybackRate = player.getPlaybackRate();
                this.playbackRateSupported = true;
            } else {
                this.playbackRateSupported = false;
            }
        }

        console.debug('SyncPlay onPlayerChange: playback rate supported:', this.playbackRateSupported);
    }

    /**
     * Called by player wrapper when playback starts.
     */
    onPlaybackStart(player, state) {
        events.trigger(syncPlayManager, 'playbackstart', [player, state]);
    }

    /**
     * Called by player wrapper when playback stops.
     */
    onPlaybackStop(stopInfo) {
        this.lastCommand = null;
        events.trigger(syncPlayManager, 'playbackstop', [stopInfo]);
        syncPlayManager.releaseCurrentPlayer();
    }

    /**
     * Called by player wrapper when playback unpauses.
     */
    onUnpause() {
        events.trigger(syncPlayManager, 'unpause', [this.currentPlayer]);
    }

    /**
     * Called by player wrapper when playback pauses.
     */
    onPause() {
        events.trigger(syncPlayManager, 'pause', [this.currentPlayer]);
    }

    /**
     * Called by player wrapper on playback progress.
     * @param {Object} event The time update event.
     */
    onTimeUpdate(event) {
        // NOTICE: this event is unreliable, at least in Safari
        // which just stops firing the event after a while.
        this.syncPlaybackTime();
        events.trigger(syncPlayManager, 'timeupdate', [event]);
    }

    /**
     * Called by player wrapper when playback is resumed.
     */
    onPlaying() {
        if (this.isBuffering()) {
            this.sendBufferingRequest(false);
        }

        clearTimeout(this.notifyBuffering);
        this.lastPlaybackWaiting = null;

        events.trigger(syncPlayManager, 'playing');
    }

    /**
     * Called by player wrapper when playback is buffering.
     */
    onWaiting(event) {
        if (!this.lastPlaybackWaiting) {
            this.lastPlaybackWaiting = new Date();
        }

        clearTimeout(this.notifyBuffering);
        this.notifyBuffering = setTimeout(() => {
            this.sendBufferingRequest();
        }, this.minBufferingThresholdMillis);

        events.trigger(syncPlayManager, 'waiting');
    }

    /**
     * Sends a buffering request to the server.
     * @param {boolean} isBuffering Whether this client is buffering or not.
     */
    sendBufferingRequest(isBuffering = true) {
        const currentTime = new Date();
        const now = this.timeSyncCore.localDateToRemote(currentTime);
        const currentPosition = playbackManager.currentTime();
        const currentPositionTicks = Math.round(currentPosition) * syncPlayHelper.TicksPerMillisecond;
        const state = playbackManager.getPlayerState();
        const playlistItemId = syncPlayManager.queueCore.getCurrentPlaylistItemId();

        apiClient.requestSyncPlayBuffering({
            When: now.toISOString(),
            PositionTicks: currentPositionTicks,
            IsPlaying: !state.PlayState.IsPaused,
            PlaylistItemId: playlistItemId,
            BufferingDone: !isBuffering
        });
    }

    /**
     * Gets playback buffering status.
     * @returns {boolean} _true_ if player is buffering, _false_ otherwise.
     */
    isBuffering() {
        if (this.lastPlaybackWaiting === null) return false;
        return (new Date() - this.lastPlaybackWaiting) > this.minBufferingThresholdMillis;
    }

    /**
     * Applies a command and checks the playback state if a duplicate command is received.
     * @param {Object} command The playback command.
     */
    applyCommand(command) {
        // Check if duplicate
        if (this.lastCommand &&
            this.lastCommand.When.getTime() === command.When.getTime() &&
            this.lastCommand.PositionTicks === command.PositionTicks &&
            this.lastCommand.Command === command.Command &&
            this.lastCommand.PlaylistItemId === command.PlaylistItemId
        ) {
            // Duplicate command found, check playback state and correct if needed
            console.debug('SyncPlay applyCommand: duplicate command received!', command);

            // Determine if past command or future one
            const currentTime = new Date();
            const whenLocal = this.timeSyncCore.remoteDateToLocal(command.When);
            if (whenLocal > currentTime) {
                // Command should be already scheduled, not much we can do
                // TODO: should re-apply or just drop?
                console.debug('SyncPlay applyCommand: command already scheduled.', command);
                return;
            } else {
                // Check if playback state matches requested command
                const currentPositionTicks = playbackManager.currentTime() * syncPlayHelper.TicksPerMillisecond;
                const state = playbackManager.getPlayerState();
                const isPlaying = !state.PlayState.IsPaused;

                switch (command.Command) {
                    case 'Unpause':
                        // Check playback state only, as position ticks will be corrected by sync
                        if (!isPlaying) {
                            this.scheduleUnpause(command.When, command.PositionTicks);
                        }
                        break;
                    case 'Pause':
                        if (isPlaying || currentPositionTicks !== command.PositionTicks) {
                            this.schedulePause(command.When, command.PositionTicks);
                        }
                        break;
                    case 'Stop':
                        if (isPlaying) {
                            this.scheduleStop(command.When);
                        }
                        break;
                    case 'Seek':
                        // During seek, playback is paused
                        if (isPlaying || currentPositionTicks !== command.PositionTicks) {
                            // Account for player imperfections, we got half a second of tollerance we can play with
                            // (the server tollerates a range of values when client reports that is ready)
                            const rangeWidth = 100; // in milliseconds
                            const randomOffsetTicks = Math.round((Math.random() - 0.5) * rangeWidth) * syncPlayHelper.TicksPerMillisecond;
                            this.scheduleSeek(command.When, command.PositionTicks + randomOffsetTicks);
                            console.debug('SyncPlay applyCommand: adding random offset to force seek:', randomOffsetTicks, command);
                        } else {
                            // All done, I guess?
                            this.sendBufferingRequest(false);
                        }
                        break;
                    default:
                        console.error('SyncPlay applyCommand: command is not recognised:', command);
                        break;
                }

                // All done
                return;
            }
        }

        // Applying command
        this.lastCommand = command;

        // Ignore if remote self-managed player
        if (syncPlayManager.isRemote()) {
            return;
        }

        switch (command.Command) {
            case 'Unpause':
                this.scheduleUnpause(command.When, command.PositionTicks);
                break;
            case 'Pause':
                this.schedulePause(command.When, command.PositionTicks);
                break;
            case 'Stop':
                this.scheduleStop(command.When);
                break;
            case 'Seek':
                this.scheduleSeek(command.When, command.PositionTicks);
                break;
            default:
                console.error('SyncPlay applyCommand: command is not recognised:', command);
                break;
        }
    }

    /**
     * Schedules a resume playback on the player at the specified clock time.
     * @param {Date} playAtTime The server's UTC time at which to resume playback.
     * @param {number} positionTicks The PositionTicks from where to resume.
     */
    scheduleUnpause(playAtTime, positionTicks) {
        this.clearScheduledCommand();
        const enableSyncTimeout = this.maxDelaySpeedToSync / 2.0;
        const currentTime = new Date();
        const playAtTimeLocal = this.timeSyncCore.remoteDateToLocal(playAtTime);
        const currentPositionTicks = playbackManager.currentTime() * syncPlayHelper.TicksPerMillisecond;

        if (playAtTimeLocal > currentTime) {
            const playTimeout = playAtTimeLocal - currentTime;

            // Seek only if delay is noticeable
            if ((currentPositionTicks - positionTicks) > this.minDelaySkipToSync * syncPlayHelper.TicksPerMillisecond) {
                this.localSeek(positionTicks);
            }

            this.scheduledCommandTimeout = setTimeout(() => {
                this.localUnpause();
                events.trigger(syncPlayManager, 'notify-osd', ['unpause']);

                this.syncTimeout = setTimeout(() => {
                    this.syncEnabled = true;
                }, enableSyncTimeout);
            }, playTimeout);

            console.debug('Scheduled unpause in', playTimeout / 1000.0, 'seconds.');
        } else {
            // Group playback already started
            const serverPositionTicks = this.estimateCurrentTicks(positionTicks, playAtTime);
            syncPlayHelper.waitForEventOnce(syncPlayManager, 'unpause').then(() => {
                this.localSeek(serverPositionTicks);
            });
            this.localUnpause();
            setTimeout(() => {
                events.trigger(syncPlayManager, 'notify-osd', ['unpause']);
            }, 100);

            this.syncTimeout = setTimeout(() => {
                this.syncEnabled = true;
            }, enableSyncTimeout);

            console.debug(`SyncPlay scheduleUnpause: unpause now from ${serverPositionTicks} (was at ${currentPositionTicks}).`);
        }
    }

    /**
     * Schedules a pause playback on the player at the specified clock time.
     * @param {Date} pauseAtTime The server's UTC time at which to pause playback.
     * @param {number} positionTicks The PositionTicks where player will be paused.
     */
    schedulePause(pauseAtTime, positionTicks) {
        this.clearScheduledCommand();
        const currentTime = new Date();
        const pauseAtTimeLocal = this.timeSyncCore.remoteDateToLocal(pauseAtTime);

        const callback = () => {
            syncPlayHelper.waitForEventOnce(syncPlayManager, 'pause', syncPlayHelper.WaitForPlayerEventTimeout).then(() => {
                this.localSeek(positionTicks);
            }).catch(() => {
                // Player was already paused, seeking
                this.localSeek(positionTicks);
            });
            this.localPause();
        };

        if (pauseAtTimeLocal > currentTime) {
            const pauseTimeout = pauseAtTimeLocal - currentTime;
            this.scheduledCommandTimeout = setTimeout(callback, pauseTimeout);

            console.debug('Scheduled pause in', pauseTimeout / 1000.0, 'seconds.');
        } else {
            callback();
            console.debug('SyncPlay schedulePause: now.');
        }
    }

    /**
     * Schedules a stop playback on the player at the specified clock time.
     * @param {Date} stopAtTime The server's UTC time at which to stop playback.
     */
    scheduleStop(stopAtTime) {
        this.clearScheduledCommand();
        const currentTime = new Date();
        const stopAtTimeLocal = this.timeSyncCore.remoteDateToLocal(stopAtTime);

        const callback = () => {
            this.localStop();
        };

        if (stopAtTimeLocal > currentTime) {
            const stopTimeout = stopAtTimeLocal - currentTime;
            this.scheduledCommandTimeout = setTimeout(callback, stopTimeout);

            console.debug('Scheduled stop in', stopTimeout / 1000.0, 'seconds.');
        } else {
            callback();
            console.debug('SyncPlay scheduleStop: now.');
        }
    }

    /**
     * Schedules a seek playback on the player at the specified clock time.
     * @param {Date} seekAtTime The server's UTC time at which to seek playback.
     * @param {number} positionTicks The PositionTicks where player will be seeked.
     */
    scheduleSeek(seekAtTime, positionTicks) {
        this.clearScheduledCommand();
        const currentTime = new Date();
        const seekAtTimeLocal = this.timeSyncCore.remoteDateToLocal(seekAtTime);

        const callback = () => {
            this.localUnpause();
            this.localSeek(positionTicks);

            syncPlayHelper.waitForEventOnce(syncPlayManager, 'playing', syncPlayHelper.WaitForEventDefaultTimeout).then(() => {
                this.localPause();
                this.sendBufferingRequest(false);
            }).catch((error) => {
                console.error(`Timed out while waiting for 'playing' event! Seeking to ${positionTicks}.`, error);
                this.localSeek(positionTicks);
            });
        };

        if (seekAtTimeLocal > currentTime) {
            const seekTimeout = seekAtTimeLocal - currentTime;
            this.scheduledCommandTimeout = setTimeout(callback, seekTimeout);

            console.debug('Scheduled seek in', seekTimeout / 1000.0, 'seconds.');
        } else {
            callback();
            console.debug('SyncPlay scheduleSeek: now.');
        }
    }

    /**
     * Clears the current scheduled command.
     */
    clearScheduledCommand() {
        clearTimeout(this.scheduledCommandTimeout);
        clearTimeout(this.syncTimeout);

        this.syncEnabled = false;
        if (this.currentPlayer && this.playbackRateSupported) {
            this.currentPlayer.setPlaybackRate(1);
        }

        syncPlayManager.clearSyncIcon();
    }

    /**
     * Overrides some PlaybackManager's methods to intercept playback commands.
     */
    injectPlaybackManager() {
        // Save local callbacks
        playbackManager._localPlayPause = playbackManager.playPause;
        playbackManager._localUnpause = playbackManager.unpause;
        playbackManager._localPause = playbackManager.pause;
        playbackManager._localSeek = playbackManager.seek;
        playbackManager._localSendCommand = playbackManager.sendCommand;

        // Override local callbacks
        playbackManager.playPause = this.playPauseRequest;
        playbackManager.unpause = this.unpauseRequest;
        playbackManager.pause = this.pauseRequest;
        playbackManager.seek = this.seekRequest;
        playbackManager.sendCommand = this.sendCommandRequest;
    }

    /**
     * Restores original PlaybackManager's methods.
     */
    restorePlaybackManager() {
        playbackManager.playPause = playbackManager._localPlayPause;
        playbackManager.unpause = playbackManager._localUnpause;
        playbackManager.pause = playbackManager._localPause;
        playbackManager.seek = playbackManager._localSeek;
        playbackManager.sendCommand = playbackManager._localSendCommand;
    }

    /**
     * Overrides PlaybackManager's playPause method.
     */
    playPauseRequest(player) {
        const self = syncPlayManager.playbackCore;

        if (syncPlayManager.isPlaying()) {
            self.pauseRequest(player);
        } else {
            self.unpauseRequest(player);
        }
    }

    /**
     * Overrides PlaybackManager's unpause method.
     */
    unpauseRequest(player) {
        if (!syncPlayManager.hasPlaybackAccess()) {
            // TODO: show some feedback?
            return;
        }

        const playerWrapper = syncPlayManager.getPlayerWrapper();
        playerWrapper.unpauseRequest(player);
    }

    /**
     * Overrides PlaybackManager's pause method.
     */
    pauseRequest(player) {
        if (!syncPlayManager.hasPlaybackAccess()) {
            // TODO: show some feedback?
            return;
        }

        const playerWrapper = syncPlayManager.getPlayerWrapper();
        playerWrapper.pauseRequest(player);
    }

    /**
     * Overrides PlaybackManager's seek method.
     */
    seekRequest(PositionTicks, player) {
        if (!syncPlayManager.hasPlaybackAccess()) {
            // TODO: show some feedback?
            return;
        }

        const playerWrapper = syncPlayManager.getPlayerWrapper();
        playerWrapper.seekRequest(PositionTicks, player);
    }

    /**
     * Overrides PlaybackManager's sendCommand method.
     */
    sendCommandRequest(cmd, player) {
        console.debug('SyncPlay sendCommandRequest:', cmd.Name, cmd);
        const playerWrapper = syncPlayManager.getPlayerWrapper();
        playerWrapper.sendCommandRequest(cmd, player);
    }

    /**
     * Calls original PlaybackManager's unpause method.
     */
    localUnpause(player) {
        // Ignore command when no player is active
        if (!syncPlayManager.isPlaybackActive()) {
            console.debug('SyncPlay localUnpause: no active player!');
            return;
        }

        if (playbackManager.syncPlayEnabled) {
            playbackManager._localUnpause(player);
        } else {
            playbackManager.unpause(player);
        }
    }

    /**
     * Calls original PlaybackManager's pause method.
     */
    localPause(player) {
        // Ignore command when no player is active
        if (!syncPlayManager.isPlaybackActive()) {
            console.debug('SyncPlay localPause: no active player!');
            return;
        }

        if (playbackManager.syncPlayEnabled) {
            playbackManager._localPause(player);
        } else {
            playbackManager.pause(player);
        }
    }

    /**
     * Calls original PlaybackManager's seek method.
     */
    localSeek(PositionTicks, player) {
        // Ignore command when no player is active
        if (!syncPlayManager.isPlaybackActive()) {
            console.debug('SyncPlay localSeek: no active player!');
            return;
        }

        if (playbackManager.syncPlayEnabled) {
            playbackManager._localSeek(PositionTicks, player);
        } else {
            playbackManager.seek(PositionTicks, player);
        }
    }

    /**
     * Calls original PlaybackManager's stop method.
     */
    localStop(player) {
        // Ignore command when no player is active
        if (!syncPlayManager.isPlaybackActive()) {
            console.debug('SyncPlay localStop: no active player!');
            return;
        }

        playbackManager.stop(player);
    }

    /**
     * Calls original PlaybackManager's sendCommand method.
     */
    localSendCommand(cmd, player) {
        // Ignore command when no player is active
        if (!syncPlayManager.isPlaybackActive()) {
            console.debug('SyncPlay localSendCommand: no active player!');
            return;
        }

        if (playbackManager.syncPlayEnabled) {
            playbackManager._localSendCommand(cmd, player);
        } else {
            playbackManager.sendCommand(cmd, player);
        }
    }

    /**
     * Estimates current value for ticks given a past state.
     * @param {number} ticks The value of the ticks.
     * @param {Date} when The point in time for the value of the ticks.
     */
    estimateCurrentTicks(ticks, when) {
        const currentTime = new Date();
        const remoteTime = this.timeSyncCore.localDateToRemote(currentTime);
        return ticks + (remoteTime.getTime() - when.getTime()) * syncPlayHelper.TicksPerMillisecond;
    }

    /**
     * Attempts to sync playback time with estimated server time.
     *
     * When sync is enabled, the following will be checked:
     *  - check if local playback time is close enough to the server playback time
     * If it is not, then a playback time sync will be attempted.
     * Two methods of syncing are available:
     * - SpeedToSync: speeds up the media for some time to catch up (default is one second)
     * - SkipToSync: seeks the media to the estimated correct time
     * SpeedToSync aims to reduce the delay as much as possible, whereas SkipToSync is less pretentious.
     */
    syncPlaybackTime() {
        const self = syncPlayManager.playbackCore;

        // See comments in constants section for more info
        const syncMethodThreshold = self.maxDelaySpeedToSync;
        let speedToSyncTime = self.speedToSyncDuration;

        // Ignore sync when no player is active
        if (!syncPlayManager.isPlaybackActive()) {
            console.debug('SyncPlay syncPlaybackTime: no active player!');
            return;
        }

        // Attempt to sync only when media is playing.
        const { lastCommand } = self;

        if (!lastCommand || lastCommand.Command !== 'Unpause' || self.isBuffering()) return;

        const currentTime = new Date();

        // Avoid overloading the browser
        const elapsed = currentTime - self.lastSyncTime;
        if (elapsed < syncMethodThreshold / 2) return;
        self.lastSyncTime = currentTime;

        // Get current PositionTicks
        const currentPositionTicks = playbackManager.currentTime() * syncPlayHelper.TicksPerMillisecond;
        // Estimate PositionTicks on server
        const serverPositionTicks = self.estimateCurrentTicks(lastCommand.PositionTicks, lastCommand.When);
        // Measure delay that needs to be recovered
        // diff might be caused by the player internally starting the playback
        const diffMillis = (serverPositionTicks - currentPositionTicks) / syncPlayHelper.TicksPerMillisecond;

        self.playbackDiffMillis = diffMillis;

        if (self.syncEnabled && self.enableSyncCorrection) {
            const absDiffMillis = Math.abs(diffMillis);
            // TODO: SpeedToSync sounds bad on songs
            // TODO: SpeedToSync is failing on Safari (Mojave); even if playbackRate is supported, some delay seems to exist
            // TODO: both SpeedToSync and SpeedToSync seem to have a hard time keeping up on Android Chrome as well
            if (self.playbackRateSupported && self.useSpeedToSync && absDiffMillis >= self.minDelaySpeedToSync && absDiffMillis < self.maxDelaySpeedToSync) {
                // Fix negative speed when client is ahead of time more than speedToSyncTime
                const MinSpeed = 0.1;
                if (diffMillis <= -speedToSyncTime * MinSpeed) {
                    speedToSyncTime = Math.abs(diffMillis) / (1.0 - MinSpeed);
                }

                // SpeedToSync method
                const speed = 1 + diffMillis / speedToSyncTime;

                if (speed <= 0) {
                    console.error('SyncPlay error: speed should not be negative!', speed, diffMillis, speedToSyncTime);
                }

                self.currentPlayer.setPlaybackRate(speed);
                self.syncEnabled = false;
                self.syncAttempts++;
                syncPlayManager.showSyncIcon(`SpeedToSync (x${speed.toFixed(2)})`);

                self.syncTimeout = setTimeout(() => {
                    if (syncPlayManager.isPlaybackActive()) {
                        self.currentPlayer.setPlaybackRate(1);
                    }
                    self.syncEnabled = true;
                    syncPlayManager.clearSyncIcon();
                }, speedToSyncTime);

                console.log('SyncPlay SpeedToSync', speed);
            } else if (self.useSkipToSync && absDiffMillis >= self.minDelaySkipToSync) {
                // SkipToSync method
                self.localSeek(serverPositionTicks);
                self.syncEnabled = false;
                self.syncAttempts++;
                syncPlayManager.showSyncIcon(`SkipToSync (${self.syncAttempts})`);

                self.syncTimeout = setTimeout(() => {
                    self.syncEnabled = true;
                    syncPlayManager.clearSyncIcon();
                }, syncMethodThreshold / 2);

                console.log('SyncPlay SkipToSync', serverPositionTicks);
            } else {
                // Playback is synced
                if (self.syncAttempts > 0) {
                    console.debug('Playback has been synced after', self.syncAttempts, 'attempts.');
                }
                self.syncAttempts = 0;
            }
        }
    }
}

export default SyncPlayPlaybackCore;
