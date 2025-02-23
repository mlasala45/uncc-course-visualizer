/// Modified source copyright
// Copyright 2022 Takanori Fujiwara.
// Released under the BSD 3-Clause 'New' or 'Revised' License

/// Original source copyright
// Copyright 2022 Matteo Abrate - IIT CNR
// Released under the MIT license.
// > MIT License
// > Permission is hereby granted, free of charge, to any person obtaining a copy
// > of this software and associated documentation files (the "Software"), to deal
// > in the Software without restriction, including without limitation the rights
// > to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// > copies of the Software, and to permit persons to whom the Software is
// > furnished to do so, subject to the following conditions:>
//
// > The above copyright notice and this permission notice shall be included in all
// > copies or substantial portions of the Software.>
//
// > THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// > IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// > FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// > AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// > LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// > OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// > SOFTWARE.

import * as d3 from 'd3'
import * as React from 'react'
import _ from 'lodash'
import { ReactSVGPanZoom, TOOL_NONE, fitSelection, zoomOnViewerCenter, fitToViewer, Tool, Value, TOOL_PAN } from 'react-svg-pan-zoom';

export const constructTangleLayout = (levels, {
  nodeWidth = 70 * 5,
  nodeHeight = 22 + 5,
  padding = 8,
  bundleWidth = 14 * 1,
  levelYPadding = 0,
  metroD = 4,
  minFamilyHeight = 10,
  c = 16,
  bigc = 64//nodeWidth + c
} = {}) => {
  // precompute level depth
  levels.forEach((l, i) => l.forEach(n => (n.level = i)));

  const nodes = levels.reduce((a, x) => a.concat(x), []);
  const nodesIndex = {};
  for (const node of nodes) nodesIndex[node.id] = node;

  // objectification
  for (const node of nodes) {
    node.parents = (node.parents === undefined ? [] : node.parents).map(p => {
      if (nodesIndex[p] == undefined) {
        console.warn(`node.id=${node.id}; nodesIndex[${p}] is undefined`)
      }
      return nodesIndex[p]
    });
  }

  // precompute bundles
  for (const [i, level] of levels.entries()) {
    const index = {};
    //For each node, if it has parents, create a bundle
    level.forEach(childNode => {
      if (childNode.parents.length == 0) {
        return;
      }

      childNode.parents.forEach(parentNode => {
        //The bundle id is made by concatenating all the parent ids
        const bundleId = childNode.id + ' <- ' + parentNode.id
        /*.map(d => {
          if (d == undefined) {
            console.log(`d is undefined; n=${n.id}`)
          }
          return d.id
        })
        .sort()
        .join('-X-');*/
        if (bundleId in index) {
          //If an exact matching bundle id exists, add the nodes parents to the existing bundle parents list
          //TODO: It seems like the node parents should all already be present in the bundle if it already exists and is named after them
          index[bundleId].parents = index[bundleId].parents.concat(childNode.parents);
        } else {
          //Otherwise, create the bundle
          //Span = Distance between currentNodeLevel and min(parent levels)
          //Span is integer; "levels spanned" by visual connections
          index[bundleId] = {
            id: bundleId,
            parents: [parentNode],
            level: i,
            span: i - parentNode.level,
            childNodeId: childNode.id
          };
        }

        if (childNode.incomingBundles === undefined) childNode.incomingBundles = {}
        childNode.incomingBundles[parentNode.id] = index[bundleId];
      })
    });
    level.bundles = Object.keys(index).map(key => index[key]);

    for (const [i, bundle] of level.bundles.entries()) bundle.i = i;
  }

  const links = [];
  for (const node of nodes) {
    for (const parent of node.parents) {
      links.push({
        source: node,
        bundle: node.incomingBundles[parent.id],
        target: parent
      });
    }
  }

  //Concat all bundles from all levels
  const bundles = levels.reduce((a, x) => a.concat(x.bundles), []);

  // reverse pointer from parent to bundles
  // bundlesIndex seems to be a dict of Bundle[], where each array only contains one bundle (if no redundant data)
  for (const bundle of bundles) {
    for (const parent of bundle.parents) {
      if (parent.bundlesIndex === undefined) {
        parent.bundlesIndex = {};
      }
      if (!(bundle.id in parent.bundlesIndex)) {
        parent.bundlesIndex[bundle.id] = [];
      }
      parent.bundlesIndex[bundle.id].push(bundle);
    }
  }

  for (const node of nodes) {
    if (node.bundlesIndex !== undefined) {
      //This appears to just pull the Object.values from node.bundlesIndex
      //TODO: Confirm
      node.bundles = Object.keys(node.bundlesIndex).map(key => node.bundlesIndex[key]);
    } else {
      node.bundlesIndex = {};
      node.bundles = [];
    }
    //Sort bundles in order of descending span
    node.bundles.sort((a, b) => d3.descending(d3.max(a, d => d.span), d3.max(b, d => d.span)));

    //console.log("Node:", node.id, "; bundles:", node.bundles.length)
    node.numBundles = 0
    node.bundles.forEach(bundles => {
      node.numBundles += 1//bundles.length
      bundles.forEach((bundle, i) => {
        const parentsArr = bundle.parents?.map(node => node.id) || []
        //console.log(`Bundle ${i}:`, bundle.id, '; Child:', bundle.childNodeId,`; Parents (${parentsArr.length}):`, parentsArr)
      })
    })
    //Populate index variables in bundles
    let i = 0
    node.bundles.forEach(bundles => {
      bundles.i = i
      i += 1
    })
    //for (const [i, bundle] of node.bundles.entries()) bundle.i = i;
  }

  //Populate bundle 'link' list
  for (const link of links) {
    if (link.bundle.links === undefined) {
      link.bundle.links = [];
    }
    link.bundle.links.push(link);
  }

  // layout
  //Node internal height is metroD * num bundles attached to node output
  //(Bundles this node is parent to)
  for (const node of nodes) {
    console.log("Node", node.id, "; numBundles:", node.numBundles)
    node.height = (Math.max(1, node.numBundles) - 1) * metroD
  }

  let xOffset = padding;
  let yOffset = padding;
  for (const level of levels) {
    xOffset += level.bundles.length * bundleWidth;
    yOffset += levelYPadding;
    for (const node of level) {
      node.x = node.level * nodeWidth + xOffset;
      node.y = nodeHeight + yOffset + node.height / 2;
      yOffset += nodeHeight + node.height;
    }
  }

  let totalLength = 0;
  for (const level of levels) {
    level.bundles.forEach(bundle => {
      bundle.x = d3.max(bundle.parents, d => d.x) + nodeWidth +
        (level.bundles.length - 1 - bundle.i) * bundleWidth;
      bundle.y = totalLength * nodeHeight;
    });
    totalLength += level.length;
  }

  //IMPORTANT
  //Link visual position calculations

  //SOURCE is the child, TARGET is the parent

  console.log("Generating link coordinates")
  for (const link of links) {
    if (link.target.bundlesIndex[link.bundle.id] === undefined) {
      console.log("Detected Error Condition")
      console.log("Link source:", link.source.id, "; target: ", link.target.id, "; bundle id:", link.bundle.id)
      console.log("Target Bundles Index Keys:", Object.keys(link.target.bundlesIndex))
      console.log("Target Bundles Index Values:", Object.values(link.target.bundlesIndex))
    }

    link.x_target = link.target.x;
    link.y_target = link.target.y +
      link.target.bundlesIndex[link.bundle.id].i * metroD -
      (link.target.numBundles * metroD) / 2 +
      metroD / 2;
    link.x_bundle = link.bundle.x;
    link.y_bundle = link.bundle.y;
    link.x_source = link.source.x;
    link.y_source = link.source.y;
  }

  // compress vertical space
  if (false) {
    let yNegativeOffset = 0;
    for (const level of levels) {
      yNegativeOffset += -minFamilyHeight +
        d3.min(level.bundles, bundle =>
          d3.min(bundle.links, link => link.y_source - 2 * c - (link.y_target + c))
        ) || 0;
      for (const node of level) node.y -= yNegativeOffset;
    }
  }

  console.log("Generating link secondary visual parameters")
  for (const link of links) {
    link.y_target = link.target.y +
      link.target.bundlesIndex[link.bundle.id].i * metroD -
      (link.target.bundles.length * metroD) / 2 +
      metroD / 2;
    link.y_source = link.source.y;
    //If source/child is left of target/parent level, c1=c
    //If child is right of parent level, c1 = distance between bundle and target, along smaller axis (X or Y), but no larger than bigc
    link.c1 = link.source.level - link.target.level > 1 ?
      Math.min(bigc, link.x_bundle - link.x_target, link.y_bundle - link.y_target) - c : c;
    link.c2 = c;
  }

  console.log("Assembling layout data")
  const layout = {
    width: d3.max(nodes, node => node.x) + nodeWidth + 2 * padding,
    height: d3.max(nodes, node => node.y) + nodeHeight / 2 + 2 * padding,
    nodeHeight,
    nodeWidth,
    bundleWidth,
    levelYPadding,
    metroD
  };

  console.log("Done!")
  return {
    levels,
    nodes,
    nodesIndex,
    links,
    bundles,
    layout
  };
}

