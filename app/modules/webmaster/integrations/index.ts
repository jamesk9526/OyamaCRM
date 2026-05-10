/** Integrations module contracts for external website tooling. */
export interface IntegrationModule {
  listProviders: () => Promise<Array<{ id: string; name: string; connected: boolean }>>;
}
