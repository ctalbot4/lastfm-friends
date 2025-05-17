// State
import { store } from "../../state/store.js";

// API
import { getJSONP } from "../../api/deezer.js";

// Blocks
import { playBlockPreview } from "./blocks.js";

// UI
import { organizeBlocksIntoRows } from "../../ui/dom.js";

export const audioState = {
    currentAudio: new Audio(),
    currentChartAudio: null,
    currentBlock: null,
    currentAudioBlock: null,
    activeRequestId: 0,
    hoverTimers: {}
};

const blockContainer = document.getElementById("block-container");

export function initPreview() {
    if (store.isTouchDevice) {
        // Reset rows on resize
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                rows = organizeBlocksIntoRows();
            }, 250);
        });

        // Start scroll listener
        window.addEventListener('scroll', handleScroll);
    }

    if (!store.isTouchDevice) {
        blockContainer.addEventListener("mouseover", function(e) {
            if (!store.isSoundOn || !charts.classList.contains("collapsed")) return;
            const block = e.target.closest(".block");
            if (!block) return;

            // If same track, don't restart
            if (audioState.currentBlock && audioState.currentBlock.querySelector('.song-title a')?.textContent.trim() == block.querySelector('.song-title a')?.textContent.trim() &&
                audioState.currentBlock.querySelector('.artist-title a')?.textContent.trim() == block.querySelector('.artist-title a')?.textContent.trim()) {
                return;
            }

            // Clear previous timeout on hovered block
            if (audioState.hoverTimers[block.dataset.username]) {
                clearTimeout(audioState.hoverTimers[block.dataset.username]);
            }

            // Clear previous timeout and save preview time on previous block if mouseout wasn't triggered
            if (audioState.currentBlock) {
                // Need to get block again, might have old copy after refresh
                const updatedCurrentBlock = document.getElementById("block-container").querySelector(`[data-username="${audioState.currentBlock.dataset.username}"]`);
                updatedCurrentBlock.dataset.previewPlaying = "false";
                clearTimeout(audioState.hoverTimers[audioState.currentBlock.dataset.username]);

                // Check if currentBlock is the block playing audio
                if (audioState.currentAudioBlock?.dataset.username == audioState.currentBlock?.dataset.username) {
                    updatedCurrentBlock.dataset.previewTime = audioState.currentAudio.currentTime;
                }
            }

            // Cancel previous interactions
            audioState.activeRequestId++;
            if (audioState.currentAudio) {
                audioState.currentAudio.pause();
                audioState.currentAudioBlock = null;
            }

            audioState.currentBlock = block;

            // Wait for 200 ms then start song search
            audioState.hoverTimers[block.dataset.username] = setTimeout(() => {
                // Combine two spans for track title
                const trackTitle = (`${block.querySelector('.song-title .rest').innerText}${block.querySelector('.song-title .rest').innerText ? " " : ""}${block.querySelector('.song-title .no-break').innerText}`).trim();
                const artistName = block.querySelector('.artist-title a').textContent;
                playBlockPreview(trackTitle, artistName, block);
            }, 200);
        });
    }

    // Stop when mouse leaves the block
    if (!store.isTouchDevice) {
        blockContainer.addEventListener("mouseout", function(e) {
            const block = e.target.closest(".block");
            if (!block || e.relatedTarget?.closest('.block') === block) return;

            // Clear any previous timeout
            if (audioState.hoverTimers[block.dataset.username]) {
                clearTimeout(audioState.hoverTimers[block.dataset.username]);
            }

            // Cancel audio and save preview time
            audioState.activeRequestId++;
            if (audioState.currentAudio) {
                audioState.currentAudio.pause();
                // Check if block is the block playing audio
                if (audioState.currentAudioBlock?.dataset.username == block.dataset.username) {
                    block.dataset.previewTime = audioState.currentAudio.currentTime;
                }
                audioState.currentAudioBlock = null;
            }
            document.getElementById("block-container").querySelector(`[data-username="${block.dataset.username}"]`).dataset.previewPlaying = "false";
            audioState.currentBlock = null;
        });
    }

    // Sound toggle
    document.querySelectorAll('.sound').forEach(toggle => {
        toggle.addEventListener('click', () => {
            store.isSoundOn = !store.isSoundOn;
            document.querySelectorAll('.sound').forEach(toggle => {
                toggle.classList.toggle('muted', !store.isSoundOn);
            });
            if (store.isSoundOn) {
                handleScroll();
            } else if (!store.isSoundOn) {
                audioState.activeRequestId++;
                if (audioState.currentAudio) {
                    audioState.currentAudio.pause();
                    audioState.currentAudio.currentTime = 0;
                }
                document.querySelectorAll(`.block`).forEach(block => {
                    block.dataset.previewPlaying = "false";
                });
                audioState.currentBlock = null;
            }

            gtag('event', 'sound_toggle', {
                sound_state: store.isSoundOn ? 'unmuted' : 'muted'
            });
        });
    });
}

