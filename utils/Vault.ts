import path from "path"
import { Utils } from "./Utils"
import fs from "fs"
import { createDecipheriv, createHash, pbkdf2Sync } from "crypto"
import dotenv from "dotenv"
dotenv.config()

const OPENSSL_MAGIC = Buffer.from("Salted__")
const LEGACY_MAGIC = Buffer.from("__COMMON_CREDS_ENCRYPTED_V1__\n")
const PBKDF2_ITERATIONS = 100000

export class Vault {

    basePath: string
    credsKey: string
    constructor(basePath?: string, credsKey?: string) {
        this.basePath = basePath ?? 'common-creds'
        this.credsKey = credsKey ?? process.env.COMMON_CREDS_KEY
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
     * e.g. mycreds/mysql-core.json
     */
    readCredSync(relativePath: string): string | undefined {
        let credPath = path.join(this.basePath, relativePath)
        if (!Utils.existsFileSync(credPath)) {
            return undefined
        }
        return this.readCredentialContents(credPath)
    }

    readCredSyncJson<T>(relativePath: string): Record<any, any> | T | any | undefined {
        let credPath = path.join(this.basePath, relativePath)
        if (!Utils.existsFileSync(credPath)) {
            return undefined
        }
        return JSON.parse(this.readCredentialContents(credPath))
    }

    private readCredentialContents(credPath: string): string {
        const content = fs.readFileSync(credPath)
        const key = this.credsKey ?? process.env.COMMON_CREDS_KEY

        if (content.subarray(0, OPENSSL_MAGIC.length).equals(OPENSSL_MAGIC)) {
            if (!key) {
                throw new Error("COMMON_CREDS_KEY is required to read encrypted credentials.")
            }
            if (content.length < 16) {
                throw new Error(`Encrypted credential file is malformed: ${credPath}`)
            }

            const salt = content.subarray(8, 16)
            const ciphertext = content.subarray(16)
            const derived = pbkdf2Sync(key, salt, PBKDF2_ITERATIONS, 48, "sha256")
            const decipher = createDecipheriv(
                "aes-256-cbc",
                derived.subarray(0, 32),
                derived.subarray(32, 48)
            )
            return Buffer.concat([
                decipher.update(ciphertext),
                decipher.final()
            ]).toString("utf8")
        }

        if (content.subarray(0, LEGACY_MAGIC.length).equals(LEGACY_MAGIC)) {
            if (!key) {
                throw new Error("COMMON_CREDS_KEY is required to read encrypted credentials.")
            }
            if (content.length < LEGACY_MAGIC.length + 28) {
                throw new Error(`Encrypted credential file is malformed: ${credPath}`)
            }

            const derivedKey = createHash("sha256").update(key).digest()
            const ivStart = LEGACY_MAGIC.length
            const iv = content.subarray(ivStart, ivStart + 12)
            const authTag = content.subarray(ivStart + 12, ivStart + 28)
            const ciphertext = content.subarray(ivStart + 28)
            const decipher = createDecipheriv("aes-256-gcm", derivedKey, iv)
            decipher.setAuthTag(authTag)
            return Buffer.concat([
                decipher.update(ciphertext),
                decipher.final()
            ]).toString("utf8")
        }

        return content.toString("utf8")
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