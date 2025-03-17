import React, { useEffect, useState } from 'react';
import SearchBar from './SearchBar';
import AnnotationsList from './components/AnnotationsList';
import GraphControls from './components/GraphControls';
import GraphVisualizer from './components/GraphVisualizer';

export default function GraphView() {
    const [clusterDistance, setClusterDistance] = useState(0.4);
    const [nodeSize, setNodeSize] = useState(3);
    const [searchTerm, setSearchTerm] = useState('');
    const [graphData, setGraphData] = useState({ nodes: [], links: [] });
    const [annotations, setAnnotations] = useState([]);
    const [selectedAnnotation, setSelectedAnnotation] = useState(null);
    const [filter, setFilter] = useState("all");
    

      // New force control states
    const [centerForceStrength, setCenterForceStrength] = useState(1);
    const [repelForceStrength, setRepelForceStrength] = useState(-80);
    const [linkForceStrength, setLinkForceStrength] = useState(70); 
    const [linkDistance, setLinkDistance] = useState(60);
    

    // Load annotations from localStorage
    useEffect(() => {
        const loadAnnotations = () => {
            chrome.storage.local.get("savedTexts", (data) => {
                const loadedAnnotations = data.savedTexts || [];
                setAnnotations(loadedAnnotations);
                
                // Transform annotations to graph data
                const graphData = transformAnnotationsToGraphData(loadedAnnotations);
                setGraphData(graphData);
            });
        };
        
        loadAnnotations();
        
        // Listen for changes in storage
        const handleStorageChange = (changes, area) => {
            if (area === "local" && changes.savedTexts) {
                const newAnnotations = changes.savedTexts.newValue || [];
                setAnnotations(newAnnotations);
                
                const graphData = transformAnnotationsToGraphData(newAnnotations);
                setGraphData(graphData);
            }
        };
        
        chrome.storage.onChanged.addListener(handleStorageChange);
        
        return () => {
            chrome.storage.onChanged.removeListener(handleStorageChange);
        };
    }, []);
    
    // Transform annotations to graph data format
    const transformAnnotationsToGraphData = (annotations) => {
        console.log("Processing annotations:", annotations);
        
        // Create nodes from annotations (using INDEX as ID instead of title)
        const nodes = annotations.map((annotation, index) => ({
            id: `node-${index}`, // Use index-based ID for uniqueness
            title: annotation.title || `Untitled ${index}`, // Keep title as a display property
            text: annotation.text,
            url: annotation.url,
            group: Math.floor(Math.random() * 7) + 1,
            tags: annotation.tags || [],
            originalIndex: index
        }));
        
        // Debug: Examine node tags
        nodes.forEach(node => {
            console.log(`Node #${node.originalIndex} "${node.title}" has tags:`, node.tags);
        });
        
        // Create links based on shared tags
        const links = [];
        
        // Create a map of normalized tag -> node IDs for efficient lookup
        const tagToNodeMap = {};
        
        // Process all tags from all nodes and build the tag map
        nodes.forEach(node => {
            if (!node.tags || !Array.isArray(node.tags) || node.tags.length === 0) {
                console.log(`Node #${node.originalIndex} "${node.title}" has no tags or invalid tags format`);
                return;
            }
            
            node.tags.forEach(tag => {
                // Extract tag text, handling different possible formats
                let tagText;
                
                if (typeof tag === 'string') {
                    tagText = tag;
                } else if (tag && typeof tag === 'object' && tag.text) {
                    tagText = tag.text;
                } else {
                    console.log(`Skipping invalid tag format:`, tag);
                    return;
                }
                
                // Skip empty tags
                if (!tagText || tagText.trim() === '') return;
                
                // Normalize tag text (lowercase, trim)
                const normalizedTag = tagText.toLowerCase().trim();
                console.log(`Node #${node.originalIndex} "${node.title}" has normalized tag: "${normalizedTag}"`);
                
                if (!tagToNodeMap[normalizedTag]) {
                    tagToNodeMap[normalizedTag] = [];
                }
                
                // Add node to this tag's list if not already there
                if (!tagToNodeMap[normalizedTag].includes(node.id)) {
                    tagToNodeMap[normalizedTag].push(node.id);
                }
            });
        });
        
        // Debug: Print the tag mapping
        console.log("Tag to node mapping:", tagToNodeMap);
        
        // For each tag, create links between ALL nodes sharing that tag
        Object.entries(tagToNodeMap).forEach(([tagText, nodeIds]) => {
            console.log(`Processing tag "${tagText}" with ${nodeIds.length} nodes:`, nodeIds);
            
            if (nodeIds.length < 2) {
                console.log(`Skipping tag "${tagText}" - fewer than 2 nodes`);
                return; // Need at least 2 nodes to create a link
            }
            
            // Create a complete graph (all nodes connected to all other nodes)
            for (let i = 0; i < nodeIds.length; i++) {
                for (let j = i + 1; j < nodeIds.length; j++) {
                    const sourceId = nodeIds[i];
                    const targetId = nodeIds[j];
                    console.log(`Creating link between "${sourceId}" and "${targetId}" for tag "${tagText}"`);
                    
                    // Check if this link already exists
                    const existingLink = links.find(link => 
                        (link.source === sourceId && link.target === targetId) || 
                        (link.source === targetId && link.target === sourceId)
                    );
                    
                    if (!existingLink) {
                        links.push({
                            source: sourceId,
                            target: targetId,
                            value: 1,
                            tag: tagText
                        });
                    } else {
                        console.log(`Link already exists, incrementing value`);
                        existingLink.value += 1;
                        
                        if (!existingLink.tags) {
                            existingLink.tags = [existingLink.tag, tagText];
                        } else if (!existingLink.tags.includes(tagText)) {
                            existingLink.tags.push(tagText);
                        }
                    }
                }
            }
        });
        
        console.log(`Created graph with ${nodes.length} nodes and ${links.length} links:`, links);
        
        return { nodes, links };
    };
    
    // Extract all unique tags from annotations
    const getAllTags = () => {
        const tagSet = new Set();
        
        annotations.forEach(annotation => {
            if (annotation.tags && annotation.tags.length) {
                annotation.tags.forEach(tag => {
                    tagSet.add(tag.text || tag);
                });
            }
        });
        
        return Array.from(tagSet);
    };
    
    // Handle filter changes
    const handleFilterChange = (newFilter) => {
        setFilter(newFilter);
    };

    return (
        <div className="flex w-screen h-screen bg-[#1E1E1E]">
            <div className="w-[20%] h-full border-r border-gray-700 bg-[#1E1E1E] flex flex-col overflow-auto">
                <AnnotationsList 
                    annotations={annotations}
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    selectedAnnotation={selectedAnnotation}
                    setSelectedAnnotation={setSelectedAnnotation}
                    filter={filter}
                    handleFilterChange={handleFilterChange}
                />
            </div>
            
            <div className="w-[65%] h-full relative">
                <GraphVisualizer
                    graphData={graphData}
                    nodeSize={nodeSize}
                    clusterDistance={clusterDistance}
                    searchTerm={searchTerm}
                    centerForceStrength={centerForceStrength}
                    repelForceStrength={repelForceStrength}
                    linkForceStrength={linkForceStrength}
                    linkDistance={linkDistance}
                    onNodeClick={setSelectedAnnotation}
                    />
                

                
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2" style={{ width: '500px' }}>
                    <SearchBar 
                        searchQuery={searchTerm} 
                        setSearchQuery={setSearchTerm}
                        width="384px"
                        graphView={true}
                    />
                </div>
            </div>
            
            <div className="w-[15%] h-full bg-gray-800 border-l border-gray-700 overflow-auto">
            <GraphControls
                nodeSize={nodeSize}
                setNodeSize={setNodeSize}
                clusterDistance={clusterDistance}
                setClusterDistance={setClusterDistance}
                centerForceStrength={centerForceStrength}
                setCenterForceStrength={setCenterForceStrength}
                repelForceStrength={repelForceStrength}
                setRepelForceStrength={setRepelForceStrength}
                linkForceStrength={linkForceStrength}
                setLinkForceStrength={setLinkForceStrength}
                linkDistance={linkDistance}
                setLinkDistance={setLinkDistance}
                />
            </div>
        </div>
    );
}