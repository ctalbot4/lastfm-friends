import { initDashboard } from './components/index.js';
import { initPreview } from './components/preview/index.js';
import { initCache } from './components/cache.js';
import { initAnalytics } from './ui/analytics.js';

import { updateCharts } from './components/charts/update.js';
import { updateAllBlocks } from './components/blocks/update.js';

window.updateCharts = updateCharts;
window.updateAllBlocks = updateAllBlocks;

initDashboard();
initPreview();
initAnalytics();
initCache().catch(console.error);

window.addEventListener("hashchange", function() {
    location.reload();
});