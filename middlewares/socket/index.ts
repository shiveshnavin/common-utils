export type SocketCallback = (channel: string, data: any, ws: any) => void

export interface ISocketConnector {
    /**
     * Register an observer for a specific channel.
     * Passing `undefined` as callback will remove the observer.
     * @param channel The channel to observe
     * @param callback The callback to handle incoming messages for this channel
     */
    observe: (channel: string, callback?: SocketCallback) => void
    /**
     * Emit an event to all connected clients.
     * @param channel The channel to emit
     * @param data The data to send
     */
    emit: (channel: string, data: any) => void
}

export async function createSocket(server: any, logging: boolean = false): Promise<ISocketConnector> {
    // Dynamically import the 'ws' dependencies
    const { WebSocket, WebSocketServer } = await import('ws')

    // Map to store channel-specific callbacks
    const observers = new Map<string, SocketCallback>()

    // Create a WebSocket server on the provided HTTP server with the '/ws' path
    const wss = new WebSocketServer({ server, path: '/ws' })

    wss.on('connection', (ws: any) => {
        logging && console.log('A user connected to /ws')

        ws.on('message', (message: string) => {
            try {
                // Assume the client sends a JSON string with `channel` and `payload`
                const parsed = JSON.parse(message.toString())
                const { channel, payload } = parsed

                // If an observer is registered for the channel, invoke its callback
                if (observers.has(channel)) {
                    const callback = observers.get(channel)
                    if (callback) {
                        callback(channel, payload, ws)
                    }
                }
            } catch (error: any) {
                logging && console.error('Error parsing socket message:', error.message)
            }
        })

        ws.on('close', () => {
            logging && console.log('User disconnected from /ws')
        })
    })

    const socketConnector: ISocketConnector = {
        observe: (channel, callback?) => {
            if (callback) {
                observers.set(channel, callback)
            } else {
                observers.delete(channel)
            }
        },
        emit: (channel, data) => {
            const message = JSON.stringify({ channel, payload: data })
            wss.clients.forEach((client: any) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(message)
                }
            })
        }
    }

    return socketConnector
}
