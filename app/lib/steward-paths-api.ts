import { apiFetch } from "@/app/lib/auth-client";

const API_ROOT = "/api/steward-paths";

function templatePath(templateId: string): string {
  return `${API_ROOT}/templates/${encodeURIComponent(templateId)}`;
}

export const stewardPathsApi = {
  listTemplates<T>() {
    return apiFetch<T[]>(`${API_ROOT}/templates`);
  },

  getTemplate<T>(templateId: string) {
    return apiFetch<T>(templatePath(templateId));
  },

  createTemplate<T>(payload: unknown) {
    return apiFetch<T>(`${API_ROOT}/templates`, { method: "POST", body: JSON.stringify(payload) });
  },

  updateTemplate<T>(templateId: string, payload: unknown) {
    return apiFetch<T>(templatePath(templateId), { method: "PATCH", body: JSON.stringify(payload) });
  },

  archiveTemplate(templateId: string) {
    return apiFetch<void>(templatePath(templateId), { method: "DELETE" });
  },

  duplicateTemplate<T>(templateId: string) {
    return apiFetch<T>(`${templatePath(templateId)}/duplicate`, { method: "POST" });
  },

  addStep<T>(templateId: string, payload: unknown) {
    return apiFetch<T>(`${templatePath(templateId)}/steps`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  archiveStep(templateId: string, stepId: string) {
    return apiFetch<void>(`${templatePath(templateId)}/steps/${encodeURIComponent(stepId)}`, { method: "DELETE" });
  },

  getHistory<T>(templateId: string, limit = 40) {
    return apiFetch<T>(`${templatePath(templateId)}/history?limit=${limit}`);
  },

  listEnrollments<T>(limit = 300) {
    return apiFetch<T[]>(`${API_ROOT}/enrollments?limit=${limit}`);
  },

  runDueSteps<T>(limit = 150) {
    return apiFetch<T>(`${API_ROOT}/process-due`, {
      method: "POST",
      body: JSON.stringify({ limit }),
    });
  },
};