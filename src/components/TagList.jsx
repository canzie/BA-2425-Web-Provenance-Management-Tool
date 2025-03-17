import React from 'react';

export default function TagList({ tags, small = false, onClick = () => {}, interactive = false }) {
    // Extract tag text from tag objects if needed
    const getTagText = (tag) => tag.text || tag;
    
    return (
        <div className="flex flex-wrap gap-1">
            {tags.map((tag, index) => (
                <span 
                    key={index} 
                    className={`
                        ${small ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-xs'} 
                        ${interactive ? 'cursor-pointer hover:bg-violet-500' : ''} 
                        bg-gray-700 text-white rounded
                    `}
                    onClick={() => interactive ? onClick(getTagText(tag)) : null}
                >
                    {getTagText(tag)}
                </span>
            ))}
        </div>
    );
} 