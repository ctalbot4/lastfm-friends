// Blocks - Update
import { userPlayCounts } from "../../blocks/update.js";

// Charts
import { chartDataPerUser, sortedData } from "../update.js";

// Network
import { createNetworkGraph, updateNetworkGraph } from "./network.js";

export let pendingNetworkUpdate = false;
let networkData = { users: [], artists: [], links: [] };

// Process network data from user listening history
export function updateNetworkData() {
    const users = new Map();
    const artists = new Map();
    const links = [];
    const artistListeners = new Map();

    // Count total users
    const userCount = Object.keys(chartDataPerUser).length;
    
    // Process top artists
    if (sortedData.artists && sortedData.artists.length > 0) {
        const artistLimit = Math.min(Math.min(userCount * 4, sortedData.artists.length), 750);
        const topArtists = sortedData.artists.slice(0, artistLimit);
        topArtists.forEach(([artistName, artistInfo]) => {
            artists.set(artistName, {
                id: `artist-${artistName}`,
                name: artistName,
                type: 'artist',
                plays: artistInfo.cappedPlays,
                actualPlays: artistInfo.plays,
                userCount: artistInfo.userCount,
                url: artistInfo.url
            });
            artistListeners.set(artistName, []);
        });
    }

    // Process each user and create links
    Object.entries(chartDataPerUser).forEach(([username, userData]) => {
        let userTotalPlays = 0;
        const userArtistsList = [];
        
        // Get all user's artists
        const userArtistEntries = Object.entries(userData.artistPlays);
        
        // Create links for any artist with more than 1 play
        userArtistEntries.forEach(([artistName, artistData]) => {
            if (artists.has(artistName)) {
                // Create link if more than 1 play
                if (artistData.plays > 1) {
                    // Cap plays at 800 per artist
                    const plays = Math.min(artistData.plays, 800);
                    userTotalPlays += plays;
                    
                    links.push({
                        source: `user-${username}`,
                        target: `artist-${artistName}`,
                        plays: plays
                    });
                }
                
                // Track this user as a listener for artist
                artistListeners.get(artistName).push({
                    username: username,
                    plays: artistData.plays,
                    actualPlays: artistData.plays,
                });
                
                // Track this artist for user
                userArtistsList.push({
                    name: artistName,
                    plays: artistData.plays,
                    actualPlays: artistData.plays,
                });
            }
        });
        
        // Sort and get top 3 artists for this user
        userArtistsList.sort((a, b) => b.plays - a.plays);
        const topArtists = userArtistsList.slice(0, 3);
        
        const userBlock = document.querySelector(`[data-username="${username}"]`);
        const profilePic = userBlock?.querySelector('.profile-picture img')?.src || 
            "https://lastfm.freetls.fastly.net/i/u/avatar170s/818148bf682d429dc215c1705eb27b98.png";
        
        // Add user
        users.set(username, {
            id: `user-${username}`,
            name: username,
            type: 'user',
            plays: userTotalPlays,
            actualPlays: userPlayCounts[username],
            image: profilePic,
            topArtists: topArtists,
            artistCount: userArtistEntries.length
        });
    });
    
    // Add top listeners to artists
    artists.forEach((artistData, artistName) => {
        const listeners = artistListeners.get(artistName);
        listeners.sort((a, b) => b.plays - a.plays);
        artistData.topListeners = listeners.slice(0, 3);
    });

    networkData = {
        users: Array.from(users.values()),
        artists: Array.from(artists.values()),
        links: links
    };

    pendingNetworkUpdate = true;
}

// Update network visualization if possible
export function tryNetworkUpdate() {
    if (pendingNetworkUpdate &&
        !document.getElementById('charts').classList.contains('collapsed')) {
        const networkChart = document.querySelector('#network-chart svg');
        if (networkChart) {
            updateNetworkGraph(networkData);
        } else {
            createNetworkGraph(networkData);
        }
        pendingNetworkUpdate = false;
    }
}

export function getNetworkData() {
    return networkData;
}

