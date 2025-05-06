export function getUsernameFromURL() {
    const hash = window.location.hash;
    const username = hash.substring(1);
    return username;
}

// Group blocks into rows and sort left-to-right
export function organizeBlocksIntoRows() {
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