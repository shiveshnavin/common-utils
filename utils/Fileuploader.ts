//@ts-nocheck
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

  async uploadBytes(fileData, filePath) {
    const oracleAPI = this.creds.url

    const uploadUrl = oracleAPI + encodeURIComponent(filePath);
    await axios.put(uploadUrl, fileData);
    return {
      url: uploadUrl
    }
  }

  targetUploadUrl(fileName) {
    const oracleAPI = this.creds.url
    return oracleAPI + encodeURIComponent(fileName)
  }

  async upload(filePath: string) {


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
    const uploadUrl = this.targetUploadUrl(fileName);

    await axios.put(uploadUrl, fileData, {
      headers: {
        "Content-Type": getContentTypeFromFilename(fileName)
      }
    });
    return {
      url: uploadUrl
    }
  }

}
function getContentTypeFromFilename(filename) {
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