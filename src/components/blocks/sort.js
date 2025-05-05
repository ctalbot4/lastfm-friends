// State
import { store } from "../../state/store.js";

// UI
import { getUsernameFromURL } from "../../ui/dom.js";

// Sort blocks then replace old ones
export async function sortBlocks(blocks) {
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

    // If user is scrolling, wait to rebuild DOM
    while (store.isScrolling) {
        await new Promise(r => setTimeout(r, 100));
    }

    // Save scroll positions inside listeners-container and reapply them after rebuilding
    const scrollPositions = {};

    document.querySelectorAll('.listeners-list').forEach(list => {
        const block = list.closest('.block');
        if (!block) return;
        scrollPositions[block.dataset.username] = list.scrollTop;
    });

    const container = document.getElementById("block-container");
    container.innerHTML = "";
    blocks.forEach(block => {
        container.appendChild(block);
    });
    blocks.forEach(block => {
        const name = block.dataset.username;
        const domList = document.querySelector(
            `.block[data-username="${name}"] .listeners-list`
        );
        if (domList && scrollPositions[name] != null) {
            domList.scrollTop = scrollPositions[name];
        }
    });
}