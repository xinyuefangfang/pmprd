import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PrdApp } from "./app/PrdApp.tsx";
import "./styles.css";

createRoot(document.getElementById("prd-root")!).render(
  <StrictMode>
    <PrdApp />
  </StrictMode>,
);
