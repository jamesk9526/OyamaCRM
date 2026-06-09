import { createSidebar } from "../components/sidebar.js";
import { createTopBar } from "../components/topBar.js";

export function createWorkspaceLayout({
  onOpenSettings,
  connectionLabel = "",
  activeItem = "dashboard",
  onSelectItem,
  content,
} = {}) {
  const shell = document.createElement("div");
  shell.className = "workspace-shell";

  shell.append(
    createSidebar({ activeItem, onSelect: onSelectItem }),
    createMainArea({ onOpenSettings, connectionLabel, content }),
  );

  return shell;
}

function createMainArea({ onOpenSettings, connectionLabel, content } = {}) {
  const main = document.createElement("main");
  main.className = "workspace-main";

  main.append(
    createTopBar({ onOpenSettings, connectionLabel }),
    createWorkspaceCanvas(content),
  );

  return main;
}

function createWorkspaceCanvas(content) {
  const canvas = document.createElement("section");
  canvas.className = "workspace-canvas";
  canvas.setAttribute("aria-label", "Workspace canvas");
  if (content instanceof Node) {
    canvas.append(content);
  }
  return canvas;
}
