import axios from 'axios'

export default class WhatsappHelper {
    endpoint
    constructor(endpoint: string) {
        this.endpoint = endpoint
    }

    sendWhatsappReaction(to: string, waid: string, emoji: string) {
        let data = JSON.stringify({
            "to": to,
            "waid": waid,
            "emoji": emoji
        });

        let config = {
            method: 'post',
            url: this.endpoint + '/whatsapp/sendReaction',
            headers: {
                'Content-Type': 'application/json'
            },
            data: data
        };

        return axios.request(config)
    }

    sendWhatsappMessage(to: string, waid: string, text: string) {
        let data = JSON.stringify({
            "to": to,
            "waid": waid,
            "text": text
        });

        let config = {
            method: 'post',
            url: this.endpoint + '/whatsapp/sendText',
            headers: {
                'Content-Type': 'application/json'
            },
            data: data
        };

        return axios.request(config)
    }

}