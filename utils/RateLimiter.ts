/**
 * Rate limiter implemented using `rate-limiter-flexible`.
 * This provides a reliable, tested implementation that supports
 * N requests per M-second window.
 */
import { RateLimiterMemory } from 'rate-limiter-flexible';

export class TimeBasedRateLimiter {
    private rl: RateLimiterMemory;
    private key = 'global';

    constructor(maxRequests: number, windowSeconds: number) {
        if (maxRequests <= 0) throw new Error('maxRequests must be > 0');
        if (windowSeconds <= 0) throw new Error('windowSeconds must be > 0');
        this.rl = new RateLimiterMemory({ points: maxRequests, duration: windowSeconds });
    }

    /**
     * Try to consume a point immediately. Resolves true if allowed, false if rate limited.
     */
    async allow(): Promise<boolean> {
        try {
            await this.rl.consume(this.key, 1);
            return true;
        } catch (rej) {
            return false;
        }
    }

    /**
     * Acquire a slot, waiting until one is available. Optional `timeoutMs` rejects after timeout.
     */
    async acquire(timeoutMs = 0): Promise<void> {
        const start = Date.now();
        while (true) {
            try {
                await this.rl.consume(this.key, 1);
                return;
            } catch (rej: any) {
                // rej.msBeforeNext gives ms until a point is available
                const wait = typeof rej.msBeforeNext === 'number' ? rej.msBeforeNext : 100;
                if (timeoutMs > 0 && Date.now() - start + wait > timeoutMs) {
                    throw new Error('RateLimiter: acquire timeout');
                }
                await new Promise(r => setTimeout(r, Math.max(10, wait)));
            }
        }
    }

    /**
     * Remaining points in the current window.
     */
    async remaining(): Promise<number> {
        const res = await this.rl.get(this.key);
        if (!res) return this.rl.points as number;
        // res.remainingPoints may or may not exist depending on version; compute if needed
        if (typeof (res as any).remainingPoints === 'number') return (res as any).remainingPoints;
        if (typeof (res as any).consumedPoints === 'number') return Math.max(0, (this.rl.points as number) - (res as any).consumedPoints);
        return 0;
    }

    /**
     * Milliseconds until next slot is available. 0 if available now.
     */
    async timeUntilNext(): Promise<number> {
        const res = await this.rl.get(this.key);
        if (!res) return 0;
        return typeof (res as any).msBeforeNext === 'number' ? (res as any).msBeforeNext : 0;
    }

    /**
     * Reset limiter state.
     */
    async reset(): Promise<void> {
        await this.rl.delete(this.key);
    }
}