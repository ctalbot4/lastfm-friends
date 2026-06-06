// --- Release Year (MusicBrainz, iTunes) ---

const MB_SLEEP = 1100;
const ITUNES_SLEEP = 3000;
const MB_HEADERS = { "User-Agent": "lastfmfriends/1.0", Accept: "application/json" };

const mbQueue = [];
const mbNameQueue = [];
const itunesQueue = [];

// --- Artist Tags (Last.fm) ---

const TAGS_SLEEP = 250;
const TAGS_SLEEP_ERROR = 2000;
const LASTFM_BASE = "https://ws.audioscrobbler.com/2.0/";

const tagsQueue = [];
let tagsApiKey = null;

const sleep = ms => new Promise(r => setTimeout(r, ms));

self.onmessage = ({ data }) => {
    if (data.type === 'enqueue-albums') {
        for (const album of data.albums) {
            if (album.mbid) {
                album.priority ? mbQueue.unshift(album) : mbQueue.push(album);
            } else {
                album.priority ? itunesQueue.unshift(album) : itunesQueue.push(album);
            }
        }
        console.log(`[releaseYear] Queue: ${mbQueue.length} MB, ${itunesQueue.length} iTunes`);
    } else if (data.type === 'enqueue-tags') {
        if (data.key) tagsApiKey = data.key;
        for (const a of data.artists) tagsQueue.push(a);
    }
};

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
            const fetchFn = album.searchByName
                ? fetchFromMusicBrainzByName(album.artist, album.album)
                : fetchFromMusicBrainz(album.mbid);
            const [year] = await Promise.all([fetchFn, sleep(MB_SLEEP)]);
            if (year) {
                self.postMessage({ type: 'year-result', id, year: parseInt(year, 10), source: album.searchByName ? 'MB-name' : 'MB' });
            } else if (!album.searchByName) {
                itunesQueue.unshift(album);
            }
        } catch (e) {
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
            if (year) {
                self.postMessage({ type: 'year-result', id, year: parseInt(year, 10), source: 'iTunes' });
            } else {
                mbNameQueue.unshift({ ...album, searchByName: true });
            }
        } catch (e) {
            await sleep(ITUNES_SLEEP);
        }
    }
}

async function processTagsQueue() {
    while (true) {
        if (!tagsApiKey || tagsQueue.length === 0) { await sleep(500); continue; }

        const { artist } = tagsQueue.shift();
        try {
            const url = new URL(LASTFM_BASE);
            url.searchParams.set('method', 'artist.getInfo');
            url.searchParams.set('artist', artist);
            url.searchParams.set('api_key', tagsApiKey);
            url.searchParams.set('format', 'json');

            const [res] = await Promise.all([fetch(url.toString()), sleep(TAGS_SLEEP)]);
            if (res.status === 429 || res.status >= 500) {
                tagsQueue.unshift({ artist });
                await sleep(TAGS_SLEEP_ERROR);
                continue;
            }
            if (!res.ok) continue;

            const data = await res.json();
            const tags = data.artist?.tags?.tag?.slice(0, 3).map(t => t.name) ?? [];
            if (tags.length) self.postMessage({ type: 'tags-result', artist, tags });
        } catch (e) {
            tagsQueue.unshift({ artist });
            await sleep(TAGS_SLEEP_ERROR);
        }
    }
}

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

processMbQueue();
processItunesQueue();
processTagsQueue();
