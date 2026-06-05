type CacheEntry<T> = {
    value: T;
    cachedAt: number;
    ttlMs: number;
};

export interface CacheService {
    setData<T>(key: string, value: T, ttl?: number): Promise<void>
    getData<T>(key: string, lazy?: boolean): Promise<undefined | { data: T | undefined; refresh: boolean }>
    deleteData(key: string): Promise<void>
}

export class InMemoryCache implements CacheService {
    private static cacheMap = new Map<string, CacheEntry<any>>();

    public async setData<T>(key: string, value: T, ttl = 0) {
        InMemoryCache.cacheMap.set(key, {
            value,
            cachedAt: Date.now(),
            ttlMs: ttl,
        });
    }

    public async getData<T>(
        key: string,
        lazy = false,
    ) {
        const entry = InMemoryCache.cacheMap.get(key);
        if (!entry) {
            return lazy ? { data: undefined, refresh: false } : undefined;
        }

        const isExpired = entry.ttlMs > 0 && Date.now() - entry.cachedAt > entry.ttlMs;
        if (isExpired) {
            const staleData = entry.value as T;
            if (lazy) {
                return { data: staleData, refresh: true };
            }
            InMemoryCache.cacheMap.delete(key);
            return undefined;
        }

        return { data: entry.value as T, refresh: false };
    }

    public async deleteData(key: string) {
        InMemoryCache.cacheMap.delete(key);
    }
}

export default InMemoryCache;
