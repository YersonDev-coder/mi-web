// Punto de montaje de la SPA.
import React from "react";
import ReactDOM from "react-dom/client";
import "./estilos/global.css";
import App from "./App";

ReactDOM.createRoot(document.getElementById("raiz")).render(
  <App />
);
