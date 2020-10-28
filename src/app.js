import { getDeviceId } from './server/deviceId';
import "./components/maincontroller";

window.deviceInfo = {
    appName: 'Jellyfin Chromecast',
    appVersion: '4.0.0',
    deviceId: getDeviceId(),
    deviceName: 'Google Cast'
};

window.mediaElement = document.getElementById('video-player');

window.playlist = [];
window.currentPlaylistIndex = -1;
window.repeatMode = "RepeatNone";

// Global variable set by Webpack
if (!PRODUCTION) {
    cast.framework.CastReceiverContext.getInstance().setLoggerLevel(cast.framework.LoggerLevel.DEBUG);
} else {
    cast.framework.CastReceiverContext.getInstance().setLoggerLevel(cast.framework.LoggerLevel.NONE);
}
