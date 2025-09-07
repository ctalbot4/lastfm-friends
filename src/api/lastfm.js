// State
import { store } from "../state/store.js";

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
    const data = await response.json();

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

export function getRecentTracks(user, key = store.keys.KEY, from, page = 1) {
    return callApi("user.getrecenttracks", {
        user,
        extended: 1,
        limit: 1000,
        from,
        page
    }, key);
}

export function getTrackInfo(user, key = store.keys.KEY, artist, track) {
    return callApi("track.getInfo", {
        username: user,
        artist,
        track
    }, key);
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

export function getTopTracks(user, key = store.keys.KEY, page = 1) {
    return callApi("user.gettoptracks", {
        user,
        limit: 1000,
        period: "7day",
        page
    }, key);
}