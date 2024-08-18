# weiqi-visualizer

A weiqi board visualizer.

[<img src="https://github.com/user-attachments/assets/d9b2094e-4f4a-4669-b2ab-1bb2e8eaa0f6">](https://tristancacqueray.github.io/weiqi-visualizer/)

## Usage

Render a SGF file using:

```html
  <div id="container"></div>
  <script type="module">
    // load sgf, see demo for file button implementation
    const sgf = "(;FF[4] SZ[19]; B[cd] (...))"

    import { render } from "weiqi-visualizer"
    render(document.getElementById("container"), sgf)
  </script>
```
