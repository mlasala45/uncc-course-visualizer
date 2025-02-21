import * as d3 from "d3";
import './App.css';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { RenderTangledTreeChart } from "./TangledTree";
import { constructTangleLayout, TangledTreeVisualization } from "./TangledTreeNovel";
import HelpTwoToneIcon from '@mui/icons-material/HelpTwoTone';
import CatalogDownloader from "./catalog-downloader/CatalogDownloader";
import { CATALOG_ID_GRADUATE_2024_TO_2025, CATALOG_ID_UNDERGRAD_2024_TO_2025 } from "./catalog-downloader/constants";
import { CourseDataEntry, CourseId } from "./catalog-downloader/types";

import DrawerList from './components/DrawerList'
import Drawer from '@mui/material/Drawer';
import { Dialog, DialogActions, DialogContent, DialogTitle, Button, Box, styled, Divider, Stack } from '@mui/material';
import { IconButton, TextField, Typography } from '@mui/material';

import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';

export const catalogDownloader = new CatalogDownloader()

function App() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [graphData, setGraphData] = useState([])
  const [helpDialogOpen, setHelpDialogOpen] = useState(false);
  const rawCourseDataRef: React.MutableRefObject<Map<CourseId, CourseDataEntry> | undefined> = useRef()

  function handleDrawerClose() {
    setDrawerOpen(false);
  }

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Tab') {
        console.log("handleKeyDown", event.key, drawerOpen)
        setDrawerOpen(value => !value);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  function generateGraphData(rawCourseData: Map<CourseId, CourseDataEntry>) {
    const depthByCoid = {}
    const allKeys = [...rawCourseData.keys()]

    let numColumnsTotal = 0
    const firstColumnIndexByFamily = {}

    const allKeysByFamily = {}
    allKeys.forEach(coid => {
      const name = rawCourseData.get(coid)!.name
      const familyIndex = parseInt(name.charAt(5)) || 0
      if (!allKeysByFamily[familyIndex]) allKeysByFamily[familyIndex] = []
      allKeysByFamily[familyIndex].push(coid)
    })

    const depthByCoidByFamily = {}
    const num_families = 8
    for (let i = 0; i <= num_families; i++) {
      const depthByCoid = {}

      const numIters = 20
      let maxDepthEncountered = 0
      //console.log('family',i)
      for (let j = 0; j < numIters; j++) {
        allKeysByFamily[i]?.forEach(coid => {
          let depth = 0
          rawCourseData.get(coid)!.links.forEach(linkedId => {
            if (!allKeysByFamily[i]?.includes(linkedId)) return;
            if (linkedId == coid) return;
            if (depthByCoid[linkedId]) {
              depth = Math.max(depth, depthByCoid[linkedId] + 1)
            }
            else {
              depth = Math.max(depth, 1)
            }
          })
          depthByCoid[coid] = depth
          //console.log("iter", j, "name", rawCourseData[coid].name.slice(0, 9), "depth", depth, "prevMaxDepth", maxDepthEncountered)
          maxDepthEncountered = Math.max(maxDepthEncountered, depth)
        })
      }
      depthByCoidByFamily[i] = depthByCoid
      //console.log("family", i, "maxDepthEncountered", maxDepthEncountered)
      firstColumnIndexByFamily[i] = numColumnsTotal
      numColumnsTotal += maxDepthEncountered + 1
    }

    const graphDataLocal: any = []
    for (let i = 0; i <= numColumnsTotal; i++) graphDataLocal.push([])

    for (const data of rawCourseData.values()) {
      const parents: any = []
      data.links.forEach(linkedCoid => {
        if (linkedCoid == data.courseId) return;

        const linkedDetails = rawCourseData.get(linkedCoid)
        if (linkedDetails) parents.push(linkedDetails.name)
      })
      const graphDataEntry = {
        id: data.name,
        parents
      }
      const familyIndex = parseInt(data.name.charAt(5)) || 0
      const depth = depthByCoidByFamily[familyIndex] ? depthByCoidByFamily[familyIndex][data.courseId] : 0
      const columnIndex = firstColumnIndexByFamily[familyIndex] + depth
      graphDataLocal[columnIndex].push(graphDataEntry)
    }

    console.log("Done generating graph input data!")
    setGraphData(graphDataLocal)
  }

  async function loadJsonFromUrl(url: string) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        rawCourseDataRef.current = data
        //generateGraphData(data)
      }
    } catch (error) {
      console.error(error)
    }
  }

  useEffect(() => {
    //loadJsonFromUrl('data/courses_compsci.json')

    Promise.all([
      //catalogDownloader.downloadDetailsForAllCoursesWithPrefix("ITCS", CATALOG_ID_UNDERGRAD_2024_TO_2025),
      //catalogDownloader.downloadDetailsForAllCoursesWithPrefix("ITSC", CATALOG_ID_UNDERGRAD_2024_TO_2025),
      //catalogDownloader.downloadDetailsForAllCoursesWithPrefix("ITIS", CATALOG_ID_UNDERGRAD_2024_TO_2025),
      //catalogDownloader.downloadDetailsForAllCoursesWithPrefix("ITCS", CATALOG_ID_GRADUATE_2024_TO_2025),
      //catalogDownloader.downloadDetailsForAllCoursesWithPrefix("ITSC", CATALOG_ID_GRADUATE_2024_TO_2025),
      //catalogDownloader.downloadDetailsForAllCoursesWithPrefix("ITIS", CATALOG_ID_GRADUATE_2024_TO_2025),
    ]).then(() => {
    }).catch((reason) => {
      console.error(reason)
    })
  }, [])

  function onClick_help() {
    setHelpDialogOpen(true)
  }

  function handleClose_helpDialog() {
    setHelpDialogOpen(false)
  }

  const regenerateGraph = useCallback((dataByCourseId: Map<string, CourseDataEntry>) => {
    rawCourseDataRef.current = dataByCourseId
    if (dataByCourseId.size > 0) {
      generateGraphData(dataByCourseId)
    }
    else {
      setGraphData([])
    }
  }, [])

  return (
    <div className="App">
      <header className="App-header" onClick={() => { }}>
        {graphData.length > 0 && <TangledTreeVisualization graphData={graphData} rawCourseData={rawCourseDataRef.current} />}
        <Stack direction='row' gap={2} alignItems='center' style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
        }}>
          <IconButton size='small' style={{
            border: 'none',
            background: '#ffffffff',
            cursor: 'pointer',
            borderStyle: 'solid',
            borderColor: 'black',
            borderWidth: 1,
            padding: 0
          }}
            onClick={onClick_help}>
            <HelpTwoToneIcon color="info" sx={{
              fontSize: 40,
            }} />
          </IconButton>
          <Typography color='black' style={{
            textShadow: '0 0 4px WHITE'
          }}>
            <b>Press [TAB] to open controls.</b>
          </Typography>
        </Stack>
      </header>
      <Dialog open={helpDialogOpen} onClose={handleClose_helpDialog}>
        <DialogTitle>Need Help?</DialogTitle>
        <DialogContent>
          <p>You can use the toolbar in the top right corner to pan and zoom around the graph.</p>
          <p>The 'M' key will toggle the Move/Pan Tool. It can also be cancelled with 'Escape'.</p>
          <p>Press 'R' to reset your view to the whole graph.</p>
          <p>You can mouse over a course to highlight its prerequisites and descendants. Click the course to lock the selection until you click again.</p>
          <p>Clicks are ignored while using the Move/Pan Tool.</p>
          <p>ℹ️ You can Control+Click on a node to open its catalog entry.</p>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose_helpDialog} color="primary">
            Close
          </Button>
        </DialogActions>
      </Dialog>
      <Drawer open={drawerOpen} variant="persistent" onClose={handleDrawerClose}>
        <DrawerList handleDrawerClose={handleDrawerClose} regenerateGraph={regenerateGraph} />
      </Drawer>
    </div>
  );
}

const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(0, 1),
  // necessary for content to be below app bar
  ...theme.mixins.toolbar,
  justifyContent: 'space-between',
}));

export default App;
