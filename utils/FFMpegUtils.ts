//@ts-nocheck
import { exec } from 'child_process';
import { path as ffmpegPath } from '@ffmpeg-installer/ffmpeg';
import { spawn } from 'child_process';
import { parseArgsStringToArgv } from 'string-argv';

function execute(cmd: String, onLog?: Function) {
    if (!onLog)
        onLog = console.log
    cmd = cmd.replace('ffmpeg', "")
    if (cmd.indexOf('-y') == -1) {
        cmd = cmd + " -y"
    }
    let args = parseArgsStringToArgv(cmd)

    return new Promise((resolve, reject) => {

        const ffmpeg = spawn(ffmpegPath, args);
        var output = ""
        ffmpeg.stdout.on('data', function (chunk) {
            onLog(chunk.toString());
            output = output + chunk.toString()
        });
        ffmpeg.stderr.on('data', function (chunk) {
            onLog(chunk.toString());
            output = output + chunk.toString()
        });
        ffmpeg.on('exit', function () {
            resolve(output);
            onLog('Command Completed : ' + cmd)
        })
    })
}


async function joinAudios(filePaths, outputFileName) {
    if (!Array.isArray(filePaths) || filePaths.length < 2) {
        throw new Error("You need at least two audio files to concatenate.");
    }

    const inputFiles = filePaths.map((filePath) => `-i "${filePath}"`).join(" ");
    const filterComplex = filePaths.map((_, index) => `[${index}:a]`).join("") + `concat=n=${filePaths.length}:v=0:a=1[out]`;

    const ffmpegCommand = `ffmpeg ${inputFiles} -filter_complex "${filterComplex}" -map "[out]" "${outputFileName}"`;
    return await execute(ffmpegCommand);
}

// joinAudios(['../../public/test/1.mp3', '../../public/test/2.mp3', '../../public/test/3.mp3'], '../../public/test/op.mp3')
const FFMpegUtils = {
    execute,
    joinAudios
};
export default FFMpegUtils

