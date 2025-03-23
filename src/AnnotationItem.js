import React, { useState, useEffect } from 'react';
import { tagManager } from './TagManager';

export default function AnnotationItem({
  textObject,
  index,
  selectedIndex,
  handleItemClick,
  editableTitle,
  setEditableTitle,
  editableTags,
  setEditableTags,
  editableMetadata,
  setEditableMetadata,
  handleSave,
  handleDelete
}) {
  const [newTag, setNewTag] = useState("");
  const [newTagColor, setNewTagColor] = useState("#ffffff");
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [tagSuggestions, setTagSuggestions] = useState([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleNewTagChange = (e) => {
    const value = e.target.value;
    setNewTag(value);

    // Filter existing tags for suggestions
    const suggestions = tagManager.getAllTags()
      .filter(tag => tag.text.toLowerCase().includes(value.toLowerCase()));
    setTagSuggestions(suggestions);
  };

  const handleTagSelect = (tag) => {
    const updatedTags = [...editableTags, tag.text];
    setEditableTags(updatedTags);
    setNewTag("");
    setTagSuggestions([]);
    setIsAddingTag(false);
  };

  const handleAddTag = () => {
    if (isAddingTag && newTag.trim() !== "") {
      const tag = tagManager.addTag(newTag.trim(), newTagColor);
      const updatedTags = [...editableTags, tag.text];
      setEditableTags(updatedTags);
      setNewTag("");
      setNewTagColor("#ffffff");
    }
    setIsAddingTag(!isAddingTag);
    setTagSuggestions([]);
  };

  const handleTagColorChange = (tagText, color) => {
    tagManager.updateTagColor(tagText, color);
    // Force re-render
    setEditableTags([...editableTags]);
  };
  
  const handleRemoveTag = (tagToRemove) => {
    const updatedTags = editableTags.filter(tag => tag !== tagToRemove);
    setEditableTags(updatedTags);
  };

  // background color's luminance (yoinked)
  const getTextColor = (bgColor) => {
    const color = bgColor.substring(1); // remove the #
    const rgb = parseInt(color, 16); // convert rrggbb to decimal
    const r = (rgb >> 16) & 0xff; // extract red
    const g = (rgb >> 8) & 0xff; // extract green
    const b = (rgb >> 0) & 0xff; // extract blue
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b; // calculate luma
    return luma > 128 ? 'black' : 'white'; // return black for light colors, white for dark colors
  };

  // Modified render method for tags
  const renderTag = (tagText) => {
    const tagInfo = tagManager.getTag(tagText);
    if (!tagInfo) return null;

    return (
      <span className="flex items-center rounded-full px-2 py-1 mr-2 mb-2 break-all"
        style={{ backgroundColor: tagInfo.color, color: getTextColor(tagInfo.color) }}>
        {tagInfo.text}
        <span
          className="ml-2 w-4 h-4 rounded-full cursor-pointer flex-shrink-0"
          style={{ background: 'linear-gradient(to right, red, orange, yellow, green, blue, indigo, violet)' }}
          onClick={() => document.getElementById(`colorPicker-${tagInfo.text}`).click()}
        ></span>
        <input
          type="color"
          id={`colorPicker-${tagInfo.text}`}
          value={tagInfo.color}
          onChange={(e) => handleTagColorChange(tagInfo.text, e.target.value)}
          className="hidden"
        />
        {selectedIndex === index && (
          <span
            className="ml-1 cursor-pointer text-sm hover:text-red-500"
            onClick={() => handleRemoveTag(tagText)}
          >
            ×
          </span>
        )}
      </span>
    );
  };

  return (
    <div
      key={index}
      className={`p-2 bg-[#363636] rounded overflow-hidden ${selectedIndex === index ? 'ring-2 ring-violet-400' : ''}`}
    >
      {selectedIndex === index ? (
        <>
          <input
            type="text"
            value={editableTitle}
            onChange={(e) => setEditableTitle(e.target.value)}
            className="w-full p-1 mb-1 border-b border-gray-400 rounded-none text-white text-xl font-bold break-words"
            onClick={(e) => {
              handleItemClick(index);
            }}
          />
          <div className="flex flex-wrap items-center mb-1">
            {editableTags.map((tagText) => renderTag(tagText))}
            {isAddingTag && (
              <div className="relative flex items-center w-10/12">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={newTag}
                    onChange={handleNewTagChange}
                    placeholder="Add tag"
                    className="w-full p-1 border-b border-gray-400 rounded-none text-white mr-2 mb-2 break-words"
                    onClick={(e) => e.stopPropagation()}
                  />
                  {tagSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 bg-neutral-800 rounded mt-1 shadow-lg z-10">
                      {tagSuggestions.map((tag) => (
                        <div
                          key={tag.text}
                          className="p-2 hover:bg-neutral-700 cursor-pointer flex items-center"
                          onClick={() => handleTagSelect(tag)}
                        >
                          <span className="w-4 h-4 rounded-full mr-2"
                            style={{ backgroundColor: tag.color }}></span>
                          {tag.text}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {/* Show color picker only for new tags */}
                {tagSuggestions.length === 0 && (
                  <input
                    type="color"
                    value={newTagColor}
                    onChange={(e) => setNewTagColor(e.target.value)}
                    className="w-6 h-6 p-0 border-none rounded-full cursor-pointer"
                  />
                )}
              </div>
            )}
            <button
              className="p-1 ml-2 bg-violet-400 hover:bg-violet-700 text-white rounded flex-shrink-0 transition-colors shadow-sm"
              onClick={handleAddTag}
            >
              +
            </button>
          </div>
          <p className="w-full p-1 my-2 text-white">
            "<strong>{textObject.text}</strong>"
          </p>
          
          {/* Timestamp and URL - always visible */}
          <div className="mt-2 text-xs text-gray-400">
            <p className="break-words opacity-75">{textObject.timestamp}</p>
            <p className="break-words opacity-75">
              <a className="hover:underline break-all" href={textObject.url} target="_blank" rel="noopener noreferrer">{textObject.url}</a>
            </p>
          </div>
          
          {/* Show/hide advanced options button */}
          <button
            className="mt-2 p-1 text-sm text-violet-300 hover:text-violet-100 underline flex items-center"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? 'Hide Metadata' : 'Show Metadata'}
            <span className="ml-1">{showAdvanced ? '▲' : '▼'}</span>
          </button>
          
          {/* Advanced options section - metadata only */}
          {showAdvanced && (
            <div className="mt-2 p-2 bg-neutral-700 rounded">
              <label className="block text-sm text-white mb-1">Metadata (comma separated):</label>
              <input
                type="text"
                value={editableMetadata}
                onChange={(e) => setEditableMetadata(e.target.value)}
                className="w-full p-1 mb-1 border-b border-gray-400 text-white bg-neutral-800 rounded-none break-words"
              />
            </div>
          )}
          
          <div className="border-t border-gray-600 mt-4 pt-2 flex space-x-2">
            <button
              className="p-1.5 bg-violet-400 hover:bg-violet-700 text-white rounded flex-1 transition-colors shadow-md"
              onClick={(e) => {
                handleSave(index);
              }}
            >
              Save
            </button>
            <button
              className="p-1.5 bg-[#444444] hover:bg-[#555555] text-white rounded flex-1 transition-colors border border-gray-600 shadow-md"
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
            className="text-xl font-bold cursor-pointer text-white mb-3"
            onClick={() => handleItemClick(index)}
          >
            {textObject.title}
          </p>
          <div className="flex flex-wrap items-center mb-1">
            {textObject.tags && Array.isArray(textObject.tags) && 
              textObject.tags.map((tagText, i) => (
                <span key={i}>{renderTag(tagText)}</span>
              ))
            }
          </div>
          <p className="text-sm text-gray-400 truncate mt-2">
            {textObject.text && textObject.text.length > 70 ? 
              textObject.text.substring(0, 70) + "..." : 
              textObject.text}
          </p>
        </>
      )}
    </div>
  );
}
