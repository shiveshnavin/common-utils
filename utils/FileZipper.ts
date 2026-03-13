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
            // console.warn('Archive warning:', err);
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
        // Use entry-by-entry extraction. `unzipper.Extract()` intermittently
        // truncates large media files on Windows for some archives.
        const directory = await unzipper.Open.file(filePath);
        const safeRoot = path.resolve(targetDir);

        for (const entry of directory.files) {
            const normalizedEntryPath = path.normalize(entry.path);
            const outputPath = path.resolve(safeRoot, normalizedEntryPath);

            // Prevent zip-slip path traversal.
            if (!outputPath.startsWith(safeRoot + path.sep) && outputPath !== safeRoot) {
                throw new Error(`Unsafe zip entry path detected: ${entry.path}`);
            }

            if (entry.type === 'Directory' || normalizedEntryPath.endsWith(path.sep)) {
                if (!fs.existsSync(outputPath)) {
                    fs.mkdirSync(outputPath, { recursive: true });
                }
                continue;
            }

            const parentDir = path.dirname(outputPath);
            if (!fs.existsSync(parentDir)) {
                fs.mkdirSync(parentDir, { recursive: true });
            }

            try {
                await new Promise<void>((resolve, reject) => {
                    entry
                        .stream()
                        .on('error', reject)
                        .pipe(fs.createWriteStream(outputPath))
                        .on('error', reject)
                        .on('finish', () => resolve());
                });
            } catch (e) {
                if (fs.existsSync(outputPath)) {
                    try { fs.unlinkSync(outputPath); } catch (_) { }
                }
                throw e;
            }
        }

        console.log('Files extracted successfully.');
    } catch (error) {
        console.error('Error occurred during the unzip process:', error);
        throw error;
    }
}
