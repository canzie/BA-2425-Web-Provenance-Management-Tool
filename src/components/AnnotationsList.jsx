import React, { useState } from 'react';
import AnnotationItem from '../AnnotationItem';

export default function AnnotationsList({ 
    annotations, 
    searchTerm, 
    setSearchTerm, 
    selectedAnnotation, 
    setSelectedAnnotation,
    filter,
    handleFilterChange
}) {
    // State for editable fields when an annotation is selected
    const [editableTitle, setEditableTitle] = useState("");
    const [editableTags, setEditableTags] = useState([]);
    const [editableMetadata, setEditableMetadata] = useState("");
    
    // Filter annotations based on filter and search
    const getFilteredAnnotations = () => {
        let filtered = [...annotations];
        
        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            filtered = filtered.filter(annotation => 
                (annotation.title && annotation.title.toLowerCase().includes(searchLower)) ||
                (annotation.text && annotation.text.toLowerCase().includes(searchLower)) ||
                (annotation.tags && annotation.tags.some(tag => 
                    (tag.text && tag.text.toLowerCase().includes(searchLower))
                ))
            );
        }
        
        return filtered;
    };

    // Handle click on an item
    const handleItemClick = (index) => {
        if (selectedAnnotation === index) {
            setSelectedAnnotation(null);
        } else {
            setSelectedAnnotation(index);
            const annotation = getFilteredAnnotations()[index];
            setEditableTitle(annotation.title || "");
            setEditableTags(annotation.tags || []);
            setEditableMetadata(annotation.metadata?.join(", ") || "");
        }
    };
    
    // Handle saving an edited annotation
    const handleSave = (index) => {
        const annotationIndex = getFilteredAnnotations()[index].originalIndex;
        const newAnnotations = [...annotations];
        newAnnotations[annotationIndex] = {
            ...newAnnotations[annotationIndex],
            title: editableTitle,
            tags: editableTags,
            metadata: editableMetadata.split(",").map(meta => meta.trim())
        };
        
        // Update in chrome storage
        chrome.storage.local.set({ savedTexts: newAnnotations });
        
        // Reset selected annotation
        setSelectedAnnotation(null);
    };
    
    // Handle deleting an annotation
    const handleDelete = (index) => {
        const annotationIndex = getFilteredAnnotations()[index].originalIndex;
        const newAnnotations = annotations.filter((_, i) => i !== annotationIndex);
        
        // Update in chrome storage
        chrome.storage.local.set({ savedTexts: newAnnotations });
        
        // Reset selected annotation
        setSelectedAnnotation(null);
    };

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-700">
                <h2 className="text-white font-medium text-center">
                    {getFilteredAnnotations().length} Annotations
                </h2>
            </div>
            
            {/* Annotations List */}
            <div className="flex-1 overflow-y-auto p-2">
                {getFilteredAnnotations().length === 0 ? (
                    <p className="text-gray-500 p-4 text-center">No annotations found.</p>
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