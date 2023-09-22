//@ts-nocheck
import fs, { existsSync, unlinkSync } from 'fs'
import Downloader from "nodejs-file-downloader";
import { createHash } from 'crypto';
import axios, { Axios } from 'axios';
import https from 'https'
import { exec } from 'child_process';
import { platform } from 'os';
import path from 'path';
import * as OTPAuth from "otpauth";
import parser from "otpauth-migration-parser";
import moment from 'moment-timezone'
const istTime = moment().tz('Asia/Kolkata');

interface ObjectWithText {
    text: string;
}

export class Utils {

    public static findObjDiff(objectOld,objectNew)  {
        return (function deepObjectDiff(obj1, obj2) {
          const diff = {};
        
          for (const key in obj1) {
            if (typeof obj1[key] === 'object' && obj1[key] !== null && typeof obj2[key] === 'object' && obj2[key] !== null) {
              const nestedDiff = deepObjectDiff(obj1[key], obj2[key]);
              if (Object.keys(nestedDiff).length > 0) {
                diff[key] = nestedDiff;
              }
            } else if (obj1[key] !== obj2[key]) {
              diff[key] = {
                oldValue: obj1[key],
                newValue: obj2[key]
              };
            }
          }
          for (const key in obj2) {
            if (!(key in obj1)) {
              diff[key] = {
                oldValue: undefined,
                newValue: obj2[key]
              };
            }
          }
          return diff;
        })(objectOld,objectNew) 
    }

    public static log(req, ...params) {
        let corrid = '-'
        if (req && req.header('x-correlation-id')) {
            corrid = req.header('x-correlation-id');
        }
        const formattedTime = istTime.format('M/DD/YY, h:mm:ss:SSS A');

        console.log(`(corrid=${corrid}) (time=${formattedTime}) `, ...params)
    }

    public static getHighestResMedia(mediaArray: { w, h }) {

        let largestResolutionPhoto = null;
        let largestResolution = 0;

        for (const media of mediaArray) {
            if (media.width) media.w = media.width
            if (media.height) media.h = media.height
            if (!media.w || !media.h) {
                continue
            }
            const resolution = media.w * media.h;
            if (resolution > largestResolution) {
                largestResolution = resolution;
                largestResolutionPhoto = media;
            }
        }

        return largestResolutionPhoto
    }

    public static clearFolder(folderPath: string, exclusions?: string[]) {
        if (!fs.existsSync(folderPath)) {
            return
        }
        const foldersToPreserve = exclusions || [];
        let cacheDirPath = folderPath
        fs.readdirSync(cacheDirPath).forEach(file => {

            const filePath = path.join(cacheDirPath, file);
            if (fs.statSync(filePath).isDirectory()) {
                if (!foldersToPreserve.includes(file)) {
                    fs.rmdirSync(filePath, { recursive: true });
                }
            } else {
                if (!foldersToPreserve.includes(file))
                    fs.unlinkSync(filePath);
            }

        });
    }

    public static replaceAll = function (source, search, replacement) {
        return source.split(search).join(replacement);
    };

    public static generateRandomID(length = 10) {
        const characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';

        for (let i = 0; i < length; i++) {
            const randomIndex = Math.floor(Math.random() * characters.length);
            result += characters.charAt(randomIndex);
        }

        return result;
    }

    public static getTimestampOfPreviousTime(hours, minutes) {
        const now = new Date();
        const date = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            hours,
            minutes,
            0,
            0
        );
        const timestamp = date.getTime();
        if (timestamp > now.getTime()) {
            // if the timestamp is in the future, subtract a day
            return timestamp - 24 * 60 * 60 * 1000;
        }
        return timestamp;
    }

    public static getConfig(file = "config.json") {
        if (fs.existsSync(file)) {
            try {
                let jstr = fs.readFileSync(file).toString()
                return JSON.parse(jstr)
            } catch (e) {
                return {}
            }
        }
        else {
            return undefined;
        }
    }

    public static formatDate(dateTimeStamp) {
        if (!dateTimeStamp)
            return undefined
        if (typeof (dateTimeStamp) == 'string') {
            dateTimeStamp = parseInt(dateTimeStamp)
        }
        let date = new Date(dateTimeStamp)
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, "0");
        const day = date.getDate().toString().padStart(2, "0");
        const hours = date.getHours().toString().padStart(2, "0");
        const minutes = date.getMinutes().toString().padStart(2, "0");
        const seconds = date.getSeconds().toString().padStart(2, "0");
        const timezoneOffset = date.getTimezoneOffset();
        const timezoneOffsetHours = Math.abs(Math.floor(timezoneOffset / 60)).toString().padStart(2, "0");
        const timezoneOffsetMinutes = (Math.abs(timezoneOffset) % 60).toString().padStart(2, "0");
        const timezoneOffsetSign = timezoneOffset >= 0 ? "-" : "+";
        //${timezoneOffsetSign}${timezoneOffsetHours}:${timezoneOffsetMinutes}
        return `${year}-${month}-${day}+${hours}:${minutes}:${seconds}`;
    }

    public static generateOTPFromKey(secret, digits?, algorithm?, period?, counter?) {
        let totp = new OTPAuth.TOTP({
            issuer: "",
            label: "OTP",
            algorithm: algorithm || "SHA1",
            digits: digits || 6,
            period: period || 30,
            counter: counter || { low: 0, high: 0, unsigned: false },
            secret: secret, // or 'OTPAuth.Secret.fromBase32("NB2W45DFOIZA")'
        });

        let token = totp.generate();
        return token
    }


    public static async parseOtpExport(dataUri) {
        const parsedDataList = await parser(dataUri);
        for (let otpSecretInfo of parsedDataList) {
            return otpSecretInfo
            /* =>
              {
                secret: 'xxxxxxxxxxxxxxxxxxxxxxxxxxx',
                name: 'sample',
                issuer: 'sample',
                algorithm: 'sha1',
                digits: 6,
                type: 'totp',
                counter: Long { low: 0, high: 0, unsigned: false }
              }
            */
        }
    }

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

    public static getAxios({ headers }): Axios {
        const axiosClient = axios.create({
            httpsAgent: new https.Agent({
                keepAlive: true,
                rejectUnauthorized: false
            })
        })
        if (headers) {
            axiosClient.interceptors.request.use(function (config) {
                Object.assign(config.headers, headers);
                return config;
            });
        }
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
    public static async sleepRandom(min, max) {
        const delay = Math.floor(Math.random() * (max - min + 1)) + min;
        return new Promise(resolve => setTimeout(resolve, delay));
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
