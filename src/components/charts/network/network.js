let simulation = null;
let svg = null;
let g = null;
let link = null;
let node = null;
let zoom = null;

// Setup zoom buttons
function setupZoomControls(svg, zoom) {
    const zoomIn = document.querySelector('.zoom-in');
    const zoomOut = document.querySelector('.zoom-out');
    
    zoomIn.onclick = () => {
        svg.transition().duration(300).call(zoom.scaleBy, 1.3);
    }
    
    zoomOut.onclick = () => {
        svg.transition().duration(300).call(zoom.scaleBy, 0.7);
    }
}

// Create network graph
export function createNetworkGraph(data) {
    const container = document.getElementById("network-chart");
    container.innerHTML = '';
    
    // Show organizing overlay
    const overlay = document.querySelector('.network-organizing-overlay');
    overlay.classList.remove('hidden');
    container.classList.add('organizing');

    const progressFill = overlay.querySelector('.network-progress-fill');
    progressFill.style.width = '0%';
    
    let width = container.clientWidth;
    let height = container.clientHeight;
    
    // If unable to get dimensions, use fallback
    if (width === 0 || height === 0) {
        width = 800;
        height = 600;
    }
    
    svg = d3.select(container)
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height])
        .style("background", "transparent");
    
    g = svg.append("g");
    
    // Add zoom
    zoom = d3.zoom()
        .scaleExtent([0.1, 4])
        .on("zoom", (event) => {
            g.attr("transform", event.transform);
        });
    
    svg.call(zoom);
    
    // Add zoom buttons
    setupZoomControls(svg, zoom);
    
    // Start zoomed out
    const initialScale = 0.3;
    const initialTransform = d3.zoomIdentity
        .translate(width / 2, height / 2)
        .scale(initialScale)
        .translate(-width / 2, -height / 2);
    svg.call(zoom.transform, initialTransform);
    
    // Create graph
    updateNetworkGraph(data);
}

