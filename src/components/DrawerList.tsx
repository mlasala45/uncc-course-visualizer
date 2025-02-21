import { useState, useEffect, useRef, Fragment } from 'react';
import * as React from 'react'

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { styled, useTheme } from '@mui/material/styles';
import { Checkbox, Stack, TextField } from '@mui/material';
import CircularProgress from '@mui/material/CircularProgress';
import { catalogDownloader } from '../App';
import { CATALOG_ID_GRADUATE_2024_TO_2025, CATALOG_ID_UNDERGRAD_2024_TO_2025 } from '../catalog-downloader/constants';
import { CatalogId, CourseDataEntry, CourseId, CourseRecordsKey } from '../catalog-downloader/types';
import UpdateIcon from '@mui/icons-material/Update';
import { equals_QueryDownloadProcess, QueryDownloadProgress } from '../catalog-downloader/CatalogDownloader';
import shadows from '@mui/material/styles/shadows';

const DrawerHeader = styled('div')(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing(0, 1),
    // necessary for content to be below app bar
    ...theme.mixins.toolbar,
    justifyContent: 'space-between',
}));

function isAlpha(charCode: number) {
    return (charCode >= 65 && charCode <= 90) || (charCode >= 97 && charCode <= 122);
}

interface DrawerListProps {
    handleDrawerClose: () => void,
    regenerateGraph: (matchingRecords: Map<CourseId, CourseDataEntry>) => void
}

function DownloadStatusMessages({ downloadProgress }: {
    downloadProgress: QueryDownloadProgress
}) {
    let color = 'green'
    const typography = (message) => <Typography variant='body1' color={color} align='left'>{message}</Typography>

    const lines: React.JSX.Element[] = []
    lines.push(typography(`Downloading listing pages (${downloadProgress.numPagesDownloaded}/${downloadProgress.numPagesDetected == 0 ? '?' : downloadProgress.numPagesDetected})`))
    if (downloadProgress.startedDetailsDownload)
        lines.push(typography(`Downloading course details (${downloadProgress.numDetailsDownloaded}/${downloadProgress.numCoursesDetected})`))

    if(downloadProgress.error) {
        color = 'red'
        lines.push(typography('Encountered error.'))
        lines.push(typography('See your browser\'s developer console for details.'))
        lines.push(typography(`This is usually network related.`))
    }

    return <Box>{lines}</Box>
}

