import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from 'd3-force';

export default function GraphVisualizer({ 
    graphData, 
    clusterDistance, 
    nodeSize, 
    searchTerm,
    onNodeClick,
    centerForceStrength = 1,
    repelForceStrength = -80, 
    linkForceStrength = 0.7,
    linkDistance = 60
}) {
    const graphRef = useRef(null);
    const simulationRef = useRef(null);
    
    // Save dimensions for responsiveness
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    
    // Set up resize observer to detect container size changes
    useEffect(() => {
        if (!graphRef.current) return;
        
        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                const { width, height } = entry.contentRect;
                setDimensions({ width, height });
            }
        });
        
        resizeObserver.observe(graphRef.current);
        
        return () => {
            if (graphRef.current) {
                resizeObserver.unobserve(graphRef.current);
            }
        };
    }, []);
    
    // Update graph when dimensions change
    useEffect(() => {
        if (dimensions.width > 0 && dimensions.height > 0) {
            updateGraph();
        }
    }, [dimensions]);
    
    // Create and update the graph visualization
    const updateGraph = () => {
        if (!graphRef.current || !graphData.nodes || graphData.nodes.length === 0) return;
        
        // Clear previous SVG
        d3.select(graphRef.current).select("svg").remove();
        
        const width = dimensions.width;
        const height = dimensions.height;
        
        // Create SVG
        const svg = d3.select(graphRef.current)
            .append("svg")
            .attr("width", width)
            .attr("height", height);
            
        // Add zoom functionality
        const g = svg.append("g");
        
        const zoom = d3.zoom()
            .scaleExtent([0.1, 8])
            .on("zoom", (event) => {
                g.attr("transform", event.transform);
            });
        
        svg.call(zoom);
        
        // Handle search filter
        let filteredData = { ...graphData };
        
        // Add containment force to keep nodes within boundaries
        const boundaryForce = () => {
            const padding = 50; // Padding from the edges
            
            for (let node of filteredData.nodes) {
                // Right boundary with padding
                if (node.x > width - padding) node.x = width - padding;
                // Left boundary with padding 
                if (node.x < padding) node.x = padding;
                // Bottom boundary with padding
                if (node.y > height - padding) node.y = height - padding;
                // Top boundary with padding
                if (node.y < padding) node.y = padding;
            }
        };
            
        // Create force simulation
        const simulation = forceSimulation(filteredData.nodes)
            // Update link force with customizable parameters
            .force("link", forceLink(filteredData.links)
                .id(d => d.id)
                .strength(linkForceStrength * 0.01)
                .distance(d => Math.min(linkDistance, clusterDistance * 0.8)))
            // Make repel force customizable
            .force("charge", forceManyBody().strength(repelForceStrength))
            // Make center force customizable
            .force("center", forceCenter(width / 2, height / 2).strength(centerForceStrength * 0.01))
            // Increase collision radius slightly to prevent tight clustering
            .force("collide", forceCollide().radius(nodeSize * 1.3))
            // Reduce the strength of global attraction forces
            .force("x", d3.forceX(width / 2).strength(0.02))
            .force("y", d3.forceY(height / 2).strength(0.02))
            .on("tick", () => {
                boundaryForce(); // Apply boundary constraints
                
                // Update positions for links with arrows
                link.each(function(d) {
                     const sourceX = d.source.x;
                     const sourceY = d.source.y;
                     const targetX = d.target.x;
                     const targetY = d.target.y;
                     const angle = Math.atan2(targetY - sourceY, targetX - sourceX);
                     
                     const targetRadius = (d.target.type === 'hub' ? nodeSize * 2.5 : nodeSize) + 2; // Target node radius + arrow offset
                     const arrowTargetX = targetX - targetRadius * Math.cos(angle);
                     const arrowTargetY = targetY - targetRadius * Math.sin(angle);
 
                     d3.select(this)
                         .attr("x1", sourceX)
                         .attr("y1", sourceY)
                         .attr("x2", arrowTargetX) // End line slightly before node edge
                         .attr("y2", arrowTargetY);
                 });
                    
                node
                    .attr("cx", d => d.x)
                    .attr("cy", d => d.y);
                    
                labels
                    .attr("x", d => d.x)
                    .attr("y", d => d.y);
            });
        
        // Store simulation reference for updates
        simulationRef.current = simulation;
            
        // Define arrow markers for directed links
        svg.append('defs').append('marker')
            .attr('id', 'arrowhead')
            .attr('viewBox', '-0 -5 10 10') // Coordinate system for marker
            .attr('refX', 8) // Position arrowhead relative to end of line
            .attr('refY', 0)
            .attr('orient', 'auto') // Orient arrow with line direction
            .attr('markerWidth', 6)
            .attr('markerHeight', 6)
            .attr('xoverflow', 'visible')
            .append('svg:path')
            .attr('d', 'M 0,-5 L 10 ,0 L 0,5') // Path for the arrow shape
            .attr('fill', '#999') // Arrow color
            .style('stroke','none');

        // Draw links
        const link = g.append("g")
            .selectAll("line")
            .data(filteredData.links)
            .enter()
            .append("line")
             // Style directed links differently
            .attr("stroke", d => d.directed ? "#999" : "#4C5D9E") 
            .attr("stroke-opacity", 0.6)
            .attr("stroke-width", d => d.directed ? 1.5 : 1)
             // Add arrowhead marker only to directed links
            .attr('marker-end', d => d.directed ? 'url(#arrowhead)' : 'none');
            
        // Draw nodes
        const node = g.append("g")
            .selectAll("circle")
            .data(filteredData.nodes)
            .enter()
            .append("circle")
            .attr("r", d => {
                 // Make hub nodes slightly larger
                 return d.type === 'hub' ? nodeSize * 2.5 : nodeSize;
            })
            .attr("fill", d => {
                // Different color scheme for hub nodes
                if (d.type === 'hub') {
                    // Color hubs based on their type (tag, domain, etc.)
                    switch (d.hubType) {
                        case 'tag': return '#FF8C00'; // Dark Orange
                        case 'time': return '#1E90FF'; // Dodger Blue
                        case 'domain': return '#32CD32'; // Lime Green
                        case 'page': return '#FFD700'; // Gold
                        case 'metadata': return '#9370DB'; // Medium Purple
                        default: return '#A9A9A9'; // Dark Gray
                    }
                }
                
                // Existing logic for annotation nodes
                if (d.tags && d.tags.length > 0) {
                    const tag = d.tags[0];
                    const tagText = tag.text || tag;
                    const hashCode = tagText.split('').reduce((a, b) => {
                        a = ((a << 5) - a) + b.charCodeAt(0);
                        return a & a;
                    }, 0);
                    
                    // Use predefined colors based on hash
                    const colors = ["#8A63D2", "#4285F4", "#34A853", "#FBBC05", "#EA4335", "#6B5B95", "#D64161"];
                    return colors[Math.abs(hashCode) % colors.length];
                }
                
                // Default coloring by group
                switch(d.group) {
                    case 1: return "#8A63D2"; // Purple 
                    case 2: return "#4285F4"; // Blue
                    case 3: return "#34A853"; // Green  
                    case 4: return "#FBBC05"; // Yellow
                    case 5: return "#EA4335"; // Red
                    case 6: return "#6B5B95"; // Purple-blue
                    default: return "#FFFFFF"; // White
                }
            })
            .on("click", (event, d) => {
                // Call parent callback when node is clicked
                if (d.originalIndex !== undefined) {
                    onNodeClick(d.originalIndex);
                }
            })
            .call(d3.drag()
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended));
                
        // Add tooltips for nodes (showing full title on hover)
        node.append("title")
            .text(d => d.title);
                
        // Add labels to nodes
        const labels = g.append("g")
            .selectAll("text")
            .data(filteredData.nodes)
            .enter()
            .append("text")
             // Display the title for both node types
            .text(d => {
                 const title = d.title || ''; // Ensure title exists
                 // Truncate long titles (especially for hub nodes like URLs)
                 return title.length > 25 ? title.substring(0, 22) + "..." : title;
             })
            .attr("font-size", "10px")
            .attr("dx", d => d.type === 'hub' ? nodeSize * 2.5 + 3 : nodeSize + 3) // Adjusted label position based on new node size
            .attr("dy", 4)
            .attr("fill", "#FFFFFF");
        
        // Drag functions
        function dragstarted(event, d) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        }
        
        function dragged(event, d) {
            d.fx = event.x;
            d.fy = event.y;
        }
        
        function dragended(event, d) {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
        }
        
        // Add double-click to reset zoom
        svg.on("dblclick.zoom", () => {
            svg.transition()
                .duration(750)
                .call(zoom.transform, d3.zoomIdentity);
        });
    };
    
    // Update graph when data or parameters change
    useEffect(() => {
        if (dimensions.width > 0 && dimensions.height > 0) {
            updateGraph();
        }
    }, [graphData, clusterDistance, nodeSize, searchTerm, onNodeClick]);
    
    // Reheat simulation when sidebar widths change to redistribute nodes
    useEffect(() => {
        if (simulationRef.current) {
            simulationRef.current.alpha(0.3).restart();
        }
    }, [dimensions]);

    return <div className="w-full h-full" ref={graphRef}></div>;
} 