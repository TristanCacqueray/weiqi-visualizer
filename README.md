# weiqi-visualizer

[![npm](https://img.shields.io/npm/v/weiqi-visualizer)](https://www.npmjs.com/package/weiqi-visualizer)

A [weiqi](https://en.wikipedia.org/wiki/Go_(game)) board visualizer.

[<img src="https://github.com/user-attachments/assets/d9b2094e-4f4a-4669-b2ab-1bb2e8eaa0f6">](https://tristancacqueray.github.io/weiqi-visualizer/)

Available controls:

- Click to start playing.
- Play step by step with the <kbd><</kbd> and <kbd>></kbd> button.
- Change the playback speed with wheel.

## Usage

Render a SGF file using:

```html
  <script type="module" src="weiqi-visualizer.js"></script>
  <weiqi-visualizer href="./my-game.sgf">
  </weiqi-visualizer>
```

Available properties:

- sgf: *text*, The game file content
- move: *number*, Load a given position
- autoplay: *bool*, Start playing
- speed: *float*, Playback speed
- href: *url*, Remote sgf location

Usage example:

```html
  <weiqi-visualizer
    href="24-gokifu-19331016-Honinbo_Shusai-Go_Seigen.sgf"
    speed=1.5
    autoplay>
  </weiqi-visualizer>
```

CSS default variable available:

```css
    /* Black stone colors */
    var(--wv-color-black, #EA55B1);
    /* White stone colors */
    var(--wv-color-white, #A992FA);
    /* Hoshi colors */
    var(--wv-color-hoshi, #FEC763);
    /* Grid lines colors */
    var(--wv-color-grid, #333333);

    /* The main background */
    var(--wv-color-bg, #111);
    /* UI backdrop */
    var(--wv-color-bg2, #222);
    /* UI color */
    var(--wv-color-fg, #ddd);
    /* UI button colors */
    var(--wv-color-btn, #666);
    var(--wv-color-btn-over, #888);
```

See the [index.html](./src/index.html) for a full demo.
