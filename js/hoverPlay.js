let currentAudio = null;
let currentBlock = null;
let currentAudioBlock = null;
let activeRequestId = 0;

// Store timers across block clones
const hoverTimers = {};
const previewTimers = {};

// Search for preview and retry if not found
async function searchPreview(trackTitle, artistName, block, retried = false) {
    // Remove any question marks (causes issues with Deezer API)
    const sanitizedTrackTitle = trackTitle.replace(/\?/g, '');

    const query = `artist:"${artistName}" track:"${sanitizedTrackTitle}"`;
    const encodedQuery = encodeURIComponent(query);
    const url = `https://api.deezer.com/search/track/?q=${encodedQuery}&output=jsonp`;

    const requestId = activeRequestId;
    const result = await getJSONP(url);
    if (requestId !== activeRequestId) {
        return;
    }
    // Find first fesult that contains matching word in artist and song name
    const trackWords = trackTitle.toLowerCase().split(/\s+/);
    const artistWords = artistName.toLowerCase().split(/\s+/);
    let foundTrack = null;
    for (let track of result.data) {
        const resultTrackTitle = track.title.toLowerCase();
        const resultArtistName = track.artist.name.toLowerCase();
        const trackMatches = trackWords.some(word => resultTrackTitle.includes(word));
        const artistMatches = artistWords.some(word => resultArtistName.includes(word));

        if (trackMatches && artistMatches) {
            foundTrack = track;
            break;
        }
    }

    if (foundTrack && foundTrack.preview) {
        if (!currentAudio) {
            currentAudio = new Audio();
        }

        const previousAudioTime = parseFloat(block.dataset.previewTime);

        currentAudio.src = foundTrack.preview;
        currentAudio.currentTime = previousAudioTime > 27 ? 0 : previousAudioTime;
        currentAudio.play();

        currentAudioBlock = block;
        document.getElementById("block-container").querySelector(`[data-username="${block.dataset.username}"]`).dataset.previewPlaying = "true";
        previewTimers[block.dataset.username] = setTimeout(() => {
            document.getElementById("block-container").querySelector(`[data-username="${block.dataset.username}"]`).dataset.previewPlaying = "false";
        }, (30 - currentAudio.currentTime) * 1000);

        gtag('event', 'song_play', {
            preview_trigger: isTouchDevice ? 'onscreen' : 'hover',
            preview_track: trackTitle || 'unknown',
            preview_artist: artistName || 'unknown'
        });
    } else if (!retried && trackTitle.includes('(')) {
        const newTitle = trackTitle.replace(/\(.*?\)/g, '').trim();
        console.log(`Retrying search without parentheses: "${newTitle}"`);
        searchPreview(newTitle, artistName, block, true);
    } else {
        console.log(`No preview found for "${trackTitle}" by "${artistName}"`);
    }
}

// Check if touch screen to know which type of preview play to enable
const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

if (!isTouchDevice) {
    blockContainer.addEventListener("mouseover", function(e) {
        if (!isSoundOn || !charts.classList.contains("collapsed")) return;
        const block = e.target.closest(".block");
        if (!block) return;

        // If same track, don't restart
        if (currentBlock && currentBlock.querySelector('.song-title a')?.textContent.trim() == block.querySelector('.song-title a')?.textContent.trim() &&
            currentBlock.querySelector('.artist-title a')?.textContent.trim() == block.querySelector('.artist-title a')?.textContent.trim()) {
            return;
        }

        // Clear previous timeout on hovered block
        if (hoverTimers[block.dataset.username] || previewTimers[block.dataset.username]) {
            clearTimeout(hoverTimers[block.dataset.username]);
            clearTimeout(previewTimers[block.dataset.username]);
        }

        // Clear previous timeout and save preview time on previous block if mouseout wasn't triggered
        if (currentBlock) {
            // Need to get block again, might have old copy after refresh
            const updatedCurrentBlock = document.getElementById("block-container").querySelector(`[data-username="${currentBlock.dataset.username}"]`);
            updatedCurrentBlock.dataset.previewPlaying = "false";
            clearTimeout(hoverTimers[currentBlock.dataset.username]);
            clearTimeout(previewTimers[currentBlock.dataset.username]);

            // Check if currentBlock is the block playing audio
            if (currentAudioBlock?.dataset.username == currentBlock?.dataset.username) {
                updatedCurrentBlock.dataset.previewTime = currentAudio.currentTime;
            }
        }

        // Cancel previous interactions
        activeRequestId++;
        if (currentAudio) {
            currentAudio.pause();
            currentAudioBlock = null;
        }

        currentBlock = block;

        // Wait for 200 ms then start song search
        hoverTimers[block.dataset.username] = setTimeout(() => {
            // Combine two spans for track title
            const trackTitle = (`${block.querySelector('.song-title .rest').innerText}${block.querySelector('.song-title .rest').innerText ? " " : ""}${block.querySelector('.song-title .no-break').innerText}`).trim();
            const artistName = block.querySelector('.artist-title a').textContent;
            searchPreview(trackTitle, artistName, block);
        }, 200);
    });
}

