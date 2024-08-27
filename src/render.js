// Copyright (C) 2024 Tristan de Cacqueray
// SPDX-License-Identifier: GPL-3.0
//
// This module contains the render logic.

import regl_ from "regl";

const getCellSize = (size) => 2 / (size + 1);

function mkGrid(regl, color, size, cellSize) {
  return regl({
    frag: `
  precision mediump float;
  uniform vec3 iColor;
  void main() {
    gl_FragColor = vec4(iColor, 1.0);
  }`,

    vert: `
  precision mediump float;
  attribute vec2 position;
  void main() {
    gl_Position = vec4(position, 1, 1);
  }`,
    attributes: {
      position: Array(size * 2)
        .fill()
        .map((_, i) => {
          const x = cellSize - 1;
          const y = cellSize + (i % size) * cellSize - 1;
          if (i < size) {
            // horizontal line
            return [x, y, 1 - cellSize, y];
          } else {
            // vertical line
            return [y, x, y, 1 - cellSize];
          }
        }),
    },
    uniforms: {
      iColor: color,
    },
    count: size * 4,
    primitive: "line",
    depth: {
      enable: false,
    },
  });
}

function mkStones(regl, colors, size, cellSize, dataBuffer) {
  const start = cellSize;
  const spacing = cellSize;

  const hoshiStart = cellSize * (size == 9 ? 3 : 4);
  const hoshiSpacing = cellSize * (size == 9 ? 2 : size == 13 ? 4 : 6);

  return regl({
    frag: `
  precision highp float;

varying vec3 vColor;
varying float vAge;
varying float isLast;

void main() {
    float size = min(0.48, vAge/(1.+ vAge));
    vec2 uv = gl_PointCoord.xy - .5;
    float dist = length(uv);
    float blend = (1.-smoothstep(0.35,0.45,dist));
    vec3 col = vColor + (1.0 - smoothstep(0., 0.2, dist)) * isLast * 0.7;
    if (length(uv) < size) { gl_FragColor = vec4(col, blend);   }
    else { discard; }
}
`,

    vert: `
  precision highp float;
  attribute vec2 position;

// The board size, in pixel
uniform float iSize;
// The current time
uniform float iTime;
// The last move
uniform float iLast;
uniform vec3 iClrBlack;
uniform vec3 iClrWhite;
uniform vec3 iClrHoshi;

// data contains [color hue, size, birth]
attribute vec3 data;

// The fragment color
varying vec3 vColor;
// The stone age, to make it grow
varying float vAge;
varying float isLast;

void main() {
  if (data.y > 0.) {
  if (data.x == 0.5) {
    vColor = iClrHoshi;
  } else if (data.x == 1.) {
    vColor = iClrWhite;
  } else {
    vColor = iClrBlack;
  }
  isLast = data.z >= iLast ? 1.0 : 0.0;
  gl_PointSize = iSize * data.y;
  vAge = (iTime - data.z) * 10.;
  gl_Position = vec4(position, 1, 1);
  }
}
`,
    attributes: {
      position: Array(9 + size * size)
        .fill()
        .map((_, i) => {
          if (i < 9) {
            const x = Math.floor(i / 3);
            const y = i % 3;
            return [
              hoshiStart + x * hoshiSpacing - 1,
              hoshiStart + y * hoshiSpacing - 1,
            ];
          } else {
            i -= 9;
            const y = Math.floor(i / size);
            const x = i % size;
            return [
              cellSize + x * cellSize - 1,
              cellSize + (size - y - 1) * cellSize - 1,
            ];
          }
        }),

      data: { buffer: dataBuffer, stride: 12 },
    },
    uniforms: {
      iClrHoshi: colors.hoshi,
      iClrBlack: colors.black,
      iClrWhite: colors.white,
      iTime: regl.context("time"),
      iSize: (context) => context.viewportWidth / (size + 1),
      iLast: regl.prop("last"),
    },
    count: 9 + size * size,
    primitive: "points",
    depth: {
      enable: false,
    },
    blend: {
      enable: true,
      func: {
        srcRGB: "src alpha",
        srcAlpha: 1,
        dstRGB: "one minus src alpha",
        dstAlpha: 1,
      },
      equation: {
        rgb: "add",
        alpha: "add",
      },
      color: [0, 0, 0, 0],
    },
  });
}

