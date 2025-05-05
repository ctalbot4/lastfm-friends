import { store } from "../state/store.js";

const blockContainer = document.getElementById("block-container");

// Cache blocks
export function cacheBlocks() {
    try {
        localStorage.setItem(store.cacheKeys.blocks, blockContainer.innerHTML);
    } catch (e) {
        if (e instanceof DOMException && e.name === 'QuotaExceededError') {
            console.warn('LocalStorage quota exceeded. Clearing storage...');

            const scheduleData = localStorage.getItem(store.cacheKeys.schedule);
            const friendsData = localStorage.getItem(store.cacheKeys.friends);
            const tickerData = localStorage.getItem(store.cacheKeys.ticker);

            localStorage.clear();

            localStorage.setItem(store.cacheKeys.schedule, scheduleData);
            localStorage.setItem(store.cacheKeys.friends, friendsData);
            localStorage.setItem(store.cacheKeys.ticker, tickerData);
            localStorage.setItem(store.cacheKeys.blocks, blockContainer.innerHTML);
            localStorage.setItem("visited", true);
        }
    }
}

// Cache ticker, charts
export function cacheCharts() {

    const chartsDiv = document.querySelector(".charts-scrollable");
    const tickerDiv = document.querySelector(".ticker-stats");

    const tickerData = {
        charts: chartsDiv.innerHTML,
        ticker: tickerDiv.innerHTML
    }
    try {
        localStorage.setItem(store.cacheKeys.ticker, JSON.stringify(tickerData));
    } catch (e) {
        if (e instanceof DOMException && e.name === 'QuotaExceededError') {
            console.warn('LocalStorage quota exceeded. Clearing storage...');

            const scheduleData = localStorage.getItem(store.cacheKeys.schedule);
            const friendsData = localStorage.getItem(store.cacheKeys.friends);
            const blocksData = localStorage.getItem(store.cacheKeys.blocks);

            localStorage.clear();

            localStorage.setItem(store.cacheKeys.schedule, scheduleData);
            localStorage.setItem(store.cacheKeys.friends, friendsData);
            localStorage.setItem(store.cacheKeys.ticker, JSON.stringify(tickerData));
            localStorage.setItem(store.cacheKeys.blocks, blocksData);
            localStorage.setItem("visited", true);
        }
    }
}

export function cacheFriends(friends) {
    try {
            localStorage.setItem(store.cacheKeys.friends, JSON.stringify(friends));
        } catch (e) {
            if (e instanceof DOMException && e.name === 'QuotaExceededError') {
                console.warn('LocalStorage quota exceeded. Clearing storage...');

                const scheduleData = localStorage.getItem(store.cacheKeys.schedule);
                const tickerData = localStorage.getItem(store.cacheKeys.ticker);
                const blocksData = localStorage.getItem(store.cacheKeys.blocks);

                localStorage.clear();

                localStorage.setItem(store.cacheKeys.schedule, scheduleData);
                localStorage.setItem(store.cacheKeys.friends, JSON.stringify(friends));
                localStorage.setItem(store.cacheKeys.ticker, tickerData);
                localStorage.setItem(store.cacheKeys.blocks, blocksData);
                localStorage.setItem("visited", true);
            }
        }
}

