let currentAudio = null;
let currentBlock = null;
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
            currentAudio = new Audio(foundTrack.preview);
            currentAudio.play();
            document.getElementById("block-container").querySelector(`[data-username="${block.dataset.username}"]`).dataset.previewPlaying = "true";
            previewTimers[block.dataset.username] = setTimeout(() => {
                document.getElementById("block-container").querySelector(`[data-username="${block.dataset.username}"]`).dataset.previewPlaying = "false";
            }, 30000);
        }
        else if (!retried && trackTitle.includes('(')) {
            const newTitle = trackTitle.replace(/\(.*?\)/g, '').trim();
            console.log(`Retrying search without parentheses: "${newTitle}"`);
            searchPreview(newTitle, artistName, block, true);
        }
        else {
            console.log(`No preview found for "${trackTitle}" by "${artistName}"`);
        }
  }

const blockContainer = document.getElementById("block-container");

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

    // Clear previous timeout on previous block if mouseout wasn't triggered
    if (currentBlock) {
        document.getElementById("block-container").querySelector(`[data-username="${currentBlock.dataset.username}"]`).dataset.previewPlaying = "false";
        clearTimeout(hoverTimers[currentBlock.dataset.username]);
        clearTimeout(previewTimers[currentBlock.dataset.username]);
    }
        
    // Cancel previous interactions
    activeRequestId++;
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null;
    }
  
    currentBlock = block;

    // Wait for 200 ms then start song search
    hoverTimers[block.dataset.username] = setTimeout(() => {
        const trackTitle = block.querySelector('.song-title a').textContent;
        const artistName = block.querySelector('.artist-title a').textContent;

        searchPreview(trackTitle, artistName, block);
    }, 200);
});

// Stop when mouse leaves the block
blockContainer.addEventListener("mouseout", function(e) {
    const block = e.target.closest(".block");
    if (!block || e.relatedTarget?.closest('.block') === block) return;

    // Clear any previous timeout
    if (hoverTimers[block.dataset.username] || previewTimers[block.dataset.username]) {
        clearTimeout(hoverTimers[block.dataset.username]);
        clearTimeout(previewTimers[block.dataset.username]);
    }

    // Cancel 
    activeRequestId++;
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null;
    }
    document.getElementById("block-container").querySelector(`[data-username="${block.dataset.username}"]`).dataset.previewPlaying = "false";
    currentBlock = null;
});

// Sound toggle
let isSoundOn = false;
const soundToggle = document.getElementById('sound-toggle');

soundToggle.addEventListener('click', () => {
    isSoundOn = !isSoundOn;
    soundToggle.classList.toggle('muted', !isSoundOn);
});