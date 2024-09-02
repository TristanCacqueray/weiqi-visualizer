// Copyright (C) 2024 Tristan de Cacqueray
// SPDX-License-Identifier: GPL-3.0
//
// This module contains the render logic.

import { PicoGL } from "picogl";

// The colors and the size
const uniformShader = `
        layout(std140) uniform Scene {
          vec4  grid;
          vec4  hoshi;
          vec4  black;
          vec4  white;
          float size;
        } scene;
`;

const gridVertexShader = `#version 300 es
        layout(location=0) in vec2 position;
        void main() {
            gl_Position = vec4(position, 1, 1);
        }
`;

const gridFragmentShader = `#version 300 es
        precision highp float;
        ${uniformShader}
        out vec4 fragColor;
        void main() {
            fragColor = scene.grid;
        }
`;

// Return an array with all the lines pair of coordinates
function mkGridPositions(sz) {
  const cellSize = 2 / (sz + 1);
  const gridPositions = new Float32Array(sz * 2 * 4);
  const addLine = (i, x0, y0, x1, y1) => {
    gridPositions[i] = x0;
    gridPositions[i + 1] = y0;
    gridPositions[i + 2] = x1;
    gridPositions[i + 3] = y1;
  };
  for (let line = 0; line < sz * 2; line++) {
    const i = line * 4;
    const x = cellSize - 1;
    const y = cellSize + (line % sz) * cellSize - 1;
    if (line < sz) {
      // horizontal line
      addLine(i, x, y, 1 - cellSize, y);
    } else {
      // vertical line
      addLine(i, y, x, y, 1 - cellSize);
    }
  }
  return gridPositions;
}

const stoneVertexShader = `#version 300 es
        uniform float iTime;
        uniform int iLast;
        ${uniformShader}

        layout(location=0) in vec2 position;
        layout(location=1) in vec3 data;
        #define ITEM data.x
        #define TS data.y
        #define MARK data.z

        out vec3 color;
        out float age;
        out float last;
        out float fade;
        out float mark;

        void main() {
          mark = MARK;
          if (ITEM == 2.0 && mark == 0.0) {
            // hoshi without a mark
            gl_PointSize = scene.size * 0.25;
            color = scene.hoshi.xyz;
            age = 100.0;
            gl_Position = vec4(position, 0., 1.);
          } else if (ITEM != 0. || MARK != 0.) {
            if (ITEM == 1.0) {
              color = scene.white.xyz;
            } else if (ITEM == -1.0) {
              color = scene.black.xyz;
            } else {
              color = vec3(0);
            }
            if (TS < 0.) {
              fade = pow(clamp(0., 1., (iTime + TS) * 3.), 2.);
              age = 100.0;
            } else {
              age = (iTime - TS) * 9.;
            }
            if (age > 0.0) {
              last = iLast == gl_VertexID ? 1.0 : 0.0;
              gl_PointSize = scene.size;
              gl_Position = vec4(position, 0., 1.);
            }
        }
}
`;

import { symbols } from "./game.js";
const atlasCount = symbols.length;
const atlasHeight = 40 * window.devicePixelRatio;
const atlasWidth = atlasHeight * atlasCount;
function mkFontAtlas() {
  var offScreenCanvas = document.createElement("canvas");
  offScreenCanvas.width = atlasWidth;
  offScreenCanvas.height = atlasHeight;
  var ctx = offScreenCanvas.getContext("2d", { antialias: false });
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "28px sans-serif";
  ctx.fillStyle = "#ddd";
  symbols.forEach((text, pos) => {
    ctx.fillText(text, atlasHeight / 2 + pos * atlasHeight, atlasHeight / 2);
  });
  // document.body.appendChild(offScreenCanvas);
  const rgba = ctx.getImageData(0, 0, atlasWidth, atlasHeight).data;
  const alphas = new Uint8ClampedArray(atlasWidth * atlasHeight);
  for (let i = 0; i < atlasWidth * atlasHeight; i++) {
    alphas[i] = rgba[i * 4 + 3];
  }
  return alphas;
}

