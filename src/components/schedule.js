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
    const now = Date.now();
    const blocksDelay = store.updateTimers.blocks.lastUpdate + store.updateTimers.blocks.interval - now;
    const chartsDelay = store.updateTimers.charts.lastUpdate + store.updateTimers.charts.interval - now;

    // Clear any other timeouts
    cancelUpdates();

    // Schedule blocks update
    if (blocksDelay <= 0) {
        await updateAllBlocks();
        store.updateTimers.blocks.timeoutId = setTimeout(scheduleUpdates, store.updateTimers.blocks.interval);
    } else {
        store.updateTimers.blocks.timeoutId = setTimeout(scheduleUpdates, blocksDelay);
    }

    // Schedule charts update
    if (chartsDelay <= 0) {
        await updateCharts();
        store.updateTimers.charts.timeoutId = setTimeout(scheduleUpdates, store.updateTimers.charts.interval);
    } else {
        store.updateTimers.charts.timeoutId = setTimeout(scheduleUpdates, chartsDelay);
    }

    const scheduleData = {
        blocks: store.updateTimers.blocks.lastUpdate,
        charts: store.updateTimers.charts.lastUpdate
    }
    setData('schedule', store.username, scheduleData);
}

export function cancelUpdates() {
    if (store.updateTimers.blocks.timeoutId) {
        clearTimeout(store.updateTimers.blocks.timeoutId);
    }
    if (store.updateTimers.charts.timeoutId) {
        clearTimeout(store.updateTimers.charts.timeoutId);
    }
}