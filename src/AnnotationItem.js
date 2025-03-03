import React, { useState } from "react";

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
  const [newTag, setNewTag] = useState("");

  const handleAddTag = () => {
    if (newTag.trim() !== "") {
      setEditableTags(`${editableTags}, ${newTag}`);
      setNewTag("");
    }
  };

  return (
    <div
      key={index}
      className={`p-2 bg-neutral-700 border border-gray-400 rounded ${selectedIndex === index ? 'bg-gray-300' : ''}`}
    >
      {selectedIndex === index ? (
        <>
          <input
            type="text"
            value={editableTitle}
            onChange={(e) => setEditableTitle(e.target.value)}
            className="w-full p-1 mb-1 border border-gray-400 rounded text-white text-xl font-bold"
            onClick={(e) => {
              handleItemClick(index);
            }}
          />
          <div className="flex flex-wrap items-center mb-1">
            {editableTags.split(",").map((tag, i) => (
              <span key={i} className="bg-gray-300 rounded-full px-2 py-1 mr-2 mb-2">
                {tag.trim()}
              </span>
            ))}
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="Add tag"
              className="p-1 border border-gray-400 rounded text-white mr-2 mb-2"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              className="p-1 bg-blue-500 text-white rounded"
              onClick={(e) => {
                handleAddTag();
              }}
            >
              +
            </button>
          </div>
          <input
            type="text"
            value={editableText}
            onChange={(e) => setEditableText(e.target.value)}
            className="w-full p-1 mb-1 border border-gray-400 text-white rounded"
          />
          <input
            type="text"
            value={editableMetadata}
            onChange={(e) => setEditableMetadata(e.target.value)}
            className="w-full p-1 mb-1 border border-gray-400 rounded text-white"
          />
          <p className="text-white"><strong>Timestamp:</strong> {textObject.timestamp}</p>
          <p className="text-white"><strong>URL:</strong> <a href={textObject.url} target="_blank" rel="noopener noreferrer">{textObject.url}</a></p>
          <div className="border-t border-gray-400 my-2 flex space-x-2">
            <button
              className="mt-2 p-1 bg-green-500 text-white rounded flex-1"
              onClick={(e) => {
                handleSave(index);
              }}
            >
              Save
            </button>
            <button
              className="mt-2 p-1 bg-red-500 text-white rounded flex-1"
              onClick={(e) => {
                handleDelete(index);
              }}
            >
              Delete
            </button>
          </div>
        </>
      ) : (
        <>
          <p
            className="text-xl font-bold cursor-pointer text-white"
            onClick={() => handleItemClick(index)}
          >
            {textObject.title}
          </p>
          <div className="flex flex-wrap items-center mb-1">
            {textObject.tags.map((tag, i) => (
              <span key={i} className="bg-gray-300 rounded-full px-2 py-1 mr-2 mb-2">
                {tag}
              </span>
            ))}
          </div>
          <p className="text-white"><strong>URL:</strong> <a href={textObject.url} target="_blank" rel="noopener noreferrer">{textObject.url}</a></p>
        </>
      )}
    </div>
  );
}