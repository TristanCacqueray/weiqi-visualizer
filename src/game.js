// Copyright (C) 2024 Tristan de Cacqueray
// SPDX-License-Identifier: GPL-3.0
//
// This module contains the game logic.
// The moves are arranged in a array of:
//   events: the affected positions
//   comment: an optional string
//   marks: the marked positions
import * as sgf from "@sabaki/sgf";
import GameTree from "@sabaki/immutable-gametree";
import Board from "@sabaki/go-board";

// Helper to process a Generator
function genMap(gen, f) {
  while (true) {
    const ev = gen.next();
    if (ev.done) {
      break;
    }
    f(ev.value);
  }
}

const getGameInfo = (data) => ({
  date: data.DT[0],
  size: parseInt(data.SZ[0]),
  white: { name: data.PW[0], rank: data.WR ? data.WR[0] : null },
  black: { name: data.PB[0], rank: data.BR ? data.BR[0] : null },
  result: data.RE ? data.RE[0] : null,
});

// Convert 'ab' notation into vertex coordinate [0, 1]
function getVertex(coord) {
  const getPos = (at) => coord.charCodeAt(at) - 97;
  return [getPos(0), getPos(1)];
}

// Convert 'W[ab]' into a move
function getMove(data) {
  let sign;
  let coord;
  if ("W" in data) {
    // A white stone
    sign = 1;
    coord = data.W;
  } else if ("B" in data) {
    // A black stone
    sign = -1;
    coord = data.B;
  } else {
    // TODO: handle non-stone move
    throw "Unknown event: " + data;
  }
  if (coord.length > 0) {
    return [sign, getVertex(coord[0])];
  } else return [sign, null];
}

export const symbols = ["a", "b", "c", "d", "e", "f"];
function getMarks(v, sz) {
  return v.map((s) => {
    const [x, y] = getVertex(s);
    let id = symbols.length;
    if (s[2] == ":") {
      const m = s.slice(3);
      const sid = symbols.indexOf(m);
      if (sid > -1) id = sid;
      else console.log("Unknown mark", s);
    } else console.log("Unknown tag?", s);
    return [x + y * sz, id + 1];
  });
}

export const getMoves = (sgfTxt) => {
  // Parse the sgf and setup a gametree
  let getId = (
    (id) => () =>
      id++
  )(0);
  let rootNodes = sgf.parse(sgfTxt, { getId });
  let gameTrees = rootNodes.map((rootNode) => {
    return new GameTree({ getId, root: rootNode });
  });

  // Traverse the tree horizontally
  let gen = gameTrees[0].listNodesHorizontally(0, 1);

  // Extract the game info from the first node
  const head = gen.next().value.data;
  const inf = getGameInfo(head);

  // Setup the game board
  let board = Board.fromDimensions(inf.size);

  // process every move
  const mkMove = (node, events) => {
    const move = { events };
    if (node.C) move.comment = document.createTextNode(node.C);
    if (node.LB) move.marks = getMarks(node.LB, inf.size);
    return move;
  };
  // TODO: handle handicaps
  const handicaps = [];
  const moves = [mkMove(head, handicaps)];
  genMap(gen, (value) => {
    const [sign, vertex] = getMove(value.data);
    const events = [];
    if (vertex !== null) {
      // play the move to get a new board
      const nextBoard = board.makeMove(sign, vertex, {
        preventOverwrite: true,
        preventSuicide: true,
        preventKo: true,
      });

      // collect the list of affected vertex and their prev/next values
      board.diff(nextBoard).forEach((vertex) => {
        events.push([vertex[0] + vertex[1] * inf.size, board.get(vertex), nextBoard.get(vertex)]);
      });
      board = nextBoard;
    } else {
      // TODO: handle PASS
      console.log(sign + ": PASS");
    }
    moves.push(mkMove(value.data, events));
  });
  return [inf, moves];
};