// Stop when mouse leaves the block
if (!isTouchDevice) {
    blockContainer.addEventListener("mouseout", function(e) {
        const block = e.target.closest(".block");
        if (!block || e.relatedTarget?.closest('.block') === block) return;

        // Clear any previous timeout
        if (hoverTimers[block.dataset.username] || previewTimers[block.dataset.username]) {
            clearTimeout(hoverTimers[block.dataset.username]);
            clearTimeout(previewTimers[block.dataset.username]);
        }

        // Cancel audio and save preview time
        activeRequestId++;
        if (currentAudio) {
            currentAudio.pause();
            // Check if block is the block playing audio
            if (currentAudioBlock?.dataset.username == block.dataset.username) {
                block.dataset.previewTime = currentAudio.currentTime;
            }
            currentAudioBlock = null;
        }
        document.getElementById("block-container").querySelector(`[data-username="${block.dataset.username}"]`).dataset.previewPlaying = "false";
        currentBlock = null;
    });
}


// Sound toggle
let isSoundOn = false;

document.querySelectorAll('.sound').forEach(toggle => {
    toggle.addEventListener('click', () => {
        isSoundOn = !isSoundOn;
        document.querySelectorAll('.sound').forEach(toggle => {
            toggle.classList.toggle('muted', !isSoundOn);
        });
        if (isSoundOn) {
            handleScroll();
        } else if (!isSoundOn) {

            activeRequestId++;
            if (currentAudio) {
                currentAudio.pause();
                currentAudio.currentTime = 0;
            }
            document.querySelectorAll(`.block`).forEach(block => {
                block.dataset.previewPlaying = "false";
            });
            currentBlock = null;
        }

        gtag('event', 'sound_toggle', {
            sound_state: isSoundOn ? 'unmuted' : 'muted'
        });
    });
});

// LOOK PLAY

// Group blocks into rows and sort left-to-right
function organizeBlocksIntoRows() {
    const blocks = Array.from(document.querySelectorAll('.block'));
    const rows = new Map();

    // Group blocks by their top position (same row)
    blocks.forEach(block => {
        const rect = block.getBoundingClientRect();
        const topKey = Math.round(rect.top); // Round to handle subpixel differences

        if (!rows.has(topKey)) {
            rows.set(topKey, []);
        }
        rows.get(topKey).push(block);
    });

    // Sort each row's blocks left-to-right and return as array
    return Array.from(rows.values()).map(row =>
        row.sort((a, b) =>
            a.getBoundingClientRect().left - b.getBoundingClientRect().left
        )
    );
}

let rows;

// Determine block to play preview on
function handleScroll() {
    if (!isTouchDevice) return;
    const requestId = activeRequestId;

    rows = organizeBlocksIntoRows();
    const viewportTop = window.scrollY;
    const viewportBottom = viewportTop + window.innerHeight;

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

        if (!isSoundOn || !charts.classList.contains("collapsed")) return;

        // If same track, don't restart
        if (currentBlock && currentBlock.querySelector('.song-title a')?.textContent.trim() == block.querySelector('.song-title a')?.textContent.trim() &&
            currentBlock.querySelector('.artist-title a')?.textContent.trim() == block.querySelector('.artist-title a')?.textContent.trim()) {
            return;
        }

        // Clear previous timeout on current block
        if (hoverTimers[block.dataset.username] || previewTimers[block.dataset.username]) {
            clearTimeout(previewTimers[block.dataset.username]);
        }

        // Clear previous timeout on previous block 
        if (currentBlock) {
            // Need to get block again, might have old copy after refresh
            const updatedCurrentBlock = document.getElementById("block-container").querySelector(`[data-username="${currentBlock.dataset.username}"]`);
            updatedCurrentBlock.dataset.previewPlaying = "false";
            clearTimeout(previewTimers[currentBlock.dataset.username]);

            // Check if currentBlock is the block playing audio
            if (currentAudioBlock?.dataset.username == currentBlock?.dataset.username) {   
                updatedCurrentBlock.dataset.previewTime = currentAudio.currentTime;
            }
        }

        // Cancel previous interactions
        activeRequestId++;
        if (currentAudio) {
            currentAudio.pause();
            currentAudioBlock = null;
        }

        currentBlock = block;

        const trackTitle = (`${block.querySelector('.song-title .rest').innerText}${block.querySelector('.song-title .rest').innerText ? " " : ""}${block.querySelector('.song-title .no-break').innerText}`).trim();        
        const artistName = block.querySelector('.artist-title a').textContent;
        searchPreview(trackTitle, artistName, block);
    }

}


if (isTouchDevice) {

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