function DrawerList({ handleDrawerClose, regenerateGraph }: DrawerListProps) {
    const theme = useTheme();

    const [prefixStr, setPrefixStr] = useState("ITCS")
    const [changedSinceReload, setChangedSinceReload] = useState(false)
    const [retrieving, setRetrieving] = useState(false)
    const [catalogs, setCatalogs] = useState([] as CatalogId[])
    const [numMatchingRecords, setNumMatchingRecords] = useState(0)

    const [retrievalEventCounter, setRetrievalEventCounter] = useState(0)

    const matchingRecordsRef = useRef(new Map<CourseId, CourseDataEntry>())

    useEffect(() => {
        onRecordsChanged()
    }, [prefixStr, catalogs, retrieving])

    function onRecordsChanged() {
        const prefixes = getPrefixes()

        matchingRecordsRef.current.clear()
        prefixes.forEach(prefix => {
            catalogs.forEach(catalogId => {
                const recordKey: CourseRecordsKey = {
                    prefix,
                    catalogId
                }
                const detailsByCoid = catalogDownloader.dataByRecordKey.get(recordKey)?.detailsByCourseId
                if (detailsByCoid) {
                    detailsByCoid.forEach((details) => {
                        matchingRecordsRef.current.set(details.courseId, details)
                    })
                }
            })
        })

        const numMatches = matchingRecordsRef.current.size
        setNumMatchingRecords(numMatches)
    }

    function getPrefixes() {
        const prefixes = prefixStr.split(',')
        for (const str of prefixes) {
            if (!str || str.length != 4) return []
        }
        const prefixesUnique: string[] = []
        prefixes.forEach(str => {
            if (!prefixesUnique.includes(str)) prefixesUnique.push(str)
        })
        return prefixesUnique
    }

    function startUpdatingRecords() {
        setRetrieving(true)
        setRetrievalEventCounter(0)

        catalogDownloader.resetDownloadProgress()
        catalogDownloader.downloadEventCallback = () => setRetrievalEventCounter(v => v + 1)

        const prefixes = getPrefixes()

        const promises: Promise<void>[] = []
        prefixes.forEach(prefix => {
            catalogs.forEach(catalogId => {
                promises.push(catalogDownloader.downloadDetailsForAllCoursesWithPrefix(prefix, catalogId))
            })
        })
        Promise.all(promises).then(() => {
            stopUpdatingRecords()
            onRecordsChanged()
            setChangedSinceReload(false)
            regenerateGraph(matchingRecordsRef.current)
        }).catch((reason) => {
            console.error(reason)
            catalogDownloader.downloadProgress.error = true
            catalogDownloader.downloadEventCallback()
            stopUpdatingRecords()
        })
    }

    function stopUpdatingRecords() {
        setRetrieving(false)
    }

    function CatalogCheckBox(name: string, catalogId: number) {
        return (
            <Stack direction='row' gap={2} alignItems='center' justifyContent='space-between' width={250} height={30}>
                <Typography variant='body1'>
                    {name}
                </Typography>
                <Checkbox value={catalogs.includes(catalogId)} onChange={(event) => {
                    setChangedSinceReload(true)
                    if (event.target.checked) {
                        setCatalogs(list => {
                            if (list.includes(catalogId)) return list
                            return [...list, catalogId]
                        })
                    }
                    else {
                        setCatalogs(list => {
                            return list.filter(v => v != catalogId)
                        })
                    }
                }} />
            </Stack>
        )
    }

    function handlePrefixStrChange(newVal: string, prevVal: string) {
        const containsInvalidChars = /[^a-zA-Z,]/.test(newVal);
        if (containsInvalidChars) return

        setChangedSinceReload(true)
        setPrefixStr(newVal.toUpperCase())
    }

    let invalidInputStr = getPrefixes().length == 0

    const DownloadStatusMessages_Memoized = React.memo(DownloadStatusMessages, (a, b) => equals_QueryDownloadProcess(a.downloadProgress, b.downloadProgress))

    function onClick_reloadGraph() {
        setChangedSinceReload(false)
        regenerateGraph(matchingRecordsRef.current)
    }

    return (
        <Box sx={{ width: 400 }} role="presentation">
            <DrawerHeader>
                <b style={{ position: "relative", left: "10px" }}>(Press [TAB] to close)</b>
                <IconButton onClick={handleDrawerClose}>
                    <ChevronLeftIcon />
                </IconButton>
            </DrawerHeader>
            <Divider style={{ marginBottom: 25 }} />
            <Box style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', margin: 20, gap: 10 }}>

                <Stack direction='row' gap={2} alignItems='center'>
                    <TextField value={prefixStr} label="Course Prefix" onChange={(event) => handlePrefixStrChange(event.target.value, prefixStr)} />
                    <IconButton
                        size='small'
                        style={{ margin: 0, color: 'black' }}
                        onClick={onClick_reloadGraph}
                    ><UpdateIcon /></IconButton>
                </Stack>
                {invalidInputStr
                    ? <Typography variant='body1' color='red' align='left'>
                        Invalid input. Requires four letter prefix codes, separated by commas.<br />Eg. ITSC,ECGR,ITIS
                    </Typography>
                    : changedSinceReload &&
                    <Typography variant='body1' color='orange' align='left' style={{ textShadow: '0px 0px 1px YELLOW' }}>
                        ⚠️ Click button to reload graph.
                    </Typography>}
                <Box display='flex' flexDirection='column' alignItems={'flex-start'}>
                    <b>Catalogs</b>
                    {CatalogCheckBox("2024-2025 Undergraduate", CATALOG_ID_UNDERGRAD_2024_TO_2025)}
                    {CatalogCheckBox("2024-2025 Graduate", CATALOG_ID_GRADUATE_2024_TO_2025)}
                </Box>
                <Typography variant='body1' color={numMatchingRecords == 0 ? 'red' : 'green'} align='left'>
                    {numMatchingRecords == 0 ?
                        catalogs.length == 0 ? "Please select at least one catalog." : "No downloaded records." :
                        <Fragment>{numMatchingRecords} matching records.<br />Did you download since changing your query?</Fragment>}
                </Typography>
                <Stack direction='row' gap={2} alignItems='center'>
                    <Button variant='contained' disabled={retrieving} onClick={startUpdatingRecords}>Retrieve New Information</Button>
                    {retrieving && <CircularProgress size={25} />}
                </Stack>
                {retrieving && <Button variant='contained' onClick={stopUpdatingRecords}>Cancel</Button>}
                {(retrieving || catalogDownloader.downloadProgress.error) && <DownloadStatusMessages_Memoized downloadProgress={catalogDownloader.downloadProgress} />}
            </Box>
        </Box >
    )
};

export default DrawerList;