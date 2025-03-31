import React from 'react';

// Component to render different types of annotations
export default function AnnotationType({ type, data }) {
  // Determine the annotation type
  switch (type) {
    case 'image':
      return <ImageAnnotation imageData={data} />;
    case 'text':
    default:
      return <TextAnnotation text={data} />;
  }
}

// Text annotation component (the original type)
function TextAnnotation({ text }) {
  if (!text) return null;
  
  return (
    <p className="w-full p-1 my-2 text-white break-words">
      "<strong>{text}</strong>"
    </p>
  );
}

// Image annotation component
function ImageAnnotation({ imageData }) {
  if (!imageData) return null;
  
  return (
    <div className="w-full my-2 rounded-md overflow-hidden">
      <img 
        src={imageData} 
        alt="Annotated image" 
        className="w-full h-auto object-contain max-h-64 rounded-md"
        onError={(e) => {
          e.target.onerror = null;
          e.target.src = 'data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22318%22%20height%3D%22180%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20318%20180%22%20preserveAspectRatio%3D%22none%22%3E%3Cdefs%3E%3Cstyle%20type%3D%22text%2Fcss%22%3E%23holder_158bd1d28ef%20text%20%7B%20fill%3A%23868e96%3Bfont-weight%3Abold%3Bfont-family%3AArial%2C%20Helvetica%2C%20Open%20Sans%2C%20sans-serif%2C%20monospace%3Bfont-size%3A16pt%20%7D%20%3C%2Fstyle%3E%3C%2Fdefs%3E%3Cg%20id%3D%22holder_158bd1d28ef%22%3E%3Crect%20width%3D%22318%22%20height%3D%22180%22%20fill%3D%22%23777%22%3E%3C%2Frect%3E%3Cg%3E%3Ctext%20x%3D%22129.359375%22%20y%3D%2297.35%22%3EImage%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E';
          console.error('Failed to load image');
        }}
      />
    </div>
  );
} 