import { GenerationConfig } from "./GenerationConfig";

export interface OriginalManuscript {
    id: string;
    bgMusic: string
    bgMusicDuration: number
    status: boolean
    transcriptText: string
    transcript: Transcript[]
    wordCount: number
    outputFile: string
    meta: Meta
}

export interface SectionMedia {
    path: string
    durationSec?: number
    type: 'image' | 'video'
}

export interface Transcript {
    title: string
    text: string
    pointers: string[]
    subtitle_file: string
    imageText: string[]
    videoText: string[]
    dialog: string[]
    imageAbsPathsOriginal: SectionMedia[]
    index: number
    transition_type: 'graphical' | 'geometrial'
    transition_file: string
    transition_duration_sec: number
    status: boolean
    imageAbsPaths: SectionMedia[]
    audioFullPath: string
    durationInSeconds: number
    duration: number // duration in frames 
    offset: number // offset in frames
    bubble: {
        image?: string
        text: string
        type: string
    }
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
}

export interface Meta {
    renderComposition: string;
    bundleUrl: string;
    filesRootDir: string
    posterTitle: string
    videoTitleOverride: string
    summary: string
    tags: string
    title: string
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
    callback_url?: string
    publish_config: {
        platform: string
        playlistId: string
        userId: string
    }
    schedule: {
        id: string
        payload: any
    }
    render?: {
        output_url: string,
        status: string,
        id: string
    }
}

export interface Speaker {
    wps: number
}

export interface TenantVideoConfig {
    introFile: string
    outroFile: string
}
