import * as fs from 'fs';
import * as path from 'path';

var archiver;
var unzipper
function getClosestCommonRoot(files: string[]): string {
    if (files.length === 0) {
        return '';
    }

    const splitPaths = files.map((file) => file.split(path.sep));
    const minLength = Math.min(...splitPaths.map((segments) => segments.length));

    let commonRoot = '';
    for (let i = 0; i < minLength; i++) {
        const firstSegment = splitPaths[0][i];
        if (splitPaths.every((segments) => segments[i] === firstSegment)) {
            commonRoot += firstSegment + path.sep;
        } else {
            break;
        }
    }

    return commonRoot;
}

export function ZipFiles(filesToExport: string[], outputPath: string): Promise<number> {
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    if (!archiver) {
        archiver = require('archiver')
    }
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip');

    let promise: Promise<number> = new Promise((resolve, reject) => {
        output.on('close', () => {
            if (fs.existsSync(outputPath))
                resolve(1)
            else
                reject(0)
        });
    });

    archive.on('warning', (err) => {
        if (err.code === 'ENOENT') {
            console.warn('Archive warning:', err);
        } else {
            throw err;
        }
    });

    archive.on('error', (err) => {
        throw err;
    });

    archive.pipe(output);

    const closestCommonRoot = getClosestCommonRoot(filesToExport);
    for (const file of filesToExport) {
        const relativePath = path.relative(closestCommonRoot, file);
        archive.file(file, { name: relativePath });
    }

    archive.finalize();
    return promise
}

export function UnzipGzFile(filePath, outFile) {
    const zlib = require("zlib");
    const gunzip = zlib.createGunzip();
    const input = fs.createReadStream(filePath);
    const output = fs.createWriteStream(outFile);

    return new Promise((resolve, reject) => {
        input.pipe(gunzip).pipe(output).on("finish", () => {
            if (fs.existsSync(outFile))
                resolve('ok')
            else
                reject()
        });
    })
}

export async function UnzipFiles(filePath, targetDir) {
    try {
        // Ensure that the targetDir exists before unzipping
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        if (!unzipper) {
            unzipper = require('unzipper')
        }
        // Open the zip file and extract its contents to the targetDir
        await fs.createReadStream(filePath)
            .pipe(unzipper.Extract({ path: targetDir }))
            .promise();

        console.log('Files extracted successfully.');
    } catch (error) {
        console.error('Error occurred during the unzip process:', error);
    }
}
