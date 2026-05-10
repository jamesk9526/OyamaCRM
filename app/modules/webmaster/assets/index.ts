import type { Asset } from "../schema";

/** Assets module for media library operations. */
export interface AssetsModule {
  listAssets: () => Promise<Asset[]>;
  uploadAsset: (file: File) => Promise<Asset>;
}
