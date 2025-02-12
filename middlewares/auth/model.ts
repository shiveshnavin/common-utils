export class ApiResponse<T extends any> {
    status: 'success' | 'failed'
    message?: string
    data?: T
    constructor(
        status: 'success' | 'failed' = "success",
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

export interface AuthUser {
    name: string,
    avatar: string,
    email: string,
    password?: string,
    id?: string,
    access_token?: string,
    extrajson?: string,
    status?: "ACTIVE" | "INACTIVE" | "UNVERIFIED"
}

export interface ForgotPassword {
    id: string
    email: string
    link: string
    linkGen: string
    linkExp: string
    secret: string
}
