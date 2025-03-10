import React from 'react';
import ReactDOM from 'react-dom/client';
import GraphView from './graphview';
import './styles.css';

const rootElement = document.getElementById("root");
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <GraphView />
    </React.StrictMode>
  );
} else {
  console.error("Root element not found!");
}