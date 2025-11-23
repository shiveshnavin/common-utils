//@ts-nocheck
import { GenerationConfig } from "./GenerationConfig";

export interface OriginalManuscript {
    id: string;
    bgMusic: string
    bgMusicVolume: number // 0 to 1
    bgMusicDuration: number
    hook: {
        durationSec: number
        file: string
    }
    status: boolean
    transcriptText: string
    transcript: Transcript[]
    wordCount: number
    outputFile: string
    meta: Meta
}


export class Transcript {
    title: string
    text: string
    pointers: string[]
    imageText: string[] // deprecated
    imageTexts: string[] // deprecated in favor of mediaTextPrompts
    mediaTextPrompts: MediaTextPrompt[]
    videoText: string[]
    dialog: string[]
    index: number
    transition_type: 'graphical' | 'geometrial' | 'none' // comma separated
    transition_file: string
    transition_duration_sec: number
    status: boolean

    mediaAbsPaths: SectionMedia[]
    audioFullPath: string
    audioCaptionFile: string
    audioStartOffsetSec: number
    audioCaption: Group | undefined
    durationInSeconds: number
    duration: number // duration in frames 
    offset: number // offset in frames
    extras: Extra
    bubble: {
        imageAbsPath?: string
        text?: string
        pointers?: string[]
        graph?: {
            nodes: { label: string, icon: string }[],
            edges: { source: string, target: string, label: string }[],
        }
        type?: 'text' | 'slide_up' | 'graph' | 'pointers'
    }
}


export interface MediaTextPrompt {
    prompt: string
    type: 'image' | 'video'
    fromSec?: number
    toSec?: number
    durationSec?: number
}

export interface Speaker {
    wps: number
}

export interface TenantVideoConfig {
    introFile: string
    outroFile: string
}

export interface SectionMedia {
    path: string
    durationSec?: number
    type: 'image' | 'video'
    dimensions?: { width: number, height: number }

}

export type Plugin = {
    name: string
} & any

export interface Meta {
    renderComposition: string;
    bundleUrl: string;
    filesRootDir: string
    title: string
    posterTitle: string
    videoTitleOverride: string
    summary: string
    plugins?: Plugin[]
    tags: string
    posterImage: string
    countLeft: number
    amazonAffiliateLink: string
    platlistName: string
    platlistId: string
    userId: string
    sourceVariantName: string
    emphasisOnImage: boolean
    speaker: Speaker
    script_mode: string
    fps: number
    tmpFiles: string[]
    lastGenConfigFile: string
    generationConfig: GenerationConfig
    tenantVideoConfig: TenantVideoConfig
    manuscriptFile: string
    thumbnailFile: string
    callback_url?: string // Not to be confused with GenerationConfig's publish webhook url, This is only used to tell media-core that render is finished. Its upto  media-core to call publish webhook or not
    publish_config: {
        platform: string
        playlistId: string
        userId: string
        bgMusicMetadata?: { // StockMedia
            id?: string
            durationSec?: number
            meta?: any
            url?: string
            platform?: string
            source?: "url" | "local"
            theme?: string
        }
    }
    schedule: {
        id: string
        payload: any
    }
    render?: {
        output_url: string,
        status: string,
        id: string,
        files?: SectionMedia[]
    }
    resolution: {
        width: number
        height: number
    }
}


export interface BgMusicInfo {
    id: string
    theme: string
    platform: string
    source: 'local' | 'url'
    durationSec: number
    file: string
    url: string
    meta: string // json string
}

export interface Speaker {
    wps: number
}

export interface TenantVideoConfig {
    introFile: string
    outroFile: string
}


export interface Word {
    phenomes: Array<any>
    start: number // start time of word (relative to group) in seconds
    end: number // end time word (relative to group) in seconds
    startOffset: number // position of the first character of the word in the transcript (in group)
    endOffset: number // position of the last character of the word in the transcript (in group)
    idx: number
    sentence_end: boolean
    case: "success" | "failure"
    alignedWord: string
    word: string
    textStyle: any & {
        color: string
        fontSize: string
    }
}


export interface Group {
    transcript: string
    words: Word[]
    start: Number
    end: Number
}

// Extras
export interface Extra extends any {
    template: string
    | "motivational-2-liner" //(instagram) 
    | "index"  //(paperdrive) 
    | "page"  //(paperdrive)
    | "poster-single-text-with-bg" //(poster single text with bg)
    | "tweet" //(tweet)
}

export interface IGReelExtra extends Extra {
    fontSize: string
    animation: 'zoom' | 'none'
}

export interface TweetExtra extends Extra {
    textBgColor?: string
}

export interface PosterSingleTextWithBGExtra extends Extra {
    textColor?: string
    bgImagePath?: string
    textBgColor?: string
    brightColor?: string
    emphasisOnImage?: boolean
}