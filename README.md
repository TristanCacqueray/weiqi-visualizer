# weiqi-visualizer

A weiqi board visualizer.

[<img src="https://github.com/user-attachments/assets/d9b2094e-4f4a-4669-b2ab-1bb2e8eaa0f6">](https://tristancacqueray.github.io/weiqi-visualizer/)

## Usage

Render a SGF file using:

```html
  <script type="module" src="weiqi-visualizer/index.js"></script>
  <weiqi-visualizer href="24-gokifu-19331016-Honinbo_Shusai-Go_Seigen.sgf">
  </weiqi-visualizer>
```

Available properties:

- sgf: *text*, The game file content
- move: *number*, Load a given position
- autoplay: *bool*, Start playing
- speed: *float*, Playback speed
- href: *url* Remote sgf url

Usage example:

```html
  <weiqi-visualizer
    href="24-gokifu-19331016-Honinbo_Shusai-Go_Seigen.sgf"
    autoplay>
  </weiqi-visualizer>
```

CSS variable available:

```css
    /* Black stone colors */
    --clr-black: var(--wv-color-black, #EA55B1);
    /* White stone colors */
    --clr-white: var(--wv-color-white, #A992FA);
    /* Hoshi colors */
    --clr-hoshi: var(--wv-color-hoshi, #FEC763);
    /* Grid lines colors */
    --clr-grid: var(--wv-color-grid, #333333);

    /* The main background */
    --clr-bg: var(--wv-color-bg, #111);
    /* UI backdrop */
    --clr-bg2: var(--wv-color-bg2, #222);
    /* UI color */
    --clr-fg: var(--wv-color-fg, #ddd);
    /* UI button colors */
    --clr-bg-btn: var(--wv-color-btn, #666);
    --clr-over-btn: var(--wv-color-btn-over, #888);
```

See the [index.html](./src/index.html) for a full demo.
