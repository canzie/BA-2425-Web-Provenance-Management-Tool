import React from 'react';
import TagList from './TagList';

export default function AnnotationDetail({ annotation, onClose }) {
    if (!annotation) return null;
    
    return (
        <div className="bg-gray-800 p-4 rounded text-white shadow-lg max-w-md">
            <div className="flex justify-between">
                <h3 className="font-bold mb-2">{annotation.title || "Untitled"}</h3>
                <button 
                    onClick={onClose}
                    className="text-gray-400 hover:text-white"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
            <p className="text-sm mb-3">{annotation.text}</p>
            
            {annotation.tags && annotation.tags.length > 0 && (
                <div className="mb-3">
                    <TagList tags={annotation.tags} />
                </div>
            )}
            
            {annotation.url && (
                <a 
                    href={annotation.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline text-sm block truncate"
                >
                    {annotation.url}
                </a>
            )}
        </div>
    );
} 