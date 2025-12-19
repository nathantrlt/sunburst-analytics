/**
 * Sunburst Visualization using D3.js
 * Creates an interactive sunburst chart for visualizing user journey data
 */

let currentSunburstData = null;
let currentSunburstData2 = null;

function createSunburst(data, chartId = 'sunburstChart', tooltipId = 'sunburstTooltip') {
    // Store data globally for zoom/reset functionality
    if (chartId === 'sunburstChart') {
        currentSunburstData = data;
    } else if (chartId === 'sunburstChart2') {
        currentSunburstData2 = data;
    }

    // Clear existing chart
    const container = document.getElementById(chartId);
    if (!container) return;

    // Determine breadcrumb ID based on chart ID
    const breadcrumbId = chartId === 'sunburstChart' ? 'sunburstBreadcrumb' : 'sunburstBreadcrumb2';

    // Save breadcrumb element before clearing
    const breadcrumbElement = document.getElementById(breadcrumbId);
    const breadcrumbParent = breadcrumbElement ? breadcrumbElement.parentNode : null;
    const breadcrumbHTML = breadcrumbElement ? breadcrumbElement.outerHTML : '';

    // Clear only the chart, not the entire container
    container.innerHTML = '';

    // Restore breadcrumb if it existed
    if (breadcrumbHTML && breadcrumbParent === container) {
        container.insertAdjacentHTML('afterbegin', breadcrumbHTML);
    }

    // Dimensions - use square aspect ratio for proper sunburst display
    // Width 600px, Height 400px
    const width = 600;
    const height = 400;
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
    const svgElement = d3.select('#' + chartId)
        .append('svg')
        .attr('width', width)
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
        .attr('transform', `translate(${width / 2},${height / 2})`)
        .on('click', function(event) {
            // If clicking on the group background (not on a path), reset zoom
            if (event.target.tagName === 'g') {
                event.stopPropagation();
                resetZoom();
            }
        });

    // Create hierarchy
    const root = d3.hierarchy(data)
        .sum(d => d.value || 0)
        .sort((a, b) => b.value - a.value);

    // Calculate center hole size (15% of radius) and thinner rings
    const centerHoleRadius = radius * 0.15;
    const ringThickness = (radius - centerHoleRadius) / 5; // Thinner rings

    // Create partition layout
    const partition = d3.partition()
        .size([2 * Math.PI, radius - centerHoleRadius]);

    partition(root);

    // Track currently focused node for zoom state
    let focusedNode = root;
    let previousFocusedNode = root;

    // Arc generator with adjusted radii for center hole and thinner rings
    const arc = d3.arc()
        .startAngle(d => d.x0)
        .endAngle(d => d.x1)
        .innerRadius(d => centerHoleRadius + d.y0)
        .outerRadius(d => centerHoleRadius + d.y1);

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
        .attr('stroke-width', 0.25)
        .style('cursor', 'pointer')
        .on('mouseover', handleMouseOver)
        .on('mouseout', handleMouseOut)
        .on('click', handleClick);

    // Center text removed - keeping variable for compatibility
    const centerText = { text: () => {} };

    // Initialize breadcrumb - hide it initially
    const breadcrumb = document.getElementById(breadcrumbId);
    if (breadcrumb) {
        breadcrumb.style.display = 'none';
    }

    // Mouse over handler
    function handleMouseOver(event, d) {
        // Highlight path
        d3.select(event.currentTarget)
            .attr('fill-opacity', 1);

        // Show tooltip
        showTooltip(event, d);

        // Update center text
        centerText.text(truncateText(d.data.name, 20));
    }

    // Mouse out handler
    function handleMouseOut(event, d) {
        d3.select(event.currentTarget)
            .attr('fill-opacity', 0.95);

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
        const xScale = (focus.x1 - focus.x0) || 0.01; // Avoid division by zero

        // For angles: full circle transformation (no scaling - must close the circle)
        const startAngle = Math.max(0, Math.min(2 * Math.PI, (node.x0 - focus.x0) / xScale * 2 * Math.PI));
        const endAngle = Math.max(0, Math.min(2 * Math.PI, (node.x1 - focus.x0) / xScale * 2 * Math.PI));

        // For radius: keep the same ring thickness as the original sunburst
        // Calculate the depth difference relative to the focused node
        const depthDiff = node.depth - focus.depth;
        const maxDepth = root.height; // Maximum depth of the tree

        // Use the effective radius (total radius - center hole)
        const effectiveRadius = radius - centerHoleRadius;

        // Calculate ring thickness based on max depth to keep consistent dimensions
        const ringThickness = effectiveRadius / maxDepth;

        // Position based on relative depth from focused node
        const innerRadius = centerHoleRadius + (depthDiff * ringThickness);
        const outerRadius = centerHoleRadius + ((depthDiff + 1) * ringThickness);

        return {
            startAngle: startAngle,
            endAngle: endAngle,
            innerRadius: Math.max(centerHoleRadius, innerRadius),
            outerRadius: Math.max(centerHoleRadius, outerRadius)
        };
    }

    // Click handler for zooming
    function handleClick(event, d) {
        event.stopPropagation();

        // Store previous focus for interpolation
        previousFocusedNode = focusedNode;

        // Update focused node
        focusedNode = d;

        // Update breadcrumb
        updateBreadcrumb(d);

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
                    // For first zoom from root, use actual original arc coordinates WITH center hole
                    const startPos = previousFocusedNode === root ? {
                        startAngle: node.x0,
                        endAngle: node.x1,
                        innerRadius: centerHoleRadius + node.y0,
                        outerRadius: centerHoleRadius + node.y1
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

        // Update breadcrumb
        updateBreadcrumb(root);

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

                    // Calculate end position (back to root = original arc with center hole)
                    const endPos = {
                        startAngle: node.x0,
                        endAngle: node.x1,
                        innerRadius: centerHoleRadius + node.y0,
                        outerRadius: centerHoleRadius + node.y1
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
        const tooltip = document.getElementById(tooltipId);

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
        const tooltip = document.getElementById(tooltipId);
        tooltip.style.display = 'none';
    }

    // Update breadcrumb trail
    function updateBreadcrumb(node) {
        const breadcrumb = document.getElementById(breadcrumbId);
        if (!breadcrumb) return;

        // Build path from root to current node
        const pathParts = [];
        let current = node;
        while (current.parent) {
            pathParts.unshift(current.data.name);
            current = current.parent;
        }

        // If at root, hide the breadcrumb
        if (pathParts.length === 0) {
            breadcrumb.style.display = 'none';
            return;
        }

        // Show breadcrumb when there's a path
        breadcrumb.style.display = 'block';

        // Build breadcrumb HTML - start directly with the first segment
        let breadcrumbHTML = '';

        pathParts.forEach((part, index) => {
            const truncated = truncateText(part, 25);
            if (index > 0) {
                breadcrumbHTML += ` <span class="breadcrumb-separator">›</span> `;
            }
            breadcrumbHTML += `<span class="breadcrumb-item breadcrumb-clickable" data-depth="${index + 1}">${truncated}</span>`;
        });

        breadcrumb.innerHTML = breadcrumbHTML;

        // Add click handlers to breadcrumb items
        breadcrumb.querySelectorAll('.breadcrumb-clickable').forEach((item, index) => {
            item.addEventListener('click', () => {
                // Navigate to that level
                let targetNode = node;
                const targetDepth = parseInt(item.getAttribute('data-depth'));

                // Go up the tree to reach the target depth
                while (targetNode && targetNode.depth > targetDepth) {
                    targetNode = targetNode.parent;
                }

                if (targetNode) {
                    if (targetNode === root || !targetNode.parent) {
                        resetZoom();
                    } else {
                        handleClick({stopPropagation: () => {}}, targetNode);
                    }
                }
            });
        });
    }

    // Truncate text helper
    function truncateText(text, maxLength) {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    // Make it responsive - handled globally below
}

/**
 * Hierarchical Sunburst - Children fill their parent's arc completely
 * Like the ContentSquare style where each child subdivides the parent's space
 */
function createConcentricSunburst(data, chartId = 'sunburstChart2', tooltipId = 'sunburstTooltip2') {
    // Store data globally
    currentSunburstData2 = data;

    // Clear existing chart
    const container = document.getElementById(chartId);
    if (!container) return;

    // Determine breadcrumb ID
    const breadcrumbId = 'sunburstBreadcrumb2';

    // Save breadcrumb element before clearing
    const breadcrumbElement = document.getElementById(breadcrumbId);
    const breadcrumbParent = breadcrumbElement ? breadcrumbElement.parentNode : null;
    const breadcrumbHTML = breadcrumbElement ? breadcrumbElement.outerHTML : '';

    // Clear container
    container.innerHTML = '';

    // Restore breadcrumb
    if (breadcrumbHTML && breadcrumbParent === container) {
        container.insertAdjacentHTML('afterbegin', breadcrumbHTML);
    }

    // Dimensions - Small compact size for second sunburst
    const width = 300;
    const height = 300;
    const radius = Math.min(width, height) / 2;
    const centerHoleRadius = radius * 0.25;

    // Color function
    const getColor = (name) => {
        if (window.getCategoryColor) {
            return window.getCategoryColor(name);
        }
        const fallbackColor = d3.scaleOrdinal(d3.schemeCategory10);
        return fallbackColor(name);
    };

    // Create SVG
    const svgElement = d3.select('#' + chartId)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .attr('viewBox', `0 0 ${width} ${height}`)
        .style('display', 'block')
        .style('margin', '0 auto');

    const svg = svgElement.append('g')
        .attr('transform', `translate(${width / 2},${height / 2})`)
        .on('click', function(event) {
            // If clicking on the group background (not on a path), reset zoom
            if (event.target.tagName === 'g') {
                event.stopPropagation();
                resetZoom();
            }
        });

    // Create hierarchy
    const root = d3.hierarchy(data)
        .sum(d => d.value || 0)
        .sort((a, b) => b.value - a.value);

    // Track currently focused node for zoom state
    let focusedNode = root;
    let previousFocusedNode = root;

    // Calculate angles where children fill parent's arc completely
    function calculateAngles(node, startAngle, endAngle) {
        node.x0 = startAngle;
        node.x1 = endAngle;

        if (node.children && node.children.length > 0) {
            const totalValue = d3.sum(node.children, d => d.value);
            let currentAngle = startAngle;

            node.children.forEach(child => {
                const proportion = child.value / totalValue;
                const childAngleSize = (endAngle - startAngle) * proportion;
                calculateAngles(child, currentAngle, currentAngle + childAngleSize);
                currentAngle += childAngleSize;
            });
        }
    }

    // Initialize angles starting from full circle
    calculateAngles(root, 0, 2 * Math.PI);

    // Calculate radii
    const maxDepth = root.height;
    const effectiveRadius = radius - centerHoleRadius;
    const ringThickness = effectiveRadius / maxDepth;

    root.each(node => {
        node.y0 = node.depth * ringThickness;
        node.y1 = (node.depth + 1) * ringThickness;
    });

    // Arc generator
    const arc = d3.arc()
        .startAngle(d => d.x0)
        .endAngle(d => d.x1)
        .innerRadius(d => centerHoleRadius + d.y0)
        .outerRadius(d => centerHoleRadius + d.y1);

    // Create paths
    const paths = svg.selectAll('path')
        .data(root.descendants().filter(d => d.depth > 0))
        .enter()
        .append('path')
        .attr('d', arc)
        .attr('fill', d => getColor(d.data.name))
        .attr('fill-opacity', 0.95)
        .attr('stroke', '#fff')
        .attr('stroke-width', 0.25)
        .style('cursor', 'pointer')
        .on('mouseover', handleMouseOver)
        .on('mouseout', handleMouseOut)
        .on('click', handleClick);

    // Mouse over handler
    function handleMouseOver(event, d) {
        d3.select(event.currentTarget).attr('fill-opacity', 1);
        showTooltip(event, d);
    }

    // Mouse out handler
    function handleMouseOut(event, d) {
        d3.select(event.currentTarget).attr('fill-opacity', 0.95);
        hideTooltip();
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
        const xScale = (focus.x1 - focus.x0) || 0.01;

        // For angles: relative to focused node
        const startAngle = Math.max(0, Math.min(2 * Math.PI, (node.x0 - focus.x0) / xScale * 2 * Math.PI));
        const endAngle = Math.max(0, Math.min(2 * Math.PI, (node.x1 - focus.x0) / xScale * 2 * Math.PI));

        // For radius: maintain constant ring thickness
        const depthDiff = node.depth - focus.depth;
        const maxDepth = root.height;
        const effectiveRadius = radius - centerHoleRadius;
        const ringThickness = effectiveRadius / maxDepth;

        const innerRadius = centerHoleRadius + (depthDiff * ringThickness);
        const outerRadius = centerHoleRadius + ((depthDiff + 1) * ringThickness);

        return {
            startAngle: startAngle,
            endAngle: endAngle,
            innerRadius: Math.max(centerHoleRadius, innerRadius),
            outerRadius: Math.max(centerHoleRadius, outerRadius)
        };
    }

    // Click handler for zooming
    function handleClick(event, d) {
        event.stopPropagation();

        // Store previous focus for interpolation
        previousFocusedNode = focusedNode;

        // Update focused node
        focusedNode = d;

        // Update breadcrumb
        updateBreadcrumb(d);

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
                    const startPos = previousFocusedNode === root ? {
                        startAngle: node.x0,
                        endAngle: node.x1,
                        innerRadius: centerHoleRadius + node.y0,
                        outerRadius: centerHoleRadius + node.y1
                    } : arcPosition(node, previousFocusedNode);

                    // Calculate end position (to new focus)
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
                    const currentOpacity = parseFloat(d3.select(this).style('opacity')) || 0.95;
                    const targetOpacity = willBeVisible ? 0.95 : 0;
                    return d3.interpolate(currentOpacity, targetOpacity);
                })
                .on('end', function() {
                    d3.select(this).style('pointer-events', willBeVisible ? 'auto' : 'none');
                });
        });
    }

    // Reset zoom
    function resetZoom() {
        // Store previous focus for interpolation
        previousFocusedNode = focusedNode;

        // Reset to root
        focusedNode = root;

        // Update breadcrumb
        updateBreadcrumb(root);

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
                        innerRadius: centerHoleRadius + node.y0,
                        outerRadius: centerHoleRadius + node.y1
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
                    const currentOpacity = parseFloat(d3.select(this).style('opacity')) || 0;
                    return d3.interpolate(currentOpacity, 0.95);
                })
                .on('end', function() {
                    d3.select(this).style('pointer-events', 'auto');
                });
        });
    }

    // Show tooltip
    function showTooltip(event, d) {
        const tooltip = document.getElementById(tooltipId);
        const percentage = ((d.value / root.value) * 100).toFixed(1);

        // Build path
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

        const tooltipWidth = 300;
        const tooltipHeight = 150;
        let left = event.clientX + 15;
        let top = event.clientY + 15;

        if (left + tooltipWidth > window.innerWidth) {
            left = event.clientX - tooltipWidth - 15;
        }
        if (top + tooltipHeight > window.innerHeight) {
            top = event.clientY - tooltipHeight - 15;
        }

        tooltip.style.left = left + 'px';
        tooltip.style.top = top + 'px';
    }

    function hideTooltip() {
        const tooltip = document.getElementById(tooltipId);
        tooltip.style.display = 'none';
    }

    function truncateText(text, maxLength) {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    // Update breadcrumb trail
    function updateBreadcrumb(node) {
        const breadcrumb = document.getElementById(breadcrumbId);
        if (!breadcrumb) return;

        // Build path from root to current node
        const pathParts = [];
        let current = node;
        while (current.parent) {
            pathParts.unshift(current.data.name);
            current = current.parent;
        }

        // If at root, hide the breadcrumb
        if (pathParts.length === 0) {
            breadcrumb.style.display = 'none';
            return;
        }

        // Show breadcrumb when there's a path
        breadcrumb.style.display = 'block';

        // Build breadcrumb HTML - start directly with the first segment
        let breadcrumbHTML = '';

        pathParts.forEach((part, index) => {
            const truncated = truncateText(part, 25);
            if (index > 0) {
                breadcrumbHTML += ` <span class="breadcrumb-separator">›</span> `;
            }
            breadcrumbHTML += `<span class="breadcrumb-item breadcrumb-clickable" data-depth="${index + 1}">${truncated}</span>`;
        });

        breadcrumb.innerHTML = breadcrumbHTML;

        // Add click handlers to breadcrumb items
        breadcrumb.querySelectorAll('.breadcrumb-clickable').forEach((item, index) => {
            item.addEventListener('click', () => {
                // Navigate to that level
                let targetNode = node;
                const targetDepth = parseInt(item.getAttribute('data-depth'));

                // Go up the tree to reach the target depth
                while (targetNode && targetNode.depth > targetDepth) {
                    targetNode = targetNode.parent;
                }

                if (targetNode) {
                    if (targetNode === root || !targetNode.parent) {
                        resetZoom();
                    } else {
                        handleClick({stopPropagation: () => {}}, targetNode);
                    }
                }
            });
        });
    }

    // Initialize breadcrumb
    updateBreadcrumb(root);
}

// Global resize handler for all sunbursts
window.addEventListener('resize', debounce(() => {
    if (currentSunburstData) {
        createSunburst(currentSunburstData, 'sunburstChart', 'sunburstTooltip');
    }
    if (currentSunburstData2) {
        createConcentricSunburst(currentSunburstData2, 'sunburstChart2', 'sunburstTooltip2');
    }
}, 250));

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
window.createConcentricSunburst = createConcentricSunburst;
