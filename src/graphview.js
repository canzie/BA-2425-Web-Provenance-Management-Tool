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
    
    // Add state for sidebar collapse
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
    
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
        metadata: false,
        samePage: false
    });
    
    // Time range state
    const [timeRange, setTimeRange] = useState(1); // Default 1 day
    const timeRangeOptions = [
        { value: 0.5, label: "12 hours" },
        { value: 1, label: "1 day" },
        { value: 7, label: "1 week" },
        { value: 30, label: "1 month" },
        { value: 90, label: "3 months" },
        { value: 180, label: "6 months" }
    ];
    
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
    }, [linkingCriteria, timeRange]);
    
    // Transform annotations to graph data format
    const transformAnnotationsToGraphData = (annotations) => {
        console.log("Processing annotations:", annotations);
        
        // Create nodes from annotations
        const annotationNodes = annotations.map((annotation, index) => ({
            id: `node-${index}`, // Use index-based ID for uniqueness
            type: 'annotation', // Add type property
            title: annotation.title || `Untitled ${index}`,
            text: annotation.text,
            url: annotation.url,
            group: Math.floor(Math.random() * 7) + 1, // Keep random group for now
            tags: annotation.tags || [],
            metadata: annotation.metadata || [],
            timestamp: annotation.timestamp,
            originalIndex: index
        }));
        
        const hubNodes = [];
        const links = [];
        const hubNodeMap = {}; // Map to store hub nodes to avoid duplicates: key = type:value, value = hubNode

        // Function to get or create a hub node
        const getOrCreateHubNode = (type, value, displayValue = value) => {
            const key = `${type}:${value}`;
            if (!hubNodeMap[key]) {
                const hubId = `hub-${type}-${value.replace(/[^a-zA-Z0-9]/g, '-')}`; // Sanitize ID
                hubNodeMap[key] = {
                    id: hubId,
                    type: 'hub',
                    hubType: type, // Store the type of hub (tag, domain, etc.)
                    title: displayValue, // Display name for the hub
                    group: 8 + (Object.keys(hubNodeMap).length % 5), // Assign a different group range for hubs
                    originalIndex: -1 // Indicate it's not an original annotation
                };
                hubNodes.push(hubNodeMap[key]);
            }
            return hubNodeMap[key];
        };

        // Function to add links (now primarily between annotation node and hub node, OR directed annotation-to-annotation)
        const addLink = (sourceNode, targetNode, reason, isDirected = false) => {
             // Allow annotation-to-annotation links ONLY if isDirected is true
             if (sourceNode.type === targetNode.type && sourceNode.type === 'annotation' && !isDirected) {
                 console.warn(`Skipping undirected link between annotations: ${sourceNode.id} -> ${targetNode.id}`);
                 return; 
             }
             // Skip hub-to-hub links for now
             if (sourceNode.type === 'hub' && targetNode.type === 'hub') {
                 console.warn(`Skipping link between hubs: ${sourceNode.id} -> ${targetNode.id}`);
                 return;
             }

            const existingLink = links.find(link => 
                (link.source === sourceNode.id && link.target === targetNode.id) || 
                (link.source === targetNode.id && link.target === sourceNode.id)
            );
            
            if (!existingLink) {
                links.push({
                    source: sourceNode.id,
                    target: targetNode.id,
                    value: 1, // Initial value, could be adjusted based on relevance
                    reason: [reason],
                    directed: isDirected // Add directed flag to link data
                });
            } else {
                 // Optionally increment value or add reason if linking multiple times for different reasons
                 if (!existingLink.reason.includes(reason)) {
                     existingLink.reason.push(reason);
                     existingLink.value += 1; 
                 }
            }
        };
        
        // --- Linking Logic ---

        // Link by tags
        if (linkingCriteria.tags) {
            annotationNodes.forEach(node => {
                if (!node.tags || !Array.isArray(node.tags) || node.tags.length === 0) return;
                
                node.tags.forEach(tag => {
                    let tagText;
                    if (typeof tag === 'string') tagText = tag;
                    else if (tag && typeof tag === 'object' && tag.text) tagText = tag.text;
                    else return;
                    
                    if (!tagText || tagText.trim() === '') return;
                    
                    const normalizedTag = tagText.toLowerCase().trim();
                    const hubNode = getOrCreateHubNode('tag', normalizedTag, tagText); // Use original text for display
                    addLink(node, hubNode, `Tag: ${tagText}`);
                });
            });
        }
        
        // Link by similar time range (group by date)
        if (linkingCriteria.similarTimeRange) {
            annotationNodes.forEach(node => {
                if (!node.timestamp) return;
                const date = new Date(node.timestamp);
                if (isNaN(date)) return;
                
                const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
                const hubNode = getOrCreateHubNode('time', dateStr, `Date: ${dateStr}`);
                addLink(node, hubNode, `Same day: ${dateStr}`);
            });
        }
        
        // Link by base URL (domain)
        if (linkingCriteria.baseLink) {
            annotationNodes.forEach(node => {
                if (!node.url) return;
                try {
                    const url = new URL(node.url);
                    const domain = url.hostname;
                    const hubNode = getOrCreateHubNode('domain', domain, `Domain: ${domain}`);
                    addLink(node, hubNode, `Same domain: ${domain}`);
                } catch (e) {
                    console.error('Invalid URL for domain linking:', node.url, e);
                }
            });
        }
        
        // Link by same page (exact URL match)
        if (linkingCriteria.samePage) {
            annotationNodes.forEach(node => {
                if (!node.url) return;
                try {
                    const url = new URL(node.url);
                    const pageKey = url.href; // Use full URL
                    const pagePath = url.pathname || url.hostname; // Display path or hostname
                    const hubNode = getOrCreateHubNode('page', pageKey, `Page: ${pagePath}`);
                    addLink(node, hubNode, `Same page: ${pagePath}`);
                } catch (e) {
                    console.error('Invalid URL for page linking:', node.url, e);
                }
            });
        }
        
        // Link by shared metadata
        if (linkingCriteria.metadata) {
            annotationNodes.forEach(node => {
                if (!node.metadata || !Array.isArray(node.metadata) || node.metadata.length === 0) return;
                
                node.metadata.forEach(meta => {
                    if (!meta || typeof meta !== 'string' || meta.trim() === '') return;
                    
                    const normalizedMeta = meta.toLowerCase().trim();
                    const hubNode = getOrCreateHubNode('metadata', normalizedMeta, `Meta: ${meta}`);
                    addLink(node, hubNode, `Shared metadata: ${meta}`);
                });
            });
        }

        // --- Add Directed Links Based on Text References ---
        const referenceRegex = /#(\w+)/g; // Regex to find #word references

        annotationNodes.forEach(sourceNode => {
            if (!sourceNode.text) return; // Skip if no text

            let match;
            while ((match = referenceRegex.exec(sourceNode.text)) !== null) {
                const referenceWord = match[1].toLowerCase(); // Get the word after #, lowercase for matching
                
                // Find target nodes (other annotations) matching the reference word
                annotationNodes.forEach(targetNode => {
                    if (sourceNode.id === targetNode.id) return; // Don't link to self

                    let matched = false;
                    let matchReason = '';

                    // Match by title (case-insensitive)
                    if (targetNode.title && targetNode.title.toLowerCase() === referenceWord) {
                        matched = true;
                        matchReason = `Reference to title: #${match[1]}`;
                    }
                    // Match by tags (case-insensitive)
                    else if (targetNode.tags && targetNode.tags.some(tag => {
                        const tagText = (typeof tag === 'string' ? tag : tag.text)?.toLowerCase();
                        return tagText === referenceWord;
                    })) {
                        matched = true;
                        matchReason = `Reference to tag: #${match[1]}`;
                    }

                    // If matched, add a directed link
                    if (matched) {
                         // Use the existing addLink function, but ensure it allows annotation-to-annotation links for references
                         // We need to slightly modify addLink or create a new one for this.
                         // Let's modify addLink for simplicity for now.
                         addLink(sourceNode, targetNode, matchReason, true); // Add a flag to indicate directed
                    }
                });
            }
        });

        // Combine annotation nodes and hub nodes
        const allNodes = [...annotationNodes, ...hubNodes];
        
        console.log(`Created graph with ${allNodes.length} nodes (${annotationNodes.length} annotations, ${hubNodes.length} hubs) and ${links.length} links.`);
        
        return { nodes: allNodes, links };
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
            
            <div className={`${isSidebarCollapsed ? 'w-[80%]' : 'w-[65%]'} h-full relative transition-all duration-300`}>
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
                <div className="absolute top-4 right-4 z-10 transition-all duration-300">
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
                                        checked={linkingCriteria.samePage} 
                                        onChange={() => handleLinkingCriteriaChange('samePage')}
                                        className="mr-2 accent-violet-500"
                                    />
                                    Same Page
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
            
            <div className={`${isSidebarCollapsed ? 'w-0' : 'w-[15%]'} h-full bg-[#363636] border-l border-gray-700 overflow-hidden transition-all duration-300 relative`}>
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
                
                {/* Toggle button */}
                <button 
                    className={`absolute top-1/2 -translate-y-1/2 ${isSidebarCollapsed ? 'right-0' : 'left-0'} 
                        bg-[#363636] text-white p-2 hover:bg-[#404040] transition-colors
                        border border-gray-700 rounded-none ${isSidebarCollapsed ? 'rounded-l-md' : 'rounded-r-md'}`}
                    onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                >
                    <svg 
                        className={`w-4 h-4 transform transition-transform ${isSidebarCollapsed ? 'rotate-180' : ''}`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                    >
                        <path 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                            strokeWidth={2} 
                            d="M9 5l7 7-7 7"
                        />
                    </svg>
                </button>
            </div>

            {/* Uncollapse button - only shown when sidebar is collapsed */}
            {isSidebarCollapsed && (
                <button 
                    className="fixed right-4 top-1/2 -translate-y-1/2 z-50
                        bg-[#363636] text-white p-2 hover:bg-[#404040] transition-colors
                        border border-gray-700 rounded-l-md shadow-lg"
                    onClick={() => setIsSidebarCollapsed(false)}
                >
                    <svg 
                        className="w-4 h-4 transform rotate-180"
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                    >
                        <path 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                            strokeWidth={2} 
                            d="M9 5l7 7-7 7"
                        />
                    </svg>
                </button>
            )}
        </div>
    );
}
