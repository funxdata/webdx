import { DxDate } from "./tools/dxdate.ts";
import { isJSONSerializable } from "./tools/json.ts";
import { createStorage, Storage } from "./tools/storage.ts";

export { createStorage, DxDate, isJSONSerializable, Storage };
export type { StorageBackend } from "./tools/types.ts";
