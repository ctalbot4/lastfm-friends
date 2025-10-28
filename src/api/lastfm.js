// State
import { store } from "../state/store.js";
import { getData, setData, cleanCache } from "../components/cache.js";

const API_BASE = "https://ws.audioscrobbler.com/2.0/";

async function callApi(method, params = {}, key = store.keys.KEY, retry = 0) {
    const url = new URL(API_BASE);
    url.searchParams.set("method", method);
    url.searchParams.set("api_key", key);
    url.searchParams.set("format", "json");
    Object.entries(params).forEach(([k, v]) => {
        url.searchParams.set(k, v);
    });

    const response = await fetch(url.toString());
    
    // Handle random HTML responses from Last.fm
    let data;
    try {
        data = await response.json();
    } catch (e) {
        if (retry < 3) {
            await new Promise(resolve => setTimeout(resolve, 500));
            return callApi(method, params, key, retry + 1);
        }
        const err = new Error(`Last.fm ${method} returned non-JSON response`);
        err.status = response.status;
        throw err;
    }

    if (!response.ok) {
        if (data.error) {
            // Retry up to 2 times if server error
            if (data.error == 8 && retry < 3) {
                await new Promise(resolve => setTimeout(resolve, 500));
                return callApi(method, params, key, retry + 1);
            } else if (data.error == 29) {
                gtag('event', 'rate_limit-general', {});
            }
            const err = new Error(data.message || `Last.fm ${method} error ${data.error}`);
            err.status = response.status;
            err.data = data;
            err.code = data.error;
            throw err;
        } else {
            const err = new Error(`Last.fm ${method} HTTP ${response.status}`);
            err.status = response.status;
            err.data = data;
            throw err;
        }
    }

    return data;
}

// Helpers
export function getFriends(user, key = store.keys.KEY, limit = 500) {
    return callApi("user.getfriends", {
        user,
        limit
    }, key);
}

export function getUserInfo(user, key = store.keys.KEY) {
    return callApi("user.getinfo", {
        user
    }, key);
}

export async function getRecentTracks(user, key = store.keys.KEY, from, page = 1) {
    const cacheKey = `${user}:${page}`;
    const cached = await getData('recent-tracks-cache', cacheKey);
    
    // Check cacbe
    if (cached && cached.timestamp) {
        const now = Date.now();
        const age = now - cached.timestamp;
        if (age < store.updateTimers.blocks.interval) {
            return cached.data;
        }
    }
    
    const data = await callApi("user.getrecenttracks", {
        user,
        extended: 1,
        limit: 1000,
        from,
        page
    }, key);
    
    // Cache response
    setData('recent-tracks-cache', cacheKey, {
        data: data,
        timestamp: Date.now()
    });
        
    // Keep only 1000 newest entries
    cleanCache('recent-tracks-cache', 1000);
    
    return data;
}

export async function getTrackInfo(user, key = store.keys.KEY, artist, track) {
    const cacheKey = `${user}:${artist}:${track}`;
    const cached = await getData('track-info-cache', cacheKey);
    
    // Check cacbe
    if (cached && cached.timestamp) {
        const now = Date.now();
        const age = now - cached.timestamp;
        if (age < store.updateTimers.listening.interval) {
            return cached.data;
        }
    }
    
    const data = await callApi("track.getInfo", {
        username: user,
        artist,
        track
    }, key);
    
    // Cache response
    setData('track-info-cache', cacheKey, {
        data: data,
        timestamp: Date.now()
    });
    
    // Keep only 1000 newest entries
    cleanCache('track-info-cache', 1000);
    
    return data;
}

export async function getArtistInfo(user, key = store.keys.KEY, artist) {
    const cacheKey = `${user}:${artist}`;
    const cached = await getData('artist-info-cache', cacheKey);
    
    // Check cache
    if (cached && cached.timestamp) {
        const now = Date.now();
        const age = now - cached.timestamp;
        if (age < store.updateTimers.listening.interval) {
            return cached.data;
        }
    }
    
    const data = await callApi("artist.getInfo", {
        username: user,
        artist
    }, key);
    
    // Cache response
    setData('artist-info-cache', cacheKey, {
        data: data,
        timestamp: Date.now()
    });
    
    // Keep only 1000 newest entries
    cleanCache('artist-info-cache', 1000);
    
    return data;
}

export function getTopArtists(user, key = store.keys.KEY) {
    return callApi("user.gettopartists", {
        user,
        limit: 1000,
        period: "7day"
    }, key);
}

export function getTopAlbums(user, key = store.keys.KEY) {
    return callApi("user.gettopalbums", {
        user,
        limit: 1000,
        period: "7day"
    }, key);
}

export async function getTopTracks(user, key = store.keys.KEY, page = 1) {
    const cacheKey = `${user}:${page}`;
    const cached = await getData('top-tracks-cache', cacheKey);
    
    // Check cacbe
    if (cached && cached.timestamp) {
        const now = Date.now();
        const age = now - cached.timestamp;
        if (age < store.updateTimers.listening.interval) {
            return cached.data;
        }
    }
    
    const data = await callApi("user.gettoptracks", {
        user,
        limit: 1000,
        period: "7day",
        page
    }, key);
    
    // Cache response
    setData('top-tracks-cache', cacheKey, {
        data: data,
        timestamp: Date.now()
    });
    
    // Keep only 1000 newest entries
    cleanCache('top-tracks-cache', 1000);
    
    return data;
}