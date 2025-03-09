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
  const [filter, setFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

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
        setCurrentTabUrl(tabs[0].url);
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
      setEditableTitle(savedTexts[index].title);
      setEditableTags(savedTexts[index].tags);
      setEditableMetadata(savedTexts[index].metadata.join(", "));
    }
  };

  const handleDelete = (index) => {
    const newSavedTexts = savedTexts.filter((_, i) => i !== index);
    setSavedTexts(newSavedTexts);
    chrome.storage.local.set({ savedTexts: newSavedTexts });
  };

  const handleSave = (index) => {
    const newSavedTexts = [...savedTexts];
    newSavedTexts[index] = {
      ...newSavedTexts[index],
      title: editableTitle,
      tags: editableTags,
      metadata: editableMetadata.split(",").map(meta => meta.trim())
    };
    setSavedTexts(newSavedTexts);
    chrome.storage.local.set({ savedTexts: newSavedTexts });
    setSelectedIndex(null);
  };

  const filteredTexts = filter === "currentTab"
    ? savedTexts.filter(textObject => textObject.url === currentTabUrl)
    : savedTexts;

  const searchedTexts = filteredTexts.filter(textObject =>
    textObject.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    textObject.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
    textObject.metadata.join(", ").toLowerCase().includes(searchQuery.toLowerCase()) ||
    textObject.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
    textObject.tags.map(tag => tag.text).join(" ").toLowerCase().includes(searchQuery.toLowerCase())
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