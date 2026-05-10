/** Publishing module contracts for preview/export/deploy. */
export interface PublishResult {
  id: string;
  target: string;
  status: "success" | "failed";
  createdAt: string;
}

export interface PublishingModule {
  exportProjectZip: (siteId: string) => Promise<PublishResult>;
  publishSite: (siteId: string) => Promise<PublishResult>;
}
