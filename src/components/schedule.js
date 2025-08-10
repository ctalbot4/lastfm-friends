// Cache
import { setData } from "./cache.js";

// Charts
import { updateCharts } from "./charts/update.js";

// Blocks
import { updateAllBlocks } from "./blocks/update.js";

// State
import { store } from "../state/store.js";

// Schedule updates for blocks and charts
export async function scheduleUpdates() {
    // Prevent multiple simultaneous calls
    if (store.isScheduling) {
        return;
    }
    store.isScheduling = true;

    const now = Date.now();
    const blocksDelay = store.updateTimers.blocks.lastUpdate + store.updateTimers.blocks.interval - now;
    const chartsDelay = store.updateTimers.charts.lastUpdate + store.updateTimers.charts.interval - now;

    // Clear any other timeouts
    cancelUpdates();

    // Update blocks
    if (blocksDelay <= 0 && !store.isUpdatingBlocks) {
        await updateAllBlocks();
    }

    // Update charts
    if (chartsDelay <= 0 && !store.isUpdatingCharts) {
        await updateCharts();
    }

    // Schedule next update
    const nextBlocksTime = store.updateTimers.blocks.lastUpdate + store.updateTimers.blocks.interval;
    const nextChartsTime = store.updateTimers.charts.lastUpdate + store.updateTimers.charts.interval;
    const nextUpdateTime = Math.min(nextBlocksTime, nextChartsTime);
    const nextDelay = Math.max(1000, nextUpdateTime - Date.now());

    store.updateTimers.timeoutId = setTimeout(scheduleUpdates, nextDelay);

    const scheduleData = {
        blocks: store.updateTimers.blocks.lastUpdate,
        charts: store.updateTimers.charts.lastUpdate
    }
    setData('schedule', store.username, scheduleData);
    
    store.isScheduling = false;
}

export function cancelUpdates() {
    if (store.updateTimers.timeoutId) {
        clearTimeout(store.updateTimers.timeoutId);
    }
}