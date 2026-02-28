import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// register service worker for PWA
if (import.meta.env.PROD) {
  import("virtual:pwa-register").then(({ registerSW }) => {
    registerSW({
      onNeedRefresh() {
        // optionally show a toast to the user
        console.log("New content available; please refresh.");
      },
      onOfflineReady() {
        console.log("App is ready to work offline.");
      }
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
