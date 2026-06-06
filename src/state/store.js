export const store = {
    username: null,
    friendCount: 0,
    completed: 0,
    isSoundOn: false,
    isScrolling: false,
    scrollTimeoutId: null,
    isFetchingListeners: false,
    isUpdatingBlocks: false,
    isUpdatingListening: false,
    tagsLoaded: false,
    releaseYearsLoaded: false,
    isScheduling: false,
    isAnimatingBars: false,
    keys: {
        KEY: null,
        KEY2: null,
        KEY3: null,
        KEY4: null
    },
    updateTimers: {
        blocks: {
            lastUpdate: 0,
            interval: 0
        },
        listening: {
            lastUpdate: 0,
            interval: 0
        },
        timeoutId: null
    },
}

// Check if touch screen to know which type of preview play to enable
store.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

// Get API key from backend
export async function getKey(n = 1) {
    const storageKey = ["lfl_key", "lfl_key2", "lfl_key3", "lfl_key4"][n - 1];
    const cachedKey = storageKey ? sessionStorage.getItem(storageKey) : null;
    if (cachedKey) return cachedKey;

    let response;
    if (n === 4) {
        response = await fetch("https://api-fetch-3.ctalbot4.workers.dev/");
    } else if (n === 3) {
        response = await fetch("https://api-fetch-secondary.ctalbot4.workers.dev/");
    } else {
        response = await fetch("https://api-fetch.ctalbot4.workers.dev/");
    }
    const data = await response.json();
    if (storageKey) sessionStorage.setItem(storageKey, data.key);
    return data.key;
}