// Copyright (C) 2024 Tristan de Cacqueray
// SPDX-License-Identifier: GPL-3.0
//
// This module contains the visualizer entrypoint.
import { getMoves } from "./game.js";
import { initialize } from "./render.js";
import { mkController } from "./ui.js";

export function render(elt, sgf) {
  // Get game info and list of moves
  const [inf, moves] = getMoves(sgf);
  console.log(inf, moves);

  // Setup the display
  elt.style.display = "flex";
  elt.style["flex-direction"] = "column";
  elt.style["align-items"] = "center";

  const display = initialize(elt, window.location.hash == "#debug");
  const controllers = mkController(inf, moves.length);
  elt.appendChild(controllers.elt);

  /// The animation state
  // auto playing
  let playing = true;
  // animation speed
  let speed = 1;
  // the timestamp of the last move
  let lastMoveTS = 0;
  // the current move
  let pos = 0;

  const updatePos = (newPos, iTime, source) => {
    if (newPos < 0 || newPos > moves.length) {
      // out of bound move, stop the animation
      playing = false;
      return;
    }
    if (iTime === 0) {
      iTime = performance.now();
    }

    // Update the stone attributes
    const attributes = display.stones.geometry.attributes;

    let start = pos;
    let end = newPos;
    let dir = Math.sign(newPos - pos);
    if (dir < 0) {
      // When moving backward, we start by undoing the last move
      start = pos - 1;
      end = newPos - 1;
    }
    for (let next = start; next != end; next += dir) {
      // console.log(dir < 0 ? "Removing" : "Applying", next);
      moves[next].forEach(([x, y, psign, nsign]) => {
        const i = 3 * (9 + x + y * 19);
        let sign = nsign;
        if (dir < 0) {
          sign = psign;
        }
        attributes.data.array[i] = sign; // (1 + sign) / 0.8;
        attributes.data.array[i + 1] = Math.abs(sign);
        attributes.data.array[i + 2] = iTime;
      });
      // Add a slight delay when jumping long distance with the slider
      iTime += 2;
    }
    attributes.data.needsUpdate = true;
    pos = newPos;
    // Update the play button with the current pos
    controllers.play.innerHTML = pos;
    if (source !== "slider") {
      // Update the slider position
      controllers.slider.value = pos;
    }
  };

  const onStep = (ev) => {
    playing = false;
    if (ev.target.textContent == ">") {
      updatePos(pos + 1, 0);
    } else {
      updatePos(pos - 1, 0);
    }
  };
  controllers.prev.onclick = onStep;
  controllers.next.onclick = onStep;

  controllers.play.onclick = () => {
    if (pos >= moves.length) {
      console.log("HERE");
      updatePos(0, -100);
      playing = true;
    } else {
      // Toggle pause
      playing = !playing;
      // ensure next move happens right away
      lastMoveTS = 0;
    }
  };
  controllers.slider.oninput = (ev) => {
    playing = false;
    updatePos(parseInt(ev.target.value), 0, "slider");
  };
  controllers.speed.onchange = (ev) => {
    // update animation speed from selection value
    speed = ev.target.value;
  };
  controllers.speed.onwheel = (ev) => {
    // adjust the animation speed from the mouse scroll event
    speed -= ev.deltaY / 1000.0;
    // use the hidden custom option
    controllers.custom.value = speed;
    controllers.custom.innerHTML = "x" + speed.toFixed(2);
    controllers.custom.style.display = "block";
    controllers.speed.selectedIndex = 0;
  };

  const animate = () => {
    const iTime = performance.now();
    if (playing) {
      if (iTime - lastMoveTS > 200 / speed) {
        // The last move was played long ago, move on to the next one
        lastMoveTS = iTime;
        updatePos(pos + 1, iTime);
      }
    }
    display.uniforms.iTime.value = iTime;
    display.draw();
  };

  const requestedPos = parseInt(window.location.hash.slice(1));
  if (requestedPos > 0) {
    updatePos(requestedPos, -100);
    playing = false;
  }
  display.renderer.setAnimationLoop(animate);
}