export const TangledTreeVisualization = ({ graphData, rawCourseData, options = {
  color: d3.scaleOrdinal(d3.schemeDark2),
  backgroundColor: 'white'
} }) => {
  const [tangleLayout, setTangleLayout] = React.useState()

  React.useEffect(() => {
    //Reset controls in case there was a previous graph open
    setHoveredNodeId(undefined)
    mouseStillOverHoveredNode.current = false
    lctrlPressed.current = false
    currentSelectionLocked.current = false

    const tangleLayoutData = constructTangleLayout(_.cloneDeep(graphData), {
      color: options.color,
      backgroundColor: options.backgroundColor
    });
    setTangleLayout(tangleLayoutData)
    console.log("Done generating graph visual data!")
  }, [graphData])

  const Viewer = React.useRef(null);
  React.useEffect(() => {
    setTimeout(() => {
      Viewer.current?.fitToViewer();
    }, 0)
  }, [tangleLayout]);

  const [tool, setTool] = React.useState(TOOL_NONE)
  const [value, setValue] = React.useState({})

  const [hoveredNodeId, setHoveredNodeId] = React.useState()

  const mouseStillOverHoveredNode = React.useRef(false)
  const currentSelectionLocked = React.useRef(false)
  const lctrlPressed = React.useRef(false)

  function handleKeyDown(event) {
    if (event.key == 'Escape') {
      setTool(TOOL_NONE)
    }
    else if (event.key.toUpperCase() == 'M') {
      setTool(prevTool => prevTool == TOOL_PAN ? TOOL_NONE : TOOL_PAN)
    }
    else if (event.key.toUpperCase() == 'R') {
      Viewer.current?.fitToViewer()
    }
    else if (event.key == 'Control') {
      lctrlPressed.current = true
    }
  }

  function handleKeyUp(event) {
    if (event.key == 'Control') {
      lctrlPressed.current = false
    }
  }

  React.useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  if (!tangleLayout) return;

  const uniqueBundleParents = new Set([]);
  tangleLayout.bundles.forEach(bundle => {
    bundle.parents.forEach(parent => {
      uniqueBundleParents.add(parent.id)
    })
  })

  function getInfoUrl(node) {
    const courseData = rawCourseData.values().find(data => data.name == node.id)
    return `https://catalog.charlotte.edu/preview_course.php?catoid=${courseData.catalogId}&coid=${courseData.courseId}`
  }

  function onHoverNode(node) {
    if (currentSelectionLocked.current) return
    setHoveredNodeId(node.id)
    mouseStillOverHoveredNode.current = true
  }

  function onStopHoveringNode() {
    //setHoveredNodeId('')    
    mouseStillOverHoveredNode.current = false
  }

  function onClick_node(node) {
    if (lctrlPressed.current) {
      const url = getInfoUrl(node)
      window.open(url, url);
    }
    else {
      currentSelectionLocked.current = true
    }
  }

  //Collect child and parent nodes
  const nodeIdsParentOfSelected = []
  const nodeIdsChildOfSelected = []
  let selectedNode
  if (hoveredNodeId) {
    selectedNode = tangleLayout.nodes.find(node => node.id == hoveredNodeId)

    const MAX_ITERS = 10

    let childNodesFront = [hoveredNodeId]
    for (let i = 0; i < MAX_ITERS; i++) {
      const front = [...childNodesFront]
      childNodesFront = []

      front.forEach(nodeId => {
        const nodeData = tangleLayout.nodes.find(node => node.id == nodeId)
        if (nodeData) {
          nodeData.bundles.forEach(bundlesArr => {
            bundlesArr.forEach(bundle => {
              nodeIdsChildOfSelected.push(bundle.childNodeId)
              childNodesFront.push(bundle.childNodeId)
            })
          })
        }
      })
    }

    let parentNodesFront = [hoveredNodeId]
    for (let i = 0; i < MAX_ITERS; i++) {
      const front = [...parentNodesFront]
      parentNodesFront = []
      front.forEach(nodeId => {
        const nodeData = tangleLayout.nodes.find(node => node.id == nodeId)
        if (nodeData && nodeData.incomingBundles) {
          Object.keys(nodeData.incomingBundles).forEach(id => {
            nodeIdsParentOfSelected.push(id)
            parentNodesFront.push(id)
          })
        }
      })

      //console.log(selectedNode.id)
    }
  }

  //color = d3.scaleOrdinal(d3.schemeObservable10).domain(Object.keys(uniqueBundleParents))

  //console.log("TangledTree rerender")
  return (
    <ReactSVGPanZoom
      ref={Viewer}
      width={window.innerWidth} height={window.innerHeight}
      tool={tool} onChangeTool={setTool}
      value={value} onChangeValue={setValue}
      onClick={() => {
        if (hoveredNodeId && mouseStillOverHoveredNode.current) {
          onClick_node(selectedNode)
        }
        else {
          currentSelectionLocked.current = false
          setHoveredNodeId('')
        }
      }}
    >
      <svg
        width={tangleLayout.layout.width}
        height={tangleLayout.layout.height}
        style={{ backgroundColor: options.backgroundColor }}
      >
        <style>{`
      text {
        font-family: sans-serif;
        font-size: 10px;
      }
      .node {
        stroke-linecap: round;
      }
      .link {
        fill: none;
      }
    `}</style>

        {/*
    A 'bundle' refers to a set of lines of the same color. It's unclear how bundles are created.
    */}

        {tangleLayout.bundles.map((bundle, i) => {
          const d = bundle.links
            .map(
              link => {
                link.c1 = 10
                return `
        M${link.x_target} ${link.y_target}
        L${link.x_bundle - link.c1} ${link.y_target}
        A${link.c1} ${link.c1} 90 0 1 ${link.x_bundle} ${link.y_target + link.c1}
        L${link.x_bundle} ${link.y_source - link.c2}
        A${link.c2} ${link.c2} 90 0 0 ${link.x_bundle + link.c2} ${link.y_source}
        L${link.x_source} ${link.y_source}`
              })
            .join("");
          return <React.Fragment>
            {/*<path class="link" d={d} stroke={backgroundColor} stroke-width={3} />*/}
            <path class="link" d={d} stroke={options.color(bundle.parents[0]?.id)} stroke-width={2} />
          </React.Fragment>;
        })}

        {tangleLayout.nodes.map(
          node => {
            let isNodeSelected = false
            let nodeColor = "white"
            let nodeScale = 1
            const selectedNodeScaleFactor = 3
            if (node.id == hoveredNodeId) {
              isNodeSelected = true
              nodeColor = "blue"
              nodeScale = selectedNodeScaleFactor
            }
            else if (nodeIdsParentOfSelected.includes(node.id)) {
              isNodeSelected = true
              nodeColor = "red"
              nodeScale = selectedNodeScaleFactor * 1
            }
            else if (nodeIdsChildOfSelected.includes(node.id)) {
              isNodeSelected = true
              nodeColor = "green"
              nodeScale = selectedNodeScaleFactor * 1
            }

            return <React.Fragment>
              <path class="selectable node"
                data-id={node.id}
                stroke="black"
                stroke-width={4 * nodeScale + 4}
                d={`M${node.x} ${node.y - node.height / 2} L${node.x} ${node.y + node.height / 2}`}
                onMouseOver={() => onHoverNode(node)}
                onMouseOut={() => onStopHoveringNode()}
                cursor='pointer'
              />

              <path class="node"
                stroke={nodeColor}
                stroke-width={4 * nodeScale}
                d={`M${node.x} ${node.y - node.height / 2} L${node.x} ${node.y + node.height / 2}`}
                onMouseOver={() => onHoverNode(node)}
                onMouseOut={() => onStopHoveringNode()}
                cursor='pointer'
              />

              <text class="selectable"
                data-id={node.id}
                x={node.x + 4}
                y={node.y - node.height / 2 - 4}
                stroke={options.backgroundColor}
                stroke-width="2"
                onMouseOver={() => onHoverNode(node)}
                onMouseOut={() => onStopHoveringNode()}
                style={{ userSelect: 'none' }}
                cursor='pointer'
              >
                {node.id}
              </text>

              <text
                x={node.x + 4}
                y={node.y - node.height / 2 - 4}
                style={{ pointerEvents: 'none' }}
                fontWeight={isNodeSelected ? 700 : 400}
                onMouseOver={() => setHoveredNodeId(node.id)}
                onMouseOut={() => setHoveredNodeId('')}
              >
                {node.id}
              </text>
            </React.Fragment>
          })
        }
      </svg>
    </ReactSVGPanZoom >
  );
}