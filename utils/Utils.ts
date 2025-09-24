//@ts-nocheck
import fs, { existsSync, unlinkSync } from "fs";
import Downloader from "nodejs-file-downloader";
import { createHash } from "crypto";
import axios, { Axios } from "axios";
import https from "https";
import { exec, spawn } from "child_process";
import { platform } from "os";
import path from "path";
import * as OTPAuth from "otpauth";
import parser from "otpauth-migration-parser";
import moment from "moment-timezone";
import crypto from "crypto";
import * as _ from "lodash";
const istTime = moment().tz("Asia/Kolkata");

interface ObjectWithText {
  text: string;
}

var cacheConfig = {};

export type Logger = { info: (log: { message: string, labels: { origin: string } }) => void }
var defaultLogger: Logger | undefined = undefined

export class Utils {
  /**
   * Processes an array of objects in parallel with a specified level of concurrency.
   * @param {Array} items - The array of objects to process.
   * @param {Function} runner - The function to run for each object. Should return a Promise.
   * @param {number} parallelism - Number of parallel executions at a time.
   * @returns {Promise<Array>} - Resolves with an array of results when all tasks are completed.
   */
  static async processInParallel(items, runner, parallelism) {
    const results = [];
    const executing = [];

    for (const item of items) {
      const task = runner(item)
        .then((result) => {
          results.push({
            item,
            result,
          });
          executing.splice(executing.indexOf(task), 1); // Remove task from executing queue.
        })
        .catch((e) => {
          results.push({
            item,
            result: undefined,
          });
        });

      executing.push(task);

      if (executing.length >= parallelism) {
        await Promise.race(executing); // Wait for one of the tasks to complete.
      }
    }

    // Wait for the remaining tasks to complete.
    await Promise.all(executing);

    return results;
  }

  public static startsWithAny(string, prefixes) {
    for (const prefix of prefixes) {
      if (string.startsWith(prefix)) {
        return true;
      }
    }
    return false;
  }

  public static getFullUrlFromRequest(req) {
    const url = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    return url;
  }
  public static stringContainsAnyWord(str: string, wordList: Array<String>) {
    const regex = new RegExp(wordList.join("|"), "i");
    return regex.test(str);
  }

