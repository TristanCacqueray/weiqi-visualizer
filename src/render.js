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
      addLine(i, y, x, y, 1 - cellSize);
    }
  }
  return gridPositions;
}

const stoneVertexShader = `#version 300 es

        layout(location=0) in vec2 position;
        layout(location=1) in vec2 data;

        out vec3 color;
        out float age;
        out float last;
        out float fade;

        // The current time
        uniform float iTime;
        // The last move
        uniform int iLast;

        ${uniformShader}

        void main() {
          if (gl_VertexID < 9) {
            gl_PointSize = scene.size * 0.25;
            color = scene.hoshi.xyz;
            age = 100.0;
            gl_Position = vec4(position, 0., 1.);
          } else {
          if (data.x != 0.) {
            if (data.x == 1.) {
              color = scene.white.xyz;
            } else {
              color = scene.black.xyz;
            }
            if (data.y < 0.) {
              fade = pow(clamp(0., 1., (iTime + data.y) * 3.), 2.);
              age = 100.0;
            } else {
              age = (iTime - data.y) * 10.;
            }
            if (age > 0.0) {
              last = iLast == gl_VertexID ? 1.0 : 0.0;
              gl_PointSize = scene.size;
              gl_Position = vec4(position, 0., 1.);
            }
          }
        }
}
`;
const stoneFragmentShader = `#version 300 es
        precision highp float;

        in vec3 color;
        in float age;
        in float last;
        in float fade;

        out vec4 fragColor;
        void main() {
          float size = min(0.48, age/(1.+ age));
          vec2 uv = gl_PointCoord.xy - .5;
          float dist = length(uv);
          if (dist < size) {
            float blend = 1.-smoothstep(0.42,0.48,dist);
            vec3 col = color + (1.0 - smoothstep(0., 0.2, dist)) * last * 0.7;
            fragColor = vec4(col, blend * (1.0 - fade));
         } else {
            discard;
         }
        }
`;

function mkStonePositions(sz) {
  const cellSize = 2 / (sz + 1);

  const hoshiStart = cellSize * (sz == 9 ? 3 : 4);
  const hoshiSpacing = cellSize * (sz == 9 ? 2 : sz == 13 ? 4 : 6);

  const count = 9 + sz * sz;
  const stonePositions = new Float32Array(count * 2);
  const addPoint = (i, x, y) => {
    stonePositions[i] = x;
    stonePositions[i + 1] = y;
  };
  for (let i = 0; i < count; i++) {
    if (i < 9) {
      const x = Math.floor(i / 3);
      const y = i % 3;
      addPoint(i * 2, hoshiStart + x * hoshiSpacing - 1, hoshiStart + y * hoshiSpacing - 1);
    } else {
      const si = i - 9;
      const y = Math.floor(si / sz);
      const x = si % sz;
      addPoint(i * 2, cellSize + x * cellSize - 1, cellSize + (sz - y - 1) * cellSize - 1);
    }
  }
  return stonePositions;
}

function mkStoneData(sz) {
  const count = 9 + sz * sz;
  const stoneData = new Float32Array(count * 2).fill(0);
  return stoneData;
}

export class BoardRenderer {
  constructor(elt, colorsMap) {
    this.app = PicoGL.createApp(elt.getContext("webgl2"));
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
    this.attr = new Float32Array(2);
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
          .uniformBlock("Scene", this.sceneUB);
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
    this.stoneDataBuffer.restore(mkStoneData(this.sz));

    // Replay moves
    for (let i = 0; i <= this.move; i++) {
      this.moves[i].events.forEach(([x, y, _, sign]) => {
        this.setStone(x, y, sign, Math.abs(sign), 0);
        if (sign != 0) this.setLast(x, y);
      });
    }
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
    this.dim = dim;
    this.app.resize(this.dim, this.dim);
    if (this.sz > 0) {
      this.sceneUB.set(4, this.dim / (this.sz + 1)).update();
      this.draw();
    }
  }

  setLast(x, y) {
    this.last = 9 + (x + y * this.sz);
  }

  setStone(x, y, color, size, ts) {
    const pos = 4 * 2 * (9 + x + y * this.sz);
    this.attr[0] = color;
    if (size == 0) ts *= -1;
    this.attr[1] = ts / 1000.0;
    this.stoneDataBuffer.data(this.attr, pos);
  }

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
    this.draw();
  }

  initialize(sz, moves) {
    if (!this.dim) {
      this.resize(this.app.gl.canvas.width);
    }
    this.moves = moves;
    this.move = 0;
    if (sz != this.sz) {
      this.sz = sz;
      this.gridPositionsBuffer = this.app.createVertexBuffer(PicoGL.FLOAT, 2, mkGridPositions(sz));
      this.stonePositionsBuffer = this.app.createVertexBuffer(PicoGL.FLOAT, 2, mkStonePositions(sz));
      this.stoneDataBuffer = this.app.createVertexBuffer(PicoGL.FLOAT, 2, mkStoneData(sz));
      this.setupGPU();
    } else {
      this.stoneDataBuffer.data(mkStoneData(sz));
    }
  }
}
