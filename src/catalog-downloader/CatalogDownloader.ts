import ArrayDictionary from "../util/ArrayDictionary";
import { CatalogId, CourseDataEntry, CourseId, CourseListing, CourseRecordsKey } from "./types"
import axios from 'axios';

function extractCourseDataFromHTML(courseId: CourseId, catalogId: CatalogId, htmlData: string): CourseDataEntry | undefined {
    const dataOut: CourseDataEntry = {
        courseId,
        catalogId,
        name: "",
        links: [],
        description: "",
        attributes: {}
    }

    try {
        const regex = /<h3>(.*?)<\/h3>.*?<hr>(.*?)<br><br>(.*)<\/div>/s
        const match = htmlData.match(regex)
        if (match) {
            dataOut.name = match[1]
            const descriptionHtml = match[2]
            const attributesHtml = match[3]

            dataOut.description = descriptionHtml

            const regex = /<strong>(.*?):<\/strong>(.*?)<br>/gs
            let attributeMatch;
            while ((attributeMatch = regex.exec(attributesHtml)) !== null) {
                const attributeName = attributeMatch[1];
                const attributeContent = attributeMatch[2].trim();

                const isAttrPrereqs = [
                    'Pre- or Corequisite(s)',
                    'Prerequisite(s)'
                ].includes(attributeName)
                if (isAttrPrereqs) {
                    const attributeContentStripped = attributeContent.replace(/<.*?>/sg, '').replaceAll('&#160;', ' ').trim()
                    dataOut.attributes[attributeName] = attributeContentStripped;

                    const regex = /coid=([0-9]*)\"/g
                    let match
                    while ((match = regex.exec(attributeContent)) !== null) {
                        const coid = match[1]
                        dataOut.links.push(coid)
                    }
                }
                else {
                    dataOut.attributes[attributeName] = attributeContent;
                }
            }

            return dataOut
        }
        else {
            throw Error()
        }
    }
    catch (err) {
        console.error("Failed to extract course data from server response.")
        return undefined
    }
}

