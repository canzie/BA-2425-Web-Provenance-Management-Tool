import React from "react";

export default function SearchBar({ searchQuery, setSearchQuery }) {
  return (
    <div className="p-4 bg-gray-100 w-full flex justify-center items-center">
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search annotations..."
        className="w-full p-2 border border-gray-400 rounded"
      />
    </div>
  );
}