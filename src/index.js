import React from "react";
import ReactDOM from "react-dom/client";
import Sidebar from "./sidebar";
import './styles.css';

const rootElement = document.getElementById("root");
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <Sidebar />
    </React.StrictMode>
  );
} else {
  console.error("Root element not found!");
}