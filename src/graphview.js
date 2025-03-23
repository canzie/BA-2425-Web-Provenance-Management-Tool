import React, { useEffect, useState } from 'react';
import SearchBar from './SearchBar';
import AnnotationsList from './components/AnnotationsList';
import GraphControls from './components/GraphControls';
import GraphVisualizer from './components/GraphVisualizer';

export default function GraphView() {
    const [clusterDistance, setClusterDistance] = useState(50);
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
    
    // Linking criteria state
    const [showLinkingCriteria, setShowLinkingCriteria] = useState(false);
    const [linkingCriteria, setLinkingCriteria] = useState({
        tags: true,
        similarTimeRange: false,
        baseLink: false,
        metadata: false
    });
    
    // Load annotations from localStorage
    useEffect(() => {
        const loadAnnotations = () => {
            console.log("Loading annotations from chrome.storage.local...");
            chrome.storage.local.get("savedTexts", (data) => {
                if (chrome.runtime.lastError) {
                    console.error("Error loading annotations:", chrome.runtime.lastError);
                    return;
                }
                
                const loadedAnnotations = data.savedTexts || [];
                console.log("Loaded annotations:", loadedAnnotations.length, loadedAnnotations);
                
                // Ensure all annotations are valid objects
                const validAnnotations = loadedAnnotations.filter(ann => 
                    ann && typeof ann === 'object'
                );
                
                if (validAnnotations.length !== loadedAnnotations.length) {
                    console.warn(`Filtered out ${loadedAnnotations.length - validAnnotations.length} invalid annotations`);
                }
                
                setAnnotations(validAnnotations);
                
                // Transform annotations to graph data
                const graphData = transformAnnotationsToGraphData(validAnnotations);
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
        
        // Load controls from localStorage if available
        const savedControls = localStorage.getItem('graphControls');
        if (savedControls) {
            try {
                const controls = JSON.parse(savedControls);
                if (controls.nodeSize) setNodeSize(controls.nodeSize);
                if (controls.clusterDistance) setClusterDistance(controls.clusterDistance);
                if (controls.centerForceStrength) setCenterForceStrength(controls.centerForceStrength);
                if (controls.repelForceStrength) setRepelForceStrength(controls.repelForceStrength);
                if (controls.linkForceStrength) setLinkForceStrength(controls.linkForceStrength);
                if (controls.linkDistance) setLinkDistance(controls.linkDistance);
            } catch (e) {
                console.error('Error restoring saved controls:', e);
            }
        }
        
        // Load linking criteria from localStorage
        const savedLinkingCriteria = localStorage.getItem('linkingCriteria');
        if (savedLinkingCriteria) {
            try {
                const criteria = JSON.parse(savedLinkingCriteria);
                setLinkingCriteria(criteria);
            } catch (e) {
                console.error('Error restoring linking criteria:', e);
            }
        }
        
        return () => {
            chrome.storage.onChanged.removeListener(handleStorageChange);
        };
    }, []);
    
    // Save linking criteria when it changes
    useEffect(() => {
        localStorage.setItem('linkingCriteria', JSON.stringify(linkingCriteria));
        
        // Re-generate graph data when linking criteria changes
        if (annotations.length > 0) {
            const newGraphData = transformAnnotationsToGraphData(annotations);
            setGraphData(newGraphData);
        }
    }, [linkingCriteria]);
    
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
            metadata: annotation.metadata || [],
            timestamp: annotation.timestamp,
            originalIndex: index
        }));
        
        // Debug: Examine node tags
        nodes.forEach(node => {
            console.log(`Node #${node.originalIndex} "${node.title}" has tags:`, node.tags);
        });
        
        // Create links based on shared tags
        const links = [];
        
        // Function to add links between nodes
        const addLinks = (sourceNode, targetNode, reason, value = 1) => {
            const existingLink = links.find(link => 
                (link.source === sourceNode.id && link.target === targetNode.id) || 
                (link.source === targetNode.id && link.target === sourceNode.id)
            );
            
            if (!existingLink) {
                links.push({
                    source: sourceNode.id,
                    target: targetNode.id,
                    value: value,
                    reason: [reason]
                });
            } else {
                existingLink.value += value;
                if (!existingLink.reason.includes(reason)) {
                    existingLink.reason.push(reason);
                }
            }
        };
        
        // Link by tags
        if (linkingCriteria.tags) {
            // Create a map of normalized tag -> node IDs for efficient lookup
            const tagToNodeMap = {};
            
            // Process all tags from all nodes and build the tag map
            nodes.forEach(node => {
                if (!node.tags || !Array.isArray(node.tags) || node.tags.length === 0) {
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
                        return;
                    }
                    
                    // Skip empty tags
                    if (!tagText || tagText.trim() === '') return;
                    
                    // Normalize tag text (lowercase, trim)
                    const normalizedTag = tagText.toLowerCase().trim();
                    
                    if (!tagToNodeMap[normalizedTag]) {
                        tagToNodeMap[normalizedTag] = [];
                    }
                    
                    // Add node to this tag's list if not already there
                    if (!tagToNodeMap[normalizedTag].includes(node)) {
                        tagToNodeMap[normalizedTag].push(node);
                    }
                });
            });
            
            // For each tag, create links between ALL nodes sharing that tag
            Object.entries(tagToNodeMap).forEach(([tagText, tagNodes]) => {
                if (tagNodes.length < 2) {
                    return; // Need at least 2 nodes to create a link
                }
                
                // Create a complete graph (all nodes connected to all other nodes)
                for (let i = 0; i < tagNodes.length; i++) {
                    for (let j = i + 1; j < tagNodes.length; j++) {
                        addLinks(tagNodes[i], tagNodes[j], `Tag: ${tagText}`);
                    }
                }
            });
        }
        
        // Link by similar time range
        if (linkingCriteria.similarTimeRange) {
            // Group nodes by time ranges (e.g., same day)
            const timeGroups = {};
            
            nodes.forEach(node => {
                if (!node.timestamp) return;
                
                // Extract date part only (YYYY-MM-DD)
                const date = new Date(node.timestamp);
                if (isNaN(date)) return;
                
                const dateStr = date.toISOString().split('T')[0];
                
                if (!timeGroups[dateStr]) {
                    timeGroups[dateStr] = [];
                }
                
                timeGroups[dateStr].push(node);
            });
            
            // Link nodes created on the same day
            Object.entries(timeGroups).forEach(([dateStr, timeNodes]) => {
                if (timeNodes.length < 2) return;
                
                for (let i = 0; i < timeNodes.length; i++) {
                    for (let j = i + 1; j < timeNodes.length; j++) {
                        addLinks(timeNodes[i], timeNodes[j], `Same day: ${dateStr}`);
                    }
                }
            });
        }
        
        // Link by base URL (domain)
        if (linkingCriteria.baseLink) {
            // Group nodes by domain
            const domainGroups = {};
            
            nodes.forEach(node => {
                if (!node.url) return;
                
                try {
                    const url = new URL(node.url);
                    const domain = url.hostname;
                    
                    if (!domainGroups[domain]) {
                        domainGroups[domain] = [];
                    }
                    
                    domainGroups[domain].push(node);
                } catch (e) {
                    console.error('Invalid URL:', node.url);
                }
            });
            
            // Link nodes from the same domain
            Object.entries(domainGroups).forEach(([domain, domainNodes]) => {
                if (domainNodes.length < 2) return;
                
                for (let i = 0; i < domainNodes.length; i++) {
                    for (let j = i + 1; j < domainNodes.length; j++) {
                        addLinks(domainNodes[i], domainNodes[j], `Same domain: ${domain}`);
                    }
                }
            });
        }
        
        // Link by shared metadata
        if (linkingCriteria.metadata) {
            // Create a map of metadata -> nodes
            const metadataToNodeMap = {};
            
            nodes.forEach(node => {
                if (!node.metadata || !Array.isArray(node.metadata) || node.metadata.length === 0) {
                    return;
                }
                
                node.metadata.forEach(meta => {
                    if (!meta || meta.trim() === '') return;
                    
                    const normalizedMeta = meta.toLowerCase().trim();
                    
                    if (!metadataToNodeMap[normalizedMeta]) {
                        metadataToNodeMap[normalizedMeta] = [];
                    }
                    
                    if (!metadataToNodeMap[normalizedMeta].includes(node)) {
                        metadataToNodeMap[normalizedMeta].push(node);
                    }
                });
            });
            
            // Link nodes with shared metadata
            Object.entries(metadataToNodeMap).forEach(([metaText, metaNodes]) => {
                if (metaNodes.length < 2) return;
                
                for (let i = 0; i < metaNodes.length; i++) {
                    for (let j = i + 1; j < metaNodes.length; j++) {
                        addLinks(metaNodes[i], metaNodes[j], `Shared metadata: ${metaText}`);
                    }
                }
            });
        }
        
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
    
    // Filter graph data based on search term
    const getFilteredGraphData = () => {
        if (!searchTerm.trim()) {
            return graphData;
        }
        
        const searchLower = searchTerm.toLowerCase();
        
        // Filter nodes that match the search
        const filteredNodes = graphData.nodes.filter(node => 
            (node.title && node.title.toLowerCase().includes(searchLower)) ||
            (node.text && node.text.toLowerCase().includes(searchLower)) ||
            (node.tags && node.tags.some(tag => {
                const tagText = typeof tag === 'string' ? tag : (tag.text || '');
                return tagText.toLowerCase().includes(searchLower);
            }))
        );
        
        // Get the IDs of filtered nodes
        const filteredNodeIds = new Set(filteredNodes.map(node => node.id));
        
        // Only include links where both source and target are in the filtered nodes
        const filteredLinks = graphData.links.filter(link => {
            const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
            const targetId = typeof link.target === 'object' ? link.target.id : link.target;
            return filteredNodeIds.has(sourceId) && filteredNodeIds.has(targetId);
        });
        
        return {
            nodes: filteredNodes,
            links: filteredLinks
        };
    };

    // Handle search changes
    const handleSearchChange = (value) => {
        setSearchTerm(value);
    };
    
    // Handle linking criteria change
    const handleLinkingCriteriaChange = (criterion) => {
        setLinkingCriteria(prev => ({
            ...prev,
            [criterion]: !prev[criterion]
        }));
    };

    // Get filtered data
    const filteredGraphData = getFilteredGraphData();
    
    // Identify connected components in the graph
    const identifyConnectedComponents = (graphData) => {
        if (!graphData.nodes || !graphData.links || graphData.nodes.length === 0) {
            return [];
        }
        
        // Create an adjacency list representation of the graph
        const adjacencyList = {};
        graphData.nodes.forEach(node => {
            adjacencyList[node.id] = [];
        });
        
        graphData.links.forEach(link => {
            const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
            const targetId = typeof link.target === 'object' ? link.target.id : link.target;
            
            if (adjacencyList[sourceId]) adjacencyList[sourceId].push(targetId);
            if (adjacencyList[targetId]) adjacencyList[targetId].push(sourceId);
        });
        
        // BFS to find connected components
        const visited = new Set();
        const components = [];
        
        const bfs = (startNode) => {
            const component = [];
            const queue = [startNode];
            visited.add(startNode);
            
            while (queue.length > 0) {
                const current = queue.shift();
                const node = graphData.nodes.find(n => n.id === current);
                if (node && node.originalIndex !== undefined) {
                    component.push(node.originalIndex);
                }
                
                if (adjacencyList[current]) {
                    adjacencyList[current].forEach(neighbor => {
                        if (!visited.has(neighbor)) {
                            visited.add(neighbor);
                            queue.push(neighbor);
                        }
                    });
                }
            }
            
            return component;
        };
        
        // Find all connected components
        graphData.nodes.forEach(node => {
            if (!visited.has(node.id)) {
                const component = bfs(node.id);
                if (component.length > 0) {
                    components.push(component);
                }
            }
        });
        
        // Handle isolated nodes (no connections)
        graphData.nodes.forEach(node => {
            if (node.originalIndex !== undefined && 
                !components.some(comp => comp.includes(node.originalIndex))) {
                components.push([node.originalIndex]);
            }
        });
        
        // Sort components by size (largest first)
        components.sort((a, b) => b.length - a.length);
        
        return components;
    };
    
    // Get the connected components
    const connectedComponents = identifyConnectedComponents(filteredGraphData);
    
    // Debug function to reset data
    const resetData = () => {
        if (window.confirm("WARNING: This will delete all your annotations. Continue?")) {
            chrome.storage.local.set({ savedTexts: [] }, () => {
                console.log("Data reset completed");
                alert("Data has been reset. Please refresh the page.");
            });
        }
    };
    
    // Debug function to list stored data
    const debugStoredData = () => {
        chrome.storage.local.get(null, (data) => {
            console.log("All stored data:", data);
        });
    };
    
    // Sample data for testing
    const addSampleData = () => {
        const sampleAnnotations = [
            {
                title: "Sample Note 1",
                text: "This is a sample annotation for testing",
                tags: ["test", "sample"],
                url: "https://example.com",
                timestamp: new Date().toISOString()
            },
            {
                title: "Sample Note 2",
                text: "Another sample annotation with different tags",
                tags: ["important", "demo"],
                url: "https://example.org",
                timestamp: new Date().toISOString()
            }
        ];
        
        chrome.storage.local.set({ savedTexts: sampleAnnotations }, () => {
            console.log("Sample data added");
            alert("Sample data added. Please refresh the page.");
        });
    };

    return (
        <div className="flex w-screen h-screen bg-[#1E1E1E]">
            {/* Debug panel - only visible in development */}
            {process.env.NODE_ENV !== 'production' && (
                <div className="fixed bottom-4 right-4 z-50 bg-[#363636] p-2 rounded shadow-lg border border-gray-700">
                    <div className="text-xs text-white font-bold mb-1">Debug Tools:</div>
                    <div className="flex flex-col space-y-1">
                        <button 
                            className="bg-blue-600 text-white text-xs py-1 px-2 rounded"
                            onClick={debugStoredData}
                        >
                            Log Storage
                        </button>
                        <button 
                            className="bg-green-600 text-white text-xs py-1 px-2 rounded"
                            onClick={addSampleData}
                        >
                            Add Sample Data
                        </button>
                        <button 
                            className="bg-red-600 text-white text-xs py-1 px-2 rounded"
                            onClick={resetData}
                        >
                            Reset Data
                        </button>
                        <div className="text-white text-xs">
                            Annotations: {annotations.length}
                        </div>
                    </div>
                </div>
            )}
            
            <div className="w-[20%] h-full border-r border-gray-700 bg-[#1E1E1E] flex flex-col overflow-auto">
                <AnnotationsList 
                    annotations={annotations}
                    searchTerm={searchTerm}
                    setSearchTerm={handleSearchChange}
                    selectedAnnotation={selectedAnnotation}
                    setSelectedAnnotation={setSelectedAnnotation}
                    filter={filter}
                    handleFilterChange={handleFilterChange}
                    connectedComponents={connectedComponents}
                />
            </div>
            
            <div className="w-[65%] h-full relative">
                <GraphVisualizer
                    graphData={filteredGraphData}
                    nodeSize={nodeSize}
                    clusterDistance={clusterDistance}
                    searchTerm={searchTerm}
                    centerForceStrength={centerForceStrength}
                    repelForceStrength={repelForceStrength}
                    linkForceStrength={linkForceStrength}
                    linkDistance={linkDistance}
                    onNodeClick={setSelectedAnnotation}
                    />
                
                {/* Linking Criteria Menu */}
                <div className="absolute top-4 right-4 z-10">
                    <button 
                        className="bg-violet-500 text-white rounded-md py-2 px-4 shadow-lg hover:bg-violet-600 transition-colors"
                        onClick={() => setShowLinkingCriteria(!showLinkingCriteria)}
                    >
                        {showLinkingCriteria ? 'Hide Linking Options' : 'Linking Options'}
                    </button>
                    
                    {showLinkingCriteria && (
                        <div className="mt-2 p-4 bg-[#363636] rounded-md shadow-xl border border-gray-700">
                            <h3 className="text-white font-medium mb-2">Link nodes by:</h3>
                            <div className="space-y-2">
                                <label className="flex items-center text-white cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={linkingCriteria.tags} 
                                        onChange={() => handleLinkingCriteriaChange('tags')}
                                        className="mr-2 accent-violet-500"
                                    />
                                    Tags
                                </label>
                                <label className="flex items-center text-white cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={linkingCriteria.similarTimeRange} 
                                        onChange={() => handleLinkingCriteriaChange('similarTimeRange')}
                                        className="mr-2 accent-violet-500"
                                    />
                                    Similar Time Range
                                </label>
                                <label className="flex items-center text-white cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={linkingCriteria.baseLink} 
                                        onChange={() => handleLinkingCriteriaChange('baseLink')}
                                        className="mr-2 accent-violet-500"
                                    />
                                    Same Domain
                                </label>
                                <label className="flex items-center text-white cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={linkingCriteria.metadata} 
                                        onChange={() => handleLinkingCriteriaChange('metadata')}
                                        className="mr-2 accent-violet-500"
                                    />
                                    Shared Metadata
                                </label>
                            </div>
                        </div>
                    )}
                </div>
                
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2" style={{ width: '500px' }}>
                    <SearchBar 
                        searchQuery={searchTerm} 
                        setSearchQuery={handleSearchChange}
                        width="384px"
                        graphView={true}
                    />
                </div>
            </div>
            
            <div className="w-[15%] h-full bg-[#363636] border-l border-gray-700 overflow-auto">
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