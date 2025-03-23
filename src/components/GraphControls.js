import React, { useEffect } from 'react';

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
  
  // Ensure integer values for better handling
  const handleCenterForceChange = (e) => {
    const value = parseFloat(e.target.value);
    setCenterForceStrength(value);
  };
  
  const handleRepelForceChange = (e) => {
    const value = parseInt(e.target.value, 10);
    setRepelForceStrength(value);
  };
  
  const handleLinkStrengthChange = (e) => {
    const value = parseInt(e.target.value, 10);
    setLinkForceStrength(value);
  };
  
  const handleLinkDistanceChange = (e) => {
    const value = parseInt(e.target.value, 10);
    setLinkDistance(value);
  };
  
  const saveGraphControlsToLocalStorage = () => {
    localStorage.setItem('graphControls', JSON.stringify({
      nodeSize,
      clusterDistance,
      centerForceStrength,
      repelForceStrength,
      linkForceStrength,
      linkDistance
    }));
  };
  
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
          onChange={(e) => {setNodeSize(Number(e.target.value)); saveGraphControlsToLocalStorage()}}
          className="w-full accent-violet-400"
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
          onChange={(e) => {setClusterDistance(Number(e.target.value)); saveGraphControlsToLocalStorage()}}
          className="w-full accent-violet-400"
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
          onChange={(e) => {handleCenterForceChange(e); saveGraphControlsToLocalStorage()}}
          className="w-full accent-violet-400"
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
          onChange={(e) => {handleRepelForceChange(e); saveGraphControlsToLocalStorage()}}
          className="w-full accent-violet-400"
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
          onChange={(e) => {handleLinkStrengthChange(e); saveGraphControlsToLocalStorage()}}
          className="w-full accent-violet-400"
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
          onChange={(e) => {handleLinkDistanceChange(e); saveGraphControlsToLocalStorage()}}
          className="w-full accent-violet-400"
        />
      </div>
      
      {/* Reset button */}
      <button
        className="w-full py-2 bg-violet-500 text-white rounded hover:bg-violet-600 transition-colors"
        onClick={() => {
          setNodeSize(5);
          setClusterDistance(80);
          setCenterForceStrength(1);
          setRepelForceStrength(-100);
          setLinkForceStrength(50);
          setLinkDistance(60);
        }}
      >
        Reset to Defaults
      </button>
    </div>
  );
} 