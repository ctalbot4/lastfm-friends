// Cache
import { getData, setData, cleanCacheRandom } from '../components/cache.js';

// State
import { store, getKey } from '../state/store.js';

const SUPABASE_URL = "https://ulrkehvwehhakjzplutf.supabase.co/rest/v1/albums";
const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVscmtlaHZ3ZWhoYWtqenBsdXRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwOTg4MjUsImV4cCI6MjA5NTY3NDgyNX0.oEljz4cHVDzf6DW_20Xdautl2GOXz3LJQhd_6X2DFqo";


// --- Release Year ---

const RELEASE_YEAR_WORKER_URL = "https://album-release-post.ctalbot4.workers.dev/";
const RELEASE_YEAR_STORE = 'album-release-year-cache';

export const releaseYearCache = {};
const releaseYearBuffer = [];
const releaseYearInFlight = new Set();
let releaseYearTotalSent = 0;

const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
worker.onmessage = ({ data }) => {
    if (data.type === 'year-result') saveReleaseYearResult(data.id, data.year, data.source);
    else if (data.type === 'tags-result') saveArtistTagsResult(data.artist, data.tags);
};

export async function getAlbumReleaseYears(albums, priorityAlbums = []) {
    const allAlbums = [...priorityAlbums, ...albums];
    const priorityKeys = new Set(priorityAlbums.map(a => `${a.artist}::${a.album}`));

    cleanCacheRandom(RELEASE_YEAR_STORE, 25000);
    const keys = allAlbums.map(a => `${a.artist}::${a.album}`);
    const idbResults = await Promise.all(keys.map(k => getData(RELEASE_YEAR_STORE, k)));

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

    const supabaseMisses = idbMisses.filter(a => !releaseYearInFlight.has(`${a.artist}::${a.album}`));

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
                setData(RELEASE_YEAR_STORE, key, row.release_year);
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
        if (releaseYearInFlight.has(key)) continue;
        releaseYearInFlight.add(key);
    }

    const toEnqueue = missing.map(a => ({ ...a, priority: priorityKeys.has(`${a.artist}::${a.album}`) }));
    if (toEnqueue.length) worker.postMessage({ type: 'enqueue-albums', albums: toEnqueue });

    //console.log(`[releaseYear] ${missing.length} queued, ${Object.keys(cached).length} total cached`);
    return cached;
}

async function saveReleaseYearResult(id, releaseYear, source) {
    releaseYear = parseInt(releaseYear, 10);
    setData(RELEASE_YEAR_STORE, id, releaseYear);
    releaseYearCache[id] = releaseYear;
    const sep = id.indexOf('::');
    releaseYearBuffer.push({ artist: id.slice(0, sep), album: id.slice(sep + 2), release_year: releaseYear });
    //console.log(`[releaseYear] Found ${id} → ${releaseYear} via ${source} (${releaseYearBuffer.length} buffered)`);
    const threshold = releaseYearTotalSent < 100 ? 25 : 150;
    if (releaseYearBuffer.length >= threshold) sendReleaseYearToWorker();
}

export function sendReleaseYearToWorker() {
    if (!releaseYearBuffer.length) return;
    const toSend = releaseYearBuffer.splice(0);
    releaseYearTotalSent += toSend.length;
    //console.log(`[releaseYear] Sending ${toSend.length} result(s) to worker (${releaseYearTotalSent} total sent)`);
    fetch(RELEASE_YEAR_WORKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ v: 1, records: toSend }),
    }).catch(e => {
        //console.warn('[releaseYear] Insert worker failed:', e.message);
    });
}


// --- Artist Tags ---

const ARTIST_TAGS_WORKER_URL = "https://artist-genre-post.ctalbot4.workers.dev/";
const ARTIST_TAGS_STORE = 'artist-tags-cache';
const ARTIST_TAGS_EXPIRATION = 60 * 24 * 60 * 60 * 1000;

export const artistTagsCache = {};
const artistTagsBuffer = [];
const artistTagsInFlight = new Set();
let artistTagsTotalSent = 0;


