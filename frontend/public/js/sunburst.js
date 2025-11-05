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

    // Dimensions
    const width = container.clientWidth || 800;
    const height = 600;
    const radius = Math.min(width, height) / 2;

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

    // Track currently focused node
    let focusedNode = root;

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

    // Add center text
    const centerText = svg.append('text')
        .attr('class', 'sunburst-center-text')
        .attr('text-anchor', 'middle')
        .attr('dy', '0.35em')
        .style('font-size', '16px')
        .style('font-weight', 'bold')
        .style('fill', '#333')
        .text('Parcours Utilisateurs');

    // Add center circle for reset
    svg.append('circle')
        .attr('r', 60)
        .attr('fill', 'transparent')
        .style('cursor', 'pointer')
        .on('click', () => resetZoom());

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

    // Click handler for zooming
    function handleClick(event, d) {
        event.stopPropagation();

        // Update focused node
        focusedNode = d;

        // Helper: check if target is a descendant of source (or equal)
        function isVisible(target, source) {
            let current = target;
            while (current) {
                if (current === source) return true;
                current = current.parent;
            }
            return false;
        }

        // Transition for zoom animation
        const t = svg.transition()
            .duration(750)
            .ease(d3.easeCubicInOut);

        // Update each path with zoom effect
        paths.transition(t)
            .attrTween('d', function(node) {
                const i = d3.interpolate(
                    {x0: node.x0, x1: node.x1, y0: node.y0, y1: node.y1},
                    {x0: node.x0, x1: node.x1, y0: node.y0, y1: node.y1}
                );

                return function(progress) {
                    const current = i(progress);

                    // Calculate zoomed coordinates
                    const xScale = (d.x1 - d.x0);
                    const yScale = (d.y1 - d.y0);

                    const startAngle = Math.max(0, Math.min(2 * Math.PI, (current.x0 - d.x0) / xScale * 2 * Math.PI));
                    const endAngle = Math.max(0, Math.min(2 * Math.PI, (current.x1 - d.x0) / xScale * 2 * Math.PI));
                    const innerRadius = Math.max(0, (current.y0 - d.y0) / yScale * radius);
                    const outerRadius = Math.max(0, (current.y1 - d.y0) / yScale * radius);

                    const zoomArc = d3.arc()
                        .startAngle(startAngle)
                        .endAngle(endAngle)
                        .innerRadius(innerRadius)
                        .outerRadius(outerRadius);

                    return zoomArc(current);
                };
            })
            .style('opacity', function(node) {
                // Show clicked node and all its descendants, hide others
                return isVisible(node, d) ? 0.95 : 0;
            })
            .style('pointer-events', function(node) {
                return isVisible(node, d) ? 'auto' : 'none';
            });

        // Update center text
        centerText.text(truncateText(d.data.name, 20));
    }

    // Reset zoom
    function resetZoom() {
        // Reset to root
        focusedNode = root;

        // Transition with same duration and easing as zoom
        const t = svg.transition()
            .duration(750)
            .ease(d3.easeCubicInOut);

        // Restore all paths with zoom-out animation
        paths.transition(t)
            .attrTween('d', function(node) {
                // Interpolate back to original arc
                return function(progress) {
                    // If currently focused, interpolate from zoomed to original
                    if (focusedNode !== root) {
                        const xScale = (focusedNode.x1 - focusedNode.x0);
                        const yScale = (focusedNode.y1 - focusedNode.y0);

                        // Interpolate from zoomed to original
                        const currentStartAngle = d3.interpolate(
                            Math.max(0, Math.min(2 * Math.PI, (node.x0 - focusedNode.x0) / xScale * 2 * Math.PI)),
                            node.x0
                        )(progress);
                        const currentEndAngle = d3.interpolate(
                            Math.max(0, Math.min(2 * Math.PI, (node.x1 - focusedNode.x0) / xScale * 2 * Math.PI)),
                            node.x1
                        )(progress);
                        const currentInnerRadius = d3.interpolate(
                            Math.max(0, (node.y0 - focusedNode.y0) / yScale * radius),
                            node.y0
                        )(progress);
                        const currentOuterRadius = d3.interpolate(
                            Math.max(0, (node.y1 - focusedNode.y0) / yScale * radius),
                            node.y1
                        )(progress);

                        const resetArc = d3.arc()
                            .startAngle(currentStartAngle)
                            .endAngle(currentEndAngle)
                            .innerRadius(currentInnerRadius)
                            .outerRadius(currentOuterRadius);

                        return resetArc(node);
                    }
                    return arc(node);
                };
            })
            .style('opacity', 0.95)
            .style('pointer-events', 'auto');

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
