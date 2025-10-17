import { React } from "./vendor/react.js";
import { createRoot } from "./vendor/react-dom.js";
import { App } from "./App.js";

const container = document.getElementById("root");
if (!container) {
  throw new Error("No se encontró el contenedor #root");
}

const root = createRoot(container);
root.render(React.createElement(App));
