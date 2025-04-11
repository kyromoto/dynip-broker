export class DynipProtoError extends Error {
    constructor (message: string, readonly status: number = 500, readonly body: 'badauth' | 'nohost' | 'dnserr' | '911'  = "911") {
        super(message)
    }
}



export class ClientError extends Error {
    constructor (message: string, readonly status: number = 400, readonly meta?: Record<string, any>) {
        super(message)
    }
}

export class ApplicationError extends Error {
    constructor (message: string, readonly meta?: Record<string, any>) {
        super(message)
    }
}