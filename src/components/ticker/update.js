import { store } from '../../state/store.js';
import { updateProgress } from '../dashboard/progress.js';
import { createListItem } from './charts.js';
import { getJSONP } from '../../api/deezer.js';

async function fetchArtists(block, artistPlays, key = store.keys.KEY) {
    const username = block.dataset.username;
    const artistsUrl = `https://ws.audioscrobbler.com/2.0/?method=user.gettopartists&user=${username}&limit=100&period=7day&api_key=${key}&format=json`;
    return fetch(artistsUrl)
        .then((response) => {
            if (!response.ok) {
                throw new Error("Network error");
            }
            return response.json();
        })
        .then((data) => {
            data.topartists.artist.forEach(artist => {
                const plays = parseInt(artist.playcount);
                const cappedPlays = Math.min(plays, 800);
                const url = artist.url;
                if (artistPlays[artist.name]) {
                    artistPlays[artist.name].plays += plays;
                    artistPlays[artist.name].cappedPlays += cappedPlays;
                } else {
                    artistPlays[artist.name] = {
                        plays,
                        cappedPlays,
                        url,
                        userCount: 0,
                        users: {}
                    };
                }
                artistPlays[artist.name].users[username] = plays;
                artistPlays[artist.name].userCount++;
            });
            updateProgress();
        })
        .catch((error) => {
            console.error("Error fetching user artist data:", error);
        });
}

async function fetchAlbums(block, albumPlays, key = store.keys.KEY) {
    const username = block.dataset.username;
    const albumsUrl = `https://ws.audioscrobbler.com/2.0/?method=user.gettopalbums&user=${username}&limit=100&period=7day&api_key=${key}&format=json`;
    return fetch(albumsUrl)
        .then((response) => {
            if (!response.ok) {
                throw new Error("Network error");
            }
            return response.json();
        })
        .then((data) => {
            data.topalbums.album.forEach(album => {
                const plays = parseInt(album.playcount);
                const cappedPlays = Math.min(plays, 300);
                const url = album.url;
                const artist = album.artist.name;
                const albumName = album.name;

                const key = `${albumName}::${artist}`;
                if (albumPlays[key]) {
                    albumPlays[key].plays += plays;
                    albumPlays[key].cappedPlays += cappedPlays;
                } else {
                    albumPlays[key] = {
                        artist,
                        albumName,
                        plays,
                        cappedPlays,
                        url,
                        img: album.image[1]["#text"],
                        userCount: 0,
                        users: {}
                    };
                }
                albumPlays[key].users[username] = plays;
                albumPlays[key].userCount++;
            });
            updateProgress();
        })
        .catch((error) => {
            console.error("Error fetching user album data:", error);
        });
}

async function fetchTracks(block, trackPlays, key = store.keys.KEY) {
    const username = block.dataset.username;
    const tracksUrl = `https://ws.audioscrobbler.com/2.0/?method=user.gettoptracks&user=${username}&limit=100&period=7day&api_key=${key}&format=json`;
    return fetch(tracksUrl)
        .then((response) => {
            if (!response.ok) {
                throw new Error("Network error");
            }
            return response.json();
        })
        .then((data) => {
            data.toptracks.track.forEach(track => {
                const plays = parseInt(track.playcount);
                const cappedPlays = Math.min(plays, 30);
                const trackUrl = track.url;
                const artistUrl = track.artist.url;
                const artist = track.artist.name;
                const trackName = track.name;

                const key = `${trackName}::${artist}`;

                if (trackPlays[key]) {
                    trackPlays[key].plays += plays;
                    trackPlays[key].cappedPlays += cappedPlays;
                } else {
                    trackPlays[key] = {
                        artist,
                        trackName,
                        plays,
                        cappedPlays,
                        trackUrl,
                        artistUrl,
                        userCount: 0,
                        users: {}
                    };
                }
                trackPlays[key].users[username] = plays;
                trackPlays[key].userCount++;
            });
            updateProgress();
        })
        .catch((error) => {
            console.error("Error fetching user track data:", error);
        });
}