  public static extractEnclosedArrString(inputString) {
    const regex = /\[[^\]]*\]/g;
    if (typeof inputString != "string") {
      inputString = JSON.stringify(inputString);
    }
    const results = inputString.match(regex);
    return results[0];
  }

  public static extractEnclosedObjString(inputString) {
    const regex = /\{[^\}]*\}/g;
    const results = inputString.match(regex);
    return results[0];
  }
  public static extractCodeFromMarkdown(markdown) {
    let codeBlocks = [];
    let regex = /```(.+?)\s*([\s\S]+?)```/gs;
    let match;
    while ((match = regex.exec(markdown))) {
      codeBlocks.push(match[2]);
    }
    return codeBlocks;
  }

  public static arrayDiff<T>(arr1: T[], arr2: T[]): T[] {
    const set1 = new Set(arr1);
    const set2 = new Set(arr2);
    const uncommonElements = new Set([...set1, ...set2]);
    for (const element of set1) {
      if (set2.has(element)) {
        uncommonElements.delete(element);
      }
    }
    return Array.from(uncommonElements);
  }

  public static shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      // Generate a random index between 0 and i (inclusive)
      const j = Math.floor(Math.random() * (i + 1));

      // Swap elements at i and j
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  public static refineString(str, replacementChar = "_") {
    if (!str) {
      return ""
    }
    const regexPattern = new RegExp(`[^a-zA-Z0-9]`, "g");
    return str.replace(regexPattern, replacementChar);
  }

  public static async forEachAsync<T>(
    array: T[],
    func: (item: T, idx?: number, array?: T[]) => Promise<void>
  ) {
    for (let i = 0; i < array.length; i++) {
      const item = array[i];
      await func(item, i, array);
    }
  }

  public static assert(actual, expected, msg?) {
    let bool = actual == expected;
    let err = `Assertion Error.${msg || ""
      } Expected {${expected}} but found {${actual}}`;
    if (!bool) throw new Error(err);
  }

  public static generateHash(inputString, desiredLength = 10) {
    const hash = crypto.createHash("sha256").update(inputString).digest("hex");
    if (desiredLength >= hash.length) {
      return hash;
    } else {
      return hash.substring(0, desiredLength);
    }
  }

  /**
   * Should avoid this function
   * @param key
   * @returns
   */
  public static getKeySync(key) {
    let file = "config.json";
    if (!fs.existsSync(file)) {
      return false;
    }
    let prefs = JSON.parse(fs.readFileSync(file).toString());
    return _.get(prefs, key);
  }

  public static getCachedKeySync(key) {
    if (cacheConfig) {
      return _.get(cacheConfig, key);
    }
    let file = "config.json";
    if (!fs.existsSync(file)) {
      return false;
    }
    let prefs = JSON.parse(fs.readFileSync(file).toString());
    cacheConfig = prefs;
    return _.get(prefs, key);
  }

  public static async getKeyAsync(key) {
    let file = "config.json";
    if (!fs.existsSync(file)) {
      return false;
    }
    let prefs = JSON.parse(fs.readFileSync(file).toString());
    return _.get(prefs, key);
  }

  public static async setKeyAsync(key, value) {
    let file = "config.json";
    if (!fs.existsSync(file)) {
      return false;
    }
    let prefs = JSON.parse(fs.readFileSync(file).toString());
    _.set(prefs, key, value);
    fs.writeFileSync(file, JSON.stringify(prefs, undefined, 2));
  }

  public static async getDynamicConfig(app) {
    let file = "config.json";
    if (!fs.existsSync(file)) {
      return false;
    }
    let prefs = JSON.parse(fs.readFileSync(file).toString());
    return prefs;
  }

  public static findObjDiff(objectOld, objectNew) {
    return (function deepObjectDiff(obj1, obj2) {
      const diff = {};

      for (const key in obj1) {
        if (
          typeof obj1[key] === "object" &&
          obj1[key] !== null &&
          typeof obj2[key] === "object" &&
          obj2[key] !== null
        ) {
          const nestedDiff = deepObjectDiff(obj1[key], obj2[key]);
          if (Object.keys(nestedDiff).length > 0) {
            diff[key] = nestedDiff;
          }
        } else if (obj1[key] !== obj2[key]) {
          diff[key] = {
            oldValue: obj1[key],
            newValue: obj2[key],
          };
        }
      }
      for (const key in obj2) {
        if (!(key in obj1)) {
          diff[key] = {
            oldValue: undefined,
            newValue: obj2[key],
          };
        }
      }
      return diff;
    })(objectOld, objectNew);
  }

  public static setLogger(loggerFunc: Logger) {
    defaultLogger = loggerFunc;
  }

  public static logPlainWithLevel(level: 0 | 1 | 2 | 3 | 4, ...params) {
    Utils.logWithLevel(level, undefined, ...params);
  }

  public static logWithLevel(level: 0 | 1 | 2 | 3 | 4, req, ...params) {
    let curLevel = Utils.getCachedKeySync("log_level");
    if (curLevel >= level) Utils.log(undefined, ...params);
  }

  public static logPlain(...params) {
    Utils.log(undefined, ...params);
  }

  public static log(req, ...params) {
    try {
      let corrid = "-";
      let tenant = undefined;
      if (req && req.header("x-correlation-id")) {
        corrid = req.header("x-correlation-id");
      }
      if (req && req.header("correlation-id")) {
        corrid = req.header("correlation-id");
      } else if (req && req["corrid"]) {
        corrid = req["corrid"];
      } else if (typeof req == "string") {
        corrid = req;
      }

      if (req && req.header("x-tenant")) {
        tenant = req.header("x-tenant");
      }
      const formattedTime = istTime.format("M/DD/YY, h:mm:ss:SSS A");

      console.log(
        `(corrid=${corrid}) (time=${formattedTime}) `,
        tenant ? `(tenant=${tenant})` : "",
        ...params
      );
      if (req?.logger?.info) {
        req.logger.info({
          message: params.join(" "),
          labels: {
            url: req.url,
            method: req.method,
            user: req.session?.user?.id,
            corrid,
            origin: "app",
          },
        });
      }
      else if (defaultLogger?.info) {
        defaultLogger.info({
          message: params.join(" "),
          labels: {
            url: req?.url,
            method: req?.method,
            user: req?.session?.user?.id,
            corrid,
            origin: "app",
          },
        });
      }
    } catch (e) { }
  }

  public static getHighestResMedia(mediaArray: { w; h }) {
    let largestResolutionPhoto = null;
    let largestResolution = 0;

    for (const media of mediaArray) {
      if (media.width) media.w = media.width;
      if (media.height) media.h = media.height;
      if (!media.w || !media.h) {
        continue;
      }
      const resolution = media.w * media.h;
      if (resolution > largestResolution) {
        largestResolution = resolution;
        largestResolutionPhoto = media;
      }
    }

    return largestResolutionPhoto;
  }

  public static clearFolder(folderPath: string, exclusions?: string[]) {
    if (!fs.existsSync(folderPath)) {
      return;
    }
    const foldersToPreserve = exclusions || [];
    let cacheDirPath = folderPath;
    fs.readdirSync(cacheDirPath).forEach((file) => {
      const filePath = path.join(cacheDirPath, file);
      if (fs.statSync(filePath).isDirectory()) {
        if (!foldersToPreserve.includes(file)) {
          fs.rmdirSync(filePath, { recursive: true });
        }
      } else {
        if (!foldersToPreserve.includes(file)) fs.unlinkSync(filePath);
      }
    });
  }

  public static replaceAll = function (source, search, replacement) {
    return source.split(search).join(replacement);
  };

  public static getRandomNumber = function (from: number, to: number): number {
    const range = to - from;
    const randomNumber = Math.random() * range + from;
    return randomNumber;
  };

  public static generateRandomID(length = 10) {
    const characters =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";

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
        let jstr = fs.readFileSync(file).toString();
        return JSON.parse(jstr);
      } catch (e) {
        return {};
      }
    } else {
      return undefined;
    }
  }

  public static formatDate(dateTimeStamp) {
    if (!dateTimeStamp) return undefined;
    if (typeof dateTimeStamp == "string") {
      dateTimeStamp = parseInt(dateTimeStamp);
    }
    let date = new Date(dateTimeStamp);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const seconds = date.getSeconds().toString().padStart(2, "0");
    const timezoneOffset = date.getTimezoneOffset();
    const timezoneOffsetHours = Math.abs(Math.floor(timezoneOffset / 60))
      .toString()
      .padStart(2, "0");
    const timezoneOffsetMinutes = (Math.abs(timezoneOffset) % 60)
      .toString()
      .padStart(2, "0");
    const timezoneOffsetSign = timezoneOffset >= 0 ? "-" : "+";
    //${timezoneOffsetSign}${timezoneOffsetHours}:${timezoneOffsetMinutes}
    return `${year}-${month}-${day}+${hours}:${minutes}:${seconds}`;
  }

  public static generateOTPFromKey(
    secret,
    digits?,
    algorithm?,
    period?,
    counter?
  ) {
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
    return token;
  }

  public static async parseOtpExport(dataUri) {
    const parsedDataList = await parser(dataUri);
    for (let otpSecretInfo of parsedDataList) {
      return otpSecretInfo;
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

  public static getFieldFromRequest(
    req: any,
    fieldname: string
  ): string | undefined {
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

  public static writeFileString(path, string) {
    fs.writeFileSync(path, string);
  }

  public static writeFileObject(path, obj) {
    Utils.writeFileString(path, JSON.stringify(obj, null, 2));
  }

  public static readFileToObject(path) {
    if (!fs.existsSync(path)) {
      return undefined;
    }
    try {
      let fileStr = fs.readFileSync(path);
      let obj = JSON.parse(fileStr);
      return obj;
    } catch (e) {
      console.error("Error converting file to object", e.message);
      return undefined;
    }
  }

  public static readFileToString(path) {
    if (!fs.existsSync(path)) {
      return undefined;
    }
    try {
      let fileStr = fs.readFileSync(path);
      return fileStr.toString();
    } catch (e) {
      console.error("Error converting file to string", e.message);
      return undefined;
    }
  }

  public static existsFileSync(path) {
    if (!fs.existsSync(path)) {
      return false;
    }
    return true;
  }

  public static getFullUrlFromRequest(req) {
    const url = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    return url;
  }
  public static stringContainsAnyWord(str: string, wordList: Array<String>) {
    const regex = new RegExp(wordList.join("|"), "i");
    return regex.test(str);
  }

  public static extractCodeFromMarkdown(markdown) {
    let codeBlocks = [];
    let regex = /```(.+?)```/gs;
    let match;
    while ((match = regex.exec(markdown))) {
      let group = match[1];
      if (group.startsWith("json")) {
        group = group.replace("json", "");
      }
      codeBlocks.push(group);
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

  public static getFileNameFromURL(url) {
    const parsedURL = new URL(url);
    const pathname = parsedURL.pathname;
    const parts = pathname.split("/");
    const filename = parts[parts.length - 1];
    return filename;
  }

  public static async downloadFile(url, fullOutFilePath, isOverwrite = false, headers = {}): any {
    if (existsSync(fullOutFilePath) && !isOverwrite) {
      console.log("Skipping Download of exisiting file");
      return;
    }
    const fileName = path.basename(fullOutFilePath);
    const dirName = path.dirname(fullOutFilePath);

    console.log("downloading ", url, "to file", fullOutFilePath);
    const downloader = new Downloader({
      url: url,
      directory: dirName,
      fileName: fileName,
      cloneFiles: false,
      timeout: 60000,
      headers
    });
    return downloader.download();
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

    paragraph = Utils.mergeObjectsWithShortText(
      paragraph.split(".").map((s) => {
        return { text: s };
      }),
      5
    )
      .map((obx) => obx.text)
      .join(".");

    let str = paragraph.trim();
    let result = "";
    let prevChar: string | null = null;

    for (let i = 0; i < str.length; i++) {
      const char = str[i];

      if (char === "." && i < str.length - 1) {
        let nextCharPos = i + 1;
        while (str[nextCharPos] == " ") {
          nextCharPos = nextCharPos + 1;
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
    return text.replace(/\b([A-Z]\.)+\b/g, (match) =>
      match.replace(/\./g, " ")
    );
  }

  public static async checkIfFFMPEGInstalled() {
    function isFfmpegInstalled(): Promise<boolean> {
      const command = platform() === "win32" ? "where ffmpeg" : "which ffmpeg";
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
    return isInstalled;
  }

  public static replaceDecimalPoints(input: string): string {
    // Define a regular expression to match decimal numbers with periods
    const decimalRegex = /\d+\.\d+/g;

    // Replace all periods with underscores in each matched decimal number
    const replaced = input.replace(decimalRegex, (match) => {
      return match.replace(".", "_");
    });

    return replaced;
  }
  public static restoreDecimalPoints(input: string): string {
    // Define a regular expression to match decimal numbers with underscores
    const decimalRegex = /\d+_\d+/g;

    // Replace all underscores with periods in each matched decimal number
    const replaced = input.replace(decimalRegex, (match) => {
      return match.replace("_", ".");
    });

    return replaced;
  }

  public static mergeObjectsWithShortText<T extends ObjectWithText>(
    arr: T[],
    threshold: number
  ) {
    const mergedArr: ObjectWithText[] = [];
    arr.forEach((ar) => {
      ar.text = Utils.replaceDecimalPoints(ar.text);
    });

    for (let i = 0; i < arr.length; i++) {
      if (i === 0) {
        // First object, just add to merged array
        mergedArr.push(arr[i]);
      } else {
        const prevObject = mergedArr[mergedArr.length - 1];
        const currObject = arr[i];

        if (currObject.text.length < threshold && !/\d/.test(currObject.text)) {
          // Merge text into previous object's text field
          prevObject.text += " " + currObject.text;
        } else {
          // Add current object to merged array
          mergedArr.push(currObject);
        }
      }
    }
    mergedArr.forEach((ar) => {
      ar.text = Utils.restoreDecimalPoints(ar.text);
    });

    return mergedArr;
  }

  public static decodeBase64(base64: string): string {
    return Buffer.from(base64, "base64").toString("utf8");
  }

  public static encodeBase64(normalString: string): string {
    return Buffer.from(normalString).toString("base64");
  }

  public static getAxios(globalConfig?= {}): Axios {
    let { headers } = globalConfig;
    const axiosClient = axios.create({
      httpsAgent: new https.Agent({
        keepAlive: true,
        rejectUnauthorized: false,
      }),
    });
    if (headers) {
      axiosClient.interceptors.request.use(function (config) {
        Object.assign(config.headers, headers);
        return config;
      });
    }
    axiosClient.defaults.validateStatus = function () {
      return true;
    };
    return axiosClient;
  }

  public static getFileName(filePath: string): string {
    const match = filePath.match(/([^\/\\]+)$/);
    return match ? match[1] : "";
  }

  public static generateUID(input: string): string {
    return createHash("sha256").update(input).digest("hex").substring(0, 10);
  }

  public static randomElement<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  public static async sleep(ms) {
    await new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
  public static async sleepRandom(min, max) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise((resolve) => setTimeout(resolve, delay));
  }
  public static saveBase64Image(base64Image, fileName) {
    // remove the "data:image/jpeg;base64," header from the base64 string
    const base64Data = base64Image.replace(/^data:image\/jpeg;base64,/, "");

    // convert the base64 string to binary data
    const binaryData = Buffer.from(base64Data, "base64");

    // write the binary data to a JPG file
    fs.writeFileSync(fileName, binaryData, "binary");
  }

  public static appendQueryParam(existingUrl, paramName, paramValue) {
    let parts = existingUrl.split("?");
    let left = parts[0];
    let right = `?${paramName}=${paramValue}`;
    if (parts[1]) {
      right = right + "&" + parts[1];
    }
    return left + right;
  }

  public static validateEmail(email: String) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }


  public static getContentTypeFromFilename(filename) {
    const extension = filename.split('.').pop().toLowerCase();

    const contentTypeMap = {
      jpg: 'image/jpeg',
      png: 'image/png',
      mp4: 'video/mp4',
      mp3: 'audio/mpeg',
      zip: 'application/zip',
      rar: 'application/x-rar-compressed',
      exe: 'application/x-msdownload',
      mov: 'video/quicktime',
      jpeg: 'image/jpeg',
      aac: 'audio/aac',
      wav: 'audio/wav',
      pdf: 'application/pdf',
    };

    const contentType = contentTypeMap[extension];

    // If content type is found, return it; otherwise, return application/octet-stream
    return contentType ? contentType : 'application/octet-stream';
  }

  static async exec(
    rawCmd: string,
    opts?: {
      isExecutableAllowed?: (cmd: string, allowed: string[]) => boolean;
      allowedCommands?: string[];
      onLog?: (...args: any[]) => void;
    }
  ): Promise<RunOneResult> {
    return new Promise<RunOneResult>(resolve => {
      if (
        opts?.isExecutableAllowed &&
        opts?.allowedCommands &&
        !opts.isExecutableAllowed(rawCmd, opts.allowedCommands)
      ) {
        return resolve({
          status: false,
          cmd: rawCmd,
          message: "Command not allowed"
        });
      }

      const wrapped = `source ~/.bash_profile >/dev/null 2>&1 || true; ${rawCmd}`;
      opts?.onLog?.(`Executing: ${rawCmd}`);

      const child = spawn("bash", ["-c", wrapped], {
        stdio: ["ignore", "pipe", "pipe"]
      });

      let stdoutBuf = "";
      let stderrBuf = "";

      child.stdout.on("data", chunk => {
        const str = chunk.toString();
        process.stdout.write(str);
        stdoutBuf += str;
      });

      child.stderr.on("data", chunk => {
        const str = chunk.toString();
        process.stderr.write(str);
        stderrBuf += str;
      });

      child.on("close", code => {
        const trim = (txt: string) =>
          txt.length > 200
            ? txt.slice(0, 100) + "\n...snip...\n" + txt.slice(-100)
            : txt;

        if (code !== 0) {
          resolve({
            status: false,
            cmd: rawCmd,
            message: `Exited with code ${code}`,
            stdout: trim(stdoutBuf),
            stderr: trim(stderrBuf)
          });
        } else {
          resolve({
            status: true,
            cmd: rawCmd,
            output: trim(stdoutBuf),
            stderr: trim(stderrBuf)
          });
        }
      });
    });
  }

  static toBoolean(val: any) {
    return val === true || val === '1' || val === 'true' || val === 1;
  }

}

export interface RunOneResult {
  status: boolean;
  cmd: string;
  message?: string;
  output?: string;
  stdout?: string;
  stderr?: string;
}
