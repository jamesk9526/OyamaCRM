export async function loadDashboardData(baseUrl) {
  const result = await window.oyamaDesktop.loadDashboard(baseUrl);
  if (!result?.ok) {
    throw new Error(result?.message || "Could not load the dashboard.");
  }
  return result;
}
