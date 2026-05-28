import { installApiFetchShim } from "./lib/api.js";
import App from "./App.svelte";

installApiFetchShim();

const app = new App({
  target: document.getElementById("app"),
});

export default app;