export function initialize(elt, colors, sz) {
  const regl = regl_({
    pixelRatio: 1,
    canvas: elt,
    extensions: ["angle_instanced_arrays"],
  });
  const dataBuffer = regl.buffer({
    length: (9 + sz * sz) * 3 * 4,
    type: "float",
    usage: "dynamic",
  });

  const cellSize = 2 / (sz + 1);

  const drawGrid = mkGrid(regl, colors.grid, sz, cellSize);
  const drawStones = mkStones(regl, colors, sz, cellSize, dataBuffer);

  let last = 0;
  function drawFrame() {
    // console.log("drawFrame", elt.width, elt.height);
    regl.clear({ color: [0, 0, 0, 0] });
    drawGrid();
    drawStones({ last });
  }
  drawFrame();

  // setup hoshis
  const attr = new Float32Array([0.5, 0.25, -100]);
  for (let i = 0; i < 9; i++) {
    dataBuffer.subdata(attr, i * 4 * 3);
  }
  return {
    regl,
    setStone: (x, y, color, size, ts) => {
      const pos = 4 * 3 * (9 + x + y * sz);
      attr[0] = color;
      attr[1] = size;
      attr[2] = ts;
      if (size > 0) {
        last = ts;
      }
      dataBuffer.subdata(attr, pos);
    },
    refresh: () => {
      regl.poll();
      drawFrame();
    },
    drawFrame,
  };
}

/*

// The code bellow renders the grid and the hoshi to a texture to avoid redrawing these static elements.
// Though, after benchmark, displaying the texture takes longer than redrawing from scratch :)

function mkBackgroundTexture(regl, colors, sz) {
  const texture = regl.texture({
    width: 589,
    height: 589,
    format: "rgb",
  });
  const texFBO = regl.framebuffer({
    color: texture,
  });
  const drawGrid = mkGrid(regl, colors.grid, sz);
  const drawHoshis = mkHoshis(regl, colors.hoshi, sz);
  texFBO.use(() => {
    drawGrid();
    drawHoshis();
  });
  return texture;
}

function mkHoshis(regl, color, size) {
  const cellSize = getCellSize(size);
  const start = cellSize * (size == 9 ? 3 : 4);
  const spacing = cellSize * (size == 9 ? 2 : size == 13 ? 4 : 6);

  return regl({
    frag: `
  precision mediump float;
  uniform vec3 iColor;
  void main() {
    gl_FragColor = vec4(iColor, 1.0);
  }`,

    vert: `
  precision mediump float;
  attribute vec2 position;
  void main() {
    gl_PointSize = 10.0;
    gl_Position = vec4(position, 1, 1);
  }`,
    attributes: {
      position: Array(9)
        .fill()
        .map((_, i) => {
          const x = Math.floor(i / 3);
          const y = i % 3;
          return [start + x * spacing - 1, start + y * spacing - 1];
        }),
    },
    uniforms: {
      iColor: color,
    },
    count: 9,
    primitive: "points",
    depth: {
      enable: false,
    },
  });
}

function mkBackground(regl, texture) {
  return regl({
    frag: `
  precision mediump float;
  varying vec2 vUv;
  uniform sampler2D tex;
  void main () {
    gl_FragColor = texture2D(tex,vUv);
  }`,
    vert: `
  precision highp float;
  attribute vec2 position;
  varying vec2 vUv;
  void main() {
    vUv = position;
    gl_Position = vec4(2.0 * position - 1.0, 0, 1);
    // gl_Position = vec4(position, 0, 1);
  }`,
    attributes: {
    position: [
      -2, 0,
      0, -2,
      2, 2]
    },
    uniforms: {
      tex: texture,
    },
    count: 3,
  });
}*/
