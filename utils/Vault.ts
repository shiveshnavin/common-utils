import path from "path"
import { Utils } from "./Utils"

export class Vault {

    basePath: string
    constructor(basePath?: string) {
        this.basePath = basePath ?? 'common-creds'
    }
    static get(basePath?: string) {
        return new Vault(basePath)
    }

    /**
     * 
     * @param relativePath Relative path considering common-creds at root
     * e.g. semibit/mysql.json
     */
    readCredSync(relativePath: string): string | undefined {
        let credPath = path.join(this.basePath, relativePath)
        if (!Utils.existsFileSync(credPath)) {
            return undefined
        }
        return Utils.readFileToString(credPath)
    }

    readCredSyncJson(relativePath: string): Record<any, any> | undefined {
        let credPath = path.join(this.basePath, relativePath)
        if (!Utils.existsFileSync(credPath)) {
            return undefined
        }
        return Utils.readFileToObject(credPath)
    }
}