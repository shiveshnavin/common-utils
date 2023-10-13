import { Logging } from "@google-cloud/logging"
import fs from 'fs'
import { PerformanceRecorder } from "./PerformanceRecorder"
import { LogEntry } from "@google-cloud/logging/build/src/entry"
import { Utils } from "./Utils"
export class Auditlog {
    private appname
    private logging
    private credsjson
    constructor(appname: string, credsfile: any) {
        this.appname = appname
        this.credsjson = JSON.parse(fs.readFileSync(credsfile).toString());
        this.logging = new Logging({
            projectId: credsfile.project_id,
            keyFilename: credsfile
        });

    }


    event(action: string): AuditlogEvent {
        let logname = `audit-${this.credsjson.project_id}`
        return new AuditlogEvent(this.appname, logname, action, this.logging)
    }

    public static get(appname?: string): Auditlog {
        let configJson: string
        let credsFile = 'audit_log_creds.json'

        if (fs.existsSync('config.json')) {
            configJson = fs.readFileSync('config.json').toString()
            let config = JSON.parse(configJson)
            credsFile = config?.audit_log_creds;
            if (!appname && config.appname) {
                appname = config.appname
            }
        }
        if (!appname) {
            throw new Error('must provide `appname` either in config.json or as param to get()')
        }
        if (!fs.existsSync(credsFile)) {
            throw new Error('Must provide audit_log_creds in config.json or create a file `audit_log_creds.json` in root dir')
        }
        let logger = new Auditlog(appname, credsFile)
        return logger
    }



}

type Status = 'COMPLETED' | 'FAILED' | 'SCHEDULED' | 'IN_REVIEW' | 'PROCESSING' | 'CRITICAL'
export class AuditlogEvent {

    private log
    perf: PerformanceRecorder
    data: {
        timestamp?: number
        appname?: string
        action?: string
        status?: Status
        corrid?: string

        payload?: any
        perftime?: number

    } = {}

    constructor(
        appname: string,
        logname: string,
        action: string,
        logging: Logging) {
        this.data.appname = appname
        this.data.action = action
        this.log = logging.log(logname)
        this.perf = new PerformanceRecorder()
    }


    payload(payload: any): AuditlogEvent {
        this.data.payload = payload
        return this
    }

    fromreq(req: any) {
        if (req.headers) {
            if (req.headers['x-correlation-id']) {
                return this.corrid(req.headers['x-correlation-id'])
            }
        }
        return this;
    }

    corrid(corrid: string): AuditlogEvent {
        this.data.corrid = corrid
        return this
    }

    action(action: string): AuditlogEvent {
        this.data.action = action
        return this
    }

    status(status: Status): AuditlogEvent {
        this.data.status = status
        return this
    }

    commit(status?: Status) {
        this.data.perftime = this.perf.elapsed()
        if (status) {
            this.data.status = status
        }
        let opid = this.data.corrid || this.data.action + "-" + Utils.generateRandomID(10)
        const metadata: LogEntry = {
            labels: {
                //@ts-ignore
                'appname': this.data.appname,
                //@ts-ignore
                'operation': this.data.action,
                'type': 'auditlog',
            },
            operation: {
                id: opid,
                producer: this.data.appname
            },
            spanId: opid,
            resource: {
                type: 'global',
            },
            severity: 'INFO',
        };

        if (this.data.status == 'FAILED') {
            metadata.severity = 'ERROR'
        }
        if (this.data.status == 'CRITICAL') {
            metadata.severity = 'ALERT'
        }
        if (this.data.status == 'SCHEDULED') {
            metadata.severity = 'INFO'
        }
        if (this.data.status == 'PROCESSING') {
            metadata.severity = 'INFO'
        }
        if (this.data.status == 'IN_REVIEW') {
            metadata.severity = 'NOTICE'
        }
        if (this.data.status == 'COMPLETED') {
            metadata.severity = 'INFO'
        }
        //@ts-ignore
        const entry = this.log.entry(metadata, this.data);
        try {
            return this.log.write(entry)
        } catch (e) {
            //@ts-ignore
            console.log('Error writing log entry', e.message)
        }

    }

}

function test() {
    Auditlog.get('test')
        .event('test-action-' + Utils.generateRandomID(5))
        .corrid(Utils.generateRandomID(10))
        .status('COMPLETED')
        .commit()
}
test()