// Update network graph
export function updateNetworkGraph(data) {
    if (!svg || !g) {
        createNetworkGraph(data);
        return;
    }
    
    // Show organizing overlay
    const container = document.getElementById("network-chart");
    const overlay = document.querySelector('.network-organizing-overlay');
    overlay.classList.remove('hidden');
    container.classList.add('organizing');

    const progressFill = overlay.querySelector('.network-progress-fill');
    progressFill.style.width = '0%';
    
    let width = parseInt(svg.attr("width"));
    let height = parseInt(svg.attr("height"));
    
    // Start zoomed out
    const initialTransform = d3.zoomIdentity
        .translate(width / 2, height / 2)
        .scale(0.2)
        .translate(-width / 2, -height / 2);
    svg.call(zoom.transform, initialTransform);
    
    // Combine users and artists
    const newNodes = [...data.users, ...data.artists];
    const links = data.links.map(d => ({ ...d }));
    
    // Save existing node positions
    const existingNodes = simulation ? simulation.nodes() : [];
    const nodePositions = new Map();
    existingNodes.forEach(n => {
        if (n.x !== undefined && n.y !== undefined) {
            nodePositions.set(n.id, { x: n.x, y: n.y, vx: n.vx, vy: n.vy });
        }
    });
    
    // Apply saved positions to new nodes
    const nodes = newNodes.map(n => {
        const existing = nodePositions.get(n.id);
        if (existing) {
            return { ...n, x: existing.x, y: existing.y, vx: existing.vx, vy: existing.vy };
        }
        return n;
    });
    
    // Calculate max plays for scaling
    const maxUserPlays = Math.max(...data.users.map(u => u.plays), 1);
    const maxArtistPlays = Math.max(...data.artists.map(a => a.plays), 1);
    const maxLinkPlays = Math.max(...links.map(l => l.plays), 1);
    
    // Scale functions
    const userRadiusScale = d3.scaleSqrt()
        .domain([0, maxUserPlays])
        .range([8, 25]);
    
    const artistRadiusScale = d3.scaleSqrt()
        .domain([0, maxArtistPlays])
        .range([5, 20]);
    
    const linkWidthScale = d3.scaleSqrt()
        .domain([0, maxLinkPlays])
        .range([0.3, 4]);
    
    const linkOpacityScale = d3.scaleLinear()
        .domain([0, maxLinkPlays])
        .range([0.2, 0.6]);
    
    const linkStrengthScale = d3.scalePow()
        .exponent(1.5)
        .domain([0, maxLinkPlays])
        .range([0.1, 1.0]);
    
    const isUpdate = simulation && existingNodes.length > 0;
    
    if (simulation) {
        simulation.stop();
    }
    
    simulation = d3.forceSimulation(nodes)
        .alphaDecay(0.01)
        .alphaMin(0.005)
        .velocityDecay(0.3)
        .force("link", d3.forceLink(links)
            .id(d => d.id)
            .distance(d => {
                const playRatio = d.plays / maxLinkPlays;
                return 30 + (1 - Math.pow(playRatio, 2)) * 150;
            })
            .strength(d => {
                return linkStrengthScale(d.plays) * 2.5;
            }))
        .force("charge", d3.forceManyBody()
            .strength(d => {
                return d.type === 'user' ? -1000 : -2000;
            }))
        .force("center", d3.forceCenter(width / 2, height / 2).strength(0.1))
        .force("collision", d3.forceCollide()
            .radius(d => d.type === 'user' ? userRadiusScale(d.plays) + 5 : artistRadiusScale(d.plays) + 2)
            .strength(0.3)
            .iterations(1));
    
    // If this is an update, restart with low alpha
    if (isUpdate) {
        simulation.alpha(0.1).restart();
    }
    
    // Clear previous elements
    g.selectAll("*").remove();

    simulation.on("tick", () => {
        // Gradually increase collision strength
        const alpha = simulation.alpha();
        const collisionStrength = Math.min(0.9, 0.3 + (1 - alpha) * 0.6);
        simulation.force("collision").strength(collisionStrength);
        
        // Update progress bar
        const progressFill = document.querySelector('.network-progress-fill');
        const progress = Math.max(0, Math.min(100, (1 - alpha) * 100));
        progressFill.style.width = `${progress}%`;
    });

    // Append elements when simulation ends
    simulation.on("end", () => {

        // Create links
        link = g.append("g")
            .attr("class", "links")
            .selectAll("line")
            .data(links)
            .join("line")
            .attr("stroke", "#999")
            .attr("stroke-opacity", d => linkOpacityScale(d.plays))
            .attr("stroke-width", d => linkWidthScale(d.plays))
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);
        
        // Create nodes
        const nodeGroup = g.append("g")
            .attr("class", "nodes")
            .selectAll("g")
            .data(nodes)
            .join("g")
            .attr("class", "node")
            .attr("transform", d => `translate(${d.x},${d.y})`);
        
        // Add circles
        nodeGroup.append("circle")
            .attr("r", d => d.type === 'user' ? userRadiusScale(d.plays) : artistRadiusScale(d.plays))
            .attr("fill", d => d.type === 'user' ? "#5856D6" : "#FF9500")
            .attr("stroke", "#fff")
            .attr("stroke-width", 2)
            .style("cursor", "pointer");
        
        // Add user images
        nodeGroup.filter(d => d.type === 'user')
            .append("image")
            .attr("xlink:href", d => d.image)
            .attr("x", d => -userRadiusScale(d.plays))
            .attr("y", d => -userRadiusScale(d.plays))
            .attr("width", d => userRadiusScale(d.plays) * 2)
            .attr("height", d => userRadiusScale(d.plays) * 2)
            .attr("clip-path", d => `circle(${userRadiusScale(d.plays)}px at center)`)
            .style("pointer-events", "none");
        
        // Add labels
        nodeGroup.append("text")
            .text(d => d.name)
            .attr("text-anchor", "middle")
            .attr("dy", d => (d.type === 'user' ? userRadiusScale(d.plays) : artistRadiusScale(d.plays)) + 12)
            .attr("fill", "white")
            .attr("font-size", "10px")
            .attr("font-weight", d => d.type === 'user' ? "bold" : "normal")
            .style("pointer-events", "none")
            .style("user-select", "none");
        
        // Add tooltips
        nodeGroup.append("title")
            .text(d => {
                if (d.type === 'user') {
                    let tooltip = `${d.name}\n${d.actualPlays.toLocaleString()} plays of ${d.artistCount} ${d.artistCount === 1 ? 'artist' : 'artists'}`;
                    if (d.topArtists && d.topArtists.length > 0) {
                        tooltip += '\n\nTop Artists:';
                        d.topArtists.forEach((artist, i) => {
                            tooltip += `\n${i + 1}. ${artist.name} (${artist.actualPlays.toLocaleString()} ${artist.actualPlays === 1 ? 'play' : 'plays'})`;
                        });
                    }
                    return tooltip;
                } else {
                    let tooltip = `${d.name}\n${d.actualPlays.toLocaleString()} plays from ${d.userCount} ${d.userCount === 1 ? 'friend' : 'friends'}`;
                    if (d.topListeners && d.topListeners.length > 0) {
                        tooltip += '\n\nTop Listeners:';
                        d.topListeners.forEach((listener, i) => {
                            tooltip += `\n${i + 1}. ${listener.username} (${listener.actualPlays.toLocaleString()} ${listener.actualPlays === 1 ? 'play' : 'plays'})`;
                        });
                    }
                    return tooltip;
                }
            });
        
        // Click handler to open Last.fm page
        nodeGroup.on("click", (event, d) => {
            if (d.type === 'artist' && d.url) {
                window.open(d.url, '_blank');
            } else if (d.type === 'user') {
                window.open(`https://www.last.fm/user/${d.name}`, '_blank');
            }
        });
        
        // Hover behavior
        nodeGroup.on("mouseenter", function(event, d) {
            d3.select(this).select("circle")
                .transition()
                .duration(200)
                .attr("stroke-width", 4)
                .attr("stroke", "#fff");
            
            // Find nodes within 1 hop
            const oneHopNodes = new Set([d.id]);
            links.forEach(l => {
                if (l.source.id === d.id) oneHopNodes.add(l.target.id);
                if (l.target.id === d.id) oneHopNodes.add(l.source.id);
            });
            
            // Find nodes within 2 hops
            const twoHopNodes = new Set(oneHopNodes);
            links.forEach(l => {
                if (oneHopNodes.has(l.source.id)) twoHopNodes.add(l.target.id);
                if (oneHopNodes.has(l.target.id)) twoHopNodes.add(l.source.id);
            });
            
            // Show links within 1-2 hops on hover
            link
                .attr("stroke-opacity", l => {
                    const sourceIn = twoHopNodes.has(l.source.id);
                    const targetIn = twoHopNodes.has(l.target.id);
                    
                    if (sourceIn && targetIn) {
                        const isDirectConnection = (l.source.id === d.id || l.target.id === d.id);
                        return isDirectConnection 
                            ? 1
                            : 0.25;
                    } else {
                        return 0;
                    }
                })
                .attr("stroke-width", l => {
                    const sourceIn = twoHopNodes.has(l.source.id);
                    const targetIn = twoHopNodes.has(l.target.id);
                    
                    if (sourceIn && targetIn) {
                        const isDirectConnection = (l.source.id === d.id || l.target.id === d.id);
                        return isDirectConnection 
                            ? linkWidthScale(l.plays) * 1.5
                            : 1.0;
                    } else {
                        return linkWidthScale(l.plays);
                    }
                });
            
            // Show nodes within 1-2 hops on hover
            nodeGroup.style("opacity", nd => {
                if (oneHopNodes.has(nd.id)) {
                    return 1;
                } else if (twoHopNodes.has(nd.id)) {
                    return 0.4;
                } else {
                    return 0.15;
                }
            });
        });
        
        // Reset after hover
        nodeGroup.on("mouseleave", function(event, d) {
            d3.select(this).select("circle")
                .transition()
                .duration(200)
                .attr("stroke-width", 2)
                .attr("stroke", "#fff");
            
            link
                .attr("stroke-opacity", l => linkOpacityScale(l.plays))
                .attr("stroke-width", l => linkWidthScale(l.plays));
            
            nodeGroup.style("opacity", 1);
        });
        
        node = nodeGroup;

        // Reveal graph and zoom in
        const container = document.getElementById("network-chart");
        const overlay = document.querySelector('.network-organizing-overlay');
        if (!overlay.classList.contains('hidden')) {
            // Zoom in
            setTimeout(() => {
                svg.transition()
                    .duration(1000)
                    .ease(d3.easeCubicInOut)
                    .call(zoom.transform, d3.zoomIdentity.scale(0.775));
            }, 200);
            
            // Hide overlay
            setTimeout(() => {
                overlay.classList.add('hidden');
                container.classList.remove('organizing');
            }, 400);
        }
    });
}