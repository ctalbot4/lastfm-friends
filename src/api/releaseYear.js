import { getData, setData } from '../components/cache.js';

const SUPABASE_URL = "https://ulrkehvwehhakjzplutf.supabase.co/rest/v1/albums";
const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVscmtlaHZ3ZWhoYWtqenBsdXRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwOTg4MjUsImV4cCI6MjA5NTY3NDgyNX0.oEljz4cHVDzf6DW_20Xdautl2GOXz3LJQhd_6X2DFqo";
const INSERT_WORKER_URL = "https://album-release-post.ctalbot4.workers.dev/";
const WORKER_VERSION = 1;
const STORE = 'album-release-year-cache';
const MB_SLEEP = 1100;    // 1 req/sec
const ITUNES_SLEEP = 3000; // 20 req/min

export const releaseYearCache = {};

const mbQueue = [];
const mbNameQueue = [];
const itunesQueue = [];
const resultsBuffer = [];
const inFlight = new Set();
let totalSent = 0;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function processMbQueue() {
    let useNameQueue = false;
    while (true) {
        const queue = (useNameQueue && mbNameQueue.length) ? mbNameQueue
                    : mbQueue.length ? mbQueue
                    : mbNameQueue.length ? mbNameQueue
                    : null;
        if (!queue) { await sleep(500); continue; }
        useNameQueue = !useNameQueue;

        const album = queue.shift();
        const id = `${album.artist}::${album.album}`;
        try {
            const fetch = album.searchByName
                ? fetchFromMusicBrainzByName(album.artist, album.album)
                : fetchFromMusicBrainz(album.mbid);
            const [year] = await Promise.all([fetch, sleep(MB_SLEEP)]);
            if (year) {
                await saveResult(id, year, album.searchByName ? 'MB-name' : 'MB');
            } else if (!album.searchByName) {
                itunesQueue.unshift(album);
            }
        } catch (e) {
            //console.warn(`[releaseYear] MB failed for ${id}:`, e.message);
            if (!album.searchByName) itunesQueue.unshift(album);
            await sleep(MB_SLEEP);
        }
    }
}

async function processItunesQueue() {
    while (true) {
        if (itunesQueue.length === 0) { await sleep(500); continue; }
        const album = itunesQueue.shift();
        const id = `${album.artist}::${album.album}`;
        try {
            const [year] = await Promise.all([fetchFromItunes(album.artist, album.album), sleep(ITUNES_SLEEP)]);
            if (year) await saveResult(id, year, 'iTunes');
            else mbNameQueue.unshift({ ...album, searchByName: true });
        } catch (e) {
            //console.warn(`[releaseYear] iTunes failed for ${id}:`, e.message);
            await sleep(ITUNES_SLEEP);
        }
    }
}


processMbQueue();
processItunesQueue();

export async function getAlbumReleaseYears(albums, priorityAlbums = []) {
    const allAlbums = [...priorityAlbums, ...albums];
    const priorityKeys = new Set(priorityAlbums.map(a => `${a.artist}::${a.album}`));

    const keys = allAlbums.map(a => `${a.artist}::${a.album}`);
    const idbResults = await Promise.all(keys.map(k => getData(STORE, k)));

    const cached = {};
    const idbMisses = [];

    for (let i = 0; i < allAlbums.length; i++) {
        if (idbResults[i] != null) {
            cached[keys[i]] = idbResults[i];
            releaseYearCache[keys[i]] = idbResults[i];
        } else {
            idbMisses.push(allAlbums[i]);
        }
    }

    const supabaseMisses = idbMisses.filter(a => !inFlight.has(`${a.artist}::${a.album}`));

    //console.log(`[releaseYear] ${Object.keys(cached).length}/${allAlbums.length} in IndexedDB, ${supabaseMisses.length} going to Supabase, ${idbMisses.length - supabaseMisses.length} skipped (already processed this session)`);

    if (supabaseMisses.length > 0) {
        try {
            const CHUNK_SIZE = 100;
            const chunks = [];
            for (let i = 0; i < supabaseMisses.length; i += CHUNK_SIZE) {
                chunks.push(supabaseMisses.slice(i, i + CHUNK_SIZE));
            }

            const pgQuote = s => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
            const responses = await Promise.all(chunks.map(chunk => {
                const orFilter = chunk.map(a => `and(artist.eq.${pgQuote(a.artist)},album.eq.${pgQuote(a.album)})`).join(',');
                const params = new URLSearchParams();
                params.set('or', `(${orFilter})`);
                return fetch(`${SUPABASE_URL}?${params.toString()}`, {
                    headers: { apikey: SUPABASE_ANON_KEY, Accept: "application/json" },
                    signal: AbortSignal.timeout(25000),
                });
            }));

            const rows = (await Promise.all(responses.filter(r => r.ok).map(r => r.json()))).flat();
            //console.log(`[releaseYear] Supabase returned ${rows.length}/${supabaseMisses.length} hit(s)`);
            for (const row of rows) {
                const key = `${row.artist}::${row.album}`;
                setData(STORE, key, row.release_year);
                cached[key] = row.release_year;
                releaseYearCache[key] = row.release_year;
            }
        } catch (e) {
            //console.warn('[releaseYear] Supabase fetch failed:', e);
        }
    }

    const missing = supabaseMisses.filter(a => !cached[`${a.artist}::${a.album}`]);
    for (const album of missing) {
        const key = `${album.artist}::${album.album}`;
        if (inFlight.has(key)) continue;
        inFlight.add(key);
        const isPriority = priorityKeys.has(key);
        if (album.mbid) {
            isPriority ? mbQueue.unshift(album) : mbQueue.push(album);
        } else {
            isPriority ? itunesQueue.unshift(album) : itunesQueue.push(album);
        }
    }

    //console.log(`[releaseYear] ${missing.length} queued (${mbQueue.length} MB, ${itunesQueue.length} iTunes), ${Object.keys(cached).length} total cached`);
    return cached;
}

