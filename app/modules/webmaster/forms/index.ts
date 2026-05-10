import type { FormDefinition } from "../schema";

/** Forms module for form builder and submission destinations. */
export interface FormsModule {
  listForms: () => Promise<FormDefinition[]>;
  createForm: (form: FormDefinition) => Promise<FormDefinition>;
}
