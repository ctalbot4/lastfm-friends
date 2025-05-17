// State
import { store, getKey } from "../../state/store.js";

// Listeners
import { fetchTrackListeners } from "../listeners.js";

// Setup blocks on initial load and when blocks are rebuilt in sortBlocks()
export function setupBlocks() {
    const blocks = document.querySelectorAll(`.block`);

    blocks.forEach(block => {
        if (!block) return;
        const infoButton = block.querySelector(".info-button");
        const closeButton = block.querySelector(".close-listeners");
        const listenersContainer = block.querySelector(".listeners-container");

        infoButton.addEventListener("click", async (e) => {
            e.preventDefault();

            listenersContainer.classList.add("active");
            blocks.forEach(otherBlock => {
                if (otherBlock == block) return;
                otherBlock.querySelector(".listeners-container").classList.remove("active");
            })

            // Fetch listeners data if not already fetched
            if (block.dataset.listenersLoaded != "2") {
                if (!store.keys.KEY3) store.keys.KEY3 = await getKey(3);
                await fetchTrackListeners(block);
            }
        });

        closeButton.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();

            listenersContainer.classList.remove("active");
        });

        // Add scroll listeners to any active listeners-lists
        document.querySelectorAll('.listeners-list').forEach(list => {
            list.addEventListener('scroll', () => {
                store.isScrolling = true;
                clearTimeout(store.scrollTimeoutId);
                store.scrollTimeoutId = setTimeout(() => {
                    store.isScrolling = false;
                }, 100);
            }, {
                passive: true
            });
        });
    })
}