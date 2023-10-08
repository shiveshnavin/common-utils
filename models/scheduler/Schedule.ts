import { GenerationConfig } from "../media/GenerationConfig"

export interface Schedule {
    id: string
    nextTimeStamp: number
    status: "SCHEDULED" | "FAILED" | "IN_REVIEW" | "COMPLETED"
    subType: string
    type: string
    payload?: InstagramRenderSchedulePayload | YoutubeRenderSchedulePayload
}

export interface InstagramRenderSchedulePayload {
    platform: 'instagram'
    genConfig: GenerationConfig
}

export interface YoutubeRenderSchedulePayload {
    platform: 'youtube'
    url?: string,
    timeStamp?: string,
    waid?: string,
    from?: string,
    source?: string,
    genConfig: GenerationConfig
}