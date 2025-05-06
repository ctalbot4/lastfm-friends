// State
import { store } from "../state/store.js";

// Components
import { updateAllBlocks } from "./blocks/update.js";
import { updateTicker } from "./ticker/update.js";

// Schedule updates for blocks and ticker
export async function scheduleUpdates() {

        const now = Date.now();
        const blocksDelay = store.updateTimers.blocks.lastUpdate + store.updateTimers.blocks.interval - now;
        const tickerDelay = store.updateTimers.ticker.lastUpdate + store.updateTimers.ticker.interval - now;

        // Clear any other timeouts
        cancelUpdates();

        // Schedule blocks update
        if (blocksDelay <= 0) {
            await updateAllBlocks();
            store.updateTimers.blocks.timeoutId = setTimeout(scheduleUpdates, store.updateTimers.blocks.interval);
        } else {
            store.updateTimers.blocks.timeoutId = setTimeout(scheduleUpdates, blocksDelay);
        }

        // Schedule ticker update
        if (tickerDelay <= 0) {
            await updateTicker();
            store.updateTimers.ticker.timeoutId = setTimeout(scheduleUpdates, store.updateTimers.ticker.interval);
        } else {
            store.updateTimers.ticker.timeoutId = setTimeout(scheduleUpdates, tickerDelay);
        }

    const scheduleData = {
        blocks: store.updateTimers.blocks.lastUpdate,
        ticker: store.updateTimers.ticker.lastUpdate
    }
    localStorage.setItem(store.cacheKeys.schedule, JSON.stringify(scheduleData));
}

export function cancelUpdates() {
    if (store.updateTimers.blocks.timeoutId) {
        clearTimeout(store.updateTimers.blocks.timeoutId);
    }
    if (store.updateTimers.ticker.timeoutId) {
        clearTimeout(store.updateTimers.ticker.timeoutId);
    }
}