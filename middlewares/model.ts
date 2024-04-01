export class ApiResponse {
    status: 'success' | 'failed'
    message?: string
    data?: any
    constructor(
        status?: 'success' | 'failed',
        message?: string,
        data?: any) {
        this.status = status
        this.message = message
        this.data = data
    }
    static ok(data?: any) {
        return new ApiResponse("success", "success", data)
    }
    static notOk(message?: string) {
        return new ApiResponse("failed", message)
    }
}