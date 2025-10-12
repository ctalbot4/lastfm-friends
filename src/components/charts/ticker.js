// State
import { store } from "../../state/store.js";

// Blocks
import { userPlayCounts } from "../blocks/update.js";

// Charts
import { userListeningTime, chartDataPerUser, userStats, sortedData } from "../charts/update.js";

// Charts - Graphs
import { hourlyActivity, hourlyListeners, dailyActivity, dailyListeners } from "./graphs/data.js";

// Charts - Scatter
import { tempBuckets } from "./scatter/data.js";

export let tickerMessages = [];
let refreshTimeout = null;

// Helper function to format streak days
function formatStreakDays(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    function formatTime(date) {
        let hours = date.getHours();
        const ampm = hours >= 12 ? 'pm' : 'am';
        hours = hours % 12 || 12;
        return `${hours}${ampm}`;
    }
    
    const startDay = dayNames[start.getDay()];
    const startTime = formatTime(start);
    const endTime = formatTime(end);
    
    if (start.toDateString() === end.toDateString()) {
        // Same day
        if (start.getHours() === end.getHours()) {
            return `on ${startDay} at ${startTime}`;
        }
        return `on ${startDay} from ${startTime}–${endTime}`;
    }
    
    const endDay = dayNames[end.getDay()];
    return `from ${startDay} ${startTime} to ${endDay} ${endTime}`;
}

