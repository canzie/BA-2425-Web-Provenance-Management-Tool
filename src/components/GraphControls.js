import React from 'react';

export default function GraphControls({
  clusterDistance,
  setClusterDistance,
  nodeSize,
  setNodeSize,
  // Force control props
  centerForceStrength,
  setCenterForceStrength,
  repelForceStrength,
  setRepelForceStrength,
  linkForceStrength,
  setLinkForceStrength,
  linkDistance,
  setLinkDistance
}) {
  return (
    <div className="graph-controls p-4 bg-[#363636] rounded-md">
      <h3 className="text-white text-lg font-medium mb-4">Graph Controls</h3>
      
      {/* Existing controls */}
      <div className="mb-4">
        <label className="block text-white text-sm mb-2">
          Node Size: {nodeSize}
        </label>
        <input
          type="range"
          min="2"
          max="15"
          value={nodeSize}
          onChange={(e) => setNodeSize(Number(e.target.value))}
          className="w-full"
        />
      </div>
      
      <div className="mb-4">
        <label className="block text-white text-sm mb-2">
          Cluster Distance: {clusterDistance}
        </label>
        <input
          type="range"
          min="30"
          max="200"
          value={clusterDistance}
          onChange={(e) => setClusterDistance(Number(e.target.value))}
          className="w-full"
        />
      </div>
      
      <div className="mb-4">
        <label className="block text-white text-sm mb-2">
          Center Force: {centerForceStrength}
        </label>
        <input
          type="range"
          min="0"
          max="10"
          step="0.1"
          value={centerForceStrength}
          onChange={(e) => setCenterForceStrength(Number(e.target.value))}
          className="w-full"
        />
      </div>
      
      <div className="mb-4">
        <label className="block text-white text-sm mb-2">
          Repel Force: {repelForceStrength}
        </label>
        <input
          type="range"
          min="-300"
          max="-10"
          value={repelForceStrength}
          onChange={(e) => setRepelForceStrength(Number(e.target.value))}
          className="w-full"
        />
      </div>
      
      <div className="mb-4">
        <label className="block text-white text-sm mb-2">
          Link Strength: {linkForceStrength}
        </label>
        <input
          type="range"
          min="1"
          max="100"
          value={linkForceStrength}
          onChange={(e) => setLinkForceStrength(Number(e.target.value))}
          className="w-full"
        />
      </div>
      
      <div className="mb-4">
        <label className="block text-white text-sm mb-2">
          Link Distance: {linkDistance}
        </label>
        <input
          type="range"
          min="20"
          max="150"
          value={linkDistance}
          onChange={(e) => setLinkDistance(Number(e.target.value))}
          className="w-full"
        />
      </div>
    </div>
  );
} 