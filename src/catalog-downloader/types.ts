export type CourseId = string
export type CatalogId = number

export type CourseRecordsKey = {
    catalogId: CatalogId,
    prefix: string
}

export type CourseListing = {
    courseId: CourseId,
    catalogId: CatalogId,
    name: string
}

export interface CourseDataEntry {
    courseId: CourseId,
    catalogId: CatalogId,
    name: string,
    description: string,
    attributes: Record<string, string | string[]>,
    links: CourseId[]
}