
export class EncryptionService {
    CryptoJS;

    constructor() {
        this.CryptoJS = require('crypto-js')
    }
    getKey(key: string) {
        return this.CryptoJS.SHA256(key);
    }

    encrypt(dataStr: string, key: string): string {
        if (!dataStr) return dataStr;

        const _key = this.getKey(key);
        console.log('CryptService:Encrypt:key=', key);

        const iv = this.CryptoJS.lib.WordArray.random(16); // Generate a random 16-byte IV
        const encrypted = this.CryptoJS.AES.encrypt(dataStr, _key, { iv });

        // Combine IV and ciphertext as hex strings, separated by ':'
        return iv.toString(this.CryptoJS.enc.Hex) + ':' + encrypted.ciphertext.toString(this.CryptoJS.enc.Hex);
    }

    decrypt(dataStr: string, key: string): string {
        if (!dataStr) return dataStr;

        const _key = this.getKey(key);
        console.log('CryptService:Decrypt:key=', key);

        try {
            const textParts = dataStr.split(':');
            const ivHex = textParts.shift()!;
            const encryptedTextHex = textParts.join(':');

            // Parse the IV and ciphertext
            const iv = this.CryptoJS.enc.Hex.parse(ivHex);
            const encryptedText = this.CryptoJS.enc.Hex.parse(encryptedTextHex);

            // Decrypt
            const decrypted = this.CryptoJS.AES.decrypt(
                { ciphertext: encryptedText } as any,
                _key,
                { iv }
            );
            const decr = decrypted.toString(this.CryptoJS.enc.Utf8);
            console.log('CryptService:Decrypt:decrypted=', decr);
            return decr;
        } catch (e) {
            console.log('Error in decryption', e);
            return dataStr;
        }
    }
}
