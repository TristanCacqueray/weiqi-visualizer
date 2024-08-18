// Copyright (C) 2024 Tristan de Cacqueray
// SPDX-License-Identifier: GPL-3.0
//
// This module contains the controller ui.
function mkButton(name) {
  const elt = document.createElement("button");
  elt.innerHTML = name;
  return elt;
}

function mkOption(name, selected) {
  const elt = document.createElement("option");
  elt.value = parseFloat(name.slice(1));
  elt.innerHTML = name;
  if (selected) elt.selected = true;
  return elt;
}

export function mkController(inf, moveCount) {
  const elt = document.createElement("div");
  elt.style.color = "white";
  elt.style.background = "black";
  elt.style.display = "flex";
  elt.style.gap = "4px";
  elt.style["align-items"] = "center";
  elt.style.width = "100%"

  // elt.appendChild(document.createTextNode(inf.date));

  const prev = mkButton("<");
  const play = mkButton("0");
  play.style.width = "36px";
  const next = mkButton(">");
  elt.appendChild(prev);
  elt.appendChild(play);
  elt.appendChild(next);

  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = 1;
  slider.max = moveCount;
  slider.value = 1;
  slider.style["flex-grow"] = 1;
  slider.style.background = "#222";
  slider.style.height = "24px";
  slider.style.outline = "none";
  slider.style.cursor = "pointer";
  elt.appendChild(slider);

  const speed = document.createElement("select");
  const custom = document.createElement("option");
  custom.style.display = "none";
  speed.appendChild(custom);
  speed.appendChild(mkOption("x0.25"));
  speed.appendChild(mkOption("x0.5"));
  speed.appendChild(mkOption("x1", true));
  speed.appendChild(mkOption("x2"));
  speed.appendChild(mkOption("x4"));
  speed.appendChild(mkOption("x8"));
  speed.appendChild(mkOption("x16"));
  elt.appendChild(speed);

  return { elt, slider, prev, play, next, speed, custom };
}
