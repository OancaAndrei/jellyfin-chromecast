import {
    ApiClient,
    ConnectionManager,
    Credentials,
    Events
} from 'jellyfin-apiclient';
import {
    broadcastToMessageBus,
    cleanName
} from '../helpers';
import syncPlay from 'syncPlay';
import syncPlayLocalPlayer from './../components/syncPlay/ui/players/localPlayer';

export function forkSession(serverAddress, parentAccessToken, parentDeviceId, receiverName) {
    // Init connection manager.
    if (!window.connectionManager) {
        createConnectionManager(serverAddress, receiverName);
    }

    // Logout from old session.
    window.connectionManager.logout();

    // Disable SyncPlay.
    syncPlay.Manager.disableSyncPlay();

    // Fork caster session.
    window.apiClient.forkSession(parentAccessToken, parentDeviceId);
}

function createConnectionManager(serverAddress, receiverName) {
    const cleanReceiverName = cleanName(receiverName || '');

    const appName = window.deviceInfo.appName;
    const appVersion = window.deviceInfo.appVersion;
    const deviceId = window.deviceInfo.deviceId;
    const deviceName = cleanReceiverName || window.deviceInfo.deviceName;

    // TODO: get real capabilities.
    const capabilities = {
        PlayableMediaTypes: ['Audio', 'Video'],
        SupportedCommands: ['DisplayMessage'],
        SupportsPersistentIdentifier: true,
        SupportsMediaControl: true,
        SupportsSyncPlay: true
    };

    // Create singletons.
    const apiClient = new ApiClient(serverAddress, appName, appVersion, deviceName, deviceId);
    apiClient.enableAutomaticNetworking = false;
    apiClient.manualAddressOnly = true;

    const credentials = new Credentials();
    const connectionManager = new ConnectionManager(credentials, appName, appVersion, deviceName, deviceId, capabilities);

    // Wait for login event.
    Events.on(connectionManager, 'localusersignedin', (event, user, sessionInfo) => {
        broadcastToMessageBus({
            type: 'initdone',
            data: {
                user: user,
                sessionInfo: sessionInfo
            }
        });
    });

    // Register ApiClient.
    connectionManager.addApiClient(apiClient);

    // Save globals.
    window.apiClient = apiClient;
    window.connectionManager = connectionManager;

    try {
        initSyncPlay(apiClient, deviceName);
    } catch (error) {
        broadcastToMessageBus({
            type: 'error_message',
            message: error.message,
            stack: error.stack
        });
    }
}

function initSyncPlay(apiClient, deviceName) {
    // Register player wrappers.
    syncPlay.PlayerFactory.setDefaultWrapper(syncPlayLocalPlayer);

    // Set default value for some settings.
    syncPlay.Settings.set('webRTCDisplayName', deviceName);
    syncPlay.Settings.set('minDelaySkipToSync', 60000.0);
    syncPlay.Settings.set('useSpeedToSync', false);
    syncPlay.Settings.set('useSkipToSync', true);
    syncPlay.Settings.set('enableSyncCorrection', true);

    // Listen for messages.
    Events.on(apiClient, 'message', (event, message) => {
        broadcastToMessageBus({
            type: 'apiclient_message',
            message: message
        });

        try {
            if (message.MessageType === 'SyncPlayCommand') {
                console.log('SyncPlay', message.Data);
                syncPlay.Manager.processCommand(message.Data, apiClient);
            } else if (message.MessageType === 'SyncPlayGroupUpdate') {
                console.log('SyncPlay', message.Data);
                syncPlay.Manager.processGroupUpdate(message.Data, apiClient);
            }
        } catch (error) {
            broadcastToMessageBus({
                type: 'error_message',
                message: error.message,
                stack: error.stack
            });
        }
    });

    // Start SyncPlay.
    syncPlay.Manager.init(apiClient);
}
