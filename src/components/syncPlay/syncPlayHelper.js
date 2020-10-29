/**
 * Module that offers some utility functions.
 * @module components/syncPlay/syncPlayHelper
 */

import events from 'events';

/**
 * Constants
 */
export const WaitForEventDefaultTimeout = 30000; // milliseconds
export const WaitForPlayerEventTimeout = 500; // milliseconds
export const TicksPerMillisecond = 10000.0;

/**
 * Waits for an event to be triggered on an object. An optional timeout can specified after which the promise is rejected.
 * @param {Object} emitter Object on which to listen for events.
 * @param {string} eventType Event name to listen for.
 * @param {number} timeout Time in milliseconds before rejecting promise if event does not trigger.
 * @param {Array} rejectEventTypes Event names to listen for and stop the waiting.
 * @returns {Promise} A promise that resolves when the event is triggered.
 */
export function waitForEventOnce(emitter, eventType, timeout, rejectEventTypes) {
    return new Promise((resolve, reject) => {
        let rejectTimeout;
        if (timeout) {
            rejectTimeout = setTimeout(() => {
                reject('Timed out.');
            }, timeout);
        }

        const clearAll = () => {
            events.off(emitter, eventType, callback);

            if (rejectTimeout) {
                clearTimeout(rejectTimeout);
            }

            if (Array.isArray(rejectEventTypes)) {
                rejectEventTypes.forEach(eventName => {
                    events.off(emitter, eventName, rejectCallback);
                });
            }
        };

        const callback = () => {
            clearAll();
            resolve(arguments);
        };

        const rejectCallback = (event) => {
            clearAll();
            reject(event.type);
        };

        events.on(emitter, eventType, callback);

        if (Array.isArray(rejectEventTypes)) {
            rejectEventTypes.forEach(eventName => {
                events.on(emitter, eventName, rejectCallback);
            });
        }
    });
}
