// Cache
import { setData } from "./cache.js";

// Charts
import { calculateListeningTime } from "./charts/update.js";

// Blocks
import { updateAllBlocks } from "./blocks/update.js";

// State
import { store } from "../state/store.js";

// Schedule updates for blocks and listening
export async function scheduleUpdates() {
    // Prevent multiple simultaneous calls
    if (store.isScheduling) {
        return;
    }
    store.isScheduling = true;

    const now = Date.now();
    const blocksDelay = store.updateTimers.blocks.lastUpdate + store.updateTimers.blocks.interval - now;
    const listeningDelay = store.updateTimers.listening.lastUpdate + store.updateTimers.listening.interval - now;

    // Clear any other timeouts
    cancelUpdates();

    // Update blocks
    if (blocksDelay <= 0 && !store.isUpdatingBlocks) {
        await updateAllBlocks();
    }

    // Update listening
    if (listeningDelay <= 0 && !store.isUpdatingListening) {
        await calculateListeningTime();
    }

    // Schedule next update
    const nextBlocksTime = store.updateTimers.blocks.lastUpdate + store.updateTimers.blocks.interval;
    const nextListeningTime = store.updateTimers.listening.lastUpdate + store.updateTimers.listening.interval;
    const nextUpdateTime = Math.min(nextBlocksTime, nextListeningTime);
    const nextDelay = Math.max(1000, nextUpdateTime - Date.now());

    store.updateTimers.timeoutId = setTimeout(scheduleUpdates, nextDelay);

    const scheduleData = {
        blocks: store.updateTimers.blocks.lastUpdate,
        listening: store.updateTimers.listening.lastUpdate
    }
    setData('schedule', store.username, scheduleData);
    
    store.isScheduling = false;
}

export function cancelUpdates() {
    if (store.updateTimers.timeoutId) {
        clearTimeout(store.updateTimers.timeoutId);
    }
}