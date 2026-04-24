// State
import { store } from "../../state/store.js";

// Blocks
import { setupBlocks } from "./index.js";

// UI
import { getUsernameFromURL } from "../../ui/dom.js";

// Sort blocks then replace old ones
export async function sortBlocks(blocks) {

    // Ignore null blocks
    blocks = blocks.filter(block => block != null);

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

    // If user is scrolling listeners list, wait to rebuild DOM
    while (store.isScrolling) {
        await new Promise(r => setTimeout(r, 16));
    }

    const newBlocks = [];

    // Sync values from original blocks that user might've changed during update and ignore null blocks
    blocks.forEach((newBlock, index) => {
        const originalBlock = document.querySelector(`.block[data-username="${newBlock.dataset.username}"]`);
        newBlock.dataset.previewPlaying = originalBlock.dataset.previewPlaying || "false";
        if (newBlock.dataset.previewTime != 0) {
            newBlock.dataset.previewTime = originalBlock.dataset.previewTime;
        }

        // Sync listeners-containers across updates
        if (newBlock.dataset.reset == "true") {
            // New track - reset listeners-container
            const trackTab = newBlock.querySelector('.listeners-tab[data-tab="track"]');
            const artistTab = newBlock.querySelector('.listeners-tab[data-tab="artist"]');
            const trackContent = newBlock.querySelector('.listeners-content-track');
            const artistContent = newBlock.querySelector('.listeners-content-artist');
            const listenersHeader = newBlock.querySelector('.listeners-header');
            
            artistTab.classList.add('active');
            trackTab.classList.remove('active');
            artistContent.style.display = 'flex';
            trackContent.style.display = 'none';
            listenersHeader.style.display = "none";
            
            delete newBlock.dataset.reset;
        } else if (originalBlock.dataset.artistListenersLoaded != "0") {
            // Listeners screen has been opened
            newBlock.querySelector(".listeners-container").className =
                originalBlock.querySelector(".listeners-container").className;
            newBlock.querySelector(".listeners-container").innerHTML =
                originalBlock.querySelector(".listeners-container").innerHTML;
            newBlock.dataset.trackListenersLoaded = originalBlock.dataset.trackListenersLoaded;
            newBlock.dataset.artistListenersLoaded = originalBlock.dataset.artistListenersLoaded;
        }

        // Preserve info button hover state
        if (originalBlock.matches(':hover')) {
            newBlock.querySelector(".info-button").style.opacity = "1";
            newBlock.addEventListener('mouseout', () => {
                newBlock.querySelector(".info-button").style.opacity = "";
            }, {
                once: true
            });
        } else {
            newBlock.querySelector(".info-button").style.opacity = "";
        }
        newBlocks.push(newBlock);
    });

    // Save scroll positions inside listeners-container and reapply them after rebuilding
    const scrollPositions = {};

    document.querySelectorAll('.listeners-list').forEach(list => {
        const block = list.closest('.block');
        const contentPanel = list.closest('.listeners-content-track, .listeners-content-artist');
        if (!block || !contentPanel || contentPanel.style.display === 'none') return;
        const tab = contentPanel.classList.contains('listeners-content-track') ? 'track' : 'artist';
        scrollPositions[`${block.dataset.username}:${tab}`] = list.scrollTop;
    });

    const container = document.getElementById("block-container");
    container.innerHTML = "";
    newBlocks.forEach(block => {
        container.appendChild(block);
    });

    // Limit grid width for small groups
    const count = Array.from(container.querySelectorAll('.block'))
        .filter(b =>
            !b.classList.contains('removed') &&
            !b.classList.contains('hidden')
        ).length;
    const maxWidth = count * 500;
    container.style.maxWidth = `${maxWidth}px`;

    newBlocks.forEach(block => {
        const name = block.dataset.username;
        ['track', 'artist'].forEach(tab => {
            const pos = scrollPositions[`${name}:${tab}`];
            if (pos == null) return;
            const contentPanel = block.querySelector(`.listeners-content-${tab}`);
            if (!contentPanel || contentPanel.style.display === 'none') return;
            const domList = contentPanel.querySelector('.listeners-list');
            if (domList) domList.scrollTop = pos;
        });
    });

    setupBlocks();
}