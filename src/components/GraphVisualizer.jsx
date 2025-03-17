import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from 'd3-force';

export default function GraphVisualizer({ 
    graphData, 
    clusterDistance, 
    nodeSize, 
    searchTerm,
    onNodeClick
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
            // Reduce link distance to bring connected nodes closer (was using clusterDistance directly)
            .force("link", forceLink(filteredData.links)
                .id(d => d.id)
                .distance(d => Math.min(30, clusterDistance * 0.6)))
            // Reduce repulsion strength to allow nodes to get closer 
            .force("charge", forceManyBody().strength(-120))
            .force("center", forceCenter(width / 2, height / 2))
            // Reduce collision radius to allow closer packing 
            .force("collide", forceCollide().radius(nodeSize * 1.2))
            // Add a weak global attraction force to pull nodes toward the center
            .force("x", d3.forceX(width / 2).strength(0.03))
            .force("y", d3.forceY(height / 2).strength(0.03))
            .on("tick", () => {
                boundaryForce(); // Apply boundary constraints
                
                link
                    .attr("x1", d => d.source.x)
                    .attr("y1", d => d.source.y)
                    .attr("x2", d => d.target.x)
                    .attr("y2", d => d.target.y);
                    
                node
                    .attr("cx", d => d.x)
                    .attr("cy", d => d.y);
                    
                labels
                    .attr("x", d => d.x)
                    .attr("y", d => d.y);
            });
        
        // Store simulation reference for updates
        simulationRef.current = simulation;
            
        // Draw links
        const link = g.append("g")
            .selectAll("line")
            .data(filteredData.links)
            .enter()
            .append("line")
            .attr("stroke", "#4C5D9E")
            .attr("stroke-opacity", 0.6)
            .attr("stroke-width", 1);
            
        // Draw nodes
        const node = g.append("g")
            .selectAll("circle")
            .data(filteredData.nodes)
            .enter()
            .append("circle")
            .attr("r", d => d.size || nodeSize)
            .attr("fill", d => {
                if (d.tags && d.tags.length > 0) {
                    // Generate color based on first tag
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
            .text(d => d.id);
                
        // Add labels to nodes
        const labels = g.append("g")
            .selectAll("text")
            .data(filteredData.nodes)
            .enter()
            .append("text")
            .text(d => d.id.length > 20 ? d.id.substring(0, 20) + "..." : d.id)
            .attr("font-size", "10px")
            .attr("dx", 12)
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