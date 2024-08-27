// Copyright (C) 2024 Tristan de Cacqueray
// SPDX-License-Identifier: GPL-3.0
//
// This module contains the web component.

import { initialize } from "./render.js";
import { getMoves } from "./game.js";

// Prepare the template from external file using vite raw import
const template = document.createElement("template");
import templateBody from "./template.html?raw";
template.innerHTML = templateBody;

// Setup the state
const mkState = (elt) => ({
  // how to render the ui, vertical or horizontal
  orientation: null,
  // playing status
  playing: false,
  animating: false,
  // animation speed
  speed: 1,
  // the current move
  move: 0,
  moves: [],
  // the timestamp of the last move
  lastMoveTS: 0,
  // controllers element
  play: elt.getElementById("play"),
  prev: elt.getElementById("prev"),
  next: elt.getElementById("next"),
  slider: elt.getElementById("slider"),
  board: elt.getElementById("board"),
  // display elements
  elt: elt.getElementById("root"),
  players: elt.getElementById("players"),
  playerBlack: elt.getElementById("player-black"),
  playerWhite: elt.getElementById("player-white"),
  controllers: elt.getElementById("controllers"),

  // speed elements
  speedSelector: elt.getElementById("speed"),
  speedCustom: elt.getElementById("custom"),
});

class WeiqiVisualizer extends HTMLElement {
  static observedAttributes = [
    // text: The game file content
    "sgf",
    // number: Load a given position
    "move",
    // bool: Start playing
    "autoplay",
    // float: Playback speed
    "speed",
    // url: Remote sgf url
    "href",
  ];
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    // setup state
    this.model = mkState(this.shadowRoot);

    // setup controllers event handler
    setupControllers(this.model);

    // setup layout
    this.resizeObserver = onResize(this.model.elt, (contentRect) =>
      handleResize(this.model, contentRect.width, contentRect.height),
    );
  }

  disconnectedCallback() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }

  attributeChangedCallback(name, oldValue, newValue) {
    console.log("Loading attribute", name, newValue.slice(0, 42));
    const setSGF = (sgf) => {
      // Parse the sgf and update infos
      setSgf(this.model, sgf);
      // this.model.info.size = 9;
      this.model.display = initialize(
        this.model.board,
        getColors(this),
        this.model.info.size,
      );
      // Apply the move set through property
      setMove(this.model, this.propMove || 0, -10.0);
    };
    if (name === "move") {
      // Save the value in case the sgf is loaded after
      this.propMove = parseInt(newValue);
      // Apply the move if the sgf is already loaded
      setMove(this.model, this.propMove);
    } else if (name === "sgf") {
      setSGF(newValue);
    } else if (name == "autoplay") {
      this.model.playing = true;
      // this.model.draw();
    } else if (name == "speed") {
      setSpeed(this.model, parseFloat(newValue));
    } else if (name == "href") {
      fetch(newValue)
        .then((r) => r.text())
        .then((res) => setSGF(res));
    }
  }
}

function draw(model) {
  model.drawingStart = model.display.regl.now();
  // We are already drawing...
  if (model.animating) return;
  model.animating = true;
  const animate = () => {
    const iTime = model.display.regl.now();
    if (model.playing) {
      if (iTime - model.lastMoveTS > 0.5 / model.speed) {
        // The last move was played long ago, move on to the next one
        model.lastMoveTS = iTime;
        setMove(model, model.move + 1, iTime);
      }
    } else if (iTime - model.drawingStart > 1) {
      model.animating.cancel();
      model.animating = false;
    }
    model.display.drawFrame();
  };
  model.animating = model.display.regl.frame(animate);
}

function setSgf(model, sgf) {
  // console.log("Loading...", sgf);
  const [info, moves] = getMoves(sgf);
  model.info = info;
  model.moves = moves;
  model.slider.max = moves.length;
  model.move = 0;
  model.playerBlack.innerHTML = info.black.name;
  model.playerWhite.innerHTML = info.white.name;
  model.playersSize = model.players.getBoundingClientRect();
}

function setMove(model, move, iTime, source) {
  if (move < 0 || move > model.moves.length) {
    // out of bound move, stop the animation
    model.playing = false;
    return;
  }
  if (!iTime) {
    // record the move time for controller events (the animation provides the uniform one).
    iTime = model.display.regl.now();
  }

  // Update the stone attributes
  let start = model.move;
  let end = move;
  let dir = Math.sign(move - model.move);
  if (dir < 0) {
    // When moving backward, we start by undoing the last move
    start = model.move - 1;
    end = move - 1;
  }
  for (let next = start; next != end; next += dir) {
    // console.log(dir < 0 ? "Removing" : "Applying", next);
    model.moves[next].forEach(([x, y, psign, nsign]) => {
      const i = 3 * (9 + x + y * 19);
      let sign = nsign;
      if (dir < 0) {
        sign = psign;
      }
      model.display.setStone(x, y, sign, Math.abs(sign), iTime);
    });
    // Add a slight delay when jumping long distance with the slider
    iTime += 0.002;
  }
  draw(model);

  // Record the current move
  model.move = move;
  model.play.innerHTML = move;
  if (source !== "slider") {
    // Update the slider position
    model.slider.value = move;
  }
}

// Setup a resize handler
function onResize(elt, cb) {
  const resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      if (entry.contentBoxSize) cb(entry.contentRect);
    }
  });
  resizeObserver.observe(elt);
  return resizeObserver;
}

