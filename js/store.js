export const store = {
    friendCount: 0,
    completed: 0,
    isScrolling: false,
    isFetchingListeners: false,
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
    cacheKeys: {
        friends: null,
        blocks: null,
        ticker: null,
        schedule: null
    }
}
  