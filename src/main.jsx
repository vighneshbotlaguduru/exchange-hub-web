import React from "react";
import ReactDOM from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import "bootstrap/dist/css/bootstrap.min.css";
import "./styles/variables.css";
import "./styles/global.css";
import "./styles/android.css";
import "./styles/android.css";
import App from "./App.jsx";

if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") {
  document.documentElement.classList.add("platform-android");
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
