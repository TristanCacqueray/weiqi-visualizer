// Copyright (C) 2024 Tristan de Cacqueray
// SPDX-License-Identifier: GPL-3.0
//
// This module contains the web component.

import { BoardRenderer } from "./render.js";
import { getMoves } from "./game.js";

// Prepare the template from external file using vite raw import
const template = document.createElement("template");
import templateBody from "./template.html?raw";
template.innerHTML = templateBody;

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
    this.orientation = null;
    this.playing = false;
    this.animating = false;
    this.speed = 1;
    this.propMove = 0;

    this.board = this.shadowRoot.getElementById("board");
    this.display = new BoardRenderer(this.board, getColors(window.getComputedStyle(this)));

    // setup controllers event handler
    this.setupControllers();

    // setup layout
    this.root = this.shadowRoot.getElementById("root");
    this.players = this.shadowRoot.getElementById("players");
    this.playerBlack = this.shadowRoot.getElementById("player-black");
    this.playerWhite = this.shadowRoot.getElementById("player-white");
    this.controllers = this.shadowRoot.getElementById("controllers");
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentBoxSize) this.handleResize(entry.contentRect.width, entry.contentRect.height);
      }
    });
    this.resizeObserver.observe(this);
  }

  connectedCallback() {
    if (this.playing) this.animate();
  }

  disconnectedCallback() {
    this.resizeObserver.disconnect();
    // TODO? dispose webgl content
  }

  attributeChangedCallback(name, oldValue, newValue) {
    // console.log("Loading attribute", name, newValue.slice(0, 42));
    if (name === "move") {
      if (this.display.moves.length > 0) {
        // Apply the move if the sgf is already loaded
        this.setMove(this.propMove);
      } else {
        // Save the value for the connectedCallback
        this.propMove = parseInt(newValue);
      }
    } else if (name === "sgf") {
      this.initialize(newValue);
    } else if (name == "autoplay") {
      this.playing = true;
    } else if (name == "speed") {
      this.setSpeed(parseFloat(newValue));
    } else if (name == "href") {
      fetch(newValue)
        .then((r) => r.text())
        .then((res) => this.initialize(res));
    }
  }

  setupControllers() {
    const elt = this.shadowRoot;

    const onStep = (ev) => {
      this.playing = false;
      const dir = ev.target.textContent == ">" ? 1 : -1;
      this.setMove(this.display.move + dir);
    };
    elt.getElementById("prev").onclick = onStep;
    elt.getElementById("next").onclick = onStep;

    this.slider = elt.getElementById("slider");
    this.slider.oninput = (ev) => {
      this.setMove(parseInt(ev.target.value), 0, "slider");
    };

    const togglePlay = () => {
      if (this.display.move >= this.display.moves.length) {
        // reset
        this.setMove(0);
        this.playing = true;
      } else {
        // Toggle pause
        this.playing = !this.playing;
        if (this.playing) this.animate();
        // ensure next move happens right away
        this.lastMoveTS = -1000;
      }
    };
    this.play = elt.getElementById("play");
    this.play.onclick = togglePlay;
    this.board.onclick = togglePlay;

    this.speedSelector = elt.getElementById("speed");
    this.speedCustom = elt.getElementById("custom");
    // speed handler
    this.speedSelector.onchange = (ev) => {
      // update animation speed from selection value
      this.speed = parseFloat(ev.target.value);
    };
    this.speedSelector.onwheel = (ev) => {
      // adjust the animation speed from the mouse scroll event
      this.setSpeed(this.speed - ev.deltaY / (this.speed >= 10 ? 100.0 : 1000.0));
    };
    this.board.onwheel = (ev) => {
      this.setMove(this.display.move + Math.floor(ev.deltaY / 126));
    };
  }

  setSpeed(value) {
    this.speed = Math.max(0.001, value);
    // use the hidden custom option
    this.speedCustom.value = this.speed;
    this.speedCustom.innerHTML = "x" + this.speed.toFixed(this.speed >= 10 ? 0 : 1);
    this.speedCustom.style.display = "block";
    this.speedSelector.selectedIndex = 0;
  }

  initialize(sgf) {
    const [info, moves] = getMoves(sgf);
    this.display.initialize(info.size, moves);
    this.playerBlack.innerHTML = info.black.name;
    this.playerWhite.innerHTML = info.white.name;
    this.playersSize = this.players.getBoundingClientRect();
    this.slider.max = moves.length;
    this.setMove(this.propMove);
  }

  animate() {
    this.lastMoveTS = this.drawingStart = performance.now();
    // We are already drawing...
    if (this.animating) return;
    this.animating = true;
    const nextFrame = () => {
      const iTime = performance.now();
      if (this.playing) {
        if (iTime - this.lastMoveTS > 500 / this.speed) {
          // The last move was played long ago, move on to the next one
          this.lastMoveTS = iTime;
          this.setMove(this.display.move + 1, iTime);
        }
      } else if (iTime - this.drawingStart > 1000) {
        this.animating = false;
        return;
      }
      this.display.draw(iTime);
      requestAnimationFrame(nextFrame);
    };
    nextFrame();
  }

  setMove(move, iTime, source) {
    if (move < 0 || move > this.display.moves.length) {
      // out of bound move, stop the animation
      this.playing = false;
      return;
    }
    if (!iTime) {
      // record the move time for controller events (the animation provides the uniform one).
      iTime = performance.now();
    }

    // Update the stone attributes
    let start = this.display.move;
    let end = move;
    let dir = Math.sign(end - start);
    if (dir < 0) {
      // When moving backward, we start by undoing the last move
      start--;
      end--;
    }
    const step = 200 / Math.abs(end - start);
    for (let next = start; next != end; next += dir) {
      // console.log(dir < 0 ? "Removing" : "Applying", next);
      this.display.moves[next].forEach(([x, y, psign, nsign]) => {
        let sign = nsign;
        let color = sign == 0 ? psign : nsign;
        if (dir < 0) {
          sign = psign;
          color = sign;
        }
        this.display.setStone(x, y, color, Math.abs(sign), iTime);
      });
      // Add a slight delay when jumping long distance with the slider
      iTime += step;
    }

    // Record the current move
    this.display.move = move;

    this.play.innerHTML = move;
    if (source !== "slider") {
      // Update the slider position
      this.slider.value = move;
    }

    this.animate();
  }
  handleResize(width, height) {
    // Get the maximum available square size
    const boardSize = Math.min(width, height);
    const availHeight = height - boardSize;
    const availWidth = width - boardSize;

    // Check if the controllers need to be vertical.
    const orientation = availHeight >= 20 ? "horizontal" : "vertical";

    // Update the css if needed
    if (this.orientation != orientation) {
      // Note that we could also use a css :state, but I find it cleaner that way...
      if (orientation == "vertical") {
        // Vertical: render the board and the controllers in a row
        this.root.style["flex-direction"] = "row";
        // The players are vertical
        this.players.style["flex-direction"] = "column";
        // The controller is a fixed column
        this.controllers.style["flex-direction"] = "column-reverse";
        this.controllers.style["width"] = "28px";
        this.controllers.style["height"] = "100%";
        // The slider is vertical
        this.slider.style["margin"] = "8px 0";
        this.slider.style["writing-mode"] = "vertical-lr";
      } else {
        // Horizontal: render the board and the controllers in a column
        this.root.style["flex-direction"] = "column";
        // The players are vertical
        this.players.style["flex-direction"] = "row";
        // The controller is a fixed row
        this.controllers.style["flex-direction"] = "row";
        this.controllers.style["width"] = "100%";
        this.controllers.style["height"] = "20px";
        // Ensure the slider is horizontal
        this.slider.style["margin"] = "0 8px";
        this.slider.style["writing-mode"] = "horizontal-tb";
      }
      this.orientation = orientation;
      this.playersSize = this.players.getBoundingClientRect();
    }

    // If the ui is too small, hide the players' name.
    if (
      (orientation == "vertical" && width - boardSize - 28 < this.playersSize.width) ||
      (orientation == "horizontal" && height - boardSize - 20 < this.playersSize.height)
    ) {
      this.players.style["display"] = "none";
    } else {
      this.players.style["display"] = "flex";
    }

    // If the ui is too small, hide the slider.
    if (boardSize < 169) {
      this.slider.style["display"] = "none";
    } else {
      this.slider.style["display"] = "block";
    }

    // Adjust the controller margin to push it away if possible
    const topMargin = orientation == "vertical" ? 0 : Math.max(0, Math.min(5, availHeight - 20));
    const leftMargin = orientation == "horizontal" ? 0 : Math.max(0, Math.min(5, availWidth - 28));
    this.controllers.style["margin"] = `${topMargin}px 0 0 ${leftMargin}px`;

    // Set the board dimention
    this.display.resize(boardSize);
  }
}

// Decode colors from css vars, see the template
function getColors(style) {
  const getColor = (cssVar) => {
    const value = style.getPropertyValue(cssVar);
    let m = value.match(/^#([0-9a-f]{3})$/i);
    if (m) {
      return [
        (parseInt(m[1].charAt(0), 16) * 0x11) / 255,
        (parseInt(m[1].charAt(1), 16) * 0x11) / 255,
        (parseInt(m[1].charAt(2), 16) * 0x11) / 255,
        1,
      ];
    }
    m = value.match(/^#([0-9a-f]{6})$/i);
    if (m) {
      return [
        parseInt(m[1].substr(0, 2), 16) / 255,
        parseInt(m[1].substr(2, 2), 16) / 255,
        parseInt(m[1].substr(4, 2), 16) / 255,
        1,
      ];
    }
    throw cssVar + ": unsupported color: " + value + ", only #rrggbb is supported";
  };
  return {
    black: getColor("--clr-black"),
    white: getColor("--clr-white"),
    hoshi: getColor("--clr-hoshi"),
    grid: getColor("--clr-grid"),
  };
}

customElements.define("weiqi-visualizer", WeiqiVisualizer);