// Check if preview exists
export async function hasPreview(title, artistName, isArtist = false, isAlbum = false) {
    const sanitizedTitle = title.replace(/\?/g, '');
    let url;

    if (isAlbum) {
        // Search for album and check if it has previews
        const query = `album:"${sanitizedTitle}" artist:"${artistName}"`;
        const encodedQuery = encodeURIComponent(query);
        url = `https://api.deezer.com/search/track?q=${encodedQuery}&output=jsonp`;
        try {
            const result = await getJSONP(url);
            if (!result.data) return false;
            const albumWords = title.toLowerCase().split(/\s+/);
            const artistWords = artistName.toLowerCase().split(/\s+/);
            for (let track of result.data) {
                const resultAlbumTitle = track.album.title.toLowerCase();
                const resultArtistName = track.artist.name.toLowerCase();
                const albumMatches = albumWords.some(word => resultAlbumTitle.includes(word));
                const artistMatches = artistWords.some(word => resultArtistName.includes(word));

                if (albumMatches && artistMatches) {
                    return true;
                }
            }
            return false;
        } catch (e) {
            console.error('Error checking album preview:', e);
            return false;
        }
    } else if (isArtist) {
        // Find artist ID
        const encodedQuery = encodeURIComponent(sanitizedTitle);
        url = `https://api.deezer.com/search/artist?q=${encodedQuery}&output=jsonp`;
        try {
            const result = await getJSONP(url);
            if (!result.data) return false;
            return result.data[0]?.id != null;
        } catch (e) {
            console.error('Error checking artist preview:', e);
            return false;
        }
    } else {
        const query = `artist:"${artistName}" track:"${sanitizedTitle}"`;
        const encodedQuery = encodeURIComponent(query);
        url = `https://api.deezer.com/search/track/?q=${encodedQuery}&output=jsonp`;
        try {
            const result = await getJSONP(url);
            if (!result.data) return false;

            // Find first result that contains matching word in artist and song name
            const trackWords = title.toLowerCase().split(/\s+/);
            const artistWords = artistName.toLowerCase().split(/\s+/);
            let foundTrack = null;

            for (let track of result.data) {
                const resultTrackTitle = track.title.toLowerCase();
                const resultArtistName = track.artist.name.toLowerCase();
                const trackMatches = trackWords.some(word => resultTrackTitle.includes(word));
                const artistMatches = artistWords.some(word => resultArtistName.includes(word));

                if (trackMatches && artistMatches) {
                    foundTrack = track;
                    return true;
                }
            }

            // If no match found and title has parentheses, try without them
            if (!foundTrack && title.includes('(')) {
                const newTitle = sanitizedTitle.replace(/\(.*?\)/g, '').trim();
                return hasPreview(newTitle, artistName, isArtist, isAlbum);
            }

            return false;
        } catch (e) {
            console.error('Error checking track preview:', e);
            return false;
        }
    }
}

let rows;

// Determine block to play preview on
export function handleScroll() {
    if (!store.isTouchDevice) return;

    rows = organizeBlocksIntoRows();
    const viewportTop = window.scrollY;

    // Find the row closest to the center of the viewport
    let closestRow = null;
    let smallestDistance = Infinity;

    rows.forEach(row => {
        const rowTop = row[0].offsetTop;
        const rowBottom = rowTop + row[0].offsetHeight;
        const center = (rowTop + rowBottom) / 2;
        const distance = Math.abs(center - (viewportTop + window.innerHeight / 2));

        if (distance < smallestDistance) {
            smallestDistance = distance;
            closestRow = row;
        }
    });
    if (closestRow) {
        const blockHeight = closestRow[0].offsetHeight;
        const rowTop = closestRow[0].offsetTop;
        const rowBottom = rowTop + closestRow[0].offsetHeight;
        const center = (rowTop + rowBottom) / 2;
        const upper = center - (blockHeight / 2);
        const scrollCenter = (viewportTop + window.innerHeight / 2);

        const col = Math.floor(closestRow.length * ((scrollCenter - upper) / blockHeight));
        const block = closestRow[col];

        if (!store.isSoundOn || !charts.classList.contains("collapsed")) return;

        // If same track, don't restart
        if (audioState.currentBlock && audioState.currentBlock.querySelector('.song-title a')?.textContent.trim() == block.querySelector('.song-title a')?.textContent.trim() &&
            audioState.currentBlock.querySelector('.artist-title a')?.textContent.trim() == block.querySelector('.artist-title a')?.textContent.trim()) {
            return;
        }

        // Clear previous timeout on previous block 
        if (audioState.currentBlock) {
            // Need to get block again, might have old copy after refresh
            const updatedCurrentBlock = document.getElementById("block-container").querySelector(`[data-username="${audioState.currentBlock.dataset.username}"]`);
            updatedCurrentBlock.dataset.previewPlaying = "false";

            // Check if currentBlock is the block playing audio
            if (audioState.currentAudioBlock?.dataset.username == audioState.currentBlock?.dataset.username) {
                updatedCurrentBlock.dataset.previewTime = audioState.currentAudio.currentTime;
            }
        }

        // Cancel previous interactions
        audioState.activeRequestId++;
        if (audioState.currentAudio) {
            audioState.currentAudio.pause();
            audioState.currentAudioBlock = null;
        }

        audioState.currentBlock = block;

        const trackTitle = (`${block.querySelector('.song-title .rest').innerText}${block.querySelector('.song-title .rest').innerText ? " " : ""}${block.querySelector('.song-title .no-break').innerText}`).trim();
        const artistName = block.querySelector('.artist-title a').textContent;
        playBlockPreview(trackTitle, artistName, block);
    }
}