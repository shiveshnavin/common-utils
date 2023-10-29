import { FlowChart } from "./full-sysdesign/FlowChart"

export interface ChatGPTConfig {
    topic_name: string,
    generate_from_seed: boolean,
    style: string,
    word_count: number,
    words_per_section: number,
    sourceUrl?: string,
    preserveConvo?: boolean,
    extraInstructions?: string
}

export interface ChatGptSectionedResponse {
    section_title: string,
    section_text: string,

    relevant_image_texts?: string[] // used in ig-travel

    // used in linkedin full-sysdesign
    graphic_type?: 'pointers' | 'flowchart'
    pointers?: string[]
    flowchart_icons: any
    flowchart?: FlowChart[]
}
