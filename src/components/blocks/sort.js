// State
import { store } from "../../state/store.js";

// Blocks
import { setupBlocks } from "./index.js";

// UI
import { getUsernameFromURL } from "../../ui/dom.js";

// Sort blocks then insert changed ones
export function sortBlocks(blocks) {

    const replacedBlocks = [];

    // Keep live blocks unless new play
    blocks = blocks.map(newBlock => {
        const liveBlock = document.querySelector(`.block[data-username="${newBlock.dataset.username}"]`);

        // Private or empty blocks aren't updated
        if (newBlock === liveBlock) return liveBlock;

        if (newBlock.dataset.reset == "true") {
            // New play, remove live block and use new block
            delete newBlock.dataset.reset;
            liveBlock.remove();
            replacedBlocks.push(newBlock);
            return newBlock;
        }

        // Same play, keep live block and pull out if no longer playing so it moves
        if (liveBlock.dataset.nowPlaying !== newBlock.dataset.nowPlaying) {
            liveBlock.remove();
        }

        // Copy updated track info to live block
        liveBlock.querySelector(".bottom").replaceWith(newBlock.querySelector(".bottom"));
        liveBlock.style.backgroundImage = newBlock.style.backgroundImage;
        ['removed', 'empty', 'private'].forEach(name => {
            liveBlock.classList.toggle(name, newBlock.classList.contains(name));
        });
        ['nowPlaying', 'date', 'currentAlbum', 'nowPlayingAlbum', 'nowPlayingArtist', 'nowPlayingMbid'].forEach(key => {
            if (key in newBlock.dataset) {
                liveBlock.dataset[key] = newBlock.dataset[key];
            }
        });
        return liveBlock;
    });

    const username = getUsernameFromURL().toLowerCase();
    blocks.sort((x, y) => {
        const xUsername = x.dataset.username.toLowerCase();
        const yUsername = y.dataset.username.toLowerCase();
        const xNowPlaying = x.dataset.nowPlaying === "true";
        const yNowPlaying = y.dataset.nowPlaying === "true";
        const xDate = parseInt(x.dataset.date, 10) || 0;
        const yDate = parseInt(y.dataset.date, 10) || 0;

        if (xUsername === username && xNowPlaying) {
            return -1;
        } else if (yUsername === username && yNowPlaying) {
            return 1;
        } else if (xNowPlaying && !yNowPlaying) {
            return -1;
        } else if (!xNowPlaying && yNowPlaying) {
            return 1;
        } else if (xNowPlaying && yNowPlaying) {
            return xUsername.localeCompare(yUsername);
        } else {
            return yDate - xDate;
        }
    });

    // Insert changed blocks in sorted position
    const container = document.getElementById("block-container");
    blocks.forEach((block, index) => {
        if (container.children[index] !== block) {
            container.insertBefore(block, container.children[index]);
        }
    });

    // Limit grid width for small groups
    const count = Array.from(container.querySelectorAll('.block'))
        .filter(b =>
            !b.classList.contains('removed') &&
            !b.classList.contains('hidden')
        ).length;
    store.activeFriendCount = count;
    const maxWidth = count * 500;
    container.style.maxWidth = `${maxWidth}px`;

    setupBlocks(replacedBlocks);
}