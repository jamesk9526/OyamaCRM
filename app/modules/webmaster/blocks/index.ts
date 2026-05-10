import type { BlockInstance } from "../schema";

/** Blocks module for block-level editing contracts. */
export interface BlocksModule {
  createTextBlock: (text?: string) => BlockInstance;
  createImageBlock: (src?: string, alt?: string) => BlockInstance;
  createButtonBlock: (label?: string, href?: string) => BlockInstance;
}
