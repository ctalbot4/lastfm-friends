// Charts
import { sortedData } from "./update.js";

// Charts - Lists
import { createAlbumCharts, createArtistCharts, createTrackCharts, createUniqueArtistsChart, createUniqueTracksChart, createTopListenersChart } from './lists/lists.js';

// Page state
export const pageState = {
    artists: { currentPage: 1, itemsPerPage: 9, totalItems: 0 },
    albums: { currentPage: 1, itemsPerPage: 9, totalItems: 0 },
    tracks: { currentPage: 1, itemsPerPage: 9, totalItems: 0 },
    listeners: { currentPage: 1, itemsPerPage: 9, totalItems: 0 },
    'unique-artists': { currentPage: 1, itemsPerPage: 9, totalItems: 0 },
    'unique-tracks': { currentPage: 1, itemsPerPage: 9, totalItems: 0 }
};

// Display a page for a list
export async function displayPage(listType) {
    const state = pageState[listType];
    const data = sortedData[listType];
    
    if (!data || data.length === 0) return;

    const startIndex = (state.currentPage - 1) * state.itemsPerPage;
    const endIndex = startIndex + state.itemsPerPage;
    const pageData = data.slice(startIndex, endIndex);

    // Calculate max value from full dataset
    let maxValue = 0;
    if (data.length > 0) {
        if (listType === 'listeners') {
            maxValue = Math.max(...data.map(item => item[1]));
        } else if (listType === 'unique-artists') {
            maxValue = Math.max(...data.map(item => item[1].totalArtists));
        } else if (listType === 'unique-tracks') {
            maxValue = Math.max(...data.map(item => item[1].totalTracks));
        } else {
            maxValue = Math.max(...data.map(item => item[1].plays));
        }
    }

    let chartItems;
    if (listType === 'artists') {
        chartItems = await createArtistCharts(pageData, maxValue);
    } else if (listType === 'albums') {
        chartItems = await createAlbumCharts(pageData, maxValue);
    } else if (listType === 'tracks') {
        chartItems = await createTrackCharts(pageData, maxValue);
    } else if (listType === 'listeners') {
        chartItems = createTopListenersChart(pageData, maxValue);
    } else if (listType === 'unique-artists') {
        chartItems = createUniqueArtistsChart(pageData, maxValue);
    } else if (listType === 'unique-tracks') {
        chartItems = createUniqueTracksChart(pageData, maxValue);
    }

    const listElement = document.getElementById(`${listType}-list`);
    listElement.innerHTML = '';
    chartItems.forEach(item => listElement.appendChild(item));

    updatePageControls(listType);
}

// Update page controls for a list
function updatePageControls(listType) {
    const state = pageState[listType];
    const totalPages = Math.ceil(state.totalItems / state.itemsPerPage);
    
    const prevBtn = document.querySelector(`[data-list="${listType}"][data-direction="prev"]`);
    const nextBtn = document.querySelector(`[data-list="${listType}"][data-direction="next"]`);

    if (prevBtn) prevBtn.disabled = state.currentPage <= 1;
    if (nextBtn) nextBtn.disabled = state.currentPage >= totalPages;
}

// Navigate pages
export async function navigatePage(listType, direction) {
    const state = pageState[listType];
    const totalPages = Math.ceil(state.totalItems / state.itemsPerPage);

    if (direction === 'next' && state.currentPage < totalPages) {
        state.currentPage++;
    } else if (direction === 'prev' && state.currentPage > 1) {
        state.currentPage--;
    } else {
        return;
    }

    await displayPage(listType);
}