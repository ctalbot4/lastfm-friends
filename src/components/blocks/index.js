// State
import { store, getKey } from "../../state/store.js";

// Listeners
import { fetchTrackListeners, fetchArtistListeners } from "../listeners.js";

// Expand/collapse listener rows
function setRowExpanded(row, expanded) {
    const nameEl = row.querySelector('.listener-username-text');
    const username = row.dataset.username;
    if (expanded) {
        const url = row.dataset.libraryUrl;
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.className = 'listener-username-text';
        link.innerHTML = username + `<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;position:relative;top:-0.75px"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;
        nameEl.replaceWith(link);
        row.classList.add('expanded');
    } else {
        const span = document.createElement('span');
        span.className = 'listener-username-text';
        span.textContent = username;
        nameEl.replaceWith(span);
        row.classList.remove('expanded');
    }
}

// Setup blocks on initial load and when blocks are rebuilt in sortBlocks()
export function setupBlocks() {
    document.querySelectorAll(`.block`).forEach(block => {
        if (!block) return;

        block.querySelector(".info-button").addEventListener("click", async (e) => {
            e.preventDefault();
            const block = e.currentTarget.closest('.block');
            const listenersContainer = block.querySelector(".listeners-container");
            const artistTab = block.querySelector('.listeners-tab[data-tab="artist"]');
            const artistContent = block.querySelector('.listeners-content-artist');

            listenersContainer.classList.add("active");
            document.querySelectorAll('.block').forEach(otherBlock => {
                if (otherBlock == block) return;
                otherBlock.querySelector(".listeners-container").classList.remove("active");
            })

            if (artistTab.classList.contains('active')) {
                if (block.dataset.artistListenersLoaded != "2") {
                    artistContent.innerHTML = `<div class="listeners-loading"><div>Loading listeners...</div></div>`;
                }
                if (!store.keys.KEY3) store.keys.KEY3 = await getKey(3);
                await fetchArtistListeners(block);
            }
        });

        block.querySelector(".close-listeners").addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const block = e.currentTarget.closest('.block');

            block.querySelector(".listeners-container").classList.remove("active");
        });

        // Who listens switching
        block.querySelector('.listeners-tab[data-tab="track"]').addEventListener("click", async (e) => {
            e.preventDefault();
            const block = e.currentTarget.closest('.block');
            const trackTab = block.querySelector('.listeners-tab[data-tab="track"]');
            const artistTab = block.querySelector('.listeners-tab[data-tab="artist"]');
            const trackContent = block.querySelector('.listeners-content-track');
            const artistContent = block.querySelector('.listeners-content-artist');

            trackTab.classList.add("active");
            artistTab.classList.remove("active");
            trackContent.style.display = "flex";
            artistContent.style.display = "none";

            if (!store.keys.KEY3) store.keys.KEY3 = await getKey(3);
            await fetchTrackListeners(block);
        });

        block.querySelector('.listeners-tab[data-tab="artist"]').addEventListener("click", async (e) => {
            e.preventDefault();
            const block = e.currentTarget.closest('.block');
            const trackTab = block.querySelector('.listeners-tab[data-tab="track"]');
            const artistTab = block.querySelector('.listeners-tab[data-tab="artist"]');
            const trackContent = block.querySelector('.listeners-content-track');
            const artistContent = block.querySelector('.listeners-content-artist');

            artistTab.classList.add("active");
            trackTab.classList.remove("active");
            artistContent.style.display = "flex";
            trackContent.style.display = "none";

            if (!store.keys.KEY3) store.keys.KEY3 = await getKey(3);
            await fetchArtistListeners(block);
        });

        // Add scroll listeners to any active listeners-lists
        block.querySelectorAll('.listeners-list').forEach(list => {
            list.addEventListener('scroll', () => {
                store.isScrolling = true;
                clearTimeout(store.scrollTimeoutId);
                store.scrollTimeoutId = setTimeout(() => { store.isScrolling = false; }, 2000);
            }, { passive: true });
            if ('onscrollend' in window) {
                list.addEventListener('scrollend', () => {
                    clearTimeout(store.scrollTimeoutId);
                    store.isScrolling = false;
                }, { passive: true });
            }
        });

        // Expand/collapse listener rows
        ['.listeners-content-track', '.listeners-content-artist'].forEach(selector => {
            block.querySelector(selector).addEventListener('click', (e) => {
                if (e.target.closest('a')) return;
                const row = e.target.closest('.listener-item-expandable');
                if (!row) return;
                const content = e.currentTarget;
                const isExpanded = row.classList.contains('expanded');
                content.querySelectorAll('.listener-item-expandable.expanded')
                    .forEach(r => setRowExpanded(r, false));
                if (!isExpanded) setRowExpanded(row, true);
            });
        });
    })
}