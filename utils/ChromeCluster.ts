import { execSync, exec } from 'child_process'
import { Utils } from 'common-utils'
import path from 'path'
import { existsSync, unlinkSync } from 'fs';

let chromePath: string, xvfbPath: string, ffmpegPath: string;
try {
    chromePath = execSync('/bin/which  chromium').toString().trim()
    xvfbPath = execSync('/bin/which  xvfb-run').toString().trim()
    ffmpegPath = execSync('/bin/which  ffmpeg').toString().trim()
} catch (e) {
    chromePath = 'chrome'
    xvfbPath = 'xvfb-run'
    ffmpegPath = 'ffmpeg'
}

export interface ClusterProcess {
    process: any,
    serverNum: number,
    profile_path?: string,
    profile: string,
    port: number,
    record?: any,
    chrome_cmd?: string,
    resolution?: string
}
export class ChromeCluster {

    processes:
        ClusterProcess[] = [] //{process,serverNum,profile,port,record}
    debug = 0
    startRecording(proc: ClusterProcess, outputPath: string, timeoutSec = 30) {
        if (proc.record) {
            this.stopRecording(proc)
        }
        if (!outputPath) {
            outputPath = path.join(__dirname, `${proc.profile}.mp4`)
        }
        if (existsSync(outputPath)) {
            unlinkSync(outputPath)
        }
        let recordCmd = `${ffmpegPath} -video_size ${proc.resolution} -f x11grab -i :${proc.serverNum} -c:v libx264 -c:a aac  -g 50 -b:v 4000k -maxrate 4000k -bufsize 8000k -f flv -t ${timeoutSec} -listen 1 ${outputPath}`
        let record = exec(recordCmd)
        proc.record = record
        setTimeout(() => {
            console.log('Recording auto stopped for', proc.profile)
            this.kill(record)
        }, (timeoutSec + 1) * 1000)
    }

    kill(procData: ClusterProcess | any) {
        let proc = procData
        if (proc?.record) {
            this.kill(proc.record)
        }
        if (proc?.process) {
            proc = proc.process
            // Dont kill main xvfb processes
            // todo: if running in low machines, kill em
            return
        }
        try {
            if (proc.kill)
                proc.kill('SIGTERM')
            if (procData.port) {
                if (procData?.process) {
                    this.processes = this.processes.filter(p => {
                        return p.profile != procData.profile
                    })
                }
                killProcessByPort(procData.port)
            }
        } catch (e) {
            //@ts-ignore
            console.log('Error killing process: ' + e.message)
        }
    }

    stopRecording(proc: ClusterProcess) {
        if (proc.record) {
            this.kill(proc.record)
        }
    }

    get(profileName: string, port: number) {
        let procExisting = this.processes.find(p => {
            return p.port == port || p.profile == profileName
        })
        return procExisting
    }

    getFreePort() {
        let data = Utils.getConfig()
        let maxPort = 21230;
        let maxServernum = 100;

        for (const key in data) {
            if (key.startsWith("xvfb_port_")) {
                const port = data[key];
                if (port > maxPort) {
                    maxPort = port;
                }
            } else if (key.startsWith("xvfb_servernum_")) {
                const servernum = data[key];
                if (servernum > maxServernum) {
                    maxServernum = servernum;
                }
            }
        }

        return {
            port: maxPort + 1,
            servernum: maxServernum + 1
        }
    }

    async create(profileName: string, port: number, resolution = '768x1024') {

        if (port && port < 21230) {
            throw new Error(`port must be > 21230`)
        }
        let procExisting = this.get(profileName, port)
        if (procExisting) {
            if (this.debug)
                console.log('profile', profileName, 'already running at port ', procExisting.port)
            return procExisting
        }
        let profile = profileName
        if (profile.indexOf("/") == -1) {
            profile = path.join(__dirname, profile)
        }
        let serverNum = this.getFreePort().servernum
        let profSerNum = await Utils.getKeyAsync(`xvfb_servernum_${profileName}`)
        if (profSerNum) {
            serverNum = profSerNum
        } else {
            await Utils.setKeyAsync(`xvfb_servernum_${profileName}`, serverNum)
        }

        if (port == undefined) {
            let profPort = await Utils.getKeyAsync(`xvfb_port_${profileName}`)

            if (profPort) {
                port = profPort
            }
            else {
                port = this.getFreePort().port
                console.log(`Port=${port} and serverNum=${serverNum} assigned to ${profile}`)
                await Utils.setKeyAsync(`xvfb_port_${profileName}`, port)
            }
        }

        let startcmd = `${chromePath}  --user-data-dir=${profile}  --no-first-run --remote-debugging-port=${port} --no-sandbox --disable-web-security --disable-features=IsolateOrigins,site-per-process`

        let xfCmd = `${xvfbPath} --server-num=${serverNum} --server-args="-screen 0 ${resolution}x24 -ac -nolisten tcp -dpi 96" ${startcmd}`
        let child = exec(xfCmd, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error: ${error.message}`);
                return;
            }
            if (stderr) {
                console.error(`Error: ${stderr}`);
                return;
            }
            if (this.debug)
                console.log(`Shell command output:\n${stdout}`);
        })

        console.log(`[${child.pid}]`, "Starting chrome cluster node: " + startcmd)
        let proc: ClusterProcess = {
            process: child,
            profile: profileName,
            profile_path: profile,
            resolution: resolution,
            port: port,
            chrome_cmd: startcmd,
            serverNum: serverNum
        }
        this.processes.push(proc)
        return proc
    }
}


function killProcessByPort(port: number) {

    const command = `lsof -i :${port}`;
    exec(command, (error, stdout) => {
        if (error) {
            return;
        }
        const lines = stdout.split('\n');
        const processes = [];
        for (let i = 1; i < lines.length; i++) {
            const parts = lines[i].split(/\s+/).filter(part => part !== '');
            if (parts[1] !== 'PID') {
                try {
                    processes.push({
                        name: parts[0],
                        pid: parts[1],
                        port: parts[8].split(':')[1],
                    });
                } catch (e) { }
            }
        }

        if (processes.length > 0) {
            console.log(`Processes using port ${port}:`);
            processes.forEach(cProc => {
                if (cProc.name?.indexOf("chrom") > -1) {
                    console.log('killing ', cProc.pid)
                    exec(`kill -9 ${cProc.pid}`);
                }
            });
        }
    });
}



// async function test() {
//     let cc = new ChromeCluster()
//     let proc = cc.create('mohit')
//     cc.startRecording(proc, './record.mp4')
//     await Utils.sleep(5000)
//     cc.stopRecording(proc)
//     cc.kill(proc)
//     proc = cc.create('mohit')

//     console.log('completed')
// }

// test()