function handleResize(model, width, height) {
  // Get the maximum available square size
  const boardSize = Math.min(width, height);
  const availHeight = height - boardSize;
  const availWidth = width - boardSize;

  // Check if the controllers need to be vertical.
  const orientation = availHeight >= 20 ? "horizontal" : "vertical";

  // Update the css if needed
  if (model.orientation != orientation) {
    // Note that we could also use a css :state, but I find it cleaner that way...
    if (orientation == "vertical") {
      // Vertical: render the board and the controllers in a row
      model.elt.style["flex-direction"] = "row";
      // The players is vertical
      model.players.style["flex-direction"] = "column";
      // The controllers is a fixed column
      model.controllers.style["flex-direction"] = "column-reverse";
      model.controllers.style["width"] = "28px";
      model.controllers.style["height"] = "100%";
      // The slider is vertical
      model.slider.style["margin"] = "8px 0";
      model.slider.style["writing-mode"] = "vertical-lr";
      model.slider.style["direction"] = "rtl";
    } else {
      // Horizontal: render the board and the controllers in a column
      model.elt.style["flex-direction"] = "column";
      // The players is vertical
      model.players.style["flex-direction"] = "row";
      // The controller is a fixed row
      model.controllers.style["flex-direction"] = "row";
      model.controllers.style["width"] = "100%";
      model.controllers.style["height"] = "20px";
      // Ensure the slider is horizontal
      model.slider.style["margin"] = "0 8px";
      model.slider.style["writing-mode"] = "horizontal-tb";
      model.slider.style["direction"] = "ltr";
    }
    model.orientation = orientation;
    model.playersSize = model.players.getBoundingClientRect();
  }

  // If the ui is too small, hide the players' name.
  if (
    (orientation == "vertical" &&
      width - boardSize - 28 < model.playersSize.width) ||
    (orientation == "horizontal" &&
      height - boardSize - 20 < model.playersSize.height)
  ) {
    model.players.style["display"] = "none";
  } else {
    model.players.style["display"] = "flex";
  }

  // If the ui is too small, hide the slider.
  if (boardSize < 169) {
    model.slider.style["display"] = "none";
  } else {
    model.slider.style["display"] = "block";
  }

  // Adjust the controller margin to push it away if possible
  const topMargin =
    orientation == "vertical" ? 0 : Math.max(0, Math.min(5, availHeight - 20));
  const leftMargin =
    orientation == "horizontal" ? 0 : Math.max(0, Math.min(5, availWidth - 28));
  model.controllers.style["margin"] = `${topMargin}px 0 0 ${leftMargin}px`;

  // Set the board dimention
  model.board.width = boardSize;
  model.board.height = boardSize;
  if (model.display) model.display.refresh();
}

// Decode colors from css vars, see the template
function getColors(elt) {
  const style = window.getComputedStyle(elt);
  const getColor = (cssVar) => {
    const value = style.getPropertyValue(cssVar);
    let m = value.match(/^#([0-9a-f]{3})$/i);
    if (m) {
      return [
        (parseInt(m[1].charAt(0), 16) * 0x11) / 255,
        (parseInt(m[1].charAt(1), 16) * 0x11) / 255,
        (parseInt(m[1].charAt(2), 16) * 0x11) / 255,
      ];
    }
    m = value.match(/^#([0-9a-f]{6})$/i);
    if (m) {
      return [
        parseInt(m[1].substr(0, 2), 16) / 255,
        parseInt(m[1].substr(2, 2), 16) / 255,
        parseInt(m[1].substr(4, 2), 16) / 255,
      ];
    }
    throw (
      cssVar + ": unsupported color: " + value + ", only #rrggbb is supported"
    );
  };
  return {
    black: getColor("--clr-black"),
    white: getColor("--clr-white"),
    hoshi: getColor("--clr-hoshi"),
    grid: getColor("--clr-grid"),
  };
}

function setSpeed(model, value) {
  model.speed = Math.max(0.001, value);
  // use the hidden custom option
  model.speedCustom.value = model.speed;
  model.speedCustom.innerHTML =
    "x" + model.speed.toFixed(model.speed >= 10 ? 0 : 1);
  model.speedCustom.style.display = "block";
  model.speedSelector.selectedIndex = 0;
}

function setupControllers(model) {
  const onStep = (ev) => {
    model.playing = false;
    if (ev.target.textContent == ">") {
      setMove(model, model.move + 1);
    } else {
      setMove(model, model.move - 1);
    }
  };
  model.prev.onclick = onStep;
  model.next.onclick = onStep;
  model.slider.oninput = (ev) => {
    setMove(model, parseInt(ev.target.value), 0, "slider");
  };

  const togglePlay = () => {
    if (model.move >= model.moves.length) {
      // reset
      setMove(model, 0);
      model.playing = true;
    } else {
      // Toggle pause
      model.playing = !model.playing;
      if (model.playing) draw(model);
      // ensure next move happens right away
      model.lastMoveTS = 0;
    }
  };

  // start/stop handler
  model.play.onclick = togglePlay;
  model.board.onclick = togglePlay;
  // speed handler
  model.speedSelector.onchange = (ev) => {
    // update animation speed from selection value
    model.speed = parseFloat(ev.target.value);
  };
  model.speedSelector.onwheel = (ev) => {
    // adjust the animation speed from the mouse scroll event
    setSpeed(
      model,
      model.speed - ev.deltaY / (model.speed >= 10 ? 100.0 : 1000.0),
    );
  };
}

customElements.define("weiqi-visualizer", WeiqiVisualizer);
