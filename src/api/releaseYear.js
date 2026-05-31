import { getData, setData } from '../components/cache.js';

const SUPABASE_URL = "https://ulrkehvwehhakjzplutf.supabase.co/rest/v1/albums";
const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVscmtlaHZ3ZWhoYWtqenBsdXRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwOTg4MjUsImV4cCI6MjA5NTY3NDgyNX0.oEljz4cHVDzf6DW_20Xdautl2GOXz3LJQhd_6X2DFqo";
const INSERT_WORKER_URL = "https://album-release-post.ctalbot4.workers.dev/";
const WORKER_VERSION = 1;
const STORE = 'album-release-year-cache';

export const releaseYearCache = {};

const resultsBuffer = [];
const inFlight = new Set();
let totalSent = 0;

const worker = new Worker(new URL('./releaseYearWorker.js', import.meta.url), { type: 'module' });
worker.onmessage = ({ data }) => {
    if (data.type === 'result') saveResult(data.id, data.year, data.source);
};

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
    }

    const toEnqueue = missing.map(a => ({ ...a, priority: priorityKeys.has(`${a.artist}::${a.album}`) }));
    if (toEnqueue.length) worker.postMessage({ type: 'enqueue', albums: toEnqueue });

    //console.log(`[releaseYear] ${missing.length} queued, ${Object.keys(cached).length} total cached`);
    return cached;
}

async function saveResult(id, releaseYear, source) {
    releaseYear = parseInt(releaseYear, 10);
    setData(STORE, id, releaseYear);
    releaseYearCache[id] = releaseYear;
    const sep = id.indexOf('::');
    resultsBuffer.push({ artist: id.slice(0, sep), album: id.slice(sep + 2), release_year: releaseYear });
    //console.log(`[releaseYear] Found ${id} → ${releaseYear} via ${source} (${resultsBuffer.length} buffered)`);
    const threshold = totalSent < 100 ? 10 : 100;
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
