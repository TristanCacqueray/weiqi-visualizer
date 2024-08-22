// Copyright (C) 2024 Tristan de Cacqueray
// SPDX-License-Identifier: GPL-3.0
//
// This module contains the render logic.
import * as THREE from "three";
import Stats from "three/addons/libs/stats.module.js";
import { GUI } from "three/addons/libs/lil-gui.module.min.js";

// Stone vertex shader
const vertexShader = `
// The board size, in pixel
uniform float iSize;
// The current time
uniform float iTime;
uniform vec3 iClrBlack;
uniform vec3 iClrWhite;
uniform vec3 iClrHoshi;

// data contains [color hue, size, birth]
attribute vec3 data;

// The fragment color
varying vec3 vColor;
// The stone age, to make it grow
varying float vAge;

void main() {
  if (data.y > 0.) {
  if (data.x == 0.5) {
    vColor = iClrHoshi;
  } else if (data.x == 1.) {
    vColor = iClrWhite;
  } else {
    vColor = iClrBlack;
  }

  gl_PointSize = data.y * iSize * 0.05;
  vAge = (iTime - data.z) * 0.005;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
  }
}
`;

// Stone fragment shader
const fragShader = `
varying vec3 vColor;
varying float vAge;

void main() {
    float size = min(0.48, vAge/(1.+ vAge));
    vec2 uv = gl_PointCoord.xy - .5;
    float dist = length(uv);
    vec3 col = vColor * (1.-smoothstep(0.33,0.45,dist))
    ;

    if (length(uv) < size) { gl_FragColor = vec4(col,0.) ;   }
    else { discard; }
}
`;

function drawGrid(color) {
  const geometry = new THREE.BufferGeometry();
  const material = new THREE.LineBasicMaterial({ color });

  const indices = [];
  const positions = [];
  let next_position_index = 0;
  const drawLine = (start, end) => {
    positions.push(start.x, start.y, 0);
    positions.push(end.x, end.y, 0);
    next_position_index += 2;
    indices.push(next_position_index - 1, next_position_index);
  };

  for (let x = 0; x < 19; x++) {
    const pos = -3 + x / 3;
    drawLine({ x: pos, y: 3 }, { x: pos, y: -3 });
    drawLine({ y: pos, x: 3 }, { y: pos, x: -3 });
  }
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.computeBoundingSphere();

  return new THREE.LineSegments(geometry, material);
}

const debug = false;
export function initialize(container, colors) {
  console.log("Initializing three.js with", colors);
  // Setup camera, looking at a 7x7 grid centered on zero
  const size = 6.5;
  const camera = new THREE.OrthographicCamera(
    size / -2,
    size / 2,
    size / 2,
    size / -2,
    0, // near
    1, // far
  );

  // Setup renderer
  const renderer = new THREE.WebGLRenderer({ alpha: true });
  // renderer.setPixelRatio(window.devicePixelRatio);
  // renderer.toneMapping = THREE.NeutralToneMapping;
  container.innerHTML = "";
  container.appendChild(renderer.domElement);

  // Add stat widget
  let stats;
  if (debug) {
    stats = new Stats();
    container.appendChild(stats.dom);
  }

  // Setup scene
  const scene = new THREE.Scene();
  // scene.background = new THREE.Color(0x101010);
  scene.add(drawGrid(new THREE.Color(colors.grid)));

  // Setup points
  const hoshis = 3 * 3;
  const amount = hoshis + 19 * 19;

  const positions = new Float32Array(amount * 3);
  const data = new Float32Array(amount * 3);
  const vertex = new THREE.Vector3();

  // Setup hoshis
  for (let x = 0; x < 3; x++) {
    for (let y = 0; y < 3; y++) {
      vertex.x = -2 + x * 2;
      vertex.y = -2 + y * 2;
      vertex.z = 0.0;
      const i = 3 * (x + y * 3);
      vertex.toArray(positions, i);
      // color
      data[i] = 0.5;
      // size
      data[i + 1] = 0.2;
      // birth
      data[i + 2] = -100;
    }
  }

  // Setup stones
  for (let x = 0; x < 19; x++) {
    for (let y = 0; y < 19; y++) {
      vertex.x = -3 + x / 3;
      vertex.y = 3 + y / -3;
      vertex.z = 0.0;
      const i = 3 * (hoshis + x + y * 19);
      vertex.toArray(positions, i);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("data", new THREE.BufferAttribute(data, 3));
  geometry.computeBoundingSphere();
  const uniforms = {
    iTime: { value: 0.0 },
    iSize: { value: 800.0 },
    iClrBlack: { value: new THREE.Color(colors.black) },
    iClrWhite: { value: new THREE.Color(colors.white) },
    iClrHoshi: { value: new THREE.Color(colors.hoshi) },
  };
  var stones = new THREE.Points(
    geometry,
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: vertexShader,
      fragmentShader: fragShader,
      depthWrite: false,
      depthTest: false,
    }),
  );
  scene.add(stones);

  return {
    renderer,
    uniforms,
    stones,
    setSize: (s) => {
      uniforms.iSize.value = s;
      renderer.setSize(s, s);
      renderer.render(scene, camera);
    },
    draw: () => {
      renderer.render(scene, camera);
      if (debug) stats.update();
    },
  };
}
