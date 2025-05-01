
const PipeLane = require('pipelane')
const { PipeTask } = PipeLane

export class WrapperPipeTask extends PipeTask<any, any> {

    onExecute: any;
    onKillCmd: any;

    public static of(taskName: any, onExecute: any): WrapperPipeTask {
        return new WrapperPipeTask(taskName, onExecute);
    }

    constructor(taskName: any, onExecute: any) {
        super(taskName, taskName)
        if (!onExecute) {
            throw new Error("must provide a onExecute")
        }
        this.onExecute = onExecute;
    }
    kill(): boolean {
        if (this.onKillCmd) {
            this.onKillCmd()
        }
        return true;
    }
    async execute(pipeWorksInstance: typeof PipeLane, inputs: any): Promise<any[]> {
        var that = this;
        return this.onExecute(pipeWorksInstance, inputs, (onKill) => {
            that.onKillCmd = onKill
        })
    }
    async getLoad() {
        return 0
    }

}