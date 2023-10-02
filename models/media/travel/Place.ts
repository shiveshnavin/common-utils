import { SectionMedia } from "../OriginalManuscriptModel"

export interface Place {
    anchorPlace: string
    coordinates: { lat: number, lon: number }
    images: SectionMedia
    name: string
    id: string
    type: string[]
    address: { country: string, city: string, fullAddress: string }
    vicinity: string
}