// Update ticker (other than now playing, plays)
export async function updateTicker() {
    const artistPlays = {};
    const albumPlays = {};
    const trackPlays = {};

    const blockContainer = document.getElementById("block-container");
    const blocks = blockContainer.getElementsByClassName("block");
    const blocksArr = Array.from(blocks);
    store.completed = 0;
    const chunks = [];

    chunks.push(blocksArr.slice(0, 250));
    const artistPromises = Array.from(chunks[0]).map(block => fetchArtists(block, artistPlays));
    const albumPromises = Array.from(chunks[0]).map(block => fetchAlbums(block, albumPlays));
    const trackPromises = Array.from(chunks[0]).map(block => fetchTracks(block, trackPlays));
    await Promise.all([...artistPromises, ...albumPromises, ...trackPromises]);

    // Fetch second chunk if necessary
    if (store.friendCount > 250) {
        await new Promise(resolve => setTimeout(resolve, 8000));

        chunks.push(blocksArr.slice(250, 500));
        const artistPromises = Array.from(chunks[1]).map(block => fetchArtists(block, artistPlays, store.keys.KEY2));
        const albumPromises = Array.from(chunks[1]).map(block => fetchAlbums(block, albumPlays, store.keys.KEY2));
        const trackPromises = Array.from(chunks[1]).map(block => fetchTracks(block, trackPlays, store.keys.KEY2));

        await Promise.all([...artistPromises, ...albumPromises, ...trackPromises]);
    }

    const sortedArtistPlays = Object.entries(artistPlays).sort((a, b) => (b[1].userCount * b[1].cappedPlays) - (a[1].userCount * a[1].cappedPlays));
    const sortedAlbumPlays = Object.entries(albumPlays).sort((a, b) => (b[1].userCount * b[1].cappedPlays) - (a[1].userCount * a[1].cappedPlays));
    const sortedTrackPlays = Object.entries(trackPlays).sort((a, b) => (b[1].userCount * b[1].cappedPlays) - (a[1].userCount * a[1].cappedPlays));

    document.querySelectorAll(".ticker-artist > .value > a").forEach(element => {
        element.innerText = sortedArtistPlays[0][0];
    });
    document.querySelectorAll(".ticker-artist > .subtext").forEach(element => {
        element.innerText = `(${sortedArtistPlays[0][1].plays} plays)`;
    });
    document.querySelectorAll(".ticker-artist > .value > a").forEach(element => {
        element.href = sortedArtistPlays[0][1].url;
    });

    document.querySelectorAll(".ticker-album > .value > a").forEach(element => {
        element.innerText = sortedAlbumPlays[0][1].albumName;
    });
    document.querySelectorAll(".ticker-album > .subtext").forEach(element => {
        element.innerText = `(${sortedAlbumPlays[0][1].plays} plays)`;
    });
    document.querySelectorAll(".ticker-album > .value > a").forEach(element => {
        element.href = sortedAlbumPlays[0][1].url;
    });

    document.querySelectorAll(".ticker-track > .value > a").forEach(element => {
        element.innerText = sortedTrackPlays[0][1].trackName;
    });
    document.querySelectorAll(".ticker-track> .subtext").forEach(element => {
        element.innerText = `(${sortedTrackPlays[0][1].plays} plays)`;
    });
    document.querySelectorAll(".ticker-track > .value > a").forEach(element => {
        element.href = sortedTrackPlays[0][1].trackUrl;
    });

    let artistsMax = 0;
    const artistsList = document.getElementById("artists-list");

    const artistChartPromises = sortedArtistPlays.slice(0, 9).map(async (artistData) => {
        const [artistName, artistInfo] = artistData;
        const artistUsers = Object.entries(artistInfo.users);
        artistUsers.sort((a, b) => b[1] - a[1]);

        artistsMax = Math.max(artistsMax, artistInfo.plays);

        const fetchUrl = `https://api.deezer.com/search/artist?q="${artistName}"&output=jsonp`;
        const imageUrl = (await getJSONP(fetchUrl)).data[0]?.picture;
        return {
            name: artistName,
            plays: artistInfo.plays,
            image: imageUrl,
            url: artistInfo.url,
            listeners: artistUsers.map(([username, plays]) => ({
                user: username,
                img: document.querySelector(`[data-username="${username}"] .profile-picture img`) ?
                    document.querySelector(`[data-username="${username}"] .profile-picture img`).src : "https://lastfm.freetls.fastly.net/i/u/avatar170s/818148bf682d429dc215c1705eb27b98.png",
                plays: plays,
                url: ``
            }))
        };
    });

    const artistResults = await Promise.all(artistChartPromises);
    artistsList.innerHTML = '';
    artistResults.forEach(data => {
        artistsList.appendChild(createListItem(data, artistsMax));
    });

    let albumsMax = 0;
    const albumsList = document.getElementById("albums-list");

    const albumChartPromises = sortedAlbumPlays.slice(0, 9).map(async (albumData) => {
        const [key, albumInfo] = albumData;
        const albumUsers = Object.entries(albumInfo.users);

        albumsMax = Math.max(albumsMax, albumInfo.plays);

        const sortedAlbumUsers = albumUsers.sort((a, b) => b[1] - a[1]);

        return {
            name: albumInfo.albumName,
            plays: albumInfo.plays,
            image: albumInfo.img,
            url: albumInfo.url,
            listeners: sortedAlbumUsers.map(([username, plays]) => ({
                user: username,
                img: document.querySelector(`[data-username="${username}"] .profile-picture img`) ?
                    document.querySelector(`[data-username="${username}"] .profile-picture img`).src : "https://lastfm.freetls.fastly.net/i/u/avatar170s/818148bf682d429dc215c1705eb27b98.png",
                plays: plays,
                url: ``
            }))
        };
    });

    const albumResults = await Promise.all(albumChartPromises);
    albumsList.innerHTML = '';
    albumResults.forEach(data => {
        albumsList.appendChild(createListItem(data, albumsMax));
    });

    let tracksMax = 0;
    const tracksList = document.getElementById("tracks-list");

    const trackChartPromises = sortedTrackPlays.slice(0, 9).map(async (trackData) => {
        const trackInfo = trackData[1];
        const trackUsers = Object.entries(trackInfo.users);

        tracksMax = Math.max(tracksMax, trackInfo.plays);

        const sortedTrackUsers = trackUsers.sort((a, b) => b[1] - a[1]);

        return {
            name: trackInfo.trackName,
            artist: trackInfo.artist,
            plays: trackInfo.plays,
            url: trackInfo.trackUrl,
            artistUrl: trackInfo.artistUrl,
            listeners: sortedTrackUsers.map(([username, plays]) => ({
                user: username,
                img: document.querySelector(`[data-username="${username}"] .profile-picture img`) ?
                    document.querySelector(`[data-username="${username}"] .profile-picture img`).src : "https://lastfm.freetls.fastly.net/i/u/avatar170s/818148bf682d429dc215c1705eb27b98.png",
                plays: plays,
                url: ``
            }))
        };
    });

    const trackResults = await Promise.all(trackChartPromises);
    tracksList.innerHTML = '';
    trackResults.forEach(data => {
        tracksList.appendChild(createListItem(data, tracksMax, true));
    });

    store.updateTimers.ticker.lastUpdate = Date.now();

    // Cache ticker and charts
    const chartsDiv = document.querySelector(".charts-scrollable");
    const tickerDiv = document.querySelector(".ticker-stats");

    const tickerData = {
        charts: chartsDiv.innerHTML,
        ticker: tickerDiv.innerHTML
    }
    try {
        localStorage.setItem(store.cacheKeys.ticker, JSON.stringify(tickerData));
    } catch (e) {
        if (e instanceof DOMException && e.name === 'QuotaExceededError') {
            console.warn('LocalStorage quota exceeded. Clearing storage...');

            const scheduleData = localStorage.getItem(store.cacheKeys.schedule);
            const friendsData = localStorage.getItem(store.cacheKeys.friends);
            const blocksData = localStorage.getItem(store.cacheKeys.blocks);

            localStorage.clear();

            localStorage.setItem(store.cacheKeys.schedule, scheduleData);
            localStorage.setItem(store.cacheKeys.friends, friendsData);
            localStorage.setItem(store.cacheKeys.ticker, JSON.stringify(tickerData));
            localStorage.setItem(store.cacheKeys.blocks, blocksData);
            localStorage.setItem("visited", true);
        }
    }

    console.log("Stats refreshed!");
}