//@ts-nocheck
import PipeLane, { PipeTask } from "pipelane";
import Utils from "./Utils";

export class WrapperPipeTask extends PipeTask<any, any>{

    onExecute;
    onKillCmd;

    public static of(taskName, onExecute): WrapperPipeTask<InputWithPreviousInputs, OutputWithStatus> {
        return new WrapperPipeTask(taskName, onExecute);
    }

    constructor(taskName, onExecute) {
        super(taskName, taskName)
        if (!onExecute) {
            throw new Error("must provide a ", onExecute)
        }
        this.onExecute = onExecute;
    }
    kill(): boolean {
        if (this.onKillCmd) {
            this.onKillCmd()
        }
        return true;
    }
    async execute(pipeWorkInstance: PipeLane, inputs: any): Promise<any[]> {
        var that = this;
        return this.onExecute(pipeWorkInstance, inputs, (onKill) => {
            that.onKillCmd = onKill
        })
    }
    async getLoad() {
        return 0
    }

}