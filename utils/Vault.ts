import path from "path"
import { Utils } from "./Utils"
import fs from "fs"

export class Vault {

    basePath: string
    constructor(basePath?: string) {
        this.basePath = basePath ?? 'common-creds'
    }
    /**
     * Deprecated
     * Get an instance of Valult
     * @param basePath 
     * @returns 
     */
    static get(basePath?: string) {
        return new Vault(basePath)
    }

    /**
     * Get an instance of Valult
     * @param basePath 
     * @returns 
     */
    static getInstance(basePath?: string) {
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

    readCredSyncJson<T>(relativePath: string): Record<any, any> | T | any | undefined {
        let credPath = path.join(this.basePath, relativePath)
        if (!Utils.existsFileSync(credPath)) {
            return undefined
        }
        return Utils.readFileToObject(credPath)
    }


    readAllCredSyncJson<T>(relativePath: string): Record<string, Record<any, any> | T | any | undefined> {
        let credPath = path.join(this.basePath, relativePath)
        if (!Utils.existsFileSync(credPath)) {
            return {}
        }
        if (!Utils.isDirectory(credPath)) {
            let credData = this.readCredSyncJson(relativePath)
            return credData ? { [relativePath]: credData } : {}
        }
        let creds: Record<string, any> = {}
        let files = fs.readdirSync(credPath)
        for (let file of files) {
            //recursively read all json files in the directory
            let filePath = path.join(credPath, file)
            let relativeFilePath = path.join(relativePath, file)

            if (Utils.isDirectory(filePath)) {
                // Recursively read subdirectories
                let subCreds = this.readAllCredSyncJson(relativeFilePath)
                Object.assign(creds, subCreds)
            } else if (file.endsWith('.json')) {
                // Only process JSON files
                let credData = this.readCredSyncJson(relativeFilePath)
                if (credData) {
                    creds[relativeFilePath] = credData
                }
            }
        }
        return creds
    }
}