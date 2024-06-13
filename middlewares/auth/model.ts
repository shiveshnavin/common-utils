export class ApiResponse {
    status: 'success' | 'failed'
    message?: string
    data?: any
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
    access_token?: string
}

export interface ForgotPassword {
    id: string
    email: string
    link: string
    linkGen: string
    linkExp: string
    secret: string
  }
  