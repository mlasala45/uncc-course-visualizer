import * as d3 from 'd3'
import * as React from 'react'
import _ from 'lodash'
import svg from './util/svg'

const color = d3.scaleOrdinal(d3.schemeDark2)
const background_color = "white"

export const RenderTangledTreeChart = ({ data, options = {} }: { data: NodeIn[][], options: any }) => {
  options.color ||= (d, i) => color(i);

  const tangleLayout = constructTangleLayout(_.cloneDeep(data), options);
  const backgroundColor = '#ffffff'; // or define your background color

  return (
    <svg
      width={tangleLayout.layout.width * .5}
      height={tangleLayout.layout.height}
      style={{ backgroundColor }}
    >
      <style>
        {`
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
        `}
      </style>

      {tangleLayout.bundles.map((bundle, i) => {
        //For each bundle...
        //For each link...
        const d = bundle.links!
          .map(
            (link) => {
              const l = link as Required<LinkData>
              return ''
                + svg.moveTo(l.xt, l.yt)
                + svg.lineTo(l.xb - l.c1, l.yt)
                + svg.arc(l.xb, l.yt + l.c1, {
                  rx: l.c1,
                  ry: l.c1,
                  xAxisRotation: 90,
                  largeArcFlag: false,
                  sweepFlag: true
                })
                + svg.lineTo(l.xb, l.ys - l.c2)
                + svg.arc(l.xb + l.c2, l.ys, {
                  rx: l.c2,
                  ry: l.c2,
                  xAxisRotation: 90,
                  largeArcFlag: false,
                  sweepFlag: false
                })
                + svg.lineTo(l.xs, l.ys)
            })
          .join('');
        return (
          <>
            <path
              className="link"
              d={d}
              stroke={backgroundColor}
              strokeWidth="5"
            />
            <path
              className="link"
              d={d}
              stroke={options.color(bundle, i)}
              strokeWidth="2"
            />
          </>
        );
      })}

      {tangleLayout.nodes.map((n) => (
        <>
          <path
            className="selectable node"
            data-id={n.id}
            stroke="black"
            strokeWidth="8"
            d={`M${n.x} ${n.y - n.height / 2} L${n.x} ${n.y + n.height / 2}`}
          />
          <path
            className="node"
            stroke="white"
            strokeWidth="4"
            d={`M${n.x} ${n.y - n.height / 2} L${n.x} ${n.y + n.height / 2}`}
          />

          <text
            className="selectable"
            data-id={n.id}
            x={n.x + 4}
            y={n.y - n.height / 2 - 4}
            stroke={backgroundColor}
            strokeWidth="2"
          >
            {n.id}
          </text>
          <text x={n.x + 4} y={n.y - n.height / 2 - 4} style={{ pointerEvents: 'none' }}>
            {n.id}
          </text>
        </>
      ))}
    </svg>
  );
};

type NodeIn = {
  id: string,
  parents: string[],
}

type NodeOut = Omit<NodeIn, 'parents'> & {
  level: number,
  x: number,
  y: number,
  height: number,
  links: LinkData[]
  parents: NodeOut[],
  bundle: BundleData,
  bundles: (BundleData[] & { i?: number })[],
  bundles_index: Record<string, (BundleData[] & { i?: number })>
}

type LevelDataIn = NodeOut[]

type LevelDataOut = LevelDataIn & {
  bundles: BundleData[]
}

type BundleData = {
  id: string,
  x?: number,
  y?: number,
  span: number,
  level: number,
  parents: NodeOut[],
  i?: number,
  links?: LinkData[]
}

type LinkData = {
  source: NodeOut,
  target: NodeOut,
  bundle: BundleData,
  xt?: number,
  yt?: number,
  xb?: number,
  yb?: number,
  xs?: number,
  ys?: number,
  c1?: number,
  c2?: number
}

type ConstructTangleLayoutOptions = {
  c?: number,
  bigC?: number
}

