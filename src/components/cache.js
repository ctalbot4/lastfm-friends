const dbName = 'lastfmfriends';
const dbVersion = 6;
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
            db.createObjectStore('schedule');
            db.createObjectStore('recent-tracks-cache');
            db.createObjectStore('top-tracks-cache');
            db.createObjectStore('track-info-cache');
            db.createObjectStore('artist-info-cache');
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

// Keep only the 1000 newest entries in a cache store
export async function cleanCache(storeName, maxEntries = 1000) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const getAllRequest = store.getAllKeys();
        
        getAllRequest.onsuccess = async () => {
            const allKeys = getAllRequest.result;
            
            if (allKeys.length <= maxEntries) {
                resolve();
                return;
            }
            
            // Get all entries with their timestamps
            const entries = [];
            for (const key of allKeys) {
                const value = await getData(storeName, key);
                if (value && value.timestamp) {
                    entries.push({ key, timestamp: value.timestamp });
                }
            }
            
            // Sort by timestamp
            entries.sort((a, b) => b.timestamp - a.timestamp);
            
            // Delete entries
            const keysToDelete = entries.slice(maxEntries).map(e => e.key);
            const deleteTransaction = db.transaction(storeName, 'readwrite');
            const deleteStore = deleteTransaction.objectStore(storeName);
            
            for (const key of keysToDelete) {
                deleteStore.delete(key);
            }
            
            deleteTransaction.oncomplete = () => resolve();
            deleteTransaction.onerror = () => reject(deleteTransaction.error);
        };
        
        getAllRequest.onerror = () => reject(getAllRequest.error);
    });
}