const MB_HEADERS = { "User-Agent": "lastfmfriends/1.0", Accept: "application/json" };

async function fetchFromMusicBrainz(mbid) {
    const res = await fetch(`https://musicbrainz.org/ws/2/release/${mbid}?inc=release-groups&fmt=json`, {
        headers: MB_HEADERS,
    });
    if (res.status === 429 || res.status >= 500) throw new Error(`MB ${res.status}`);
    if (!res.ok) return null;
    const data = await res.json();
    const date = data["release-group"]?.["first-release-date"];
    return date ? date.split("-")[0] : null;
}

async function fetchFromMusicBrainzByName(artist, album) {
    const escape = s => s.replace(/"/g, '\\"');
    const query = encodeURIComponent(`artist:"${escape(artist)}" AND releasegroup:"${escape(album)}"`);
    const res = await fetch(`https://musicbrainz.org/ws/2/release-group?query=${query}&fmt=json`, {
        headers: MB_HEADERS,
    });
    if (res.status === 429 || res.status >= 500) throw new Error(`MB ${res.status}`);
    if (!res.ok) return null;
    const data = await res.json();
    const rg = data['release-groups']?.[0];
    return rg?.['first-release-date'] ? rg['first-release-date'].split('-')[0] : null;
}

async function fetchFromItunes(artist, album) {
    const artistWords = artist.toLowerCase().split(/\s+/);

    async function search(albumTitle) {
        const term = encodeURIComponent(`${artist} ${albumTitle}`);
        const res = await fetch(`https://itunes.apple.com/search?term=${term}&entity=album&limit=30`);
        if (res.status === 429 || res.status >= 500) throw new Error(`iTunes ${res.status}`);
        if (!res.ok) return { error: true };
        const data = await res.json();
        if (!data.results?.length) return { empty: true };
        const albumWords = albumTitle.toLowerCase().split(/\s+/);
        const match = data.results.find(r => {
            return artistWords.some(w => r.artistName.toLowerCase().includes(w)) &&
                   albumWords.some(w => r.collectionName.toLowerCase().includes(w));
        });
        return match ? new Date(match.releaseDate).getFullYear().toString() : { noMatch: true };
    }

    const result = await search(album);
    if ((result?.empty || result?.noMatch) && album.includes('(')) {
        const stripped = album.replace(/\(.*?\)/g, '').trim();
        const retry = await search(stripped);
        return typeof retry === 'string' ? retry : null;
    }
    return typeof result === 'string' ? result : null;
}

async function saveResult(id, releaseYear, source) {
    releaseYear = parseInt(releaseYear, 10);
    setData(STORE, id, releaseYear);
    releaseYearCache[id] = releaseYear;
    const sep = id.indexOf('::');
    resultsBuffer.push({ artist: id.slice(0, sep), album: id.slice(sep + 2), release_year: releaseYear });
    //console.log(`[releaseYear] Found ${id} → ${releaseYear} via ${source} (${resultsBuffer.length} buffered)`);
    const threshold = totalSent < 100 ? 25 : 150;
    if (resultsBuffer.length >= threshold) sendResultsToWorker();
}

export function sendResultsToWorker() {
    if (!resultsBuffer.length) return;
    const toSend = resultsBuffer.splice(0);
    totalSent += toSend.length;
    //console.log(`[releaseYear] Sending ${toSend.length} result(s) to worker (${totalSent} total sent)`);
    fetch(INSERT_WORKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ v: WORKER_VERSION, records: toSend }),
    }).catch(e => {
        //console.warn('[releaseYear] Insert worker failed:', e.message);
    });
}
