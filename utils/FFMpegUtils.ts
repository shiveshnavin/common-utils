//@ts-nocheck
import { exec } from 'child_process';
import { path as ffmpegPath } from '@ffmpeg-installer/ffmpeg';
import { spawn } from 'child_process';
import { parseArgsStringToArgv } from 'string-argv';

function runSpawn(cmd: String, onLog?: Function) {
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
runSpawn('-version', console.log)
const ffmpegExecute = runSpawn;
export default ffmpegExecute

