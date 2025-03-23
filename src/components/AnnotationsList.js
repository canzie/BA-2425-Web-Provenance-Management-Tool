import React, { useState, useEffect } from 'react';
import AnnotationItem from '../AnnotationItem';

export default function AnnotationsList({ 
    annotations, 
    searchTerm, 
    setSearchTerm, 
    selectedAnnotation, 
    setSelectedAnnotation,
    filter,
    handleFilterChange,
    connectedComponents = []
}) {
    // Log incoming props for debugging
    console.log("AnnotationsList received props:", { 
        annotationsCount: annotations?.length || 0, 
        searchTerm, 
        filter,
        hasSelectedAnnotation: selectedAnnotation !== null && selectedAnnotation !== undefined
    });
    
    // State for editable fields when an annotation is selected
    const [editableTitle, setEditableTitle] = useState("");
    const [editableTags, setEditableTags] = useState([]);
    const [editableMetadata, setEditableMetadata] = useState("");
    
    // Add state for view modes and tag hierarchy
    const [expandedTags, setExpandedTags] = useState({});
    const [expandedGroups, setExpandedGroups] = useState({});
    const [hierarchyView, setHierarchyView] = useState(true);
    const [viewMode, setViewMode] = useState("tags"); // "tags" or "groups"
    
    // Add saving status state
    const [savingStatus, setSavingStatus] = useState("");
    
    // Log connected components when they change
    useEffect(() => {
        console.log("Connected components received:", connectedComponents);
    }, [connectedComponents]);
    
    // Filter annotations based on filter and search
    const getFilteredAnnotations = () => {
        console.log("AnnotationsList getFilteredAnnotations - annotations:", annotations);
        
        if (!annotations || annotations.length === 0) {
            console.log("No annotations available");
            return [];
        }
        
        // First, ensure all annotations have originalIndex
        const annotationsWithIndices = annotations.map((annotation, index) => ({
            ...annotation,
            originalIndex: annotation.originalIndex !== undefined ? annotation.originalIndex : index
        }));
        
        // Apply search term if present
        let filtered = annotationsWithIndices;
        
        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            filtered = filtered.filter(annotation => 
                (annotation.title && annotation.title.toLowerCase().includes(searchLower)) ||
                (annotation.text && annotation.text.toLowerCase().includes(searchLower))
            );
        }
        
        // Apply tag filter if present
        if (filter && filter !== "all") {
            filtered = filtered.filter(annotation => {
                if (!annotation.tags || !Array.isArray(annotation.tags)) {
                    return false;
                }
                
                return annotation.tags.some(tag => {
                    const tagText = typeof tag === 'string' ? tag : (tag.text || tag.name || '');
                    return tagText.toLowerCase() === filter.toLowerCase();
                });
            });
        }
        
        console.log(`Filtered annotations: ${filtered.length} of ${annotations.length}`);
        return filtered;
    };

    // Handle click on an item
    const handleItemClick = (index) => {
        if (selectedAnnotation === index) {
            setSelectedAnnotation(null);
        } else {
            const filteredAnnotations = getFilteredAnnotations();
            console.log("Clicking on annotation at index:", index);
            
            if (index >= 0 && index < filteredAnnotations.length) {
                const annotation = filteredAnnotations[index];
                if (annotation) {
                    setSelectedAnnotation(index);
                    setEditableTitle(annotation.title || "");
                    setEditableTags(Array.isArray(annotation.tags) ? annotation.tags : []);
                    setEditableMetadata(Array.isArray(annotation.metadata) ? annotation.metadata.join(", ") : "");
                } else {
                    console.error("No annotation found at index:", index);
                }
            } else {
                console.error("Invalid index:", index, "Total annotations:", filteredAnnotations.length);
            }
        }
    };
    
    // Handle saving an edited annotation
    const handleSave = (index) => {
        try {
            setSavingStatus("Saving...");
            // Get the filtered annotation at this index
            const filteredAnnotation = getFilteredAnnotations()[index];
            
            if (!filteredAnnotation) {
                console.error("Error: Could not find annotation at index", index);
                setSavingStatus("Error: Cannot find annotation");
                setTimeout(() => setSavingStatus(""), 2000);
                return;
            }
            
            // Get the original index if it exists, otherwise use the provided index
            const annotationIndex = filteredAnnotation.originalIndex !== undefined 
                ? filteredAnnotation.originalIndex 
                : index;
            
            console.log(`Saving annotation: index=${index}, originalIndex=${annotationIndex}`);
            
            const newAnnotations = [...annotations];
            
            // Ensure we don't go out of bounds
            if (annotationIndex < 0 || annotationIndex >= newAnnotations.length) {
                console.error("Error: Index out of bounds", annotationIndex);
                setSavingStatus("Error: Index out of bounds");
                setTimeout(() => setSavingStatus(""), 2000);
                return;
            }
            
            // Validate tags
            let processedTags = editableTags;
            if (!Array.isArray(processedTags)) {
                try {
                    // If it's a string, try to parse it as JSON
                    if (typeof editableTags === 'string') {
                        processedTags = JSON.parse(editableTags);
                    } else {
                        processedTags = [];
                    }
                } catch (e) {
                    console.error("Error parsing tags:", e);
                    processedTags = [];
                }
            }
            
            // Process metadata
            const processedMetadata = typeof editableMetadata === 'string' 
                ? editableMetadata.split(",").map(meta => meta.trim()).filter(Boolean)
                : [];
            
            // Update the annotation
            newAnnotations[annotationIndex] = {
                ...newAnnotations[annotationIndex],
                title: editableTitle || "Untitled",
                tags: processedTags,
                metadata: processedMetadata
            };
            
            // Update in chrome storage with callback to handle errors
            chrome.storage.local.set({ savedTexts: newAnnotations }, () => {
                if (chrome.runtime.lastError) {
                    console.error("Error saving annotation:", chrome.runtime.lastError);
                    setSavingStatus("Error: Could not save");
                } else {
                    console.log("Annotation saved successfully");
                    setSavingStatus("Saved successfully");
                }
                
                setTimeout(() => setSavingStatus(""), 2000);
                // Reset selected annotation
                setSelectedAnnotation(null);
            });
        } catch (error) {
            console.error("Error in handleSave:", error);
            setSavingStatus("Error: " + error.message);
            setTimeout(() => setSavingStatus(""), 2000);
        }
    };
    
    // Handle deleting an annotation
    const handleDelete = (index) => {
        try {
            setSavingStatus("Deleting...");
            // Get the filtered annotation at this index
            const filteredAnnotation = getFilteredAnnotations()[index];
            
            if (!filteredAnnotation) {
                console.error("Error: Could not find annotation at index", index);
                setSavingStatus("Error: Cannot find annotation");
                setTimeout(() => setSavingStatus(""), 2000);
                return;
            }
            
            // Get the original index if it exists, otherwise use the provided index
            const annotationIndex = filteredAnnotation.originalIndex !== undefined 
                ? filteredAnnotation.originalIndex 
                : index;
            
            console.log(`Deleting annotation: index=${index}, originalIndex=${annotationIndex}`);
            
            const newAnnotations = [...annotations];
            
            // Ensure we don't go out of bounds
            if (annotationIndex < 0 || annotationIndex >= newAnnotations.length) {
                console.error("Error: Index out of bounds", annotationIndex);
                setSavingStatus("Error: Index out of bounds");
                setTimeout(() => setSavingStatus(""), 2000);
                return;
            }
            
            newAnnotations.splice(annotationIndex, 1);
            
            // Update in chrome storage with callback to handle errors
            chrome.storage.local.set({ savedTexts: newAnnotations }, () => {
                if (chrome.runtime.lastError) {
                    console.error("Error deleting annotation:", chrome.runtime.lastError);
                    setSavingStatus("Error: Could not delete");
                } else {
                    console.log("Annotation deleted successfully");
                    setSavingStatus("Deleted successfully");
                }
                
                setTimeout(() => setSavingStatus(""), 2000);
                // Reset selected annotation
                setSelectedAnnotation(null);
            });
        } catch (error) {
            console.error("Error in handleDelete:", error);
            setSavingStatus("Error: " + error.message);
            setTimeout(() => setSavingStatus(""), 2000);
        }
    };
    
    // Function to toggle tag expansion
    const toggleTag = (tag) => {
        setExpandedTags(prev => ({
            ...prev,
            [tag]: !prev[tag]
        }));
    };
    
    // Function to organize annotations by tags for hierarchical view
    const organizeAnnotationsByTag = () => {
        const filtered = getFilteredAnnotations();
        const tagGroups = {};
        
        // Group annotations by tag
        filtered.forEach((annotation, index) => {
            if (annotation.tags && annotation.tags.length > 0) {
                // For each tag in the annotation
                annotation.tags.forEach(tag => {
                    // Handle different tag formats consistently
                    let tagText;
                    if (typeof tag === 'string') {
                        tagText = tag;
                    } else if (typeof tag === 'object') {
                        tagText = tag.text || tag.name || 'Unknown Tag';
                    } else {
                        tagText = 'Unknown Tag';
                    }
                    
                    // Skip empty tags
                    if (!tagText || tagText.trim() === '') return;
                    
                    if (!tagGroups[tagText]) {
                        tagGroups[tagText] = [];
                    }
                    
                    // Add this annotation to this tag group if not already there
                    if (!tagGroups[tagText].some(item => item.index === index)) {
                        tagGroups[tagText].push({ annotation, index });
                    }
                });
            } else {
                // Create a group for untagged items
                if (!tagGroups['Untagged']) {
                    tagGroups['Untagged'] = [];
                }
                tagGroups['Untagged'].push({ annotation, index });
            }
        });
        
        // Log the tag groups for debugging
        const tagCount = Object.keys(tagGroups).length;
        console.log(`Found ${tagCount} tag groups`);
        
        return tagGroups;
    };
    
    // Function to organize annotations by graph components
    const organizeAnnotationsByComponent = () => {
        const filtered = getFilteredAnnotations();
        const componentGroups = {};
        
        // If no connected components are available, return empty
        if (!connectedComponents || connectedComponents.length === 0) {
            return { 'No Connected Groups': filtered.map((annotation, index) => ({ annotation, index })) };
        }
        
        // Create a map of original indices to filtered indices
        const originalToFilteredIndex = {};
        filtered.forEach((annotation, filteredIndex) => {
            if (annotation.originalIndex !== undefined) {
                originalToFilteredIndex[annotation.originalIndex] = filteredIndex;
            }
        });
        
        // Process each component
        connectedComponents.forEach((component, componentIndex) => {
            const groupName = `Group ${componentIndex + 1}`;
            componentGroups[groupName] = [];
            
            // Add each annotation from this component that exists in filtered results
            component.forEach(originalIndex => {
                const filteredIndex = originalToFilteredIndex[originalIndex];
                
                if (filteredIndex !== undefined) {
                    const annotation = filtered[filteredIndex];
                    componentGroups[groupName].push({ 
                        annotation, 
                        index: filteredIndex 
                    });
                }
            });
            
            // Remove empty groups
            if (componentGroups[groupName].length === 0) {
                delete componentGroups[groupName];
            }
        });
        
        // Handle annotations not in any component
        const allGroupedIndices = new Set();
        Object.values(componentGroups).forEach(group => {
            group.forEach(item => {
                allGroupedIndices.add(item.index);
            });
        });
        
        // Find annotations not in any group
        const ungrouped = filtered.filter((_, index) => !allGroupedIndices.has(index));
        
        if (ungrouped.length > 0) {
            componentGroups['Isolated Annotations'] = ungrouped.map((annotation, i) => ({
                annotation,
                index: filtered.indexOf(annotation)
            }));
        }
        
        return componentGroups;
    };
    
    // Get organized annotations for rendering based on view mode
    const tagGroups = organizeAnnotationsByTag();
    const componentGroups = organizeAnnotationsByComponent();
    
    // Get the active groups based on view mode
    const activeGroups = viewMode === "tags" ? tagGroups : componentGroups;
    
    // Function to toggle a group's expansion
    const toggleGroup = (groupName) => {
        if (viewMode === "tags") {
            setExpandedTags(prev => ({
                ...prev,
                [groupName]: !prev[groupName]
            }));
        } else {
            setExpandedGroups(prev => ({
                ...prev,
                [groupName]: !prev[groupName]
            }));
        }
    };

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-700">
                <h2 className="text-white font-medium text-center">
                    {getFilteredAnnotations().length} Annotations
                </h2>
                <div className="flex justify-center gap-2 mt-2">
                    <button
                        onClick={() => setViewMode("tags")}
                        className={`px-3 py-1 rounded ${viewMode === "tags" ? 'bg-violet-500 text-white' : 'bg-gray-600 text-gray-200'}`}
                    >
                        Tag Groups
                    </button>
                    <button
                        onClick={() => setViewMode("groups")}
                        className={`px-3 py-1 rounded ${viewMode === "groups" ? 'bg-violet-500 text-white' : 'bg-gray-600 text-gray-200'}`}
                    >
                        Graph Groups
                    </button>
                </div>
                <div className="flex justify-center mt-2">
                    <button
                        onClick={() => setHierarchyView(!hierarchyView)}
                        className={`px-3 py-1 rounded ${hierarchyView ? 'bg-violet-500 text-white' : 'bg-gray-600 text-gray-200'}`}
                    >
                        {hierarchyView ? 'Hierarchy View' : 'Flat View'}
                    </button>
                </div>
            </div>
            
            {/* Status message */}
            {savingStatus && (
                <div className={`p-2 text-center ${savingStatus.includes('Error') ? 'bg-red-500' : 'bg-green-500'} text-white`}>
                    {savingStatus}
                </div>
            )}
            
            {/* Annotations List */}
            <div className="flex-1 overflow-y-auto p-2">
                {getFilteredAnnotations().length === 0 ? (
                    <p className="text-gray-500 p-4 text-center">No annotations found.</p>
                ) : hierarchyView ? (
                    <div className="space-y-1">
                        {Object.keys(activeGroups).sort().map(groupName => (
                            <div key={groupName} className="mb-2">
                                {/* Group header (clickable to expand/collapse) */}
                                <div 
                                    className="flex items-center p-2 rounded cursor-pointer hover:bg-[#444444] border-l-4 bg-[#363636] border-violet-400"
                                    onClick={() => toggleGroup(groupName)}
                                >
                                    <span className="mr-2 text-violet-300">
                                        {viewMode === "tags" ? 
                                            (expandedTags[groupName] ? '▼' : '►') : 
                                            (expandedGroups[groupName] ? '▼' : '►')}
                                    </span>
                                    <span className="text-white font-medium flex items-center">
                                        {viewMode === "tags" ? (
                                            groupName
                                        ) : (
                                            <>
                                                {groupName === "Isolated Annotations" ? (
                                                    <>
                                                        <span className="inline-block w-2 h-2 mr-1.5 bg-gray-400 rounded-full"></span>
                                                        {groupName}
                                                    </>
                                                ) : (
                                                    <>
                                                        <span className="inline-block w-2 h-2 mr-1.5 bg-violet-300 rounded-full"></span>
                                                        {`${groupName} (${activeGroups[groupName].length > 1 ? "Connected" : "Single"})`}
                                                    </>
                                                )}
                                            </>
                                        )}
                                    </span>
                                    <span className="ml-2 text-sm text-violet-300">
                                        ({activeGroups[groupName].length})
                                    </span>
                                </div>
                                
                                {/* Annotations under this group */}
                                {(viewMode === "tags" ? expandedTags[groupName] : expandedGroups[groupName]) && (
                                    <div className="ml-4 mt-1 space-y-1">
                                        {activeGroups[groupName].map(({annotation, index}) => (
                                            <div key={index} className="ml-4">
                                                <AnnotationItem
                                                    textObject={annotation}
                                                    index={index}
                                                    selectedIndex={selectedAnnotation}
                                                    handleItemClick={handleItemClick}
                                                    editableTitle={editableTitle}
                                                    setEditableTitle={setEditableTitle}
                                                    editableTags={editableTags}
                                                    setEditableTags={setEditableTags}
                                                    editableMetadata={editableMetadata}
                                                    setEditableMetadata={setEditableMetadata}
                                                    handleSave={handleSave}
                                                    handleDelete={handleDelete}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <ul className="space-y-2">
                        {getFilteredAnnotations().map((annotation, index) => (
                            <AnnotationItem
                                key={index}
                                textObject={annotation}
                                index={index}
                                selectedIndex={selectedAnnotation}
                                handleItemClick={handleItemClick}
                                editableTitle={editableTitle}
                                setEditableTitle={setEditableTitle}
                                editableTags={editableTags}
                                setEditableTags={setEditableTags}
                                editableMetadata={editableMetadata}
                                setEditableMetadata={setEditableMetadata}
                                handleSave={handleSave}
                                handleDelete={handleDelete}
                            />
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
} 