const stoneFragmentShader = `#version 300 es
        precision highp float;
        uniform sampler2D tex;
        in vec3 color;
        in float age;
        in float last;
        in float fade;
        in float mark;
        out vec4 fragColor;

        void main() {
          vec2 tcoord = vec2((mark - 1.0 + gl_PointCoord.x)/${atlasCount}.0, gl_PointCoord.y);
          vec4 scol = texture(tex, tcoord);
          // fragColor = vec4(gl_PointCoord.xy, 0., 1.);
          // fragColor = vec4(texture(tex, tcoord).rgb, 1.0);
          // return;

          if (color == vec3(0.0) && mark != 0.0) {
            // Just a mark, display the texture
            fragColor = vec4(.9, .9, .9, scol.r);
            return;
          }

          vec3 col = vec3(0.0);
          float blend = scol.r;
          float dist = length(gl_PointCoord.xy - .5);
          if (dist < min(0.48, age/(1.+ age))) {
            blend = 1.-smoothstep(0.42,0.48,dist);
            col += color;
          }
          if (mark != 0.0)
            // Add the mark
            col = mix(color, vec3(.9), scol.r);
          else
            // Or add the last move highlight
            col += (1.0 - smoothstep(0., 0.2, dist)) * last * 0.7;
          fragColor = vec4(col, blend * (1.0 - fade));
        }
`;

function mkStonePositions(sz) {
  const cellSize = 2 / (sz + 1);

  const count = sz * sz;
  const stonePositions = new Float32Array(count * 2);
  const addPoint = (i, x, y) => {
    stonePositions[i] = x;
    stonePositions[i + 1] = y;
  };
  for (let i = 0; i < count; i++) {
    const y = Math.floor(i / sz);
    const x = i % sz;
    addPoint(i * 2, cellSize + x * cellSize - 1, cellSize + (sz - y - 1) * cellSize - 1);
  }
  return stonePositions;
}

export class BoardRenderer {
  constructor(elt, colorsMap) {
    this.app = PicoGL.createApp(elt.getContext("webgl2"));

    this.font = this.app.createTexture2D(mkFontAtlas(), atlasWidth, atlasHeight, { internalFormat: PicoGL.R8 });
    this.gridArrays = this.app.createVertexArray();
    this.stoneArrays = this.app.createVertexArray();
    this.sceneUB = this.app.createUniformBuffer([
      PicoGL.FLOAT_VEC4,
      PicoGL.FLOAT_VEC4,
      PicoGL.FLOAT_VEC4,
      PicoGL.FLOAT_VEC4,
      PicoGL.FLOAT,
    ]);
    this.colorsMap = colorsMap;
    this.attr = new Float32Array(3).fill(0);
    this.mark = new Float32Array(1);
    this.sz = 0;
    this.move = 0;
    this.moves = [];
    this.app
      .createPrograms([gridVertexShader, gridFragmentShader], [stoneVertexShader, stoneFragmentShader])
      .then(([gridProgram, stoneProgram]) => {
        this.gridProgram = gridProgram;
        this.stoneProgram = stoneProgram;
        this.drawGrid = this.app
          .createDrawCall(gridProgram, this.gridArrays)
          .primitive(PicoGL.LINES)
          .uniformBlock("Scene", this.sceneUB);
        this.drawStones = this.app
          .createDrawCall(stoneProgram, this.stoneArrays)
          .primitive(PicoGL.POINTS)
          .uniformBlock("Scene", this.sceneUB)
          .texture("tex", this.font);
        if (this.sz > 0) {
          this.draw();
        }
      });
    this.app.onContextRestored(this.restore.bind(this));
    globalThis.app = this.app;
  }

  restore() {
    console.log("Restoring the context!");
    this.gridArrays.restore();
    this.stoneArrays.restore();
    this.sceneUB.restore();
    this.app.restorePrograms(this.gridProgram, this.stoneProgram);
    this.gridPositionsBuffer.restore(mkGridPositions(this.sz));
    this.stonePositionsBuffer.restore(mkStonePositions(this.sz));
    this.stoneDataBuffer.restore(this.mkStoneData());
    this.font.restore(mkFontAtlas());

    // Replay moves
    for (let i = 0; i <= this.move; i++) {
      this.moves[i].events.forEach(([i, _, sign]) => {
        this.setStone(i, sign, Math.abs(sign), 0);
        if (sign != 0) this.last = i;
      });
    }
    this.setMarks(this.move);
    this.setupGPU();
  }

  draw(iTime) {
    if (!this.drawGrid) return;
    if (!iTime) iTime = performance.now();
    this.app.clear();
    this.drawGrid.draw();
    this.drawStones.uniform("iTime", iTime / 1000.0).uniform("iLast", this.last);
    this.drawStones.draw();
  }

