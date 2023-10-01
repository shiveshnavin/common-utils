
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