function extractCourseListingsFromHTML(htmlData: string, catalogId: CatalogId, courseListingsArr: Set<CourseListing>) {
    const regex = /<!-- Course results -->(.*?)<\/table>/s;
    const match = htmlData.match(regex);

    if (match) {
        const courseResultsHtml = match[1];
        const anchorRegex = /coid=([^\"]*)\"[^>]*>([\s\S]*?)<\/a>/gs

        let anchorMatch;
        while ((anchorMatch = anchorRegex.exec(courseResultsHtml)) !== null) {
            const coid = anchorMatch[1];
            const name = anchorMatch[2].replace(/[\n\r]+/g, '').trim();

            // Create an object for each match and push it to the list
            courseListingsArr.add({
                courseId: coid,
                catalogId,
                name
            });
        }
    }
    else {
        //Invalid HTML!
    }
}

function extractPageCountFromCourseListingsHTML(htmlData) {
    const regex = /Page:.*>([0-9]*)<\/a>.*<\/nav>/s
    const match = htmlData.match(regex);
    if (match) {
        return parseInt(match[1])
    }
    else {
        //No page numbers, means there's only a single page
        return 1
    }
}

interface CatalogRecordSection {
    recordKey: CourseRecordsKey,
    detailsByCourseId: Map<CourseId, CourseDataEntry>
}

export interface QueryDownloadProgress {
    numPagesDownloaded: number
    numPagesDetected: number
    startedDetailsDownload: boolean
    numDetailsDownloaded: number
    numCoursesDetected: number
    error: boolean
}

export function equals_QueryDownloadProcess(a: QueryDownloadProgress, b: QueryDownloadProgress) {
    return a.numDetailsDownloaded == b.numDetailsDownloaded &&
        a.numPagesDetected == b.numPagesDetected &&
        a.numPagesDownloaded == b.numPagesDownloaded &&
        a.startedDetailsDownload == b.startedDetailsDownload
}

class CatalogDownloader {
    dataByRecordKey: ArrayDictionary<CourseRecordsKey, CatalogRecordSection>
    downloadProgress: QueryDownloadProgress
    downloadEventCallback: () => void

    targetURL: string

    constructor() {
        this.dataByRecordKey = new ArrayDictionary<CourseRecordsKey, CatalogRecordSection>({
            keyGetter: item => item.recordKey,
            keyEquals: (k0, k1) => k0.catalogId == k1.catalogId && k0.prefix == k1.prefix
        })
        this.resetDownloadProgress()

        this.targetURL = "https://catalog.charlotte.edu"
    }

    resetDownloadProgress() {
        this.downloadProgress = {
            numDetailsDownloaded: 0,
            numPagesDetected: 0,
            numPagesDownloaded: 0,
            startedDetailsDownload: false,
            numCoursesDetected: 0,
            error: false
        }
    }

    #onDownloadProgressEvent() {
        if (this.downloadEventCallback) this.downloadEventCallback()
    }

    #generateCourseListingRequestUrl({ searchKeyword, page = 1, catalogId }: {
        searchKeyword: string,
        page?: number,
        catalogId: CatalogId
    }) {
        const database = 'Search'
        let url = `${this.targetURL}/search_advanced.php?cur_cat_oid=${catalogId}&search_database=${database}&search_db=${database}&location=33&sorting_type=1`
        url += `&ecpage=${page}`
        url += `&filter%5Bkeyword%5D=${searchKeyword}` //filter[keyword] = ...
        return url
    }
    
    #generateCourseDataRequestUrl({ courseId, catalogId }: {
        courseId: CourseId,
        catalogId: CatalogId
    }) {
        const url = `${this.targetURL}/ajax/preview_course.php?catoid=${catalogId}&coid=${courseId}&show`
        return url
    }

    downloadCoursesByCOID(courseIds: CourseId[], catalogId: CatalogId) {
        courseIds.forEach(coid => {
            this.downloadCourseDetails({
                courseId: coid,
                catalogId
            })
        })
    }

    async queryListingsForPrefix(coursePrefix: string, catalogId: CatalogId) {
        //Do not reset progress, as we may have multiple downloads running concurrently

        const matches = new Set<CourseListing>()
        let page = 1
        const url = this.#generateCourseListingRequestUrl({
            searchKeyword: coursePrefix,
            page,
            catalogId
        })
        const { data } = await axios.get(url);

        extractCourseListingsFromHTML(data, catalogId, matches)

        this.downloadProgress.numPagesDownloaded++
        this.#onDownloadProgressEvent()

        let pageCount = extractPageCountFromCourseListingsHTML(data)
        //There's no way to get an error page count right now, but in case we need one, here's a handler
        if (pageCount == -1) {
            console.error(`Failed to extract page count from server response. coursePrefix=${coursePrefix}, catalogId=${catalogId}`)
            console.error(`Query URL: ${url}`)
            pageCount = 1
        }

        this.downloadProgress.numPagesDetected += pageCount
        this.#onDownloadProgressEvent()

        if (pageCount > 1) {
            for (page = 2; page <= pageCount; page++) {
                const url = this.#generateCourseListingRequestUrl({
                    searchKeyword: coursePrefix,
                    page,
                    catalogId
                })
                const { data } = await axios.get(url);
                extractCourseListingsFromHTML(data, catalogId, matches)

                this.downloadProgress.numPagesDownloaded++
                this.#onDownloadProgressEvent()
            }
        }
        this.downloadProgress.numCoursesDetected += matches.size
        this.#onDownloadProgressEvent()

        return matches
    }

    async downloadDetailsForAllCoursesWithPrefix(coursePrefix: string, catalogId: CatalogId) {
        const listings = await this.queryListingsForPrefix(coursePrefix, catalogId)

        this.downloadProgress.startedDetailsDownload = true
        const detailPromises: Promise<CourseDataEntry | undefined>[] = []
        listings?.forEach(data => {
            if (data.courseId == '' || data.courseId == undefined) {
                console.error(`Listing for undefined course ID! catalogId=${data.catalogId}, courseName=${data.name}`)
                this.downloadProgress.numCoursesDetected--
                this.#onDownloadProgressEvent()
            }
            else {
                const promise = this.downloadCourseDetails({
                    courseId: data.courseId,
                    catalogId: data.catalogId
                })
                detailPromises.push(promise)
            }
        })

        await Promise.all(detailPromises)
    }

    async downloadCourseDetails({ courseId, catalogId }: {
        courseId: CourseId, catalogId: CatalogId
    }) {
        const url = this.#generateCourseDataRequestUrl({
            courseId,
            catalogId
        })
        const { data } = await axios.get(url);
        const details = extractCourseDataFromHTML(courseId, catalogId, data)
        if (details) this.#recordCourseDetails(catalogId, details)

        this.downloadProgress.numDetailsDownloaded++
        this.#onDownloadProgressEvent()

        return details
    }

    #recordCourseDetails(catalogId: CatalogId, details: CourseDataEntry) {
        const prefix = details.name.slice(0, 4)
        const recordKey: CourseRecordsKey = {
            catalogId,
            prefix
        }
        if (this.dataByRecordKey.containsKey(recordKey)) {
            this.dataByRecordKey.get(recordKey)?.detailsByCourseId.set(details.courseId, details)
        }
        else {
            const map = new Map<CourseId, CourseDataEntry>()
            map.set(details.courseId, details)
            this.dataByRecordKey.set({
                recordKey,
                detailsByCourseId: map
            })
        }
    }
}

export default CatalogDownloader