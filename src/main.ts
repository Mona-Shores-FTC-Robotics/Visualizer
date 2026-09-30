import "./app.css";
import { mount } from "svelte";
import App from "./App.svelte";

const app = mount(App, { target: document.body });

// Register the service worker (the offline copy, public/sw.js) only in production
// builds; in development it would get in the way of hot reload. "none": always
// check the server for a new sw.js, never a browser-cached one, so a deploy is
// picked up on the next load.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).catch((error) => {
    console.error(`Service worker registration failed: ${error}`);
  });
}

export default app;
