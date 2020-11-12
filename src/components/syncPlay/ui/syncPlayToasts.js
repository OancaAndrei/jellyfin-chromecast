/**
 * Module that notifies user about SyncPlay messages using toasts.
 * @module components/syncPlay/syncPlayToasts
 */

import events from 'events';
import toast from 'toast';
import globalize from 'globalize';
import syncPlay from 'syncPlay';

/**
 * Class that notifies user about SyncPlay messages using toasts.
 */
class SyncPlayToasts {
    constructor() {
        // Do nothing.
    }

    /**
     * Listens for messages to show.
     */
    init() {
        events.on(syncPlay.Manager, 'show-message', (event, data) => {
            const { message, args = [] } = data;
            toast({
                text: globalize.translate(message, ...args)
            });
        });
    }
}

/** SyncPlayToasts singleton. */
const syncPlayToasts = new SyncPlayToasts();
export default syncPlayToasts;
