import { Axios } from "axios"
import { PerformanceRecorder } from "./PerformanceRecorder"
import { Utils } from "./Utils"

export interface ChatGptResponse {
    response: string
    conversationId: string
    response_time: number
    messageId?: string
    code?: number
}

export class ChatGptApi {

    endpoint
    conversationId
    retries
    axios

    constructor(
        endpoint: string,
        convoId?: string,
        retries?: number,
        axios?: Axios) {
        this.endpoint = endpoint
        this.conversationId = convoId
        this.retries = retries || 0
        this.axios = axios || Utils.getAxios()
    }

    async getChat(convoId?: string): Promise<any> {
        try {
            if (!convoId) {
                convoId = this.conversationId
            }
            if (!convoId) {
                return false
            }
            let chat = await this.axios.get(`${this.endpoint}/chat/${convoId}`)
            if (chat.status == 200) {
                return chat.data
            }
        } catch (e) {
            Utils.logPlain('Error reading chat', convoId)
        }
        return false
    }

    async query(prompt: string): Promise<ChatGptResponse | undefined> {

        let retryCountLeft = this.retries
        if (!this.conversationId) {
            this.conversationId = 'new'
        }
        do {
            try {

                Utils.logPlain("Prompting ChatGPT: ", prompt.substr(0, 50) + "...")
                let perfRecorder = PerformanceRecorder.create()

                let response = await this.axios.post(`${this.endpoint}/query`, {
                    text: prompt,
                    "options": {
                        "conversationId": this.conversationId
                    }
                })
                let cdata: ChatGptResponse = response.data

                if (!cdata?.response || response.status != 200) {
                    if (cdata?.code == 106004) {
                        Utils.logPlain('Too Many Requests Error from ChatGPT V2. Backing off for ', (10 - retryCountLeft) * 6, 'secs')
                        await Utils.sleep((10 - retryCountLeft) * 2 * 3000)
                    }
                    throw new Error('Chatgpt reponse failed: ' + JSON.stringify(cdata))
                }

                Utils.logPlain('Response from ChatGPT took', perfRecorder.elapsedSeconds(), 'seconds:', cdata.response)
                this.conversationId = cdata.conversationId
                return cdata;
            } catch (e) {
                retryCountLeft--
                Utils.logPlain('Chatgpt prompt failed. Retry count left=' + retryCountLeft)
                //@ts-ignore
                Utils.logPlain(e.message)
            }
        } while (retryCountLeft > 0)

        return undefined

    }

    async deleteConversation(convId?: string) {
        if (!convId)
            convId = this.conversationId
        return await this.axios.delete(`${this.endpoint}/chat/${convId}`)
    }


    static extractJson(resp: ChatGptResponse) {
        let mds = Utils.extractCodeFromMarkdown(resp.response)
        if (mds?.length > 0) {
            let jstr = mds[0]
            try {
                return JSON.parse(jstr)
            } catch (e: any) {
                Utils.logPlain('Unrecoverable Error parsing json from markdown', e.message)
            }
        } else {
            try {
                return JSON.parse(resp.response)
            } catch (e: any) {
                Utils.logPlain('Unrecoverable Error parsing json from plain text', e.message)
            }
        }
        return undefined
    }


}