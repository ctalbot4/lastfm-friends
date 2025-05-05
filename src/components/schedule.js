// State
import { store } from "../state/store.js";

// Components
import { updateAllBlocks } from "./blocks/update.js";
import { updateTicker } from "./ticker/update.js";

// Schedule next ticker and block update
export async function scheduleUpdates() {
    // Cancel other timeouts because this will replace them
    cancelUpdates();

    const now = Date.now();

    // Calculate time when the next update should occur
    let nextBlockUpdateTime = store.updateTimers.blocks.lastUpdate + store.updateTimers.blocks.interval;
    let blocksDelay = nextBlockUpdateTime - now;

    if (blocksDelay <= 0) {
        await updateAllBlocks();

        // Schedule next update
        store.updateTimers.blocks.timeoutId = setTimeout(scheduleUpdates, store.updateTimers.blocks.interval);
    } else {
        store.updateTimers.blocks.timeoutId = setTimeout(scheduleUpdates, blocksDelay);
    }

    let nextTickerUpdateTime = store.updateTimers.ticker.lastUpdate + store.updateTimers.ticker.interval;
    let tickerDelay = nextTickerUpdateTime - now;

    if (tickerDelay <= 0) {
        await updateTicker();

        // Schedule next update
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
    clearTimeout(store.updateTimers.blocks.timeoutId);
    clearTimeout(store.updateTimers.ticker.timeoutId);
}