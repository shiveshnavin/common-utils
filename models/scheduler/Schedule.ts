import { GenerationConfig } from "../media/GenerationConfig"

export interface Schedule {
    id: string
    nextTimeStamp: number
    status: "SCHEDULED" | "FAILED" | "IN_REVIEW" | "COMPLETED"
    subType: string
    type: string
    payload?:
    InstagramRenderSchedulePayload |
    YoutubeRenderSchedulePayload |
    LinkedinSchedulePayload

}

export interface SchedulePayload {
    platform: 'linkedin' | 'youtube' | 'instagram'
}

export interface LinkedinSchedulePayload extends SchedulePayload {
    genConfig?: GenerationConfig
    topicName?: string
}

export interface InstagramRenderSchedulePayload extends SchedulePayload {
    genConfig?: GenerationConfig
}

export interface YoutubeRenderSchedulePayload extends SchedulePayload {
    url?: string,
    timeStamp?: string,
    waid?: string,
    from?: string,
    source?: string,
    genConfig?: GenerationConfig
}