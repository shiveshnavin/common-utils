type CacheEntry<T> = {
    value: T;
    cachedAt: number;
    ttlMs: number;
};

export class InMemoryCache {
    private static cacheMap = new Map<string, CacheEntry<any>>();

    public setData<T>(key: string, value: T, ttl = 0): void {
        InMemoryCache.cacheMap.set(key, {
            value,
            cachedAt: Date.now(),
            ttlMs: ttl,
        });
    }

    public getData<T>(
        key: string,
        lazy = false,
    ): undefined | { data: T | undefined; refresh: boolean } {
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

    public deleteData(key: string): void {
        InMemoryCache.cacheMap.delete(key);
    }
}

export default InMemoryCache;
