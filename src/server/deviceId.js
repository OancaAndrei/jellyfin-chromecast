import { AppStorage } from 'jellyfin-apiclient';

function escapeRegExp(str) {
    return str.replace(/([.*+?^=!:${}()|[\]/\\])/g, '\\$1');
}

function replaceAll(originalString, strReplace, strWith) {
    const strReplace2 = escapeRegExp(strReplace);
    const reg = new RegExp(strReplace2, 'ig');
    return originalString.replace(reg, strWith);
}

function generateDeviceId() {
    const { userAgent } = window.navigator;
    const keys = [];

    if (keys.push(userAgent), keys.push(new Date().getTime()), window.btoa) {
        const result = replaceAll(btoa(keys.join('|')), '=', '1');
        return result;
    }

    return new Date().getTime();
}

export function getDeviceId() {
    const key = 'deviceId';
    let deviceId = AppStorage.getItem(key);

    if (deviceId) {
        return deviceId;
    }

    deviceId = generateDeviceId()
    AppStorage.setItem(key, deviceId);

    return deviceId;
}
