import React from "react";

export default function SearchBar({ searchQuery, setSearchQuery }) {
  return (
    <div className="w-full flex justify-center items-center ">
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search annotations..."
        className="w-full p-2 border bg-white border-gray-400 rounded"
      />
    </div>
  );
}