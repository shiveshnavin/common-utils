import path from "path";
import { ChatGptApi } from "./ChatGptApi";
import { PerformanceRecorder } from "./PerformanceRecorder";
import fs from 'fs'
import { Utils } from "./Utils";

export class ChatGptTraining {
    private cgpt: ChatGptApi
    private maxRetries = 5

    constructor(gptApi: ChatGptApi) {
        this.cgpt = gptApi
    }


    private checkpoint(folderPath: string,
        i: number,
        convoId?: string,
        retries?: number) {
        let chkp = path.join(folderPath, '.checkpoint.json')
        fs.writeFileSync(chkp, JSON.stringify({
            i: i,
            retries: retries,
            conversationId: convoId
        }, undefined, 2))
    }

    private getCheckpoint(folderPath: string) {
        let chkp = path.join(folderPath, '.checkpoint.json')
        if (fs.existsSync(chkp)) {
            return JSON.parse(fs.readFileSync(chkp).toString())
        }
        return undefined
    }

    private removeCheckpoint(folderPath: string) {
        let chkp = path.join(folderPath, '.checkpoint.json')
        if (fs.existsSync(chkp)) {
            fs.unlinkSync(chkp)
            return true
        }
        return false
    }
    async train(folderPath: string) {
        this.cgpt.conversationId = 'new'
        let start = 0
        let ckkp = this.getCheckpoint(folderPath)
        if (ckkp) {
            let chat = await this.cgpt.getChat(ckkp.conversationId)
            if (chat) {
                this.cgpt.conversationId = ckkp.conversationId
                start = ckkp.i + 1
                Utils.logPlain('Skipping training steps directly to ', start, 'for', ckkp.conversationId)
                ckkp.retries = ckkp.retries || 0
                if (ckkp.retries > this.maxRetries) {
                    throw new Error(`MAX_RETRY_EXCEEDED retried ${ckkp.retries}`)
                }
            }
        }
        let perf = PerformanceRecorder.create()
        let metaPath = path.join(folderPath, 'meta.json')
        if (fs.existsSync(metaPath)) {
            let meta = JSON.parse(fs.readFileSync(metaPath).toString())
            Utils.logPlain('Started training with itemcount=', meta.length, ' and checkpoint at', start, 'retrycount=', ckkp?.retries)
            for (let i = start; i < meta.length; i++) {
                const train = meta[i];
                if (train.file) {
                    train.text = fs.readFileSync(path.join(folderPath, train.file)).toString()
                }
                if (train.text) {
                    let resp = await this.cgpt.query(train.text)
                    this.checkpoint(folderPath, start, this.cgpt.conversationId, (ckkp?.retries || 0) + 1)
                    if (!resp?.response) {
                        throw new Error('Training failed as no response from chatgpt. Please try training again')
                    }
                } else {
                    throw new Error('Must provide `file` or `text` in each training row')
                }
                this.checkpoint(folderPath, i, this.cgpt.conversationId, 0)
                Utils.logPlain('Training', Math.round(100 * ((i + 1) / meta.length)), '% complete')
            }
            Utils.logPlain('Training completed in ', perf.elapsedString(), 'conversationId=', this.cgpt.conversationId)
            this.removeCheckpoint(folderPath)
            return this.cgpt.conversationId
        } else {
            throw new Error(`Folder ${folderPath} doesnot contain a meta.json`)
        }

    }
}