import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { SingleBar, Presets } from 'cli-progress';

const url = 'https://catalog.charlotte.edu/search_advanced.php?cur_cat_oid=38&search_database=Search&search_db=Search&cpage=1&ecpage=1&ppage=1&spage=1&tpage=1&location=33&filter%5Bkeyword%5D=itsc';

const CATALOG_ID_UNDERGRAD = 38
const CATALOG_ID_GRADUATE = 39
const DEFAULT_CAT_OID = CATALOG_ID_UNDERGRAD

function generateCourseListingRequestUrl({ searchKeyword, page = 1, catalogId = DEFAULT_CAT_OID }: {
    searchKeyword: string,
    page?: number,
    catalogId?: number
}) {
    const database = 'Search'
    let url = `https://catalog.charlotte.edu/search_advanced.php?cur_cat_oid=${catalogId}&search_database=${database}&search_db=${database}&location=33&sorting_type=1`
    url += `&ecpage=${page}`
    url += `&filter%5Bkeyword%5D=${searchKeyword}` //filter[keyword] = ...
    return url
}

function generateCourseDataRequestUrl({ courseId, catalogId }: {
    courseId: string,
    catalogId: number
}) {
    const url = `https://catalog.charlotte.edu/ajax/preview_course.php?catoid=${catalogId}&coid=${courseId}&show`
    return url
}

function extractCourseListingsFromHTML(data: string, courseListingsArr: any[]) {
    const regex = /<!-- Course results -->(.*?)<\/table>/s;
    const match = data.match(regex);

    if (match) {
        const courseResultsHtml = match[1];
        const anchorRegex = /coid=([^\"]*)\"[^>]*>([\s\S]*?)<\/a>/gs

        let anchorMatch;
        while ((anchorMatch = anchorRegex.exec(courseResultsHtml)) !== null) {
            const coid = anchorMatch[1];
            const name = anchorMatch[2].replace(/[\n\r]+/g, '').trim();

            // Create an object for each match and push it to the list
            courseListingsArr.push({ coid, name });
        }
    }
    else {
        console.log("No match!")
    }
}

function extractPageCountFromCourseListingsHTML(data) {
    const regex = /Page:.*>([0-9]*)<\/a>.*<\/nav>/s
    const match = data.match(regex);
    if (match) {
        return parseInt(match[1])
    }
    else {
        console.error("Failed to extract page count from server response.")
        return 1
    }
}

interface CourseDataEntry {
    courseId: string,
    name: string,
    description: string,
    attributes: Record<string, string | string[]>,
    links: string[]
}

function extractCourseDataFromHTML(courseId: string, courseName: string, data: string): CourseDataEntry {
    const dataOut = {
        courseId,
        name: courseName,
        links: []
    } as CourseDataEntry

    try {
        const regex = /<\/h3>.*?<hr>(.*)<br><br>(.*)<\/div>/s
        const match = data.match(regex)
        if (match) {
            const descriptionHtml = match[1]
            const attributesHtml = match[2]

            dataOut.description = descriptionHtml
            dataOut.attributes = {}

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

async function retrieveCourseData({ courseId, catalogId, courseName }: {
    courseId: string, catalogId: number, courseName: string
}) {
    const url = generateCourseDataRequestUrl({
        courseId,
        catalogId
    })
    //console.log("Retrieving Course Data:", url)
    const { data } = await axios.get(url);
    return extractCourseDataFromHTML(courseId, courseName, data)
}

let courseCodePrefix
if (process.argv.length > 2) {
    courseCodePrefix = process.argv[2]
}
else {
    console.log("\x1b[31mMissing required argument: <course-code-prefix>\x1b[0m")
    process.exit(1)
}

const mainThreadAsync = async () => {
    try {
        console.log(`Retrieving course listings for '${courseCodePrefix}' from Catalog ID ${CATALOG_ID_UNDERGRAD}`)

        const courseListings: { coid: string, name: string }[] = []
        let page = 1

        console.log(`Fetching Page ${page}`)
        const url = generateCourseListingRequestUrl({
            searchKeyword: courseCodePrefix,
            page,
            catalogId: CATALOG_ID_UNDERGRAD
        })
        console.log(url)
        const { data } = await axios.get(url);
        extractCourseListingsFromHTML(data, courseListings)

        const pageCount = extractPageCountFromCourseListingsHTML(data)
        console.log(`Detected page count: ${pageCount}`)
        if (pageCount > 1) {
            for (page = 2; page <= pageCount; page++) {
                console.log(`Fetching Page ${page}`)
                const url = generateCourseListingRequestUrl({
                    searchKeyword: courseCodePrefix,
                    page,
                    catalogId: CATALOG_ID_UNDERGRAD
                })
                const { data } = await axios.get(url);
                extractCourseListingsFromHTML(data, courseListings)
            }
        }

        console.log(`Found ${courseListings.length} courses:`)
        courseListings.forEach(data => console.log(data.name))

        console.log()
        console.log(`Downloading all courses catalog data`)
        const progressBar = new SingleBar({
            format: '{bar} {percentage}% | {value}/{total}',
            barCompleteChar: '\u2588',
            barIncompleteChar: '\u2591',
            hideCursor: true,
        }, Presets.shades_classic);

        progressBar.start(courseListings.length, 0);

        const courseDataByCoid = {}
        let promisesComplete = 0
        await Promise.all(
            courseListings.map(listingData => {
                return retrieveCourseData({
                    courseId: listingData.coid,
                    courseName: listingData.name,
                    catalogId: DEFAULT_CAT_OID
                }).then(courseData => {
                    progressBar.update(promisesComplete++);
                    courseDataByCoid[listingData.coid] = courseData
                })
            })
        )

        progressBar.update(courseListings.length);
        progressBar.stop();
        console.log(`Downloaded data for ${Object.keys(courseDataByCoid).length} courses`)

        const outputDir = 'data_out';
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const filePath = path.join(outputDir, `courses_${courseCodePrefix}.json`);
        fs.writeFileSync(filePath, JSON.stringify(courseDataByCoid), 'utf8');
        console.log(`Saved data to ${filePath}`);
    } catch (error) {
        console.error('Error fetching data:', error);
    }
};

mainThreadAsync();