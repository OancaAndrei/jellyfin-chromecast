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

export function createConnectionManager(serverAddress, parentAccessToken, parentDeviceId, receiverName) {
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

    // Fork caster session.
    apiClient.forkSession(parentAccessToken, parentDeviceId);

    // Listen for messages.
    Events.on(apiClient, 'message', (event, message) => {
        broadcastToMessageBus({
            type: 'apiclient_message',
            message: message
        });
    });

    // Save globals.
    window.apiClient = apiClient;
    window.connectionManager = connectionManager;
}
