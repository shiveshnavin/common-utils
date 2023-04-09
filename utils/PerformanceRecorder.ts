//@ts-nocheck
export class PerformanceRecorder {


    private startTimeMs: number;
    private endTimeMs: number;

    public static create() {
        return new PerformanceRecorder();
    }

    constructor() {
        this.reset()
    }

    reset() {
        this.startTimeMs = Date.now()
        this.endTimeMs = undefined
    }

    end() {
        this.endTimeMs = Date.now()
    }

    elapsed() {
        if (this.endTimeMs) {
            return this.endTimeMs - this.startTimeMs
        }
        return Date.now() - this.startTimeMs
    }

    elapsedSeconds() {
        return Math.round(this.elapsed() / 1000)
    }


    elapsedString() {
        return Math.round(this.elapsed() / 1000) + ' seconds'
    }

}