import { createWorkspaceLayout } from "./layout/workspaceLayout.js";
import { createSettingsWizard } from "./components/settingsWizard.js";
import { loadSavedConnection, saveConnection } from "./lib/connection-store.js";
import { loadDashboardData } from "./lib/desktop-api.js";
import { createDashboardPage } from "./pages/dashboardPage.js";

const root = document.getElementById("app");

if (!root) {
  throw new Error("Workspace root not found.");
}

const state = {
  settingsOpen: false,
  activeItem: "dashboard",
  connection: loadSavedConnection(),
  selectedConstituentId: "",
  dashboard: {
    loading: false,
    error: "",
    data: null,
    connectionKey: "",
  },
};

render();
queueDashboardLoad();

function render() {
  root.replaceChildren(
    createWorkspaceLayout({
      connectionLabel: state.connection?.appName || state.connection?.baseUrl || "",
      activeItem: state.activeItem,
      onSelectItem: (item) => {
        state.activeItem = item;
        render();
      },
      onOpenSettings: () => {
        state.settingsOpen = true;
        render();
      },
      content: createCurrentPage(),
    }),
  );

  if (state.settingsOpen) {
    root.append(
      createSettingsWizard({
        initialConnection: state.connection,
        onClose: () => {
          state.settingsOpen = false;
          render();
        },
        onConnected: (connection) => {
          state.connection = connection;
          saveConnection(connection);
          state.dashboard = {
            loading: false,
            error: "",
            data: null,
            connectionKey: "",
          };
          render();
          queueDashboardLoad(true);
        },
      }),
    );
  }
}

function createCurrentPage() {
  if (state.activeItem === "dashboard") {
    return createDashboardPage({
      connection: state.connection,
      dashboard: state.dashboard,
      selectedConstituentId: state.selectedConstituentId,
      onSelectConstituent: (id) => {
        state.selectedConstituentId = id;
        render();
      },
      onRefresh: () => {
        void queueDashboardLoad(true);
      },
      onOpenSettings: () => {
        state.settingsOpen = true;
        render();
      },
    });
  }

  return document.createElement("section");
}

let dashboardRequestId = 0;

async function queueDashboardLoad(force = false) {
  const baseUrl = state.connection?.baseUrl || "";
  if (!baseUrl) return;
  if (!force && state.dashboard.loading) return;
  if (!force && state.dashboard.connectionKey === baseUrl && state.dashboard.data) return;

  const requestId = ++dashboardRequestId;
  state.dashboard.loading = true;
  state.dashboard.error = "";
  render();

  try {
    const result = await loadDashboardData(baseUrl);
    if (requestId !== dashboardRequestId) return;
    state.dashboard = {
      loading: false,
      error: "",
      data: result,
      connectionKey: baseUrl,
    };
    const items = Array.isArray(result?.constituents?.items)
      ? result.constituents.items
      : Array.isArray(result?.constituents)
        ? result.constituents
        : [];
    if (!items.some((item) => item?.id === state.selectedConstituentId)) {
      state.selectedConstituentId = items[0]?.id || "";
    }
  } catch (error) {
    if (requestId !== dashboardRequestId) return;
    state.dashboard = {
      loading: false,
      error: error instanceof Error ? error.message : "Could not load the desktop dashboard.",
      data: null,
      connectionKey: baseUrl,
    };
    state.selectedConstituentId = "";
  }

  render();
}
