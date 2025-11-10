/**
 * Sunburst Visualization using D3.js
 * Creates an interactive sunburst chart for visualizing user journey data
 */

let currentSunburstData = null;

function createSunburst(data) {
    // Store data globally for zoom/reset functionality
    currentSunburstData = data;

    // Clear existing chart
    const container = document.getElementById('sunburstChart');
    container.innerHTML = '';

    // Dimensions - use square aspect ratio for proper sunburst display
    const containerWidth = container.clientWidth || 800;
    const size = Math.min(containerWidth, 600);
    const width = size;
    const height = size;
    const radius = size / 2;

    // Color function using category colors if available
    const getColor = (name) => {
        // Use getCategoryColor if available (for category view)
        if (window.getCategoryColor) {
            return window.getCategoryColor(name);
        }
        // Fallback to D3 color scheme for URL view
        const fallbackColor = d3.scaleOrdinal(d3.schemeCategory10);
        return fallbackColor(name);
    };

    // Create SVG
    const svgElement = d3.select('#sunburstChart')
        .append('svg')
        .attr('width', '100%')
        .attr('height', height)
        .attr('viewBox', `0 0 ${width} ${height}`)
        .style('display', 'block')
        .style('margin', '0 auto')
        .style('pointer-events', 'all')
        .on('wheel', function(event) {
            // Prevent default zoom behavior but allow page scroll
            event.stopPropagation();
        })
        .on('click', function(event) {
            // Click on empty space to reset zoom
            if (event.target.tagName === 'svg') {
                resetZoom();
            }
        });

    const svg = svgElement.append('g')
        .attr('transform', `translate(${width / 2},${height / 2})`);

    // Create hierarchy
    const root = d3.hierarchy(data)
        .sum(d => d.value || 0)
        .sort((a, b) => b.value - a.value);

    // Create partition layout
    const partition = d3.partition()
        .size([2 * Math.PI, radius]);

    partition(root);

    // Track currently focused node for zoom state
    let focusedNode = root;
    let previousFocusedNode = root;

    // Arc generator
    const arc = d3.arc()
        .startAngle(d => d.x0)
        .endAngle(d => d.x1)
        .innerRadius(d => d.y0)
        .outerRadius(d => d.y1);

    // Create path elements
    const paths = svg.selectAll('path')
        .data(root.descendants().filter(d => d.depth > 0))
        .enter()
        .append('path')
        .attr('d', arc)
        .attr('fill', d => {
            // Each node gets the color of its own category name
            // No variations based on depth - same category = same color
            return getColor(d.data.name);
        })
        .attr('fill-opacity', 0.95)
        .attr('stroke', '#fff')
        .attr('stroke-width', 1)
        .style('cursor', 'pointer')
        .on('mouseover', handleMouseOver)
        .on('mouseout', handleMouseOut)
        .on('click', handleClick);

    // Center text removed - keeping variable for compatibility
    const centerText = { text: () => {} };

    // Center circle removed - click on empty space (SVG background) now resets zoom

    // Mouse over handler
    function handleMouseOver(event, d) {
        // Highlight path
        d3.select(event.currentTarget)
            .attr('fill-opacity', 1)
            .attr('stroke-width', 2);

        // Show tooltip
        showTooltip(event, d);

        // Update center text
        centerText.text(truncateText(d.data.name, 20));
    }

    // Mouse out handler
    function handleMouseOut(event, d) {
        d3.select(event.currentTarget)
            .attr('fill-opacity', 0.95)
            .attr('stroke-width', 1);

        hideTooltip();
        centerText.text('Parcours Utilisateurs');
    }

    // Helper: check if target is a descendant of source (or equal)
    function isVisible(target, source) {
        let current = target;
        while (current) {
            if (current === source) return true;
            current = current.parent;
        }
        return false;
    }

    // Helper: calculate arc coordinates for a node given a focus
    function arcPosition(node, focus) {
        const ZOOM_SCALE = 0.4; // Reduce zoom intensity (0.4 = 40% size)
        const xScale = (focus.x1 - focus.x0) || 0.01; // Avoid division by zero
        const yScale = (focus.y1 - focus.y0) || 0.01;

        // For angles: full circle transformation (no scaling - must close the circle)
        const startAngle = Math.max(0, Math.min(2 * Math.PI, (node.x0 - focus.x0) / xScale * 2 * Math.PI));
        const endAngle = Math.max(0, Math.min(2 * Math.PI, (node.x1 - focus.x0) / xScale * 2 * Math.PI));

        // For radius: apply zoom scale to reduce overall size
        const baseInnerRadius = (node.y0 - focus.y0) / yScale * radius;
        const baseOuterRadius = (node.y1 - focus.y0) / yScale * radius;

        return {
            startAngle: startAngle,
            endAngle: endAngle,
            innerRadius: Math.max(0, baseInnerRadius * ZOOM_SCALE),
            outerRadius: Math.max(0, baseOuterRadius * ZOOM_SCALE)
        };
    }

    // Click handler for zooming
    function handleClick(event, d) {
        event.stopPropagation();

        // Store previous focus for interpolation
        previousFocusedNode = focusedNode;

        // Update focused node
        focusedNode = d;

        // Transition for zoom animation
        const t = svg.transition()
            .duration(750)
            .ease(d3.easeCubicInOut);

        // Update each path with smooth zoom effect
        paths.each(function(node) {
            const path = d3.select(this);
            const willBeVisible = isVisible(node, d);

            path.transition(t)
                .attrTween('d', function() {
                    // Calculate start position
                    // For first zoom from root, use actual original arc coordinates
                    const startPos = previousFocusedNode === root ? {
                        startAngle: node.x0,
                        endAngle: node.x1,
                        innerRadius: node.y0,
                        outerRadius: node.y1
                    } : arcPosition(node, previousFocusedNode);

                    // Calculate end position (to new focus) - always calculated
                    const endPos = arcPosition(node, focusedNode);

                    // Create interpolators for each coordinate
                    const interpolateStartAngle = d3.interpolate(startPos.startAngle, endPos.startAngle);
                    const interpolateEndAngle = d3.interpolate(startPos.endAngle, endPos.endAngle);
                    const interpolateInnerRadius = d3.interpolate(startPos.innerRadius, endPos.innerRadius);
                    const interpolateOuterRadius = d3.interpolate(startPos.outerRadius, endPos.outerRadius);

                    return function(t) {
                        const currentArc = d3.arc()
                            .startAngle(interpolateStartAngle(t))
                            .endAngle(interpolateEndAngle(t))
                            .innerRadius(interpolateInnerRadius(t))
                            .outerRadius(interpolateOuterRadius(t));

                        return currentArc(node);
                    };
                })
                .styleTween('opacity', function() {
                    // Get current opacity
                    const currentOpacity = parseFloat(d3.select(this).style('opacity')) || 0.95;
                    const targetOpacity = willBeVisible ? 0.95 : 0;

                    // Interpolate opacity
                    return d3.interpolate(currentOpacity, targetOpacity);
                })
                .on('end', function() {
                    // Update pointer events after transition
                    d3.select(this).style('pointer-events', willBeVisible ? 'auto' : 'none');
                });
        });

        // Update center text
        centerText.text(truncateText(d.data.name, 20));
    }

    // Reset zoom
    function resetZoom() {
        // Store previous focus for interpolation
        previousFocusedNode = focusedNode;

        // Reset to root
        focusedNode = root;

        // Transition with same duration and easing as zoom
        const t = svg.transition()
            .duration(750)
            .ease(d3.easeCubicInOut);

        // Restore all paths with smooth zoom-out animation
        paths.each(function(node) {
            const path = d3.select(this);

            path.transition(t)
                .attrTween('d', function() {
                    // Calculate start position (from previous focus)
                    const startPos = arcPosition(node, previousFocusedNode);

                    // Calculate end position (back to root = original arc)
                    const endPos = {
                        startAngle: node.x0,
                        endAngle: node.x1,
                        innerRadius: node.y0,
                        outerRadius: node.y1
                    };

                    // Create interpolators
                    const interpolateStartAngle = d3.interpolate(startPos.startAngle, endPos.startAngle);
                    const interpolateEndAngle = d3.interpolate(startPos.endAngle, endPos.endAngle);
                    const interpolateInnerRadius = d3.interpolate(startPos.innerRadius, endPos.innerRadius);
                    const interpolateOuterRadius = d3.interpolate(startPos.outerRadius, endPos.outerRadius);

                    return function(t) {
                        const currentArc = d3.arc()
                            .startAngle(interpolateStartAngle(t))
                            .endAngle(interpolateEndAngle(t))
                            .innerRadius(interpolateInnerRadius(t))
                            .outerRadius(interpolateOuterRadius(t));

                        return currentArc(node);
                    };
                })
                .styleTween('opacity', function() {
                    // Get current opacity
                    const currentOpacity = parseFloat(d3.select(this).style('opacity')) || 0;

                    // Interpolate to full opacity
                    return d3.interpolate(currentOpacity, 0.95);
                })
                .on('end', function() {
                    // Restore pointer events
                    d3.select(this).style('pointer-events', 'auto');
                });
        });

        centerText.text('Parcours Utilisateurs');
    }

    // Show tooltip
    function showTooltip(event, d) {
        const tooltip = document.getElementById('sunburstTooltip');

        const total = root.value;
        const percentage = ((d.value / total) * 100).toFixed(1);

        // Build path string
        const pathParts = [];
        let current = d;
        while (current.parent) {
            pathParts.unshift(current.data.name);
            current = current.parent;
        }

        tooltip.innerHTML = `
            <div class="tooltip-title">${d.data.name}</div>
            <div class="tooltip-content">
                <div><strong>Vues :</strong> ${d.value.toLocaleString()}</div>
                <div><strong>Pourcentage :</strong> ${percentage}%</div>
                <div><strong>Profondeur :</strong> ${d.depth}</div>
                ${d.data.url ? `<div><strong>URL :</strong> ${truncateText(d.data.url, 40)}</div>` : ''}
            </div>
            <div class="tooltip-path">
                <strong>Chemin :</strong> ${pathParts.join(' → ')}
            </div>
        `;

        tooltip.style.display = 'block';

        // Use clientX/clientY instead of pageX/pageY for better positioning
        const tooltipWidth = 300; // Approximate tooltip width
        const tooltipHeight = 150; // Approximate tooltip height

        let left = event.clientX + 15;
        let top = event.clientY + 15;

        // Adjust if tooltip goes off screen
        if (left + tooltipWidth > window.innerWidth) {
            left = event.clientX - tooltipWidth - 15;
        }
        if (top + tooltipHeight > window.innerHeight) {
            top = event.clientY - tooltipHeight - 15;
        }

        tooltip.style.left = left + 'px';
        tooltip.style.top = top + 'px';
    }

    // Hide tooltip
    function hideTooltip() {
        const tooltip = document.getElementById('sunburstTooltip');
        tooltip.style.display = 'none';
    }

    // Truncate text helper
    function truncateText(text, maxLength) {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    // Make it responsive
    window.addEventListener('resize', debounce(() => {
        if (currentSunburstData) {
            createSunburst(currentSunburstData);
        }
    }, 250));
}

// Debounce helper
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Export for global access
window.createSunburst = createSunburst;
