import { TplDB as TplDBType} from "./types.ts"
export class TplDB implements TplDBType {
    dbname:string;
    store?:string;
    version:number;

    private db: IDBDatabase | null = null;

    constructor(dbname: string, store: string, version:number = 1) {
        this.dbname = dbname;  
        this.version = 1;
    
    }

    async open(): Promise<void> {
        if (this.db) return;
        this.db = await new Promise((resolve, reject) => {
            const req = indexedDB.open(this.dbname, this.version);
            req.onupgradeneeded = (e) => {
                const db = (e.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'id', autoIncrement: true });
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    private tx(mode: IDBTransactionMode) {
        if (!this.db) throw new Error('Database not opened');
        return this.db.transaction(this.storeName, mode).objectStore(this.storeName);
    }

    async set<T extends object>(value: T): Promise<number> {
        const store = this.tx('readwrite');
        return await new Promise((resolve, reject) => {
            const req = store.put(value);
            req.onsuccess = () => resolve(req.result as number);
            req.onerror = () => reject(req.error);
        });
    }

    async get<T>(key: IDBValidKey): Promise<T | undefined> {
        const store = this.tx('readonly');
        return await new Promise((resolve, reject) => {
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result as T);
            req.onerror = () => reject(req.error);
        });
    }

    async delete(key: IDBValidKey): Promise<void> {
        const store = this.tx('readwrite');
        return await new Promise((resolve, reject) => {
            const req = store.delete(key);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }

    async getAll<T>(): Promise<T[]> {
        const store = this.tx('readonly');
        return await new Promise((resolve, reject) => {
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result as T[]);
            req.onerror = () => reject(req.error);
        });
    }

    async clear(): Promise<void> {
        const store = this.tx('readwrite');
        return await new Promise((resolve, reject) => {
            const req = store.clear();
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }
}