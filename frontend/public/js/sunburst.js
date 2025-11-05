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
    const svg = d3.select('#sunburstChart')
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
        .append('g')
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
            .duration(750);

        // Update each path
        paths.each(function(node) {
            const path = d3.select(this);

            // Check if this node should be visible
            const visible = isVisible(node, d);

            // Animate opacity
            path.transition(t)
                .style('opacity', visible ? 0.95 : 0)
                .style('pointer-events', visible ? 'auto' : 'none');

            // Animate arc transformation if visible
            if (visible) {
                path.transition(t)
                    .attrTween('d', () => {
                        const xd = d3.interpolate(
                            [(node.x0 - d.x0) / (d.x1 - d.x0) * 2 * Math.PI,
                             (node.x1 - d.x0) / (d.x1 - d.x0) * 2 * Math.PI],
                            [(node.x0 - d.x0) / (d.x1 - d.x0) * 2 * Math.PI,
                             (node.x1 - d.x0) / (d.x1 - d.x0) * 2 * Math.PI]
                        );
                        const yd = d3.interpolate(
                            [(node.y0 - d.y0) / (d.y1 - d.y0) * radius,
                             (node.y1 - d.y0) / (d.y1 - d.y0) * radius],
                            [(node.y0 - d.y0) / (d.y1 - d.y0) * radius,
                             (node.y1 - d.y0) / (d.y1 - d.y0) * radius]
                        );

                        return () => {
                            const zoomArc = d3.arc()
                                .startAngle(Math.max(0, Math.min(2 * Math.PI, (node.x0 - d.x0) / (d.x1 - d.x0) * 2 * Math.PI)))
                                .endAngle(Math.max(0, Math.min(2 * Math.PI, (node.x1 - d.x0) / (d.x1 - d.x0) * 2 * Math.PI)))
                                .innerRadius(Math.max(0, (node.y0 - d.y0) / (d.y1 - d.y0) * radius))
                                .outerRadius(Math.max(0, (node.y1 - d.y0) / (d.y1 - d.y0) * radius));
                            return zoomArc(node);
                        };
                    });
            }
        });

        // Update center text
        centerText.text(truncateText(d.data.name, 20));
    }

    // Reset zoom
    function resetZoom() {
        // Reset to root
        focusedNode = root;

        // Transition
        const t = svg.transition()
            .duration(750);

        // Restore all paths
        paths.each(function(node) {
            const path = d3.select(this);

            // Make all nodes visible again
            path.transition(t)
                .style('opacity', 0.95)
                .style('pointer-events', 'auto')
                .attr('d', arc);
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
