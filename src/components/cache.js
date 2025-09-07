// State
import { store } from "../state/store.js";

const blockContainer = document.getElementById("block-container");

const dbName = 'lastfmfriends';
const dbVersion = 4;
let db;

export function initCache() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, dbVersion);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            const stores = Array.from(db.objectStoreNames);
            for (const name of stores) {
                db.deleteObjectStore(name);
            }

            db.createObjectStore('blocks');
            db.createObjectStore('play-data');
            db.createObjectStore('sorted-data');
            db.createObjectStore('charts-html');
            db.createObjectStore('friends');
            db.createObjectStore('schedule');
            db.createObjectStore('listening');
        };
    });
}

export async function getData(storeName, key) {
    return new Promise(res => {
        const rq = db.transaction(storeName).objectStore(storeName).get(key);
        rq.onsuccess = () => res(rq.result);
    })
}

export function setData(storeName, key, value) {
    db.transaction(storeName, 'readwrite').objectStore(storeName).put(value, key);
}

// Cache blocks
export function cacheBlocks() {
    setData('blocks', store.username, blockContainer.innerHTML);
}

// Cache ticker, charts
export function cacheChartsHTML() {
    const tickerDiv = document.querySelector(".ticker-stats");
    const chartsDiv = document.querySelector(".charts-scrollable");

    const data = {
        charts: chartsDiv.innerHTML,
        ticker: tickerDiv.innerHTML
    };

    setData('charts-html', store.username, data);
}

// Cache sorted top artists, albums, tracks data
export function cacheSortedData(sortedData) {
    setData('sorted-data', store.username, sortedData);
}

// Cache all tracks and their info
export function cachePlays(trackPlays) {
    setData('play-data', store.username, trackPlays);
}

// Cache listening time and play count per user
export function cacheListening(userListeningTime, userPlayCounts) {
    const data = {
        listeningTime: userListeningTime,
        playCounts: userPlayCounts
    }
    setData('listening', store.username, data);
}

export function cacheFriends(friends) {
    const list = [];
    friends.forEach(friend => {
        list.push(friend.name);
    });
    setData('friends', store.username, list);
}

export async function getCachedBlocks() {
    try {
        return await getData('blocks', store.username);
    } catch (error) {
        console.error('Error getting cached blocks:', error);
        return null;
    }
}

export async function getCachedChartsHTML() {
    try {
        return await getData('charts-html', store.username);
    } catch (error) {
        console.error('Error getting cached charts HTML:', error);
        return null;
    }
}

export async function getCachedSortedData() {
    try {
        return await getData('sorted-data', store.username);
    } catch (error) {
        console.error('Error getting cached sorted data:', error);
        return null;
    }
}

export async function getCachedPlays() {
    try {
        return await getData('play-data', store.username);
    } catch (error) {
        console.error('Error getting play data:', error);
        return null;
    }
}

export async function getCachedListening() {

    try {
        return await getData('listening', store.username);
    } catch (error) {
        console.error('Error getting cached listening:', error);
        return null;
    }
}

export async function getCachedFriends() {
    try {
        return await getData('friends', store.username);
    } catch (error) {
        console.error('Error getting cached friends:', error);
        return null;
    }
}