export async function getArtistTags(artists) {
    if (!store.keys.KEY4) store.keys.KEY4 = await getKey(4);
    const now = Date.now();

    cleanCacheRandom(ARTIST_TAGS_STORE, 20000);
    const idbResults = await Promise.all(artists.map(a => getData(ARTIST_TAGS_STORE, a)));

    const cached = {};
    const idbMisses = [];

    for (let i = 0; i < artists.length; i++) {
        const entry = idbResults[i];
        if (entry && (now - entry.timestamp) < ARTIST_TAGS_EXPIRATION) {
            cached[artists[i]] = entry.tags;
            artistTagsCache[artists[i]] = entry.tags;
        } else {
            idbMisses.push(artists[i]);
        }
    }

    const supabaseMisses = idbMisses.filter(a => !artistTagsInFlight.has(a));

    //console.log(`[artistTags] ${Object.keys(cached).length}/${artists.length} in IDB, ${supabaseMisses.length} going to Supabase`);

    if (supabaseMisses.length > 0) {
        try {
            const CHUNK_SIZE = 100;
            const chunks = [];
            for (let i = 0; i < supabaseMisses.length; i += CHUNK_SIZE) {
                chunks.push(supabaseMisses.slice(i, i + CHUNK_SIZE));
            }

            const pgQuote = s => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
            const responses = await Promise.all(chunks.map(chunk => {
                const orFilter = chunk.map(a => `artist.eq.${pgQuote(a)}`).join(',');
                const params = new URLSearchParams();
                params.set('or', `(${orFilter})`);
                return fetch(`${SUPABASE_URL.replace('/albums', '/artist_tags')}?${params.toString()}`, {
                    headers: { apikey: SUPABASE_ANON_KEY, Accept: "application/json" },
                    signal: AbortSignal.timeout(25000),
                });
            }));

            const rows = (await Promise.all(responses.filter(r => r.ok).map(r => r.json()))).flat();
            //console.log(`[artistTags] Supabase returned ${rows.length}/${supabaseMisses.length} hit(s)`);
            for (const row of rows) {
                if ((now - new Date(row.cached_at).getTime()) < ARTIST_TAGS_EXPIRATION) {
                    setData(ARTIST_TAGS_STORE, row.artist, { tags: row.tags, timestamp: now });
                    cached[row.artist] = row.tags;
                    artistTagsCache[row.artist] = row.tags;
                }
            }
        } catch (e) {
            //console.warn('[artistTags] Supabase fetch failed:', e);
        }
    }

    const missing = supabaseMisses.filter(a => !cached[a]);
    for (const artist of missing) {
        if (artistTagsInFlight.has(artist)) continue;
        artistTagsInFlight.add(artist);
    }

    const toEnqueue = missing.map(a => ({ artist: a }));
    if (toEnqueue.length) worker.postMessage({ type: 'enqueue-tags', artists: toEnqueue, key: store.keys.KEY4 });

    //console.log(`[artistTags] ${missing.length} queued, ${Object.keys(cached).length} total cached`);
    return cached;
}

async function saveArtistTagsResult(artist, tags) {
    setData(ARTIST_TAGS_STORE, artist, { tags, timestamp: Date.now() });
    artistTagsCache[artist] = tags;
    artistTagsBuffer.push({ artist, tags });
    //console.log(`[artistTags] Found ${artist} → [${tags.join(', ')}] (${artistTagsBuffer.length} buffered)`);
    const threshold = artistTagsTotalSent < 100 ? 25 : 200;
    if (artistTagsBuffer.length >= threshold) sendArtistTagsToWorker();
}

export function sendArtistTagsToWorker() {
    if (!artistTagsBuffer.length) return;
    const toSend = artistTagsBuffer.splice(0);
    artistTagsTotalSent += toSend.length;
    //console.log(`[artistTags] Sending ${toSend.length} result(s) to worker (${artistTagsTotalSent} total sent)`);
    fetch(ARTIST_TAGS_WORKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ v: 1, records: toSend }),
    }).catch(() => {});
}