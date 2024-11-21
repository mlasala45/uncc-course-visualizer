import * as d3 from "d3";
import './App.css';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { RenderTangledTreeChart } from "./TangledTree";
import { constructTangleLayout, tangledTreeVisualization } from "./TangledTreeNovel";
import { ReactSVGPanZoom, TOOL_NONE, fitSelection, zoomOnViewerCenter, fitToViewer, Tool, Value } from 'react-svg-pan-zoom';

function App() {
  const [graphData, setGraphData] = useState([])
  const Viewer: React.Ref<any> = useRef(null);

  function generateGraphData(rawCourseData: any) {
    const depthByCoid = {}
    const allKeys = Object.keys(rawCourseData)

    let numColumnsTotal = 0
    const firstColumnIndexByFamily = {}

    const allKeysByFamily = {}
    allKeys.forEach(coid => {
      const name = rawCourseData[coid].name
      const familyIndex = parseInt(name.charAt(5)) || 0
      if (!allKeysByFamily[familyIndex]) allKeysByFamily[familyIndex] = []
      allKeysByFamily[familyIndex].push(coid)
    })

    const depthByCoidByFamily = {}
    const num_families = 4
    for (let i = 1; i <= num_families; i++) {
      const depthByCoid = {}

      const numIters = 20
      let maxDepthEncountered = 0
      //console.log('family',i)
      for (let j = 0; j < numIters; j++) {
        allKeysByFamily[i].forEach(coid => {
          let depth = 0
          rawCourseData[coid].links.forEach(linkedId => {
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

    Object.values(rawCourseData).forEach((data: any) => {
      const parents: any = []
      data.links.forEach(linkedCoid => {
        if (linkedCoid == data.courseId) return;
        if (rawCourseData[linkedCoid]) parents.push(rawCourseData[linkedCoid].name)
      })
      const graphDataEntry = {
        id: data.name,
        parents
      }
      const familyIndex = parseInt(data.name.charAt(5)) || 0
      const depth = depthByCoidByFamily[familyIndex] ? depthByCoidByFamily[familyIndex][data.courseId] : 0
      const columnIndex = firstColumnIndexByFamily[familyIndex] + depth
      graphDataLocal[columnIndex].push(graphDataEntry)
    })

    setGraphData(graphDataLocal)
  }

  async function loadJsonFromUrl(url: string) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        generateGraphData(data)
      }
    } catch (error) {
      console.error(error)
    }
  }

  useEffect(() => {
    loadJsonFromUrl('data/courses_compsci.json')
  }, [])

  useEffect(() => {
    Viewer.current?.fitToViewer();
  }, []);

  const [tool, setTool] = useState(TOOL_NONE as Tool)
  const [value, setValue] = useState({} as Value)

  const memoizedVisualization = useMemo(() => {
    return tangledTreeVisualization(graphData);
  }, [graphData]);

  return (
    <div className="App">
      <header className="App-header">
        {graphData.length > 0 && <ReactSVGPanZoom
          ref={Viewer}
          width={window.innerWidth} height={window.innerHeight}
          tool={tool} onChangeTool={setTool}
          value={value} onChangeValue={setValue}
          onZoom={e => console.log('zoom')}
          onPan={e => console.log('pan')}
          onClick={event => console.log('click', event.x, event.y, event.originalEvent)}
        >
          {memoizedVisualization}
        </ReactSVGPanZoom>
        }
      </header>
    </div>
  );
}

export default App;
