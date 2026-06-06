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

// Metadata caches
import { releaseYearCache, artistTagsCache } from "../../api/metadata.js";

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

    // Wait for any active updates to finish
    while (store.isUpdatingBlocks || store.isUpdatingListening) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Wait for tag and release year initial fetches to complete
    const metaWaitStart = Date.now();
    while (!store.tagsLoaded || !store.releaseYearsLoaded) {
        if (Date.now() - metaWaitStart > 20000) break;
        await new Promise(resolve => setTimeout(resolve, 100));
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
                    const templates = [
                        `${artistName} tops the charts with ${artistInfo.plays.toLocaleString()} plays from ${listenerCount}/${store.friendCount} friends`,
                        `${artistName} leads the week with ${artistInfo.plays.toLocaleString()} plays from ${listenerCount}/${store.friendCount} friends`,
                        `${artistName} is the chart-topper: ${artistInfo.plays.toLocaleString()} plays from ${listenerCount}/${store.friendCount} friends`
                    ];
                    messages.push(random(templates));
                } else if (percentage >= 40) {
                    const templates = [
                        `${artistName} tops the charts with ${artistInfo.plays.toLocaleString()} plays from ${percentage}% of friends`,
                        `${artistName} leads the week with ${artistInfo.plays.toLocaleString()} plays from ${percentage}% of friends`,
                        `${artistName} is the chart-topper: ${artistInfo.plays.toLocaleString()} plays from ${percentage}% of friends`
                    ];
                    messages.push(random(templates));
                } else {
                    const templates = [
                        `${artistName} tops the charts: ${listenerCount} friends played ${artistInfo.plays.toLocaleString()} times total`,
                        `${artistName} leads the week: ${listenerCount} friends played ${artistInfo.plays.toLocaleString()} times total`,
                        `${artistName} is the most-played artist: ${listenerCount} friends played ${artistInfo.plays.toLocaleString()} times total`
                    ];
                    messages.push(random(templates));
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
                    const templates = [
                        `${topUsername} played ${artistName} more than all other listeners combined (${topPlays} vs ${otherPlays})`,
                        `${topUsername} is loving ${artistName}, outplaying all other listeners combined (${topPlays} vs ${otherPlays})`,
                        `${topUsername} outplayed everyone else on ${artistName} (${topPlays} vs ${otherPlays} combined)`
                    ];
                    messages.push(random(templates));
                    addedMessage = true;
                }
                // Two users played more than all others combined
                else if (duoRatio < 4 && combined > duoOtherPlays && duoOtherPlays > combined / 2 && listenerCount > 2) {
                    const templates = [
                        `${topUsername} and ${secondUsername} played ${artistName} more than all other listeners combined (${combined} vs ${duoOtherPlays})`,
                        `${topUsername} and ${secondUsername} are loving ${artistName}, outplaying all other listeners combined (${combined} vs ${duoOtherPlays})`,
                        `${topUsername} and ${secondUsername} outplayed everyone else on ${artistName} (${combined} vs ${duoOtherPlays} combined)`
                    ];
                    messages.push(random(templates));
                    addedMessage = true;
                }
                // Only 2 listeners
                else if (listenerCount === 2 && combined >= 20) {
                    const templates = [
                        `${topUsername} and ${secondUsername} are the only listeners of ${artistName} (${combined} plays total)`,
                        `${topUsername} and ${secondUsername} are the sole listeners of ${artistName} (${combined} plays total)`,
                        `${topUsername} and ${secondUsername} are the only ones listening to ${artistName} (${combined} plays total)`
                    ];
                    messages.push(random(templates));
                    addedMessage = true;
                }
            }
            
            // Tier 2
            if (!addedMessage && listenerCount >= 2) {
                // Single-user dominance
                if (topPercentage >= 60 && topPlays >= 25) {
                    if (secondPlays >= 5 && margin > 20) {
                        const templates = [
                            `${topUsername} is dominating ${artistName} plays with ${topPlays} (${margin} ahead of ${secondUsername})`,
                            `${topUsername} is way ahead in ${artistName} plays with ${topPlays} (${margin} ahead of ${secondUsername})`,
                            `${topUsername} is crushing ${artistName} plays with ${topPlays} (${margin} ahead of ${secondUsername})`
                        ];
                        messages.push(random(templates));
                    } else {
                        const templates = [
                            `${topUsername} is dominating ${artistName} plays with ${topPlays} (${topPercentage}% of all plays)`,
                            `${topUsername} is way ahead in ${artistName} plays with ${topPlays} (${topPercentage}% of all plays)`,
                            `${topUsername} is crushing ${artistName} plays with ${topPlays} (${topPercentage}% of all plays)`
                        ];
                        messages.push(random(templates));
                    }
                    addedMessage = true;
                }
                // Neck-and-neck race accounting for significant portion
                else if (margin <= 4 && margin > 0 && topPlays >= 8 && combinedPercentage >= 50) {
                    const templates = [
                        `${topUsername} (${topPlays}) and ${secondUsername} (${secondPlays}) are neck-and-neck on ${artistName}, accounting for ${combinedPercentage}% of plays`,
                        `${topUsername} (${topPlays}) and ${secondUsername} (${secondPlays}) are in a tight race on ${artistName}, accounting for ${combinedPercentage}% of plays`
                    ];
                    messages.push(random(templates));
                    addedMessage = true;
                }
            }
            
            // Tier 3
            if (!addedMessage && listenerCount >= 2) {
                // High dominance (40-60%)
                if (topPercentage >= 40 && topPlays >= 25) {
                    if (secondPlays >= 5 && margin > 20) {
                        const templates = [
                            `${topUsername} is dominating ${artistName} plays with ${topPlays} (${margin} ahead of ${secondUsername})`,
                            `${topUsername} is way ahead in ${artistName} plays with ${topPlays} (${margin} ahead of ${secondUsername})`,
                            `${topUsername} is crushing ${artistName} plays with ${topPlays} (${margin} ahead of ${secondUsername})`
                        ];
                        messages.push(random(templates));
                    } else {
                        const templates = [
                            `${topUsername} is dominating ${artistName} plays with ${topPlays} (${topPercentage}% of all plays)`,
                            `${topUsername} is way ahead in ${artistName} plays with ${topPlays} (${topPercentage}% of all plays)`,
                            `${topUsername} is crushing ${artistName} plays with ${topPlays} (${topPercentage}% of all plays)`
                        ];
                        messages.push(random(templates));
                    }
                    addedMessage = true;
                }
                // Significant margin with 2x multiplier
                else if (topPlays >= 2 * secondPlays && topPlays >= 20 && secondPlays >= 5) {
                    const templates = [
                        `${topUsername} played ${artistName} twice as much as anyone else (${topPlays} plays)`,
                        `${topUsername} doubled everyone else's ${artistName} plays (${topPlays} plays)`,
                        `${topUsername} has 2x more ${artistName} plays than anyone else (${topPlays} plays)`
                    ];
                    messages.push(random(templates));
                    addedMessage = true;
                }
                // Strong plays between two users
                else if (duoRatio < 3 && combinedPercentage >= 50 && index < 10) {
                    const templates = [
                        `${topUsername} (${topPlays}) and ${secondUsername} (${secondPlays}) lead ${artistName} plays (${combinedPercentage}% of all plays)`,
                        `${topUsername} (${topPlays}) and ${secondUsername} (${secondPlays}) are in front on ${artistName} plays (${combinedPercentage}% of all plays)`,
                        `${topUsername} (${topPlays}) and ${secondUsername} (${secondPlays}) are the top ${artistName} listeners (${combinedPercentage}% of all plays)`
                    ];
                    messages.push(random(templates));
                    addedMessage = true;
                }
                // Significant lead
                else if (margin >= 12 && topPlays >= 20 && secondPlays >= 5) {
                    const templates = [
                        `${topUsername} leads ${artistName} plays with ${topPlays} (${margin} ahead of ${secondUsername})`,
                        `${topUsername} is ahead in ${artistName} plays with ${topPlays} (${margin} ahead of ${secondUsername})`,
                        `${topUsername} is the top listener of ${artistName} with ${topPlays} plays (${margin} ahead of ${secondUsername})`
                    ];
                    messages.push(random(templates));
                    addedMessage = true;
                }
            }
            
            // Tier 4
            if (!addedMessage && listenerCount >= 2) {
                // Competitive race
                if (margin <= 4 && margin > 0 && topPlays >= 6 && combinedPercentage >= 40) {
                    const templates = [
                        `${topUsername} (${topPlays}) and ${secondUsername} (${secondPlays}) are neck-and-neck on ${artistName}, accounting for ${combinedPercentage}% of plays`,
                        `${topUsername} (${topPlays}) and ${secondUsername} (${secondPlays}) are in a tight race on ${artistName}, accounting for ${combinedPercentage}% of plays`
                    ];
                    messages.push(random(templates));
                    addedMessage = true;
                }
                // Decent plays between two users
                else if (duoRatio < 4 && combinedPercentage >= 30 && index < 12) {
                    const templates = [
                        `${topUsername} and ${secondUsername} lead ${artistName} plays with ${combined.toLocaleString()} combined`,
                        `${topUsername} and ${secondUsername} are the biggest listeners of ${artistName} with ${combined.toLocaleString()} combined`,
                        `${topUsername} and ${secondUsername} are the top ${artistName} listeners with ${combined.toLocaleString()} combined`
                    ];
                    messages.push(random(templates));
                    addedMessage = true;
                }
                // Decent lead
                else if (margin >= 10 && topPlays >= 18) {
                    if (secondPlays >= 5) {
                        const templates = [
                            `${topUsername} leads ${artistName} plays with ${topPlays} (${margin} ahead of ${secondUsername})`,
                            `${topUsername} is ahead in ${artistName} plays with ${topPlays} (${margin} ahead of ${secondUsername})`,
                            `${topUsername} is the top listener of ${artistName} with ${topPlays} plays (${margin} ahead of ${secondUsername})`
                        ];
                        messages.push(random(templates));
                    } else {
                        const templates = [
                            `${topUsername} leads ${artistName} plays with ${topPlays} (${topPercentage}% of all plays)`,
                            `${topUsername} is ahead in ${artistName} plays with ${topPlays} (${topPercentage}% of all plays)`,
                            `${topUsername} is the top listener of ${artistName} with ${topPlays} plays (${topPercentage}% of all plays)`
                        ];
                        messages.push(random(templates));
                    }
                    addedMessage = true;
                }
            }
            
            // Tier 5
            if (!addedMessage && percentage >= 60 && artistInfo.plays >= 20) {
                if (percentage >= 80) {
                    const templates = [
                        `${artistName} is universally loved: ${listenerCount}/${store.friendCount} friends listened (${artistInfo.plays.toLocaleString()} total plays)`,
                        `${artistName} is widely popular: ${listenerCount}/${store.friendCount} friends listened (${artistInfo.plays.toLocaleString()} total plays)`
                    ];
                    messages.push(random(templates));
                } else {
                    const templates = [
                        `${artistName} is a group favorite: ${percentage}% of friends listened ${avgPlays} times on average`,
                        `${artistName} is popular with the group: ${percentage}% of friends listened ${avgPlays} times on average`
                    ];
                    messages.push(random(templates));
                }
                addedMessage = true;
            }
            
            // Tier 6
            if (!addedMessage && artistInfo.plays >= 15 && index < 5 && listenerCount >= 2) {
                const templates = [
                    `${listenerCount}/${store.friendCount} friends played ${artistName} ${artistInfo.plays.toLocaleString()} times (${avgPlays} each on average)`,
                    `${artistName} has ${artistInfo.plays.toLocaleString()} plays from ${listenerCount} listener${listenerCount > 1 ? 's' : ''} (${avgPlays} per friend)`
                ];
                messages.push(random(templates));
            }

            // Tier 7 - basic fallback
            if (!addedMessage && artistInfo.plays >= 15 && index < 5) {
                const templates = [
                    `${listenerCount}/${store.friendCount} friends played ${artistName} ${artistInfo.plays.toLocaleString()} times`,
                    `${artistName} has ${artistInfo.plays.toLocaleString()} plays from ${listenerCount} listener${listenerCount > 1 ? 's' : ''}`
                ];
                messages.push(random(templates));
            }
        });
        
        return messages.slice(0, 8);
    },

    // Top albums
    topAlbums: (data) => {
        const messages = [];
        const topAlbums = data.albums.slice(0, 9);
        
        topAlbums.forEach(([, albumInfo], index) => {
            const users = getSortedUsers(albumInfo);
            const [topUsername, topPlays] = users[0];
            const listenerCount = albumInfo.userCount;
            const percentage = Math.round((listenerCount / store.friendCount) * 100);
            const avgPlays = Math.round(albumInfo.plays / listenerCount);
            const albumDisplay = `${albumInfo.albumName} by ${albumInfo.artist}`;
            
            let addedMessage = false;
            
            // Priority 1: #1 album
            if (index === 0 && albumInfo.plays >= 30) {
                if (percentage >= 80) {
                    const templates = [
                        `${albumDisplay} tops the album charts with ${albumInfo.plays.toLocaleString()} plays from ${listenerCount}/${store.friendCount} friends`,
                        `${albumDisplay} leads the week with ${albumInfo.plays.toLocaleString()} plays from ${listenerCount}/${store.friendCount} friends`,
                        `${albumInfo.artist}'s ${albumInfo.albumName} is the chart-topping album: ${albumInfo.plays.toLocaleString()} plays from ${listenerCount}/${store.friendCount} friends`
                    ];
                    messages.push(random(templates));
                } else if (percentage >= 40) {
                    const templates = [
                        `${albumDisplay} tops the album charts with ${albumInfo.plays.toLocaleString()} plays from ${percentage}% of friends`,
                        `${albumInfo.artist}'s ${albumInfo.albumName} leads the week with ${albumInfo.plays.toLocaleString()} plays from ${percentage}% of friends`,
                        `${albumDisplay} is the chart-topping album: ${albumInfo.plays.toLocaleString()} plays from ${percentage}% of friends`
                    ];
                    messages.push(random(templates));
                } else {
                    const templates = [
                        `${albumDisplay} tops the album charts: ${listenerCount} friends played it ${albumInfo.plays.toLocaleString()} times total`,
                        `${albumInfo.artist}'s ${albumInfo.albumName} leads the week: ${listenerCount} friends played it ${albumInfo.plays.toLocaleString()} times total`,
                        `${albumDisplay} is the most-played album: ${listenerCount} friends played it ${albumInfo.plays.toLocaleString()} times total`
                    ];
                    messages.push(random(templates));
                }
            }

            if (albumInfo.plays < 15) return;
            
            // Prepare data if multiple listeners
            let secondUsername, secondPlays, otherPlays, margin, topPercentage, combined, duoRatio, duoOtherPlays, combinedPercentage;
            if (!addedMessage && listenerCount >= 2) {
                [secondUsername, secondPlays] = users[1];
                otherPlays = albumInfo.plays - topPlays;
                margin = topPlays - secondPlays;
                topPercentage = Math.round((topPlays / albumInfo.plays) * 100);
                combined = topPlays + secondPlays;
                duoRatio = Math.max(topPlays / secondPlays, secondPlays / topPlays);
                duoOtherPlays = albumInfo.plays - combined;
                combinedPercentage = Math.round((combined / albumInfo.plays) * 100);
            }
            
            // Tier 1
            if (listenerCount >= 2) {
                // One user played more than all others combined
                if (topPlays > otherPlays && otherPlays > topPlays / 2 && listenerCount > 2) {
                    const templates = [
                        `${topUsername} played ${albumDisplay} more than all other listeners combined (${topPlays} vs ${otherPlays})`,
                        `${topUsername} is loving ${albumDisplay}, outplaying all other listeners combined (${topPlays} vs ${otherPlays})`,
                        `${topUsername} outplayed everyone else on ${albumDisplay} (${topPlays} vs ${otherPlays} combined)`,
                        `${topUsername} can't get enough of ${albumDisplay}, outplaying all other listeners combined (${topPlays} vs ${otherPlays})`
                    ];
                    messages.push(random(templates));
                    addedMessage = true;
                }
                // Two users played more than all others combined
                else if (duoRatio < 4 && combined > duoOtherPlays && duoOtherPlays > combined / 2 && listenerCount > 2) {
                    const templates = [
                        `${topUsername} and ${secondUsername} played ${albumDisplay} more than all other listeners combined (${combined} vs ${duoOtherPlays})`,
                        `${topUsername} and ${secondUsername} are loving ${albumDisplay}, outplaying all other listeners combined (${combined} vs ${duoOtherPlays})`,
                        `${topUsername} and ${secondUsername} outplayed everyone else on ${albumDisplay} (${combined} vs ${duoOtherPlays})`,
                        `${topUsername} and ${secondUsername} can't stop spinning ${albumDisplay}, outplaying all other listeners combined (${combined} vs ${duoOtherPlays})`
                    ];
                    messages.push(random(templates));
                    addedMessage = true;
                }
                // Only 2 listeners
                else if (listenerCount === 2 && combined >= 15) {
                    const templates = [
                        `${topUsername} and ${secondUsername} are the only listeners of ${albumDisplay} (${combined} plays total)`,
                        `${topUsername} and ${secondUsername} are the sole listeners of ${albumDisplay} (${combined} plays total)`,
                        `${topUsername} and ${secondUsername} are the only ones listening to ${albumDisplay} (${combined} plays total)`                    ];
                    messages.push(random(templates));
                    addedMessage = true;
                }
            }
            
            // Tier 2
            if (!addedMessage && listenerCount >= 2) {
                // Single-user dominance
                if (topPercentage >= 60 && topPlays >= 20) {
                    if (secondPlays >= 5 && margin > 15) {
                        const templates = [
                            `${topUsername} is dominating ${albumDisplay} plays with ${topPlays} (${margin} ahead of ${secondUsername})`,
                            `${topUsername} is way ahead in ${albumDisplay} plays with ${topPlays} (${margin} ahead of ${secondUsername})`,
                            `${topUsername} is crushing ${albumDisplay} plays with ${topPlays} (${margin} ahead of ${secondUsername})`,
                            `${topUsername} has ${albumDisplay} on heavy rotation with ${topPlays} plays (${margin} ahead of ${secondUsername})`
                        ];
                        messages.push(random(templates));
                    } else {
                        const templates = [
                            `${topUsername} is dominating ${albumDisplay} plays with ${topPlays} (${topPercentage}% of all plays)`,
                            `${topUsername} is way ahead in ${albumDisplay} plays with ${topPlays} (${topPercentage}% of all plays)`,
                            `${topUsername} is crushing ${albumDisplay} plays with ${topPlays} (${topPercentage}% of all plays)`,
                            `${topUsername} has ${albumDisplay} on heavy rotation: ${topPlays} plays (${topPercentage}% of all plays)`
                        ];
                        messages.push(random(templates));
                    }
                    addedMessage = true;
                }
                // Neck-and-neck race accounting for significant portion
                else if (margin <= 3 && margin > 0 && topPlays >= 8 && combinedPercentage >= 50) {
                    const templates = [
                        `${topUsername} (${topPlays}) and ${secondUsername} (${secondPlays}) are neck-and-neck on ${albumDisplay}, accounting for ${combinedPercentage}% of plays`,
                        `${topUsername} (${topPlays}) and ${secondUsername} (${secondPlays}) are in a tight race on ${albumDisplay}, accounting for ${combinedPercentage}% of plays`,
                        `${topUsername} (${topPlays}) and ${secondUsername} (${secondPlays}) are battling for the top spot on ${albumDisplay}, accounting for ${combinedPercentage}% of plays`
                    ];
                    messages.push(random(templates));
                    addedMessage = true;
                }
            }
            
            // Tier 3
            if (!addedMessage && listenerCount >= 2) {
                // High dominance (40-60%)
                if (topPercentage >= 40 && topPlays >= 20) {
                    if (secondPlays >= 5 && margin > 15) {
                        const templates = [
                            `${topUsername} is dominating ${albumDisplay} plays with ${topPlays} (${margin} ahead of ${secondUsername})`,
                            `${topUsername} is way ahead in ${albumDisplay} plays with ${topPlays} (${margin} ahead of ${secondUsername})`,
                            `${topUsername} leads ${albumDisplay} plays with ${topPlays} (${margin} ahead of ${secondUsername})`
                        ];
                        messages.push(random(templates));
                    } else {
                        const templates = [
                            `${topUsername} is dominating ${albumDisplay} plays with ${topPlays} (${topPercentage}% of all plays)`,
                            `${topUsername} is way ahead in ${albumDisplay} plays with ${topPlays} (${topPercentage}% of all plays)`,
                            `${topUsername} leads ${albumDisplay} plays with ${topPlays} (${topPercentage}% of all plays)`
                        ];
                        messages.push(random(templates));
                    }
                    addedMessage = true;
                }
                // Significant margin with 2x multiplier
                else if (topPlays >= 2 * secondPlays && topPlays >= 15 && secondPlays >= 5) {
                    const templates = [
                        `${topUsername} played ${albumDisplay} twice as much as anyone else (${topPlays} plays)`,
                        `${topUsername} doubled everyone else's ${albumDisplay} plays (${topPlays} plays)`,
                        `${topUsername} has 2x more ${albumDisplay} plays than anyone else (${topPlays} plays)`,
                        `${topUsername} spun ${albumDisplay} twice as much as anyone else (${topPlays} plays)`
                    ];
                    messages.push(random(templates));
                    addedMessage = true;
                }
                // Strong plays between two users
                else if (duoRatio < 3 && combinedPercentage >= 50 && index < 10) {
                    const templates = [
                        `${topUsername} (${topPlays}) and ${secondUsername} (${secondPlays}) lead ${albumDisplay} plays (${combinedPercentage}% of all plays)`,
                        `${topUsername} (${topPlays}) and ${secondUsername} (${secondPlays}) are in front on ${albumDisplay} plays (${combinedPercentage}% of all plays)`,
                        `${topUsername} (${topPlays}) and ${secondUsername} (${secondPlays}) are the top ${albumDisplay} listeners (${combinedPercentage}% of all plays)`,
                        `${topUsername} (${topPlays}) and ${secondUsername} (${secondPlays}) are dominating ${albumDisplay} plays (${combinedPercentage}% of all plays)`
                    ];
                    messages.push(random(templates));
                    addedMessage = true;
                }
                // Significant lead
                else if (margin >= 10 && topPlays >= 15 && secondPlays >= 5) {
                    const templates = [
                        `${topUsername} leads ${albumDisplay} plays with ${topPlays} (${margin} ahead of ${secondUsername})`,
                        `${topUsername} is ahead in ${albumDisplay} plays with ${topPlays} (${margin} ahead of ${secondUsername})`,
                        `${topUsername} is the top listener of ${albumDisplay} with ${topPlays} plays (${margin} ahead of ${secondUsername})`,
                        `${topUsername} is way ahead on ${albumDisplay} with ${topPlays} plays (${margin} ahead of ${secondUsername})`
                    ];
                    messages.push(random(templates));
                    addedMessage = true;
                }
            }
            
            // Tier 4
            if (!addedMessage && listenerCount >= 2) {
                // Competitive race
                if (margin <= 3 && margin > 0 && topPlays >= 6 && combinedPercentage >= 40) {
                    const templates = [
                        `${topUsername} (${topPlays}) and ${secondUsername} (${secondPlays}) are neck-and-neck on ${albumDisplay}, accounting for ${combinedPercentage}% of plays`,
                        `${topUsername} (${topPlays}) and ${secondUsername} (${secondPlays}) are in a tight race on ${albumDisplay}, accounting for ${combinedPercentage}% of plays`,
                        `${topUsername} (${topPlays}) and ${secondUsername} (${secondPlays}) are battling for the top on ${albumDisplay}, accounting for ${combinedPercentage}% of plays`
                    ];
                    messages.push(random(templates));
                    addedMessage = true;
                }
                // Decent plays between two users
                else if (duoRatio < 4 && combinedPercentage >= 30 && index < 12) {
                    const templates = [
                        `${topUsername} and ${secondUsername} lead ${albumDisplay} plays with ${combined} combined`,
                        `${topUsername} and ${secondUsername} are the biggest listeners of ${albumDisplay} with ${combined} combined`,
                        `${topUsername} and ${secondUsername} are the top ${albumDisplay} listeners with ${combined} combined`,
                        `${topUsername} and ${secondUsername} are dominating ${albumDisplay} with ${combined} combined plays`
                    ];
                    messages.push(random(templates));
                    addedMessage = true;
                }
                // Decent lead
                else if (margin >= 8 && topPlays >= 12) {
                    if (secondPlays >= 4) {
                        const templates = [
                            `${topUsername} leads ${albumDisplay} plays with ${topPlays} (${margin} ahead of ${secondUsername})`,
                            `${topUsername} is ahead in ${albumDisplay} plays with ${topPlays} (${margin} ahead of ${secondUsername})`,
                            `${topUsername} is the top listener of ${albumDisplay} with ${topPlays} plays (${margin} ahead of ${secondUsername})`
                        ];
                        messages.push(random(templates));
                    } else {
                        const templates = [
                            `${topUsername} leads ${albumDisplay} plays with ${topPlays} (${topPercentage}% of all plays)`,
                            `${topUsername} is ahead in ${albumDisplay} plays with ${topPlays} (${topPercentage}% of all plays)`,
                            `${topUsername} is the top listener of ${albumDisplay} with ${topPlays} plays (${topPercentage}% of all plays)`
                        ];
                        messages.push(random(templates));
                    }
                    addedMessage = true;
                }
            }
            
            // Tier 5
            if (!addedMessage && percentage >= 60 && albumInfo.plays >= 15) {
                if (percentage >= 80) {
                    const templates = [
                        `${albumDisplay} is universally loved: ${listenerCount}/${store.friendCount} friends listened (${albumInfo.plays.toLocaleString()} total plays)`,
                        `${albumDisplay} is widely popular: ${listenerCount}/${store.friendCount} friends listened (${albumInfo.plays.toLocaleString()} total plays)`,
                        `${albumInfo.artist}'s ${albumInfo.albumName} is a universal favorite: ${listenerCount}/${store.friendCount} friends listened (${albumInfo.plays.toLocaleString()} total plays)`
                    ];
                    messages.push(random(templates));
                } else {
                    const templates = [
                        `${albumDisplay} is a group favorite: ${percentage}% of friends listened ${avgPlays} times on average`,
                        `${albumDisplay} is popular with the group: ${percentage}% of friends listened ${avgPlays} times on average`,
                        `${albumInfo.artist}'s ${albumInfo.albumName} is a fan favorite: ${percentage}% of friends listened ${avgPlays} times on average`
                    ];
                    messages.push(random(templates));
                }
                addedMessage = true;
            }
            
            // Tier 6
            if (!addedMessage && albumInfo.plays >= 12 && index < 5 && listenerCount >= 2) {
                const templates = [
                    `${albumDisplay} has ${albumInfo.plays} plays from ${listenerCount} listener${listenerCount > 1 ? 's' : ''} (${avgPlays} per friend)`,
                    `${albumInfo.artist}'s ${albumInfo.albumName} got ${albumInfo.plays} plays from ${listenerCount} friend${listenerCount > 1 ? 's' : ''} (${avgPlays} per friend)`
                ];
                messages.push(random(templates));
            }

            // Tier 7 - basic fallback
            if (!addedMessage && albumInfo.plays >= 12 && index < 5) {
                const templates = [
                    `${albumDisplay} has ${albumInfo.plays} plays from ${listenerCount} listener${listenerCount > 1 ? 's' : ''}`,
                    `${albumInfo.artist}'s ${albumInfo.albumName} got ${albumInfo.plays} plays from ${listenerCount} friend${listenerCount > 1 ? 's' : ''}`
                ];
                messages.push(random(templates));
            }
        });
        
        return messages.slice(0, 8);
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
                    const templates = [
                        `${trackDisplay} is the most-played track this week (${trackInfo.plays} plays by ${topUsername})`,
                        `${trackDisplay} tops the charts this week (${trackInfo.plays} plays by ${topUsername})`,
                        `${trackDisplay} leads the week (${trackInfo.plays} plays by ${topUsername})`
                    ];
                    messages.push(random(templates));
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
                        `${topUsername} is the only listener for ${trackDisplay} this week (${topPlays} plays)`,
                        `${topUsername} is the only friend listening to ${trackDisplay} this week (${topPlays} plays)`
                    ];
                    messages.push(random(templates));

                } else if (topPlays > otherPlays && otherPlays > topPlays / 2 && trackInfo.userCount > 2) {
                    const templates = [
                        `${topUsername} played ${trackDisplay} more than all other friends combined (${topPlays} vs ${otherPlays})`,
                        `${topUsername} is loving ${trackDisplay}, outplaying all other friends combined (${topPlays} vs ${otherPlays})`,
                        `${topUsername} outplayed everyone else on ${trackDisplay} (${topPlays} vs ${otherPlays} combined)`
                    ];
                    messages.push(random(templates));
                } else {
                    const templates = [
                        `${topUsername} put ${trackDisplay} on repeat (${topPlays} plays)`,
                        `Heavy rotation: ${topUsername} played ${trackDisplay} ${topPlays} times this week`,
                        `${topUsername} leads ${trackDisplay} plays with ${topPlays} of the ${trackInfo.plays} total`
                    ];
                    messages.push(random(templates));
                }
            } else if (trackInfo.userCount >= 2) {
                const templates = [
                    `${trackDisplay} has ${trackInfo.plays} plays from ${trackInfo.userCount} listeners`,
                    `${trackDisplay} was played ${trackInfo.plays} times by ${trackInfo.userCount} listeners`,
                    `${trackDisplay} got ${trackInfo.plays} plays from ${trackInfo.userCount} listeners`
                ];
                messages.push(random(templates));
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
                    const templates = [
                        `${user1Name} and ${user2Name} are the only listeners of ${trackDisplay} (${combined} plays total)`,
                        `${user1Name} and ${user2Name} are the sole listeners of ${trackDisplay} (${combined} plays total)`
                    ];
                    messages.push(random(templates));
                } else if (combined > otherPlays && otherPlays > combined / 2) {
                    const templates = [
                        `${user1Name} and ${user2Name} played ${trackDisplay} more than all other listeners combined (${combined} vs ${otherPlays})`,
                        `${user1Name} and ${user2Name} are loving ${trackDisplay}, outplaying all other listeners combined (${combined} vs ${otherPlays})`,
                        `${user1Name} and ${user2Name} outplayed everyone else on ${trackDisplay} (${combined} vs ${otherPlays} combined)`
                    ];
                    messages.push(random(templates));
                } else if (combinedPercentage >= 50 && user2Plays >= 2) {
                    const templates = [
                        `${user1Name} (${user1Plays}) and ${user2Name} (${user2Plays}) are dominating ${trackDisplay} plays`,
                        `${user1Name} (${user1Plays}) and ${user2Name} (${user2Plays}) lead ${trackDisplay} plays`,
                        `${user1Name} (${user1Plays}) and ${user2Name} (${user2Plays}) are the top ${trackDisplay} listeners`
                    ];
                    messages.push(random(templates));
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
                
                if (margin >= 4) {
                    const templates = [
                        `${username} leads listening time with ${hours} hours (${margin} more than anyone else)`,
                        `${username} listened to the most this week with ${hours} hours (${margin} more than anyone else)`,
                        `${username} is the top listener with ${hours} hours (${margin} more than anyone else)`
                    ];
                    messages.push(random(templates));
                } else {
                    const templates = [
                        `${username} leads listening time with ${hours} hours this week`,
                        `${username} listened the most this week with ${plays.toLocaleString()} plays (${hours} hours total)`
                    ];
                    messages.push(random(templates));
                }
            } else if (hours >= 3 && plays > 0) {
                const templates = [
                    `${username} has logged ${hours} hours across ${plays.toLocaleString()} plays this week`,
                    `${username} spent ${hours} hours listening across ${plays.toLocaleString()} plays this week`,
                    `${username} racked up ${hours} hours of listening time with ${plays.toLocaleString()} plays this week`
                ];
                messages.push(random(templates));
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
                const templates = [
                    `${streak.username} had the longest listening session with ${plays} plays straight ${when}`,
                    `${streak.username} listened to the most music in one session with ${plays} plays straight ${when}`
                ];
                messages.push(random(templates));
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
                `${streak.username} listened to ${streak.count} consecutive tracks from ${streak.name} by ${streak.artist} ${when}`,
                `${streak.username} binged ${streak.count} tracks from ${streak.name} by ${streak.artist} straight ${when}`
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
            const trackDisplay = `"${streak.name}" by ${streak.artist}`;
            const when = formatStreakDays(streak.startDate, streak.endDate);
            if (streak.count >= 8) {
                const templates = [
                    `${streak.username} played ${trackDisplay} ${streak.count} times in a row ${when}`,
                    `${streak.count} consecutive plays: ${streak.username} put ${trackDisplay} on repeat ${when.replace(/^on /, '')}`,
                    `${streak.username} replayed ${trackDisplay} ${streak.count} times straight ${when}`,
                    `${streak.username} had ${trackDisplay} on repeat for ${streak.count} plays ${when}`,
                    `${streak.username} binged ${trackDisplay} ${streak.count} times in a row ${when}`
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
                    const templates = [
                        `${username} is exploring the most variety with ${stats.totalArtists.toLocaleString()} different artists (${margin} more than anyone else)`,
                        `${username} has the most diverse taste with ${stats.totalArtists.toLocaleString()} different artists (${margin} more than anyone else)`,
                        `${username} is the most adventurous listener with ${stats.totalArtists.toLocaleString()} different artists (${margin} more than anyone else)`
                    ];
                    messages.push(random(templates));
                } else {
                    const templates = [
                        `${username} is exploring the most variety with ${stats.totalArtists.toLocaleString()} different artists`,
                        `${username} listened to ${stats.totalArtists.toLocaleString()} different artists this week, more than anyone else`
                    ];
                    messages.push(random(templates));
                }
            } else if (avgPlays >= 3 && plays >= 50) {
                const templates = [
                    `${username} played ${stats.totalArtists.toLocaleString()} different artists (${avgPlays} plays each on average)`,
                    `${username} listened to ${stats.totalArtists.toLocaleString()} different artists (${avgPlays} plays each on average)`,
                    `${username} explored ${stats.totalArtists.toLocaleString()} different artists (${avgPlays} plays each on average)`
                ];
                messages.push(random(templates));
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
                
                if (margin >= 20) {
                    const templates = [
                        `${username} explored the most songs with ${stats.totalTracks.toLocaleString()} different tracks (${margin} more than anyone else)`,
                        `${username} has the biggest library with ${stats.totalTracks.toLocaleString()} different tracks played this week (${margin} more than anyone else)`,
                        `${username} listened to ${stats.totalTracks.toLocaleString()} different tracks this week (${margin} more than anyone else)`
                    ];
                    messages.push(random(templates));
                } else {
                    const templates = [
                        `${username} explored the most songs with ${stats.totalTracks.toLocaleString()} different tracks`,
                        `${username} listened to ${stats.totalTracks.toLocaleString()} different tracks this week, more than anyone else`
                    ];
                    messages.push(random(templates));
                }
            } else if (avgPlays >= 3 && plays >= 50) {
                const templates = [
                    `${username} played ${stats.totalTracks.toLocaleString()} different tracks (${avgPlays} plays each on average)`,
                    `${username} listened to ${stats.totalTracks.toLocaleString()} different tracks (${avgPlays} plays each on average)`,
                    `${username} explored ${stats.totalTracks.toLocaleString()} different tracks (${avgPlays} plays each on average)`
                ];
                messages.push(random(templates));
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
                const templates = [
                    `${username} played ${artistName} more than all other artists combined this week (${artistPlays} plays)`,
                    `${username} is obsessed with ${artistName}, playing them more than all other artists combined (${artistPlays} plays)`,
                    `${username} has ${artistName} on heavy rotation, beating all other artists combined (${artistPlays} plays)`
                ];
                messages.unshift(random(templates));
            } else if (percentage >= 30 && artistPlays >= 20) {
                const templates = [
                    `${artistName} is dominating ${username}'s week with ${artistPlays} plays (${percentage}% of their total)`,
                    `${username} is obsessed with ${artistName}, playing them ${artistPlays} times (${percentage}% of their total)`,
                    `${username}'s listening is ${percentage}% ${artistName} (${artistPlays} of ${totalPlays} plays)`
                ];
                messages.push(random(templates));
            }
        });
        
        return messages.sort(() => Math.random() - 0.5).slice(0, 3);
    },

    // One album dominates a user's listening
    albumMonopoly: (data) => {
        const messages = [];
        
        Object.entries(data.chartDataPerUser).forEach(([username, userData]) => {
            const totalPlays = data.userPlayCounts[username];
            if (!totalPlays || totalPlays < 25) return;
            
            const albumsArray = Object.entries(userData.albumPlays).sort((a, b) => b[1].plays - a[1].plays);
            if (albumsArray.length === 0) return;
            
            const [albumKey, albumData] = albumsArray[0];
            const albumPlays = albumData.plays;
            const percentage = Math.round((albumPlays / totalPlays) * 100);
            const albumDisplay = `${albumData.albumName} by ${albumData.artistName}`;
            
            if (percentage >= 30 && albumPlays >= 15) {
                const templates = [
                    `${username} can't stop playing ${albumDisplay} (${albumPlays} plays, ${percentage}% of their total)`,
                    `${username} is obsessed with ${albumDisplay}, playing it ${albumPlays} times (${percentage}% of their total)`,
                    `${username} has ${albumDisplay} on repeat: ${albumPlays} plays (${percentage}% of their total)`
                ];
                messages.push(random(templates));
            }
        });
        
        return messages.sort(() => Math.random() - 0.5).slice(0, 2);
    },

    // Identical top artists
    identicalTaste: (data) => {
        const messages = [];
        
        // Get top 2 artists for each user and check for matches
        const userTopArtists = Object.entries(data.chartDataPerUser).map(([username, userData]) => {
            const artists = Object.entries(userData.artistPlays)
                .sort((a, b) => b[1].plays - a[1].plays)
                .slice(0, 2)
                .map(([artistName]) => artistName);
            return { username, artists };
        }).filter(({ artists }) => artists.length >= 2);
        
        // Compare pairs
        for (let i = 0; i < userTopArtists.length; i++) {
            const { username: user1, artists: artists1 } = userTopArtists[i];
            
            for (let j = i + 1; j < userTopArtists.length; j++) {
                const { username: user2, artists: artists2 } = userTopArtists[j];
                
                // Check if top 2 artists are matches in order
                if (artists1.every((artist, index) => artist === artists2[index])) {
                    const templates = [
                        `${user1} and ${user2} have the same top 2 artists this week: ${artists1.join(', ')}`,
                        `${user1} and ${user2} share identical taste with the same top 2 artists: ${artists1.join(', ')}`
                    ];
                    messages.push(random(templates));
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
                `${username} is the only friend listening to ${artistName} (${artistInfo.plays} plays)`,
                `${username} is the sole fan of ${artistName} this week (${artistInfo.plays} plays)`
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
                const templates = [
                    `${username} was very active on ${dayName} with ${plays} plays`,
                    `${username} had a busy ${dayName} with ${plays} plays`,
                    `${username} was on fire ${dayName} with ${plays} plays`
                ];
                messages.push(random(templates));
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
                const templates = [
                    `${username} was very active this week at the ${hourName} hour, totaling ${plays} plays`,
                    `${username} had a busy ${hourName} hour this week, totaling ${plays} plays`,
                    `${username} was on fire at the ${hourName} hour this week, totaling ${plays} plays`
                ];
                messages.push(random(templates));
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
            const templates = [
                `${dayNames[peakDay]} was the peak listening day with ${peakPlays.toLocaleString()} plays from ${uniqueListeners} listeners`,
                `${dayNames[peakDay]} was the most active day with ${peakPlays.toLocaleString()} plays from ${uniqueListeners} listeners`,
                `${dayNames[peakDay]} was the busiest listening day with ${peakPlays.toLocaleString()} plays from ${uniqueListeners} listeners`
            ];
            messages.push(random(templates));
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
            const templates = [
                `${formatHour(peakHour)} was the peak listening hour with ${peakPlays.toLocaleString()} plays from ${uniqueListeners} listeners`,
                `${formatHour(peakHour)} was the most active hour with ${peakPlays.toLocaleString()} plays from ${uniqueListeners} listeners`,
                `${formatHour(peakHour)} was the busiest listening hour with ${peakPlays.toLocaleString()} plays from ${uniqueListeners} listeners`
            ];
            messages.push(random(templates));
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
                    const templates = [
                        `${username} was the only person listening on ${dayNames[day]} (${plays} plays)`,
                        `${username} was the sole listener on ${dayNames[day]} (${plays} plays)`
                    ];
                    messages.push(random(templates));
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
                    const templates = [
                        `${username} was the only person listening at ${formatHour(hour)} (${plays} plays)`,
                        `${username} was the sole listener at ${formatHour(hour)} (${plays} plays)`
                    ];
                    messages.push(random(templates));
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
                const templates = [
                    `${username} is avoiding weekends: ${weekday} weekday plays vs only ${weekend} weekend plays`,
                    `${username} prefers weekdays: ${weekday} weekday plays vs only ${weekend} weekend plays`
                ];
                messages.push(random(templates));
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
            const templates = [
                `${dayNames[quietDay]} was the quietest day with only ${quietPlays.toLocaleString()} ${quietPlays === 1 ? 'play' : 'plays'}`,
                `${dayNames[quietDay]} was the slowest day with only ${quietPlays.toLocaleString()} ${quietPlays === 1 ? 'play' : 'plays'}`,
                `${dayNames[quietDay]} was the calmest day with only ${quietPlays.toLocaleString()} ${quietPlays === 1 ? 'play' : 'plays'}`
            ];
            messages.push(random(templates));
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
            const templates = [
                `${formatHour(quietHour)} is the quietest hour this week with only ${quietPlays} ${quietPlays === 1 ? 'play' : 'plays'}`,
                `${formatHour(quietHour)} is the slowest hour this week with only ${quietPlays} ${quietPlays === 1 ? 'play' : 'plays'}`,
                `${formatHour(quietHour)} is the calmest hour this week with only ${quietPlays} ${quietPlays === 1 ? 'play' : 'plays'}`
            ];
            messages.push(random(templates));
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
                    const trackDisplay = `"${track}" by ${artist}`;
                    const templates = [
                        `${user1} and ${user2} both played ${trackDisplay} at the same time on ${formatTime(timestamp)}`,
                        `${user1} and ${user2} listened to ${trackDisplay} at the same time on ${formatTime(timestamp)}`
                    ];
                    messages.push(random(templates));
                    
                    // Stop after 6 messages
                    if (messages.length >= 6) return messages;
                    break;
                }
            }
        }
        
        return messages;
    },

    // Top 3 genres group-wide
    topGenre: (data) => {
        const messages = [];
        if (!data.tags.length) return messages;

        data.tags.slice(0, 3).forEach(([tagName, tagInfo], index) => {
            if (tagInfo.plays < 20) return;
            const tag = tagName.charAt(0).toUpperCase() + tagName.slice(1);
            const listenerCount = tagInfo.userCount;
            const percentage = Math.round((listenerCount / store.friendCount) * 100);

            if (index === 0) {
                if (percentage >= 80) {
                    messages.push(random([
                        `${tag} tops the genre charts with ${tagInfo.plays.toLocaleString()} plays from ${listenerCount}/${store.friendCount} friends`,
                        `${tag} leads the week with ${tagInfo.plays.toLocaleString()} plays from ${listenerCount}/${store.friendCount} friends`
                    ]));
                } else if (percentage >= 40) {
                    messages.push(random([
                        `${tag} is the top genre this week with ${tagInfo.plays.toLocaleString()} plays from ${percentage}% of friends`,
                        `${tag} leads the genre charts with ${tagInfo.plays.toLocaleString()} plays from ${percentage}% of friends`
                    ]));
                } else {
                    messages.push(random([
                        `${tag} leads the group with ${tagInfo.plays.toLocaleString()} plays from ${listenerCount} listener${listenerCount > 1 ? 's' : ''}`,
                        `${tag} is the most-played genre this week with ${tagInfo.plays.toLocaleString()} plays from ${listenerCount} listener${listenerCount > 1 ? 's' : ''}`
                    ]));
                }
            } else if (index === 1) {
                if (percentage >= 40) {
                    messages.push(random([
                        `${tag} is the #2 genre this week with ${tagInfo.plays.toLocaleString()} plays from ${percentage}% of friends`,
                        `${tag} comes second in genre charts with ${tagInfo.plays.toLocaleString()} plays from ${percentage}% of friends`
                    ]));
                } else {
                    messages.push(random([
                        `${tag} is the #2 genre this week with ${tagInfo.plays.toLocaleString()} plays from ${listenerCount} listener${listenerCount > 1 ? 's' : ''}`,
                        `${tag} comes second in genre charts with ${tagInfo.plays.toLocaleString()} plays from ${listenerCount} listener${listenerCount > 1 ? 's' : ''}`
                    ]));
                }
            } else {
                messages.push(random([
                    `${tag} rounds out the top 3 genres with ${tagInfo.plays.toLocaleString()} plays from ${listenerCount} listener${listenerCount > 1 ? 's' : ''}`,
                    `${tag} is the #3 genre this week with ${tagInfo.plays.toLocaleString()} plays from ${listenerCount} listener${listenerCount > 1 ? 's' : ''}`
                ]));
            }
        });

        return messages;
    },

    // One genre dominates a user's listening
    genreMonopoly: (data) => {
        const messages = [];
        if (!data.tags.length) return messages;

        const userTagPlays = {};
        for (const [tag, tagInfo] of data.tags) {
            for (const [user, plays] of Object.entries(tagInfo.users)) {
                if (!userTagPlays[user]) userTagPlays[user] = {};
                userTagPlays[user][tag] = (userTagPlays[user][tag] || 0) + plays;
            }
        }

        Object.entries(userTagPlays).forEach(([username, tagMap]) => {
            const total = Object.values(tagMap).reduce((s, p) => s + p, 0);
            if (total < 15) return;
            const [topTag, topPlays] = Object.entries(tagMap).sort((a, b) => b[1] - a[1])[0];
            const pct = Math.round((topPlays / total) * 100);
            if (pct < 40) return;
            const tag = topTag.charAt(0).toUpperCase() + topTag.slice(1);
            const templates = [
                `${pct}% of ${username}'s week is ${tag} (${topPlays} plays)`,
                `${username}'s listening is ${pct}% ${tag} this week (${topPlays} plays)`,
                `${tag} dominates ${username}'s week at ${pct}% of their tagged plays`
            ];
            messages.push(random(templates));
        });

        return messages.sort(() => Math.random() - 0.5).slice(0, 2);
    },

    // User who spanned the most genres
    genreExplorer: (data) => {
        const messages = [];
        if (!data.tags.length) return messages;

        const userGenreCount = {};
        for (const [, tagInfo] of data.tags) {
            for (const user of Object.keys(tagInfo.users)) {
                userGenreCount[user] = (userGenreCount[user] || 0) + 1;
            }
        }

        const sorted = Object.entries(userGenreCount).sort((a, b) => b[1] - a[1]);
        if (!sorted.length || sorted[0][1] < 4) return messages;
        const [username, count] = sorted[0];
        const secondCount = sorted[1]?.[1] || 0;
        const margin = count - secondCount;

        if (margin >= 3) {
            const templates = [
                `${username} spanned ${count} different genres this week, more than anyone else`,
                `${username} explored the most genres this week with ${count} different genres`,
                `${username} listened to the most genres this week with ${count} (${margin} more than anyone else)`
            ];
            messages.push(random(templates));
        } else {
            const templates = [
                `${username} spanned ${count} different genres this week, more than anyone else`,
                `${username} explored the most genres this week with ${count} different genres`
            ];
            messages.push(random(templates));
        }

        return messages;
    },

    // Two users share the same top genre
    sharedGenre: (data) => {
        const messages = [];
        if (!data.tags.length) return messages;

        const userTopGenre = {};
        for (const [tag, tagInfo] of data.tags) {
            for (const [user, plays] of Object.entries(tagInfo.users)) {
                if (!userTopGenre[user] || plays > userTopGenre[user].plays) {
                    userTopGenre[user] = { tag, plays };
                }
            }
        }

        // Group users by top genre, skip the group's overall top 3
        const topGroupGenres = new Set(data.tags.slice(0, 3).map(([tag]) => tag));
        const genreUsers = {};
        for (const [user, { tag, plays }] of Object.entries(userTopGenre)) {
            if (topGroupGenres.has(tag)) continue;
            if (!genreUsers[tag]) genreUsers[tag] = [];
            genreUsers[tag].push({ user, plays });
        }

        // Find the genre shared by the most users with the most combined plays
        const candidates = Object.entries(genreUsers)
            .filter(([, users]) => users.length >= 2)
            .sort((a, b) => b[1].reduce((s, u) => s + u.plays, 0) - a[1].reduce((s, u) => s + u.plays, 0));

        if (!candidates.length) return messages;
        const [tag, users] = candidates[0];
        const capitalized = tag.charAt(0).toUpperCase() + tag.slice(1);
        const [u1, u2] = users;
        messages.push(random([
            `${u1.user} and ${u2.user} are both deep into ${capitalized} this week`,
            `${u1.user} and ${u2.user} share a top genre this week: ${capitalized}`
        ]));

        return messages;
    },

    // Vintage vs modern split
    vintageVsModern: (data) => {
        const messages = [];
        const entries = Object.entries(data.groupYearPlays);
        if (!entries.length) return messages;

        let pre2000 = 0, post2000 = 0;
        for (const [y, plays] of entries) {
            if (parseInt(y) < 2000) pre2000 += plays;
            else post2000 += plays;
        }
        const total = pre2000 + post2000;
        if (total < 50) return messages;

        const prePct = Math.round((pre2000 / total) * 100);
        const postPct = 100 - prePct;

        if (prePct >= 40) {
            const templates = [
                `${prePct}% of this week's plays are from albums released before 2000`,
                `The group was vintage this week - ${prePct}% of plays are from pre-2000 albums`
            ];
            messages.push(random(templates));
        } else if (postPct >= 80) {
            const templates = [
                `${postPct}% of this week's plays are from albums released in 2000 or later`,
                `The group is staying modern - ${postPct}% of plays are from 2000s albums or newer`
            ];
            messages.push(random(templates));
        }

        return messages;
    },

    // Decade with most group plays
    decadeOfTheWeek: (data) => {
        const messages = [];
        const entries = Object.entries(data.groupYearPlays);
        if (!entries.length) return messages;

        const decadeNames = { 1960: '60s', 1970: '70s', 1980: '80s', 1990: '90s', 2000: '2000s', 2010: '2010s' };
        const decadePlays = {};
        for (const [y, plays] of entries) {
            const decade = Math.floor(parseInt(y) / 10) * 10;
            if (decade >= 1960 && decade <= 2010) {
                decadePlays[decade] = (decadePlays[decade] || 0) + plays;
            }
        }

        if (!Object.keys(decadePlays).length) return messages;
        const [topDecade, topPlays] = Object.entries(decadePlays).sort((a, b) => b[1] - a[1])[0];
        if (topPlays < 15) return messages;

        const decadeName = decadeNames[parseInt(topDecade)];
        const templates = [
            `The ${decadeName} were popular this week with ${topPlays.toLocaleString()} plays`,
            `It's a ${decadeName} week - ${topPlays.toLocaleString()} plays from that decade`,
            `The group was loving ${decadeName} music this week (${topPlays.toLocaleString()} plays)`
        ];
        messages.push(random(templates));
        return messages;
    },

    // Single year (pre-2010) with most group plays
    bestSingleYear: (data) => {
        const messages = [];
        const preEntries = Object.entries(data.groupYearPlays).filter(([y]) => parseInt(y) < 2010);
        if (!preEntries.length) return messages;

        const [topYear, topPlays] = preEntries.sort((a, b) => b[1] - a[1])[0];
        if (topPlays < 10) return messages;

        const templates = [
            `${topYear} is seeing a resurgence this week with ${topPlays.toLocaleString()} plays from that year`,
            `The group went heavy on music from ${topYear} this week (${topPlays.toLocaleString()} plays)`
        ];
        messages.push(random(templates));
        return messages;
    },

    // % of plays from current year albums
    currentYearPlays: (data) => {
        const messages = [];
        const currentYear = new Date().getFullYear();
        const total = Object.values(data.groupYearPlays).reduce((s, p) => s + p, 0);
        if (total < 20) return messages;

        const currentPlays = data.groupYearPlays[currentYear] || 0;
        const pct = Math.round((currentPlays / total) * 100);

        if (pct >= 10) {
            const templates = [
                `${pct}% of this week's plays are from albums released this year`,
                `The group is keeping up with new releases - ${pct}% of plays are from albums released this year`
            ];
            messages.push(random(templates));
        }

        const userCurrentPlays = Object.entries(data.userYearPlays)
            .map(([username, yearMap]) => [username, yearMap[currentYear] || 0])
            .filter(([, p]) => p >= 10)
            .sort((a, b) => b[1] - a[1]);

        if (userCurrentPlays.length) {
            const [username, plays] = userCurrentPlays[0];
            const userTotal = Object.values(data.userYearPlays[username]).reduce((s, p) => s + p, 0);
            const userPct = Math.round((plays / userTotal) * 100);
            if (userPct >= 20) {
                const templates = [
                    `${username} is keeping up with new releases - ${userPct}% of their plays are from albums released this year`,
                    `${username} is first on new releases: ${plays} plays from songs released this year (${userPct}% of their week)`
                ];
                messages.push(random(templates));
            }
        }

        return messages.slice(0, 1);
    },

    // Average age of albums played by the group
    albumAge: (data) => {
        const messages = [];
        const currentYear = new Date().getFullYear();
        const entries = Object.entries(data.groupYearPlays);
        if (!entries.length) return messages;

        let weightedSum = 0, totalPlays = 0;
        for (const [y, plays] of entries) {
            weightedSum += parseInt(y) * plays;
            totalPlays += plays;
        }
        if (totalPlays < 30) return messages;

        const avgYear = Math.round(weightedSum / totalPlays);
        const avgAge = currentYear - avgYear;

        if (avgAge >= 3) {
            const templates = [
                `The group's average album this week is ${avgAge} years old (avg release year: ${avgYear})`
            ];
            messages.push(random(templates));
        }

        return messages;
    },

    // Show if the group has played music from every year since some point
    groupEraSpread: (data) => {
        const messages = [];
        const currentYear = new Date().getFullYear();
        const years = new Set(Object.keys(data.groupYearPlays).map(Number));
        if (!years.size) return messages;

        let continuousFrom = currentYear;
        for (let y = currentYear; y >= 1960; y--) {
            if (!years.has(y)) break;
            continuousFrom = y;
        }
        if (continuousFrom > 1990) return messages;

        const span = currentYear - continuousFrom;
        const templates = [
            `The group has played music from every year since ${continuousFrom}`,
            `The group listened to music from every year of the last ${span} years`
        ];
        messages.push(random(templates));
        return messages;
    },

    // User who covered the most distinct release years
    timeTraveler: (data) => {
        const messages = [];
        const userYearCounts = Object.entries(data.userYearPlays)
            .map(([username, yearMap]) => [username, Object.keys(yearMap).length])
            .filter(([, count]) => count >= 10)
            .sort((a, b) => b[1] - a[1]);

        if (!userYearCounts.length) return messages;
        const [username, count] = userYearCounts[0];
        const secondCount = userYearCounts[1]?.[1] || 0;
        const margin = count - secondCount;

        if (margin >= 5) {
            const templates = [
                `${username}'s listening ranged across ${count} years of music this week (${margin} more than anyone else)`,
                `${username}'s plays covered ${count} years of music this week (${margin} more than anyone else)`
            ];
            messages.push(random(templates));
        } else {
            const templates = [
                `${username} ranged across ${count} years of music this week, more than anyone else`,
                `${username} covered the most ground historically with ${count} years of music`
            ];
            messages.push(random(templates));
        }

        return messages;
    },

    // User with highest % of recent (last 2 years) plays
    freshestListener: (data) => {
        const messages = [];
        const currentYear = new Date().getFullYear();

        const candidates = Object.entries(data.userYearPlays).map(([username, yearMap]) => {
            const total = Object.values(yearMap).reduce((s, p) => s + p, 0);
            const recent = (yearMap[currentYear] || 0) + (yearMap[currentYear - 1] || 0);
            return { username, total, recent, pct: total > 0 ? Math.round((recent / total) * 100) : 0 };
        }).filter(d => d.total >= 15 && d.pct >= 20).sort((a, b) => b.pct - a.pct);

        if (!candidates.length) return messages;
        const { username, pct, recent } = candidates[0];
        const templates = [
            `${username} is keeping up with new releases - ${pct}% of their music is from the last two years`,
            `${username} is the most recent listener - ${pct}% of their music is from the last two years`
        ];
        messages.push(random(templates));
        return messages;
    },

    // User with lowest average release year
    mostNostalgic: (data) => {
        const messages = [];
        const candidates = Object.entries(data.userYearPlays).map(([username, yearMap]) => {
            const entries = Object.entries(yearMap);
            const total = entries.reduce((s, [, p]) => s + p, 0);
            if (total < 20) return null;
            const weightedSum = entries.reduce((s, [y, p]) => s + parseInt(y) * p, 0);
            return { username, avgYear: Math.round(weightedSum / total), total };
        }).filter(Boolean).sort((a, b) => a.avgYear - b.avgYear);

        if (!candidates.length) return messages;
        const { username, avgYear } = candidates[0];
        const age = new Date().getFullYear() - avgYear;

        const templates = [
            `${username} went the deepest into the archives this week, averaging albums released in ${avgYear}`,
            `${username} is the most nostalgic listener - their average album is ${age} years old`
        ];
        messages.push(random(templates));
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
        const avgHoursPerPerson = Math.round(totalHours / store.friendCount);
        
        if (totalPlays >= 50) {
            const templates = [
                `The group has ${totalPlays.toLocaleString()} plays from ${store.friendCount} friends this week (${avgPlaysPerPerson} plays per friend)`,
                `The group totaled ${totalPlays.toLocaleString()} plays from ${store.friendCount} friends this week (${avgPlaysPerPerson} plays per friend)`
            ];
            messages.push(random(templates));
        }
        
        if (totalHours >= 4) {
            const templates = [
                `${store.friendCount} listeners logged ${totalHours.toLocaleString()} hours of music this week (${avgHoursPerPerson} hours per friend)`,
                `${store.friendCount} friends spent ${totalHours.toLocaleString()} hours listening this week (${avgHoursPerPerson} hours per friend)`,
                `The group racked up ${totalHours.toLocaleString()} hours of listening time this week (${avgHoursPerPerson} hours per friend)`
            ];
            messages.push(random(templates));
        }
        
        if (totalTracks >= 50) {
            const avgTracksPerPerson = Math.round(totalTracks / store.friendCount);
            const templates = [
                `${totalTracks.toLocaleString()} unique tracks were played this week (${avgTracksPerPerson} per friend)`,
                `The group explored ${totalTracks.toLocaleString()} different tracks this week (${avgTracksPerPerson} per friend)`,
                `The group discovered ${totalTracks.toLocaleString()} unique tracks this week (${avgTracksPerPerson} per friend)`
            ];
            messages.push(random(templates));
        }

        if (totalAlbums >= 20) {
            const templates = [
                `The group listened to ${totalAlbums.toLocaleString()} different albums from ${totalArtists.toLocaleString()} different artists this week`,
                `The group explored ${totalAlbums.toLocaleString()} different albums from ${totalArtists.toLocaleString()} different artists this week`
            ];
            messages.push(random(templates));
        }
        
        return messages;
    }
};

