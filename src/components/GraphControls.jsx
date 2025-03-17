import React from 'react';

export default function GraphControls({ 
    graphData, 
    clusterDistance, 
    setClusterDistance, 
    nodeSize, 
    setNodeSize,
    allTags,
    setSearchTerm
}) {
    return (
        <div className="h-full p-4 overflow-y-auto">
            
            <div className="mb-4">
                <div className="flex items-center text-white mb-2">

                    <span className="font-medium">Clusters</span>
                </div>
                
                <div className="ml-5 mb-3">
                    <div className="flex justify-between text-white text-sm mb-1">
                        <span>Cluster Distance</span>

                    </div>
                    <input
                        type="range"
                        min="10"
                        max="200"
                        value={clusterDistance}
                        onChange={(e) => setClusterDistance(parseInt(e.target.value))}
                        className="w-full"
                    />
                </div>
                
                <div className="ml-5">
                    <div className="text-white text-sm mb-1">Node Size</div>
                    <input
                        type="range"
                        min="2"
                        max="15"
                        value={nodeSize}
                        onChange={(e) => setNodeSize(parseInt(e.target.value))}
                        className="w-full"
                    />
                </div>
            </div>
            
        </div>
    );
} 