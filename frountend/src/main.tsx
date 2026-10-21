import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

const rootElement = document.getElementById("root");
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      {/* Router sits above App so its hooks (useNavigate, useLocation) work
          in App itself, not only in the page components. */}
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  );
}
