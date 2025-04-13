//@ts-nocheck
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
    const { WebSocket, WebSocketServer } = await import('ws')

    // Map to store channel-specific callbacks for observer pattern (if needed)
    const observers = new Map<string, SocketCallback>()

    // Map to store subscriptions: channel -> Set of clients (ws connections)
    const subscriptions = new Map<string, Set<any>>()

    // Create a WebSocket server on the provided HTTP server with the '/ws' path
    const wss = new WebSocketServer({ server, path: '/ws' })

    wss.on('connection', (ws: any) => {
        logging && console.log('A user connected to /ws')

        // Setup an object to track which channels this client is subscribed to
        ws.subscriptions = new Set<string>()

        ws.on('message', (message: string) => {
            try {
                const parsed = JSON.parse(message.toString())
                const { channel, payload, action } = parsed

                // Handle subscription management
                if (action === 'subscribe') {
                    ws.subscriptions.add(channel)
                    if (!subscriptions.has(channel)) {
                        subscriptions.set(channel, new Set())
                    }
                    subscriptions.get(channel)?.add(ws)
                    logging && console.log(`Client subscribed to ${channel}`)
                    return
                } else if (action === 'unsubscribe') {
                    ws.subscriptions.delete(channel)
                    subscriptions.get(channel)?.delete(ws)
                    logging && console.log(`Client unsubscribed from ${channel}`)
                    return
                }

                // For normal messages, if an observer is registered, invoke its callback.
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
            // Clean up subscriptions for this client
            ws.subscriptions.forEach(channel => {
                subscriptions.get(channel)?.delete(ws)
            })
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
            // Send only to clients subscribed to this channel
            const clients = subscriptions.get(channel)
            if (clients) {
                clients.forEach((client: any) => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(message)
                    }
                })
            }
        }
    }

    return socketConnector
}

