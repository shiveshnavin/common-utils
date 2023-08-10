import path from "path";
import fs from 'fs'
import axios from "axios";

export class FileUploader {

  private service;
  private creds;

  /**
   * 
   * @param service oracle
   * @param creds {url: -pre-authenticated-url- }
   */
  constructor(service: string, creds: any) {
    this.service = service;
    this.creds = creds
  }

  async upload(filePath: string) {

    const oracleAPI = this.creds.url

    let uploadDir = 'uploads'
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir)
    }
    let fileName = path.basename(filePath)
    const readStream = fs.createReadStream(filePath);
    const writeStream = fs.createWriteStream(path.join(uploadDir, fileName));
    readStream.pipe(writeStream);

    await new Promise((resolve) => {
      writeStream.on('finish', resolve);
    });

    const fileData = fs.readFileSync(path.join(uploadDir, fileName));
    const uploadUrl = oracleAPI + encodeURIComponent(fileName);

    await axios.put(uploadUrl, fileData);
    return {
      url: uploadUrl
    }
  }

}