  resize(dim) {
    // console.log("Resizing", dim, this.sz);
    this.dim = dim * window.devicePixelRatio;
    this.app.resize(this.dim, this.dim);
    this.app.canvas.style["width"] = dim + "px";
    this.app.canvas.style["height"] = dim + "px";
    if (this.sz > 0) {
      this.sceneUB.set(4, this.dim / (this.sz + 1)).update();
      this.draw();
    }
  }

  setStone(i, color, size, ts) {
    const pos = 4 * 3 * i;
    this.attr[0] = color;
    if (size == 0) {
      ts *= -1;
      if (this.hoshis.indexOf(i) > -1) {
        // The removed stone was an hoshi, restore it's type
        this.attr[0] = 2;
      }
    }
    this.attr[1] = ts / 1000.0;
    this.stoneDataBuffer.data(this.attr, pos);
  }

  setMarks(move, prev) {
    if (prev != null && this.moves[prev].marks) {
      // remove previous mark
      this.moves[prev].marks.forEach(([i, mark]) => {
        this.setMark(i, 0);
      });
    }
    if (move != null && this.moves[move].marks) {
      // add new marks
      this.moves[move].marks.forEach(([i, mark]) => {
        this.setMark(i, mark);
      });
    }
  }

  setMark(i, mark) {
    const pos = 4 * 3 * i;
    this.mark[0] = mark;
    this.stoneDataBuffer.data(this.mark, pos + 8);
  }

  // initialize GPU resources, to be called on context lost
  setupGPU() {
    this.app
      .clearColor(0.0, 0.0, 0.0, 0.0)
      .enable(PicoGL.BLEND)
      .blendEquation(PicoGL.FUNC_ADD)
      .blendFunc(PicoGL.SRC_ALPHA, PicoGL.ONE_MINUS_SRC_ALPHA);
    this.sceneUB
      .set(0, this.colorsMap.grid)
      .set(1, this.colorsMap.hoshi)
      .set(2, this.colorsMap.black)
      .set(3, this.colorsMap.white)
      .set(4, this.dim / (this.sz + 1))
      .update();
    this.gridArrays.vertexAttributeBuffer(0, this.gridPositionsBuffer);
    this.stoneArrays.vertexAttributeBuffer(0, this.stonePositionsBuffer).vertexAttributeBuffer(1, this.stoneDataBuffer);

    /* // test render
    const now = performance.now();
    for (let i = 0; i < 2; i++) {
      this.setStone(5 + i + 5 * 19, -1, 1, now);
      this.setStone(5 + i + 6 * 19, 1, 1, now);
    }
    for (let i = 0; i < 2; i++) {
      this.setMark(5 + i + 5 * 19, 1 + i);
      this.setMark(5 + i + 6 * 19, 1 + i);
      this.setMark(5 + i + 7 * 19, 1 + i);
    }
    */
    this.draw();
  }

  mkStoneData(hoshiStart, hoshiSpacing) {
    const count = this.sz * this.sz;
    const stoneData = new Float32Array(count * 3).fill(0);
    this.hoshis = [];
    for (let x = 0; x < 3; x++) {
      for (let y = 0; y < 3; y++) {
        const pos = this.hoshiStart + x * this.hoshiSpacing + this.sz * (this.hoshiStart + y * this.hoshiSpacing);
        this.hoshis.push(pos);
        stoneData[pos * 3] = 2;
      }
    }
    return stoneData;
  }

  initialize(sz, moves) {
    // sz = 9;
    if (!this.dim) {
      this.resize(this.app.gl.canvas.width);
    }
    this.hoshiStart = sz == 9 ? 2 : 3;
    this.hoshiSpacing = sz == 9 ? 2 : sz == 13 ? 4 : 6;
    this.moves = moves;
    this.move = 0;
    if (sz != this.sz) {
      this.sz = sz;
      this.gridPositionsBuffer = this.app.createVertexBuffer(PicoGL.FLOAT, 2, mkGridPositions(sz));
      this.stonePositionsBuffer = this.app.createVertexBuffer(PicoGL.FLOAT, 2, mkStonePositions(sz));
      this.stoneDataBuffer = this.app.createVertexBuffer(PicoGL.FLOAT, 3, this.mkStoneData());
      this.setupGPU();
    } else {
      this.stoneDataBuffer.data(mkStoneData(sz));
    }
  }
}
