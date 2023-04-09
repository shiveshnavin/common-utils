//@ts-nocheck
import fs, { existsSync, unlinkSync } from 'fs'
import Downloader from "nodejs-file-downloader";
import { createHash } from 'crypto';
import axios, { Axios } from 'axios';
import https from 'https'
import { exec } from 'child_process';
import { platform } from 'os';
import path from 'path';

interface ObjectWithText {
    text: string;
}

export class Utils {

    public static getFieldFromRequest(req: any, fieldname: string): string | undefined {
        let value: string | undefined;

        if (req.body && req.body[fieldname]) {
            value = req.body[fieldname].toString();
        } else if (req.query && req.query[fieldname]) {
            value = req.query[fieldname].toString();
        } else if (req.headers && req.headers[fieldname]) {
            value = req.headers[fieldname].toString();
        }

        return value;
    }


    public static readFileToObject(path) {
        if (!fs.existsSync(path)) {
            return undefined
        }
        try {
            let fileStr = fs.readFileSync(path)
            let obj = JSON.parse(fileStr)
            return obj
        } catch (e) {
            console.error('Error converting file to object', e.message)
            return undefined
        }
    }

    public static getFullUrlFromRequest(req) {
        const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        return url;
    }
    public static stringContainsAnyWord(str: string, wordList: Array<String>) {
        const regex = new RegExp(wordList.join('|'), 'i');
        return regex.test(str);
    }

    public static extractCodeFromMarkdown(markdown) {
        let codeBlocks = [];
        let regex = /```(.+?)```/gs;
        let match;
        while (match = regex.exec(markdown)) {
            codeBlocks.push(match[1]);
        }
        return codeBlocks;
    }

    public static splitArray(arr, pieces) {
        let result = [];
        let chunkSize = Math.ceil(arr.length / pieces);
        for (let i = 0, j = arr.length; i < j; i += chunkSize) {
            result.push(arr.slice(i, i + chunkSize));
        }
        return result;
    }


    public static downloadFile(url, fullOutFilePath, isOverwrite = false): any {
        if (existsSync(fullOutFilePath) && !isOverwrite) {
            console.log('Skipping Download of exisiting file')
            return
        }
        const fileName = path.basename(fullOutFilePath);
        const dirName = path.dirname(fullOutFilePath);
        if (isOverwrite && existsSync(fullOutFilePath))
            unlinkSync(fullOutFilePath)

        console.log('downloading ', url, 'to file', fullOutFilePath)
        axios({
            url,
            method: 'GET',
            responseType: 'stream'
        }).then(response => {
            if (existsSync(fullOutFilePath))
                return
            const writer = fs.createWriteStream(fullOutFilePath);
            response.data.pipe(writer);
        });
    }

    public static _downloadFile(url, fullOutFilePath, isOverwrite = false): any {
        if (existsSync(fullOutFilePath) && !isOverwrite) {
            console.log('Skipping Download of exisiting file')
            return
        }
        const fileName = path.basename(fullOutFilePath);
        const dirName = path.dirname(fullOutFilePath);

        console.log('downloading ', url, 'to file', fullOutFilePath)
        const downloader = new Downloader({
            url: url,
            directory: dirName,
            fileName: fileName,
            cloneFiles: false
        });
        return downloader.download()
    }

    public static printProgress(progress) {
        try {
            //@ts-ignore
            process.stdout.clearLine();
            process.stdout.cursorTo(0);
            process.stdout.write(progress);
        } catch (e) {
            //console.log(progress)
        }
    }

    public static removePeriodInAbbreviations(paragraph: string): string {

        const sentences = paragraph.split("."); // split paragraph into sentences
        const lastSentence = sentences.pop().trim(); // remove the last sentence and trim whitespace
        if (lastSentence.startsWith("Featured")) {
            paragraph = sentences.join(".") + "."; // join the remaining sentences and add period
        } else {
            paragraph = paragraph; // return the original paragraph if the last sentence doesn't start with "Featured"
        }

        paragraph = Utils.mergeObjectsWithShortText
            (paragraph.split(".").map(s => { return { text: s } }), 5)
            .map(obx => obx.text)
            .join(".")


        let str = paragraph.trim();
        let result = '';
        let prevChar: string | null = null;

        for (let i = 0; i < str.length; i++) {
            const char = str[i];

            if (char === '.' && i < str.length - 1) {
                let nextCharPos = i + 1
                while (str[nextCharPos] == ' ') {
                    nextCharPos = nextCharPos + 1
                }
                var nextChar = str[nextCharPos];
                if (prevChar !== null && nextChar.match(/[A-Z]/) === null) {
                    continue;
                }
            }

            result += char;
            prevChar = char;
        }

        return result;
    }