// Generate all ticker messages based on chart data
function generateTickerMessages() {
    tickerMessages = [];

    // Compute cache completion percentages
    let tagLoadedPlays = 0, tagTotalPlays = 0;
    for (const [artistName, artistInfo] of sortedData.artists) {
        tagTotalPlays += artistInfo.plays;
        if (artistTagsCache[artistName]) tagLoadedPlays += artistInfo.plays;
    }
    const tagCachePct = tagTotalPlays > 0 ? tagLoadedPlays / tagTotalPlays : 0;

    let yearLoadedPlays = 0, yearTotalPlays = 0;
    for (const [, albumInfo] of sortedData.albums) {
        yearTotalPlays += albumInfo.plays;
        if (releaseYearCache[`${albumInfo.artist}::${albumInfo.albumName}`]) yearLoadedPlays += albumInfo.plays;
    }
    const yearCachePct = yearTotalPlays > 0 ? yearLoadedPlays / yearTotalPlays : 0;

    // Pre-compute release year data for all year-based generators
    const currentYear = new Date().getFullYear();
    const groupYearPlays = {};
    const userYearPlays = {};
    Object.entries(chartDataPerUser).forEach(([username, userData]) => {
        userYearPlays[username] = {};
        Object.values(userData.albumPlays || {}).forEach(albumData => {
            const year = releaseYearCache[`${albumData.artistName}::${albumData.albumName}`];
            if (!year) return;
            const y = parseInt(year);
            if (isNaN(y) || y < 1900 || y > currentYear) return;
            userYearPlays[username][y] = (userYearPlays[username][y] || 0) + albumData.plays;
            groupYearPlays[y] = (groupYearPlays[y] || 0) + albumData.plays;
        });
    });

    const data = {
        artists: sortedData.artists || [],
        albums: sortedData.albums || [],
        tracks: sortedData.tracks || [],
        tags: sortedData.tags || [],
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
        scatterBuckets: tempBuckets || {}, // Use tempBuckets because buckets not always populated
        groupYearPlays,
        userYearPlays,
        tagCachePct,
        yearCachePct,
    };
    
    const genreGenerators = [messageGenerators.topGenre, messageGenerators.genreMonopoly, messageGenerators.genreExplorer, messageGenerators.sharedGenre];
    const yearGenerators = [messageGenerators.vintageVsModern, messageGenerators.decadeOfTheWeek, messageGenerators.bestSingleYear, messageGenerators.currentYearPlays, messageGenerators.albumAge, messageGenerators.groupEraSpread, messageGenerators.timeTraveler, messageGenerators.freshestListener, messageGenerators.mostNostalgic];
    const generators = new Set([...genreGenerators, ...yearGenerators]);

    // Generate messages from each generator
    Object.values(messageGenerators).forEach(generator => {
        if (generators.has(generator)) return;
        tickerMessages.push(...generator(data));
    });

    if (tagCachePct >= 0.5) {
        genreGenerators.forEach(g => tickerMessages.push(...g(data)));
    }
    if (yearCachePct >= 0.5) {
        yearGenerators.forEach(g => tickerMessages.push(...g(data)));
    }
    
    // Shuffle messages for variety
    tickerMessages = tickerMessages.sort(() => Math.random() - 0.5);
}