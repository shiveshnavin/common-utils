import { ChatGPTConfig } from "./ChatGPTConfig";

export interface GenerationConfig {
    default_transition_obj?: any;
    playlistId?: any;
    extras?: {
        schedule?: any
    },
    genId?: string,
    renderComposition?: 'SemibitComposition'
    platform?: 'youtube' | 'instagram' | 'linkedin'
    isDoParaphraseSource?: boolean,
    playlistName?: string,
    disableCache?: boolean,
    sourceVariantName?: 'blog' | 'wikipedia' | 'chat-gpt' | 'youtube' | 'amazon',
    youtubeSourceUrl?: string,
    wikipediaTopicUrl?: string,
    sourceContentUrl?: string,
    blogUrl?: string,
    chatgptConfig?: ChatGPTConfig,
    publisherGoogleUserId?: string,
    bgMusicYoutubeVideoUrl?: string,
    speechVariantName?: string,
    speechVoiceName?: string,
    videoTitleOverride?: string,
    speechEndDelaySec?: number,

    runGeneration?: "1" | "0",
    asyncRender?: "1" | "0",
    isTestMode?: boolean,
    runPublish?: "1" | "0",
    isChatGptTestMode?: boolean
}