    public static countWords(str: string): number {
        const words = str.trim().split(/\s+/);
        return words.length;
    }

    public static removePeriodsFromAbbr(text: string): string {
        return text.replace(/\b([A-Z]\.)+\b/g, (match) => match.replace(/\./g, ' '));
    }

    public static async checkIfFFMPEGInstalled() {

        function isFfmpegInstalled(): Promise<boolean> {
            const command = platform() === 'win32' ? 'where ffmpeg' : 'which ffmpeg';
            return new Promise((resolve) => {
                exec(command, (err, stdout, stderr) => {
                    if (err) {
                        // FFmpeg is not installed
                        resolve(false);
                        return;
                    }
                    // FFmpeg is installed
                    resolve(true);
                });
            });
        }

        const isInstalled = await isFfmpegInstalled();
        return isInstalled
    }

    public static replaceDecimalPoints(input: string): string {
        // Define a regular expression to match decimal numbers with periods
        const decimalRegex = /\d+\.\d+/g;

        // Replace all periods with underscores in each matched decimal number
        const replaced = input.replace(decimalRegex, (match) => {
            return match.replace('.', '_');
        });

        return replaced;
    };
    public static restoreDecimalPoints(input: string): string {
        // Define a regular expression to match decimal numbers with underscores
        const decimalRegex = /\d+_\d+/g;

        // Replace all underscores with periods in each matched decimal number
        const replaced = input.replace(decimalRegex, (match) => {
            return match.replace('_', '.');
        });

        return replaced;
    };


    public static mergeObjectsWithShortText<T extends ObjectWithText>(arr: T[], threshold: number) {
        const mergedArr: ObjectWithText[] = [];
        arr.forEach(ar => {
            ar.text = Utils.replaceDecimalPoints(ar.text)
        })

        for (let i = 0; i < arr.length; i++) {
            if (i === 0) {
                // First object, just add to merged array
                mergedArr.push(arr[i]);
            } else {
                const prevObject = mergedArr[mergedArr.length - 1];
                const currObject = arr[i];

                if (currObject.text.length < threshold && !(/\d/.test(currObject.text))) {
                    // Merge text into previous object's text field
                    prevObject.text += " " + currObject.text;
                } else {
                    // Add current object to merged array
                    mergedArr.push(currObject);
                }
            }
        }
        mergedArr.forEach(ar => {
            ar.text = Utils.restoreDecimalPoints(ar.text)
        })

        return mergedArr;
    }

    public static decodeBase64(base64: string): string {
        return Buffer.from(base64, 'base64').toString('utf8');
    }


    public static encodeBase64(normalString: string): string {
        return Buffer.from(normalString).toString("base64");
    }

    public static getAxios(): Axios {
        const axiosClient = axios.create({
            httpsAgent: new https.Agent({
                keepAlive: true,
                rejectUnauthorized: false
            })
        })
        axiosClient.defaults.validateStatus = function () {
            return true;
        };
        return axiosClient
    }

    public static getFileName(filePath: string): string {
        const match = filePath.match(/([^\/\\]+)$/);
        return match ? match[1] : '';
    }

    public static generateUID(input: string): string {
        return createHash('sha256').update(input).digest('hex').substring(0, 10);
    }

    public static randomElement<T>(arr: T[]): T {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    public static async sleep(ms) {
        await new Promise(resolve => {
            setTimeout(resolve, ms)
        })
    }
    public static saveBase64Image(base64Image, fileName) {
        // remove the "data:image/jpeg;base64," header from the base64 string
        const base64Data = base64Image.replace(/^data:image\/jpeg;base64,/, '');

        // convert the base64 string to binary data
        const binaryData = Buffer.from(base64Data, 'base64');

        // write the binary data to a JPG file
        fs.writeFileSync(fileName, binaryData, 'binary');
    }
}