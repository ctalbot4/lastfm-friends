// State
import { store, getKey } from "../../state/store.js";

// Listeners
import { fetchTrackListeners, fetchArtistListeners } from "../listeners.js";

// Setup blocks on initial load and when blocks are rebuilt in sortBlocks()
export function setupBlocks() {
    const blocks = document.querySelectorAll(`.block`);

    blocks.forEach(block => {
        if (!block) return;
        const infoButton = block.querySelector(".info-button");
        const closeButton = block.querySelector(".close-listeners");
        const listenersContainer = block.querySelector(".listeners-container");
        const trackTab = block.querySelector('.listeners-tab[data-tab="track"]');
        const artistTab = block.querySelector('.listeners-tab[data-tab="artist"]');
        const trackContent = block.querySelector('.listeners-content-track');
        const artistContent = block.querySelector('.listeners-content-artist');

        infoButton.addEventListener("click", async (e) => {
            e.preventDefault();

            listenersContainer.classList.add("active");
            blocks.forEach(otherBlock => {
                if (otherBlock == block) return;
                otherBlock.querySelector(".listeners-container").classList.remove("active");
            })

            if (trackTab.classList.contains('active')) {
                if (!store.keys.KEY3) store.keys.KEY3 = await getKey(3);
                await fetchTrackListeners(block);
            }
        });

        closeButton.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();

            listenersContainer.classList.remove("active");
        });

        // Who listens switching
        trackTab.addEventListener("click", async (e) => {
            e.preventDefault();
            trackTab.classList.add("active");
            artistTab.classList.remove("active");
            trackContent.style.display = "flex";
            artistContent.style.display = "none";

            if (!store.keys.KEY3) store.keys.KEY3 = await getKey(3);
            await fetchTrackListeners(block);
        });

        artistTab.addEventListener("click", async (e) => {
            e.preventDefault();
            artistTab.classList.add("active");
            trackTab.classList.remove("active");
            artistContent.style.display = "flex";
            trackContent.style.display = "none";

            if (!store.keys.KEY3) store.keys.KEY3 = await getKey(3);
            await fetchArtistListeners(block);
        });

        // Add scroll listeners to any active listeners-lists
        document.querySelectorAll('.listeners-list').forEach(list => {
            list.addEventListener('scroll', () => {
                store.isScrolling = true;
                clearTimeout(store.scrollTimeoutId);
                store.scrollTimeoutId = setTimeout(() => {
                    store.isScrolling = false;
                }, 3000);
            }, {
                passive: true
            });
        });
    })
}