const constructTangleLayout = (levels: LevelDataIn[], options: ConstructTangleLayoutOptions = {}) => {
  const workingLevels: LevelDataOut[] = []
  levels.forEach(level => {
    //@ts-ignore
    const newLevelData: LevelDataOut = []
    level.forEach(node => {
      newLevelData.push({
        ...node,
      } as NodeOut)
    })
    workingLevels.push(newLevelData)
  })

  // precompute level depth
  workingLevels.forEach((level, i) => level.forEach(node => (node.level = i)));

  var nodes = workingLevels.reduce((a, x) => a.concat(x), [] as NodeOut[]);
  var nodes_index: Record<string, NodeOut> = {};
  nodes.forEach(d => (nodes_index[d.id] = d));

  // objectification
  nodes.forEach(node => {
    //@ts-ignore
    const nodeParentsStrArr = (node.parents === undefined ? [] : node.parents as string[])
    node.parents = nodeParentsStrArr.map(
      p => nodes_index[p]
    );
  });

  // precompute bundles
  workingLevels.forEach((level, i) => {
    var index: Record<string, BundleData> = {};
    level.forEach(node => {
      if (node.parents.length == 0) {
        return;
      }

      var id = node.parents
        .map(d => d.id)
        .sort()
        .join('-X-');
      if (id in index) {
        index[id].parents = index[id].parents.concat(node.parents);
      } else {
        index[id] = { id: id, parents: node.parents.slice(), level: i, span: i - d3.min(node.parents, parentNode => parentNode.level) };
      }
      node.bundle = index[id];
    });
    level.bundles = Object.keys(index).map(k => index[k]);
    level.bundles.forEach((b, i) => (b.i = i));
  });

  var links: LinkData[] = [];
  nodes.forEach(d => {
    d.parents.forEach(p =>
      links.push({ source: d, bundle: d.bundle, target: p })
    );
  });

  var bundles = workingLevels.reduce((a, x) => a.concat(x.bundles), [] as BundleData[]);

  // reverse pointer from parent to bundles
  bundles.forEach(bundle =>
    bundle.parents.forEach(parentNode => {
      if (parentNode.bundles_index === undefined) {
        parentNode.bundles_index = {};
      }
      if (!(bundle.id in parentNode.bundles_index)) {
        parentNode.bundles_index[bundle.id] = [];
      }
      parentNode.bundles_index[bundle.id].push(bundle);
    })
  );

  nodes.forEach(n => {
    if (n.bundles_index !== undefined) {
      n.bundles = Object.keys(n.bundles_index).map(k => n.bundles_index[k]);
    } else {
      n.bundles_index = {};
      n.bundles = [];
    }
    n.bundles.sort((a, b) => d3.descending(d3.max(a, d => d.span), d3.max(b, d => d.span)))
    n.bundles.forEach((b, i) => (b.i = i));
  });

  links.forEach(link => {
    if (link.bundle.links === undefined) {
      link.bundle.links = [];
    }
    link.bundle.links.push(link);
  });

  // layout
  const padding = 8;
  const node_height = 22;
  const node_width = 140 * 3;
  const bundle_width = 14;
  const level_y_padding = 16;
  const metro_d = 4;
  const min_family_height = 22;

  options.c ||= 16;
  const c = options.c;
  options.bigC ||= node_width + c;

  nodes.forEach(
    n => (n.height = (Math.max(1, n.bundles.length) - 1) * metro_d)
  );

  var x_offset = padding;
  var y_offset = padding;
  workingLevels.forEach(l => {
    x_offset += l.bundles.length * bundle_width;
    y_offset += level_y_padding;
    l.forEach((n, i) => {
      n.x = n.level * node_width + x_offset;
      n.y = node_height + y_offset + n.height / 2;

      y_offset += node_height + n.height;
    });
  });

  var i = 0;
  workingLevels.forEach(l => {
    l.bundles.forEach(bundle => {
      bundle.x =
        d3.max(bundle.parents, d => d.x) +
        node_width +
        (l.bundles.length - 1 - bundle.i!) * bundle_width;
      bundle.y = i * node_height;
    });
    i += l.length;
  });

  links.forEach(l => {
    l.xt = l.target.x;
    l.yt =
      l.target.y +
      l.target.bundles_index[l.bundle.id].i! * metro_d -
      (l.target.bundles.length * metro_d) / 2 +
      metro_d / 2;
    l.xb = l.bundle.x;
    l.yb = l.bundle.y;
    l.xs = l.source.x;
    l.ys = l.source.y;
  });

  // compress vertical space
  var y_negative_offset = 0;
  workingLevels.forEach(l => {
    y_negative_offset +=
      -min_family_height +
      d3.min(l.bundles, b =>
        d3.min(b.links, link => link.ys - 2 * c - (link.yt + c))
      ) || 0;
    l.forEach(n => (n.y -= y_negative_offset));
  });

  // very ugly, I know
  links.forEach(l => {
    l.yt =
      l.target.y +
      l.target.bundles_index[l.bundle.id].i! * metro_d -
      (l.target.bundles.length * metro_d) / 2 +
      metro_d / 2;
    l.ys = l.source.y;
    l.c1 = l.source.level - l.target.level > 1 ? Math.min(options.bigC!, l.xb! - l.xt!, l.yb! - l.yt) - c : c;
    l.c2 = c;
  });

  var layout = {
    width: d3.max(nodes, n => n.x) + node_width + 2 * padding,
    height: d3.max(nodes, n => n.y) + node_height / 2 + 2 * padding,
    node_height,
    node_width,
    bundle_width,
    level_y_padding,
    metro_d
  };

  return {
    workingLevels, nodes, nodes_index,
    links,
    bundles,
    layout
  };
}