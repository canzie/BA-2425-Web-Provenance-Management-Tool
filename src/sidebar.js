import React, { useState, useEffect } from "react";
import SearchBar from "./SearchBar";
import AnnotationItem from "./AnnotationItem";

export default function Sidebar() {
  const [savedTexts, setSavedTexts] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [editableTitle, setEditableTitle] = useState("");
  const [editableTags, setEditableTags] = useState([]);
  const [editableMetadata, setEditableMetadata] = useState("");
  const [currentTabUrl, setCurrentTabUrl] = useState("");
  const [editableNotes, setEditableNotes] = useState("");
  const [filter, setFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [savingStatus, setSavingStatus] = useState(""); // For showing save status

  useEffect(() => {
    // Fetch saved texts
    chrome.storage.local.get("savedTexts", (data) => {
      setSavedTexts(data.savedTexts || []);
    });

    // Listen for changes in chrome.storage
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes.savedTexts) {
        setSavedTexts(changes.savedTexts.newValue);
      }
    });

    // Get the current tab URL
    const updateCurrentTabUrl = () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs[0]) {
          setCurrentTabUrl(tabs[0].url);
        }
      });
    };

    updateCurrentTabUrl();

    chrome.tabs.onActivated.addListener(updateCurrentTabUrl);
    chrome.tabs.onUpdated.addListener(updateCurrentTabUrl);

    // Cleanup event listeners on component unmount
    return () => {
      chrome.tabs.onActivated.removeListener(updateCurrentTabUrl);
      chrome.tabs.onUpdated.removeListener(updateCurrentTabUrl);
    };
  }, []);

  const handleItemClick = (index) => {
    setSelectedIndex(selectedIndex === index ? null : index);
    if (selectedIndex !== index) {
      const item = savedTexts[index];
      setEditableTitle(item.title || "");
      
      // Handle different tag formats
      if (item.tags) {
        if (Array.isArray(item.tags)) {
          setEditableTags(item.tags);
        } else {
          console.error("Tags is not an array:", item.tags);
          setEditableTags([]);
        }
      } else {
        setEditableTags([]);
      }
      
      // Handle metadata
      setEditableMetadata(item.metadata ? item.metadata.join(", ") : "");
      setEditableNotes(item.notes || "");
    }
  };

  const handleDelete = (index) => {
    const newSavedTexts = savedTexts.filter((_, i) => i !== index);
    setSavedTexts(newSavedTexts);
    chrome.storage.local.set({ savedTexts: newSavedTexts }, () => {
      if (chrome.runtime.lastError) {
        console.error("Error deleting item:", chrome.runtime.lastError);
        setSavingStatus("Error: Could not delete");
      } else {
        setSavingStatus("Deleted successfully");
        setTimeout(() => setSavingStatus(""), 2000);
      }
    });
    setSelectedIndex(null);
  };

  const handleSave = (index) => {
    try {
      setSavingStatus("Saving...");
      
      const newSavedTexts = [...savedTexts];
      
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
      
      newSavedTexts[index] = {
        ...newSavedTexts[index],
        title: editableTitle || "Untitled",
        tags: processedTags,
        metadata: processedMetadata,
        notes: editableNotes
      };
      
      // Update local state first for immediate feedback
      setSavedTexts(newSavedTexts);
      
      // Then update storage
      chrome.storage.local.set({ savedTexts: newSavedTexts }, () => {
        if (chrome.runtime.lastError) {
          console.error("Error saving:", chrome.runtime.lastError);
          setSavingStatus("Error: Could not save");
        } else {
          setSavingStatus("Saved successfully");
          setTimeout(() => setSavingStatus(""), 2000);
        }
      });
      
      setSelectedIndex(null);
    } catch (error) {
      console.error("Error in handleSave:", error);
      setSavingStatus("Error: " + error.message);
    }
  };

  const filteredTexts = filter === "currentTab"
    ? savedTexts.filter(textObject => textObject.url === currentTabUrl)
    : savedTexts;

  const searchedTexts = filteredTexts.filter(textObject =>
    textObject.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    textObject.text?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    textObject.metadata?.join(", ").toLowerCase().includes(searchQuery.toLowerCase()) ||
    textObject.url?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (Array.isArray(textObject.tags) && textObject.tags.some(tag => {
      const tagText = typeof tag === 'string' ? tag : (tag.text || '');
      return tagText.toLowerCase().includes(searchQuery.toLowerCase());
    }))
  );
  
  return (
    <div className="flex flex-col h-screen bg-[#1E1E1E]">
      {/* Header */}
      <div className="p-4">
        <div className="flex justify-center items-center mb-4">
          <button
            className={`p-2 flex-1 font-bold ${filter === "currentTab" ? "bg-violet-400 text-white" : "bg-gray-200"}`}
            onClick={() => setFilter("currentTab")}
          >
            Page Annotations
          </button>
          <div className="border-l border-gray-400 h-full"></div>
          <button
            className={`p-2 flex-1 font-bold ${filter === "all" ? "bg-violet-400 text-white" : "bg-gray-200"}`}
            onClick={() => setFilter("all")}
          >
            All Annotations
          </button>
        </div>
      </div>

      {/* Status message */}
      {savingStatus && (
        <div className={`p-2 text-center ${savingStatus.includes('Error') ? 'bg-red-500' : 'bg-green-500'} text-white`}>
          {savingStatus}
        </div>
      )}

      {/* Main content - scrollable area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 pb-20">
      {searchedTexts.length === 0 ? (
          <p className="text-gray-500">No annotations yet.</p>
        ) : (
          <ul className="space-y-2 w-full">
            {searchedTexts.map((textObject, index) => (
              <AnnotationItem
                key={index}
                textObject={textObject}
                index={index}
                selectedIndex={selectedIndex}
                handleItemClick={handleItemClick}
                editableTitle={editableTitle}
                setEditableTitle={setEditableTitle}
                editableTags={editableTags}
                setEditableTags={setEditableTags}
                editableMetadata={editableMetadata}
                setEditableMetadata={setEditableMetadata}
                editableNotes={editableNotes}
                setEditableNotes={setEditableNotes}
                handleSave={handleSave}
                handleDelete={handleDelete}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Footer - fixed search bar */}
      <div className="sticky bottom-0 bg-neutral-900 p-4 border-t border-gray-700 shadow-lg">
        <SearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
      </div>
    </div>
  );
}