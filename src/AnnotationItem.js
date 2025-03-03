import React from "react";

export default function AnnotationItem({
  textObject,
  index,
  selectedIndex,
  handleItemClick,
  editableTitle,
  setEditableTitle,
  editableTags,
  setEditableTags,
  editableText,
  setEditableText,
  editableMetadata,
  setEditableMetadata,
  handleSave,
  handleDelete
}) {
  return (
    <div
      key={index}
      className={`p-2 bg-gray-200 border border-gray-400 rounded cursor-pointer ${selectedIndex === index ? 'bg-gray-300' : ''}`}
      onClick={() => handleItemClick(index)}
    >
      {selectedIndex === index ? (
        <>
          <input
            type="text"
            value={editableTitle}
            onChange={(e) => setEditableTitle(e.target.value)}
            className="w-full p-1 mb-1 border border-gray-400 rounded"
          />
          <input
            type="text"
            value={editableTags}
            onChange={(e) => setEditableTags(e.target.value)}
            className="w-full p-1 mb-1 border border-gray-400 rounded"
          />
          <input
            type="text"
            value={editableText}
            onChange={(e) => setEditableText(e.target.value)}
            className="w-full p-1 mb-1 border border-gray-400 rounded"
          />
          <input
            type="text"
            value={editableMetadata}
            onChange={(e) => setEditableMetadata(e.target.value)}
            className="w-full p-1 mb-1 border border-gray-400 rounded"
          />
          <p><strong>Timestamp:</strong> {textObject.timestamp}</p>
          <p><strong>URL:</strong> <a href={textObject.url} target="_blank" rel="noopener noreferrer">{textObject.url}</a></p>
          <div className="border-t border-gray-400 my-2 flex space-x-2">
            <button
              className="mt-2 p-1 bg-green-500 text-white rounded flex-1"
              onClick={() => handleSave(index)}
            >
              Save
            </button>
            <button
              className="mt-2 p-1 bg-red-500 text-white rounded flex-1"
              onClick={() => handleDelete(index)}
            >
              Delete
            </button>
          </div>
        </>
      ) : (
        <>
          <p><strong>Title:</strong> {textObject.title}</p>
          <p><strong>Tags:</strong> {textObject.tags.join(", ")}</p>
          <p><strong>URL:</strong> <a href={textObject.url} target="_blank" rel="noopener noreferrer">{textObject.url}</a></p>
        </>
      )}
    </div>
  );
}