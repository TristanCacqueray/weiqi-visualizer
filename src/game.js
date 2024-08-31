// Copyright (C) 2024 Tristan de Cacqueray
// SPDX-License-Identifier: GPL-3.0
//
// This module contains the game logic.
import * as sgf from "@sabaki/sgf";
import GameTree from "@sabaki/immutable-gametree";
import Board from "@sabaki/go-board";

// Helper to process a Generator
const genMap = (gen, f) => {
  while (true) {
    const ev = gen.next();
    if (ev.done) {
      break;
    }
    f(ev.value);
  }
};

const getGameInfo = (data) => ({
  date: data.DT[0],
  size: parseInt(data.SZ[0]),
  white: { name: data.PW[0], rank: data.WR ? data.WR[0] : null },
  black: { name: data.PB[0], rank: data.BR ? data.BR[0] : null },
});

// Convert 'ab' notation into vertex coordinate [0, 1]
const getVertex = (coord) => {
  const getPos = (at) => coord.charCodeAt(at) - 97;
  return [getPos(0), getPos(1)];
};

// Convert 'W[ab]' into a move
const getMove = (data) => {
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
};

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
    return move;
  };
  const moves = [mkMove(head, [])];
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
        events.push([vertex[0], vertex[1], board.get(vertex), nextBoard.get(vertex)]);
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
