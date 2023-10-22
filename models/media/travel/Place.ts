import { SectionMedia } from "../OriginalManuscriptModel"

export interface Place {
    coordinates: { lat: number, lon: number }
    images: SectionMedia
    name: string
    id: string
    description?: string
    address: { country: string, city: string, fullAddress: string }
    attractions: string[]
}