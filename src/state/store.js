export const store = {
    username: null,
    friendCount: 0,
    completed: 0,
    isSoundOn: false,
    isScrolling: false,
    scrollTimeoutId: null,
    isFetchingListeners: false,
    isUpdatingBlocks: false,
    isUpdatingCharts: false,
    keys: {
        KEY: null,
        KEY2: null,
        KEY3: null
    },
    updateTimers: {
        blocks: {
            lastUpdate: 0,
            interval: 0,
            timeoutId: null
        },
        ticker: {
            lastUpdate: 0,
            interval: 0,
            timeoutId: null
        }
    },
    foundBlocksCache: false,
    foundTickerCache: false,
    cacheKeys: {
        friends: null,
        blocks: null,
        ticker: null,
        schedule: null
    }
}

// Check if touch screen to know which type of preview play to enable
store.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

// Get API key from backend
export async function getKey(n = 1) {
    let cachedKey;
    if (n == 1) {
        cachedKey = sessionStorage.getItem("lfl_key");
    } else if (n == 2) {
        cachedKey = sessionStorage.getItem("lfl_key2");
    } else if (n == 3) {
        cachedKey = sessionStorage.getItem("lfl_key3");
    }
    if (cachedKey) {
        return cachedKey;
    }
    let response;
    if (n < 3) {
        response = await fetch("https://api-fetch.ctalbot4.workers.dev/");
    } else {
        response = await fetch("https://api-fetch-secondary.ctalbot4.workers.dev/");
    }
    const data = await response.json();
    if (n == 1) {
        sessionStorage.setItem("lfl_key", data.key);
    } else if (n == 2) {
        sessionStorage.setItem("lfl_key2", data.key);
    } else if (n == 3) {
        sessionStorage.setItem("lfl_key3", data.key);
    }
    return data.key;
}