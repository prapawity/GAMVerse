import React from "react";
import { createRoot } from "react-dom/client";
import { OfficeApp } from "./ui/OfficeApp";
import { NetworkStatusBanner } from "./ui/pwa/NetworkStatusBanner";
import "./ui/styles.css";
import "./ui/pwa/install-app.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <>
      <NetworkStatusBanner />
      <OfficeApp />
    </>
  </React.StrictMode>,
);