// Populate and start the ticker
export async function startTicker() {
    // Clear any existing refresh timeout
    if (refreshTimeout) {
        clearTimeout(refreshTimeout);
        refreshTimeout = null;
    }

    // Wait for chart data to finish updating
    if (store.isUpdatingBlocks || store.isUpdatingListening) {
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    generateTickerMessages();
    
    if (tickerMessages.length === 0) return;
    
    const tickerContent = document.getElementById('ticker-content');
    
    // Reset ticker
    tickerContent.style.animation = '';
    tickerContent.style.transform = 'translateX(' + window.innerWidth + 'px)';
    tickerContent.innerHTML = '';
    
    // Create ticker items
    tickerMessages.forEach(message => {
        const item = document.createElement('div');
        item.className = 'ticker-item';
        item.textContent = message;
        tickerContent.appendChild(item);
    });
    
    // Calculate animation based on content width
    setTimeout(() => {
        const contentWidth = tickerContent.scrollWidth + window.innerWidth;
        const pixelsPerSecond = 60; // Adjust this for speed (higher = faster)
        const duration = contentWidth / pixelsPerSecond;
        
        // Create keyframe animation with absolute pixel value
        const styleSheet = document.styleSheets[0];
        const keyframeName = 'scroll-ticker-dynamic';
        
        // Remove existing animation if it exists
        for (let i = styleSheet.cssRules.length - 1; i >= 0; i--) {
            if (styleSheet.cssRules[i].name === keyframeName) {
                styleSheet.deleteRule(i);
            }
        }
        
        // Add new animation with correct width
        const keyframes = `
            @keyframes ${keyframeName} {
                0% { transform: translateX(${window.innerWidth}px); }
                100% { transform: translateX(-${contentWidth}px); }
            }
        `;
        styleSheet.insertRule(keyframes, styleSheet.cssRules.length);
        
        // Apply animation
        tickerContent.style.animation = `${keyframeName} ${duration}s linear`;
                
        // Schedule refresh to happen exactly when animation completes
        refreshTimeout = setTimeout(() => {
            startTicker();
        }, duration * 1000);
    }, 100);
}

// Helper to pick random element from array
function random(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// Helper to get sorted users from artist/track info
function getSortedUsers(info) {
    return Object.entries(info.users).sort((a, b) => b[1] - a[1]);
}

// A bunch of message generators for ticker
const messageGenerators = {

    // Top artists
    topArtists: (data) => {
        const messages = [];
        const topArtists = data.artists.slice(0, 12);
        
        topArtists.forEach(([artistName, artistInfo], index) => {
            // Skip solo listeners, handled by soloListeners
            if (artistInfo.userCount === 1) return;
            
            const users = getSortedUsers(artistInfo);
            const [topUsername, topPlays] = users[0];
            const listenerCount = artistInfo.userCount;
            const percentage = Math.round((listenerCount / store.friendCount) * 100);
            const avgPlays = Math.round(artistInfo.plays / listenerCount);
            
            let addedMessage = false;
            
            // Priority 1: #1 artist
            if (index === 0 && artistInfo.plays >= 40) {
                if (percentage >= 80) {
                    messages.push(`${artistName} is the most popular artist this week: ${listenerCount}/${store.friendCount} friends played ${artistInfo.plays.toLocaleString()} times total`);
                } else if (percentage >= 40) {
                    messages.push(`${artistName} tops the charts with ${artistInfo.plays.toLocaleString()} plays from ${percentage}% of friends`);
                } else {
                    messages.push(`${artistName} tops the charts: ${listenerCount} friends played ${artistInfo.plays.toLocaleString()} times total`);
                }
            }
            
            // Prepare data if multiple listeners
            let secondUsername, secondPlays, otherPlays, margin, topPercentage, combined, duoRatio, duoOtherPlays, combinedPercentage;
            if (!addedMessage && listenerCount >= 2) {
                [secondUsername, secondPlays] = users[1];
                otherPlays = artistInfo.plays - topPlays;
                margin = topPlays - secondPlays;
                topPercentage = Math.round((topPlays / artistInfo.plays) * 100);
                combined = topPlays + secondPlays;
                duoRatio = Math.max(topPlays / secondPlays, secondPlays / topPlays);
                duoOtherPlays = artistInfo.plays - combined;
                combinedPercentage = Math.round((combined / artistInfo.plays) * 100);
            }
            
            // Tier 1
            if (listenerCount >= 2) {
                // One user played more than all others combined
                if (topPlays > otherPlays && otherPlays > topPlays / 2 && listenerCount > 2) {
                    messages.push(`${topUsername} played ${artistName} more than all other listeners combined (${topPlays} vs ${otherPlays})`);
                    addedMessage = true;
                }
                // Two users played more than all others combined
                else if (duoRatio < 4 && combined > duoOtherPlays && duoOtherPlays > combined / 2 && listenerCount > 2) {
                    messages.push(`${topUsername} and ${secondUsername} played ${artistName} more than all other listeners combined (${combined} vs ${duoOtherPlays})`);
                    addedMessage = true;
                }
                // Only 2 listeners
                else if (listenerCount === 2 && combined >= 20) {
                    messages.push(`${topUsername} and ${secondUsername} are the only listeners of ${artistName} (${combined} plays total)`);
                    addedMessage = true;
                }
            }
            
            // Tier 2
            if (!addedMessage && listenerCount >= 2) {
                // Single-user dominance
                if (topPercentage >= 50 && topPlays >= 25) {
                    if (secondPlays >= 5) {
                        messages.push(`${topUsername} is dominating ${artistName} plays with ${topPlays} (${margin} ahead of ${secondUsername})`);
                    } else {
                        messages.push(`${topUsername} is dominating ${artistName} plays with ${topPlays} (${topPercentage}% of all plays)`);
                    }
                    addedMessage = true;
                }
                // Neck-and-neck race accounting for significant portion
                else if (margin <= 4 && margin > 0 && topPlays >= 8 && combinedPercentage >= 50) {
                    messages.push(`${topUsername} (${topPlays}) and ${secondUsername} (${secondPlays}) are neck-and-neck on ${artistName}, accounting for ${combinedPercentage}% of plays`);
                    addedMessage = true;
                }
            }
            
            // Tier 3
            if (!addedMessage && listenerCount >= 2) {
                // High dominance (40-50%)
                if (topPercentage >= 40 && topPlays >= 25) {
                    if (secondPlays >= 5) {
                        messages.push(`${topUsername} is dominating ${artistName} plays with ${topPlays} (${margin} ahead of ${secondUsername})`);
                    } else {
                        messages.push(`${topUsername} is dominating ${artistName} plays with ${topPlays} (${topPercentage}% of all plays)`);
                    }
                    addedMessage = true;
                }
                // Significant margin with 2x multiplier
                else if (topPlays >= 2 * secondPlays && topPlays >= 20 && secondPlays >= 5) {
                    messages.push(`${topUsername} played ${artistName} twice as much as anyone else (${topPlays} plays)`);
                    addedMessage = true;
                }
                // Strong plays between two users
                else if (duoRatio < 3 && combinedPercentage >= 50 && index < 10) {
                    messages.push(`${topUsername} (${topPlays}) and ${secondUsername} (${secondPlays}) lead ${artistName} plays (${combinedPercentage}% of all plays)`);
                    addedMessage = true;
                }
                // Significant lead
                else if (margin >= 12 && topPlays >= 20 && secondPlays >= 5) {
                    messages.push(`${topUsername} leads ${artistName} plays with ${topPlays} (${margin} ahead of ${secondUsername})`);
                    addedMessage = true;
                }
            }
            
            // Tier 4
            if (!addedMessage && listenerCount >= 2) {
                // Competitive race
                if (margin <= 4 && margin > 0 && topPlays >= 6 && combinedPercentage >= 40) {
                    messages.push(`${topUsername} (${topPlays}) and ${secondUsername} (${secondPlays}) are neck-and-neck on ${artistName}, accounting for ${combinedPercentage}% of plays`);
                    addedMessage = true;
                }
                // Decent plays between two users
                else if (duoRatio < 4 && combinedPercentage >= 30 && index < 12) {
                    messages.push(`${topUsername} and ${secondUsername} lead ${artistName} plays with ${combined.toLocaleString()} combined`);
                    addedMessage = true;
                }
                // Decent lead
                else if (margin >= 10 && topPlays >= 18) {
                    if (secondPlays >= 5) {
                        messages.push(`${topUsername} leads ${artistName} plays with ${topPlays} (${margin} ahead of ${secondUsername})`);
                    } else {
                        messages.push(`${topUsername} leads ${artistName} plays with ${topPlays} (${topPercentage}% of all plays)`);
                    }
                    addedMessage = true;
                }
            }
            
            // Tier 5
            if (!addedMessage && percentage >= 60 && artistInfo.plays >= 20) {
                if (percentage >= 80) {
                    messages.push(`${artistName} is universally loved: ${listenerCount}/${store.friendCount} friends listened (${artistInfo.plays.toLocaleString()} total plays)`);
                } else {
                    messages.push(`${artistName} is a group favorite: ${percentage}% of friends listened ${avgPlays} times on average`);
                }
                addedMessage = true;
            }
            
            // Tier 6 - basic fallback
            if (!addedMessage && artistInfo.plays >= 15 && index < 5) {
                const templates = [
                    `${listenerCount}/${store.friendCount} friends played ${artistName} ${artistInfo.plays.toLocaleString()} times (${avgPlays} each on average)`,
                    `${artistName} has ${artistInfo.plays.toLocaleString()} plays from ${listenerCount} listener${listenerCount > 1 ? 's' : ''} (${avgPlays} per friend)`
                ];
                messages.push(random(templates));
            }
        });
        
        return messages.slice(0, 8);
    },

    // Top albums
    topAlbums: (data) => {
        const messages = [];
        const topAlbums = data.albums.slice(0, 2);
        
        topAlbums.forEach(([, albumInfo], index) => {
            if (albumInfo.plays < 10) return;
            
            const users = getSortedUsers(albumInfo);
            const [topUsername, topPlays] = users[0];
            const percentage = Math.round((topPlays / albumInfo.plays) * 100);
            const albumDisplay = `${albumInfo.albumName} by ${albumInfo.artist}`;
            
            if (index === 0) {
                const templates = [
                    `${albumInfo.artist}'s ${albumInfo.albumName} tops the charts with ${albumInfo.plays} plays across ${albumInfo.userCount} listener${albumInfo.userCount > 1 ? 's' : ''}`,
                    `${albumDisplay} is the top album with ${albumInfo.plays} plays across ${albumInfo.userCount} listener${albumInfo.userCount > 1 ? 's' : ''}`
                ];
                messages.push(random(templates));
            } else if (albumInfo.userCount >= 2) {
                messages.push(`${albumDisplay} has ${albumInfo.plays} plays from ${albumInfo.userCount} listener${albumInfo.userCount > 1 ? 's' : ''}`);
            }
        });
        
        return messages;
    },

    // Top tracks
    topTracks: (data) => {
        const messages = [];
        const topTracks = data.tracks.slice(0, 6);
        
        topTracks.forEach(([, trackInfo], index) => {
            if (trackInfo.plays < 10) return;
            
            const users = getSortedUsers(trackInfo);
            const [topUsername, topPlays] = users[0];
            const trackDisplay = `"${trackInfo.trackName}" by ${trackInfo.artist}`;
            
            // Top track overall
            if (index === 0) {
                if (trackInfo.userCount === 1) {
                    messages.push(`${trackDisplay} is the most-played track this week (${trackInfo.plays} plays by ${topUsername})`);
                } else {
                    const templates = [
                        `${trackDisplay} is the most-played track with ${trackInfo.plays} plays across ${trackInfo.userCount} listener${trackInfo.userCount > 1 ? 's' : ''}`,
                        `${trackInfo.artist}'s "${trackInfo.trackName}" is the most popular track with ${trackInfo.plays} plays across ${trackInfo.userCount} listener${trackInfo.userCount > 1 ? 's' : ''}`
                    ];
                    messages.push(random(templates));
                }
                return;
            }
            
            if (topPlays >= 8) {
                const otherPlays = trackInfo.plays - topPlays;
                
                if (trackInfo.userCount === 1) {
                    const templates = [
                        `${topUsername} is the only listener for ${trackDisplay} this week(${topPlays} plays)`,
                        `${topUsername} is the only friend listening to ${trackDisplay} (${topPlays} plays)`
                    ];
                    messages.push(random(templates));

                } else if (topPlays > otherPlays && otherPlays > topPlays / 2 && trackInfo.userCount > 2) {
                    messages.push(`${topUsername} played ${trackDisplay} more than all other friends combined (${topPlays} vs ${otherPlays})`);
                } else {
                    const templates = [
                        `${topUsername} put ${trackDisplay} on repeat (${topPlays} plays)`,
                        `Heavy rotation: ${topUsername} played ${trackDisplay} ${topPlays} times`,
                        `${topUsername} leads ${trackDisplay} plays with ${topPlays} of the ${trackInfo.plays} total`
                    ];
                    messages.push(random(templates));
                }
            } else if (trackInfo.userCount >= 2) {
                messages.push(`${trackDisplay} has ${trackInfo.plays} plays from ${trackInfo.userCount} listeners`);
            }
        });
        
        return messages.slice(0, 4);
    },
    

    // Combined track plays between users
    trackCombinedPlays: (data) => {
        const messages = [];
        const popularTracks = data.tracks.filter(([, info]) => info.userCount >= 2).slice(0, 15);
        
        popularTracks.forEach(([, trackInfo]) => {
            const users = getSortedUsers(trackInfo);
            const [user1Name, user1Plays] = users[0];
            const [user2Name, user2Plays] = users[1];
            const combined = user1Plays + user2Plays;
            const otherPlays = trackInfo.plays - combined;
            const combinedPercentage = Math.round((combined / trackInfo.plays) * 100);
            const trackDisplay = `"${trackInfo.trackName}" by ${trackInfo.artist}`;
            
            if (combined >= 12) {
                if (trackInfo.userCount === 2) {
                    messages.push(`${user1Name} and ${user2Name} are the only listeners of ${trackDisplay} (${combined} plays total)`);
                } else if (combined > otherPlays && otherPlays > combined / 2) {
                    messages.push(`${user1Name} and ${user2Name} played ${trackDisplay} more than all other listeners combined (${combined} vs ${otherPlays})`);
                } else if (combinedPercentage >= 50) {
                    messages.push(`${user1Name} (${user1Plays}) and ${user2Name} (${user2Plays}) are dominating ${trackDisplay} plays`);
                }
            }
        });
        
        return messages.slice(0, 5);
    },

    // Top listeners
    listeningTime: (data) => {
        const messages = [];
        const topListeners = data.listeners.slice(0, 3);
        
        topListeners.forEach(([username, seconds], index) => {
            const hours = Math.floor(seconds / 3600);
            if (hours < 2) return;
            
            const plays = data.userPlayCounts[username] || 0;
            
            if (index === 0) {
                const secondHours = topListeners[1] ? Math.floor(topListeners[1][1] / 3600) : 0;
                const margin = hours - secondHours;
                
                if (margin >= 2) {
                    messages.push(`${username} leads listening time with ${hours} hours (${margin} more than anyone else)`);
                } else {
                    const templates = [
                        `${username} leads listening time with ${hours} hours this week`,
                        `${username} listened the most this week with ${plays.toLocaleString()} plays (${hours} hours total)`
                    ];
                    messages.push(random(templates));
                }
            } else if (hours >= 3 && plays > 0) {
                messages.push(`${username} has logged ${hours} hours across ${plays.toLocaleString()} plays this week`);
            }
        });
        
        return messages;
    },
    
    // Listening streaks
    listeningStreaks: (data) => {
        const messages = [];
        const topStreaks = data['listening-streaks'].slice(0, 2);
        
        topStreaks.forEach((streak, index) => {
            const hours = Math.floor(streak.duration / 3600);
            const plays = streak.count;
            const when = formatStreakDays(streak.startDate, streak.endDate);
            
            if (index === 0) {
                messages.push(`${streak.username} had the longest listening session with ${plays} plays straight ${when}`);
            }
            else if (hours >= 1) {
                const templates = [
                    `${streak.username} had ${plays} plays straight over ${hours} hour${hours > 1 ? 's' : ''} ${when}`,
                    `${streak.username} had a ${hours}-hour listening session ${when} (${plays} plays)`
                ];
                messages.push(random(templates));
            }
        });
        
        return messages;
    },
    
    // Artist streaks
    artistStreaks: (data) => {
        const messages = [];
        const topStreaks = data['artist-streaks'].slice(0, 2).filter(s => s.count >= 8);
        
        topStreaks.forEach((streak) => {
            const when = formatStreakDays(streak.startDate, streak.endDate);
            const templates = [
                `${streak.username} binged ${streak.name} for ${streak.count} plays straight ${when}`,
                `${streak.username} had ${streak.count} consecutive ${streak.name} plays ${when}`,
                `${streak.username} played ${streak.name} ${streak.count} times in a row ${when}`
            ];
            messages.push(random(templates));
        });
        
        return messages;
    },
    
    // Album streaks
    albumStreaks: (data) => {
        const messages = [];
        const topStreaks = data['album-streaks'].slice(0, 2).filter(s => s.count >= 6);
        
        topStreaks.forEach((streak) => {
            const when = formatStreakDays(streak.startDate, streak.endDate);
            const templates = [
                `${streak.username} played ${streak.count} tracks from ${streak.name} by ${streak.artist} in a row ${when}`,
                `${streak.username} listened to ${streak.count} consecutive tracks from ${streak.name} by ${streak.artist} ${when}`
            ];
            messages.push(random(templates));
        });
        
        return messages;
    },

    // Track streaks
    trackStreaks: (data) => {
        const messages = [];
        const topStreaks = data['track-streaks'].slice(0, 3).filter(s => s.count >= 5);
        
        topStreaks.forEach((streak) => {
            const when = formatStreakDays(streak.startDate, streak.endDate);
            if (streak.count >= 8) {
                const templates = [
                    `${streak.username} played "${streak.name}" by ${streak.artist} ${streak.count} times in a row ${when}`,
                    `${streak.count} consecutive plays: ${streak.username} put "${streak.name}" by ${streak.artist} on repeat ${when.replace('on ', '')}`,
                    `${streak.username} replayed "${streak.name}" by ${streak.artist} ${streak.count} times straight ${when}`
                ];
                messages.push(random(templates));
            }
        });
        
        return messages;
    },
    
    // Artist variety and exploration
    uniqueArtists: (data) => {
        const messages = [];
        const topDiversity = data['unique-artists'].slice(0, 2);
        
        topDiversity.forEach(([username, stats], index) => {
            if (stats.totalArtists < 20) return;
            
            const plays = data.userPlayCounts[username] || 0;
            const avgPlays = plays > 0 ? (plays / stats.totalArtists).toFixed(1) : 0;
            
            if (index === 0) {
                const secondArtists = topDiversity[1] ? topDiversity[1][1].totalArtists : 0;
                const margin = stats.totalArtists - secondArtists;
                
                if (margin >= 20) {
                    messages.push(`${username} is exploring the most variety with ${stats.totalArtists.toLocaleString()} different artists (${margin} more than anyone else)`);
                } else {
                    const templates = [
                        `${username} is exploring the most variety with ${stats.totalArtists.toLocaleString()} different artists`,
                        `${username} listened to ${stats.totalArtists.toLocaleString()} different artists this week, more than anyone else`
                    ];
                    messages.push(random(templates));
                }
            } else if (avgPlays >= 3 && plays >= 50) {
                messages.push(`${username} played ${stats.totalArtists.toLocaleString()} different artists (${avgPlays} plays each on average)`);
            }
        });
        
        return messages;
    },
    
    uniqueTracks: (data) => {
        const messages = [];
        const topDiversity = data['unique-tracks'].slice(0, 2);
        
        topDiversity.forEach(([username, stats], index) => {
            if (stats.totalTracks < 20) return;
            
            const plays = data.userPlayCounts[username] || 0;
            const avgPlays = plays > 0 ? (plays / stats.totalTracks).toFixed(1) : 0;
            
            if (index === 0) {
                const secondTracks = topDiversity[1] ? topDiversity[1][1].totalTracks : 0;
                const margin = stats.totalTracks - secondTracks;
                
                if (margin >= 10) {
                    messages.push(`${username} explored the most songs with ${stats.totalTracks.toLocaleString()} different tracks (${margin} more than anyone else)`);
                } else {
                    const templates = [
                        `${username} explored the most songs with ${stats.totalTracks.toLocaleString()} different tracks`,
                        `${username} listened to ${stats.totalTracks.toLocaleString()} different tracks this week, more than anyone else`
                    ];
                    messages.push(random(templates));
                }
            } else if (avgPlays >= 3 && plays >= 50) {
                messages.push(`${username} played ${stats.totalTracks.toLocaleString()} different tracks (${avgPlays} plays each on average)`);
            }
        });
        
        return messages;
    },
    
    
    // One artist dominates a user's listening
    artistMonopoly: (data) => {
        const messages = [];
        
        Object.entries(data.chartDataPerUser).forEach(([username, userData]) => {
            const totalPlays = data.userPlayCounts[username];
            if (!totalPlays || totalPlays < 30) return;
            
            const artistsArray = Object.entries(userData.artistPlays).sort((a, b) => b[1].plays - a[1].plays);
            if (artistsArray.length === 0) return;
            
            const [artistName, artistData] = artistsArray[0];
            const artistPlays = artistData.plays;
            const percentage = Math.round((artistPlays / totalPlays) * 100);
            
            if (percentage >= 50 && artistPlays >= 20) {
                messages.push(`${username} played ${artistName} more than all other artists combined this week (${artistPlays} plays)`);
            } else if (percentage >= 30 && artistPlays >= 20) {
                const templates = [
                    `${artistName} is dominating ${username}'s week with ${artistPlays} plays (${percentage}% of their total)`,
                    `${username}'s listening is ${percentage}% ${artistName} (${artistPlays} of ${totalPlays} plays)`
                ];
                messages.push(random(templates));
            }
        });
        
        return messages.slice(0, 2);
    },

    // Identical top artists
    identicalTaste: (data) => {
        const messages = [];
        
        // Get top 3 artists for each user and check for matches
        const userTopArtists = Object.entries(data.chartDataPerUser).map(([username, userData]) => {
            const artists = Object.entries(userData.artistPlays)
                .sort((a, b) => b[1].plays - a[1].plays)
                .slice(0, 3)
                .map(([artistName]) => artistName);
            return { username, artists };
        }).filter(({ artists }) => artists.length >= 3);
        
        // Compare pairs
        for (let i = 0; i < userTopArtists.length; i++) {
            const { username: user1, artists: artists1 } = userTopArtists[i];
            
            for (let j = i + 1; j < userTopArtists.length; j++) {
                const { username: user2, artists: artists2 } = userTopArtists[j];
                
                // Check if top 3 artists are matches in order
                if (artists1.every((artist, index) => artist === artists2[index])) {
                    messages.push(`${user1} and ${user2} have the same top 3 artists this week: ${artists1.join(', ')}`);
                    return messages;
                }
            }
        }
        
        return messages;
    },
    
    // Artists with only one listener
    soloListeners: (data) => {
        const messages = [];
        const soloArtists = data.artists.slice(0, 100)
            .filter(([, info]) => info.userCount === 1 && info.plays >= 15)
            .slice(0, 5);
        
        soloArtists.forEach(([artistName, artistInfo]) => {
            const username = Object.keys(artistInfo.users)[0];
            const templates = [
                `${username} is the only listener of ${artistName} this week (${artistInfo.plays} plays)`,
                `${username} is the only friend listening to ${artistName} (${artistInfo.plays} plays)`
            ];
            messages.push(random(templates));
        });
        
        return messages.slice(0, 2);
    },

    // Most plays in a day per user
    peakListeningDays: (data) => {
        const messages = [];
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        
        // Find top user-day combinations
        const topStats = [];
        data.dailyListeners.forEach((dayMap, day) => {
            dayMap.forEach((plays, username) => {
                if (plays >= 10) {
                    topStats.push({ username, day, plays });
                }
            });
        });
        
        topStats.sort((a, b) => b.plays - a.plays);
        
        topStats.slice(0, 5).forEach(({ username, day, plays }) => {
            const percentage = Math.round((plays / data.dailyActivity[day]) * 100);
            const dayName = dayNames[day];
            
            if (percentage >= 50 && data.dailyActivity[day] >= 10) {
                messages.push(`${username} dominated ${dayName} with ${plays} plays (${percentage}% of all ${dayName} listening)`);
            } else if (plays >= 15) {
                messages.push(`${username} was very active on ${dayName} with ${plays} plays`);
            }
        });
        
        return messages.slice(0, 2);
    },
    
    // Most plays in an hour per user
    peakListeningHours: (data) => {
        const messages = [];
        
        // Helper to format hour
        const formatHour = (hour) => {
            if (hour === 0) return 'midnight';
            if (hour < 12) return `${hour}am`;
            if (hour === 12) return 'noon';
            return `${hour - 12}pm`;
        };
        
        // Find top user-hour combinations
        const topStats = [];
        data.hourlyListeners.forEach((hourMap, hour) => {
            hourMap.forEach((plays, username) => {
                if (plays >= 10) {
                    topStats.push({ username, hour, plays });
                }
            });
        });
        
        topStats.sort((a, b) => b.plays - a.plays);
        
        topStats.slice(0, 5).forEach(({ username, hour, plays }) => {
            const percentage = Math.round((plays / data.hourlyActivity[hour]) * 100);
            const hourName = formatHour(hour);
            
            if (percentage >= 50 && data.hourlyActivity[hour] >= 10) {
                messages.push(`${username} dominated the ${hourName} hour this week with ${plays} plays (${percentage}% of all ${hourName} listening)`);
            } else if (plays >= 15) {
                messages.push(`${username} was very active this week at the ${hourName} hour, totaling ${plays} plays`);
            }
        });
        
        return messages.slice(0, 2);
    },

    // Peak day in group
    peakCommunityDays: (data) => {
        const messages = [];
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        
        // Find day with most activity
        let peakDay = 0;
        let peakPlays = 0;
        data.dailyActivity.forEach((plays, day) => {
            if (plays > peakPlays) {
                peakPlays = plays;
                peakDay = day;
            }
        });
        
        if (peakPlays >= 20) {
            const uniqueListeners = data.dailyListeners[peakDay].size;
            messages.push(`${dayNames[peakDay]} was the peak listening day with ${peakPlays} plays from ${uniqueListeners} listeners`);
        }
        
        return messages;
    },

    // Peak hour in group
    peakCommunityHours: (data) => {
        const messages = [];
        
        // Helper to format hour
        const formatHour = (hour) => {
            if (hour === 0) return 'midnight';
            if (hour < 12) return `${hour}am`;
            if (hour === 12) return 'noon';
            return `${hour - 12}pm`;
        };
        
        // Find hour with most activity
        let peakHour = 0;
        let peakPlays = 0;
        data.hourlyActivity.forEach((plays, hour) => {
            if (plays > peakPlays) {
                peakPlays = plays;
                peakHour = hour;
            }
        });
        
        if (peakPlays >= 20) {
            const uniqueListeners = data.hourlyListeners[peakHour].size;
            messages.push(`${formatHour(peakHour)} was the peak listening hour with ${peakPlays} plays from ${uniqueListeners} listeners`);
        }
        
        return messages;
    },

    // Solo listening days
    soloListeningDays: (data) => {
        const messages = [];
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        
        // Find days where only one person was listening
        data.dailyListeners.forEach((dayMap, day) => {
            if (dayMap.size === 1) {
                const [username, plays] = dayMap.entries().next().value;
                
                if (plays >= 5) {
                    messages.push(`${username} was the only person listening on ${dayNames[day]} (${plays} plays)`);
                }
            }
        });
        
        return messages.slice(0, 1);
    },

    // Solo listening hours
    soloListeningHours: (data) => {
        const messages = [];
        
        // Helper to format hour
        const formatHour = (hour) => {
            if (hour === 0) return 'midnight';
            if (hour < 12) return `${hour}am`;
            if (hour === 12) return 'noon';
            return `${hour - 12}pm`;
        };
        
        // Find hours where only one person was listening
        data.hourlyListeners.forEach((hourMap, hour) => {
            if (hourMap.size === 1) {
                const [username, plays] = hourMap.entries().next().value;
                
                if (plays >= 3) {
                    messages.push(`${username} was the only person listening at ${formatHour(hour)} (${plays} plays)`);
                }
            }
        });
        
        return messages.slice(0, 1);
    },
    
    // Weekend vs weekday patterns
    weekendVsWeekday: (data) => {
        const messages = [];
        const weekendDays = [0, 6];
        
        const userActivity = {};
        
        // Count weekend and weekday activity
        data.dailyListeners.forEach((dayMap, day) => {
            const isWeekend = weekendDays.includes(day);
            dayMap.forEach((plays, username) => {
                if (!userActivity[username]) {
                    userActivity[username] = { weekend: 0, weekday: 0 };
                }
                if (isWeekend) {
                    userActivity[username].weekend += plays;
                } else {
                    userActivity[username].weekday += plays;
                }
            });
        });
        
        // Find users with significant differences
        Object.entries(userActivity).forEach(([username, { weekend, weekday }]) => {
            const total = weekend + weekday;
            if (total >= 20 && weekend / total < 0.2) {
                messages.push(`${username} is avoiding weekends: ${weekday} weekday plays vs ${weekend} weekend plays`);
            }
        });
        
        return messages.slice(0, 2);
    },

    // Quiet day
    quietDays: (data) => {
        const messages = [];
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        
        // Find day with least activity
        let quietDay = -1;
        let quietPlays = Infinity;
        data.dailyActivity.forEach((plays, day) => {
            if (plays > 0 && plays < quietPlays) {
                quietPlays = plays;
                quietDay = day;
            }
        });
        
        if (quietDay !== -1) {
            messages.push(`${dayNames[quietDay]} was the quietest day with only ${quietPlays} ${quietPlays === 1 ? 'play' : 'plays'}`);
        }
        
        return messages.slice(0, 1);
    },
    
    // Quiet hour
    quietHours: (data) => {
        const messages = [];
        
        // Helper to format hour
        const formatHour = (hour) => {
            if (hour === 0) return 'midnight';
            if (hour < 12) return `${hour}am`;
            if (hour === 12) return 'noon';
            return `${hour - 12}pm`;
        };
        
        // Find hour with least activity
        let quietHour = -1;
        let quietPlays = Infinity;
        data.hourlyActivity.forEach((plays, hour) => {
            if (plays > 0 && plays < quietPlays) {
                quietPlays = plays;
                quietHour = hour;
            }
        });
        
        if (quietHour !== -1) {
            messages.push(`${formatHour(quietHour)} is the quietest hour this week with only ${quietPlays} ${quietPlays === 1 ? 'play' : 'plays'}`);
        }
        
        return messages.slice(0, 1);
    },
    
    // Same song at the same time (same bucket)
    sameSongSameTime: (data) => {
        const messages = [];
        
        // Helper to format time
        const formatTime = (timestamp) => {
            const date = new Date(timestamp * 1000);
            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const dayName = dayNames[date.getDay()];
            
            let hour = date.getHours();
            const min = date.getMinutes();
            const ampm = hour >= 12 ? 'pm' : 'am';
            hour = hour % 12 || 12;
            
            return `${dayName} at ${hour}:${min.toString().padStart(2, '0')}${ampm}`;
        };
        
        // Look in each bucket
        for (const bucket of Object.values(data.scatterBuckets)) {
            if (bucket.length < 2) continue;
            
            // Group by track
            const trackGroups = new Map();
            bucket.forEach(play => {
                const trackKey = `${play.track}::${play.artist}`;
                if (!trackGroups.has(trackKey)) {
                    trackGroups.set(trackKey, []);
                }
                trackGroups.get(trackKey).push(play);
            });
            
            // Find tracks with multiple users
            for (const plays of trackGroups.values()) {
                if (plays.length < 2) continue;
                
                const uniqueUsers = [...new Set(plays.map(p => p.username))];
                if (uniqueUsers.length >= 2) {
                    const { username: user1, track, artist, timestamp } = plays[0];
                    const user2 = plays.find(p => p.username !== user1).username;
                    
                    messages.push(`${user1} and ${user2} both played "${track}" by ${artist} at the same time on ${formatTime(timestamp)}`);
                    
                    // Stop after 4 messages
                    if (messages.length >= 4) return messages;
                    break;
                }
            }
        }
        
        return messages;
    },

    // Total group statistics
    totalCommunityStats: (data) => {
        const messages = [];
        
        // Calculate totals from existing data
        const totalPlays = Object.values(data.userPlayCounts).reduce((sum, count) => sum + count, 0);
        const totalListeningTime = Object.values(data.userListeningTime).reduce((sum, seconds) => sum + seconds, 0);
        const totalArtists = data.artists.length;
        const totalTracks = data.tracks.length;
        const totalAlbums = data.albums.length;
        
        const totalHours = Math.floor(totalListeningTime / 3600);
        const avgPlaysPerPerson = Math.round(totalPlays / store.friendCount);
        
        if (totalPlays >= 50) {
            messages.push(`The group has played ${totalPlays.toLocaleString()} tracks across ${totalArtists.toLocaleString()} different artists this week`);
        }
        
        if (totalHours >= 1) {
            messages.push(`${store.friendCount} listeners logged ${totalHours.toLocaleString()} hours of music this week (${avgPlaysPerPerson} plays per friend on average)`);
        }
        
        if (totalTracks >= 50) {
            const avgTracksPerPerson = Math.round(totalTracks / store.friendCount);
            messages.push(`${totalTracks.toLocaleString()} unique tracks were played this week (${avgTracksPerPerson} per friend on average)`);
        }

        if (totalAlbums >= 50) {
            messages.push(`${totalAlbums.toLocaleString()} different albums were played this week by ${store.friendCount} friends`);
        }
        
        return messages.slice(0, 1);
    }
};

// Generate all ticker messages based on chart data
function generateTickerMessages() {
    tickerMessages = [];
    
    const data = {
        artists: sortedData.artists || [],
        albums: sortedData.albums || [],
        tracks: sortedData.tracks || [],
        listeners: sortedData.listeners || [],
        'unique-artists': sortedData['unique-artists'] || [],
        'unique-tracks': sortedData['unique-tracks'] || [],
        'artist-streaks': sortedData['artist-streaks'] || [],
        'album-streaks': sortedData['album-streaks'] || [],
        'track-streaks': sortedData['track-streaks'] || [],
        'listening-streaks': sortedData['listening-streaks'] || [],
        userStats: userStats,
        userListeningTime: userListeningTime,
        chartDataPerUser: chartDataPerUser,
        userPlayCounts: userPlayCounts || {},
        hourlyActivity: hourlyActivity || [],
        hourlyListeners: hourlyListeners || [],
        dailyActivity: dailyActivity || [],
        dailyListeners: dailyListeners || [],
        scatterBuckets: tempBuckets || {} // Use tempBuckets because buckets not always populated
    };
    
    // Generate messages from each generator
    Object.values(messageGenerators).forEach(generator => {
        const messages = generator(data);
        tickerMessages.push(...messages);
    });
    
    // Shuffle messages for variety
    tickerMessages = tickerMessages.sort(() => Math.random() - 0.5);
}