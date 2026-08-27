---
name: vue-termui
description: Build, refactor, debug, or extend Vue 3 terminal apps with vue-termui and OpenTUI. Use for components, layout, text, forms, selection, scrolling, focus, keyboard or mouse input, images, Markdown, renderer behavior, playground pages, and native component wrappers.
---

# vue-termui

Build terminal interfaces with Vue 3 and the public `vue-termui` API. This file covers layout and common components. Load a reference only when the task needs it:

- Markdown or images: [specialized components](references/components.md)
- Additional implementation patterns: [cookbook](references/cookbook.md)
- Focus, events, refs, renderer constraints, lifecycle, Vite, or 3D: [advanced](references/advanced.md)
- Core component implementation or a new wrapper: [component development](references/component-development.md)

## Essential rules

- In apps, import components, composables, and Vue APIs from `vue-termui`. Do not import from `vue` or `@opentui/core`.
- Use PascalCase public components. Treat `tui-*` tags as internal renderer hosts.
- Use `Box` for layout and `Text` for text. Do not rely on CSS, HTML, DOM APIs, or browser behavior.
- Keep text nodes inside `Text`. Its children must resolve directly to strings or
  text nodes: do not nest components or put conditional `<template>` fragments
  inside it. Compute conditional lines as strings, or use styled-text helpers
  for inline runs.
- Prefer percentage or flex sizing inside bordered containers. Terminal dimensions are measured in cells.
- Give `ScrollBox`, images, editors, and other content a useful constraint through width, height, or flex props.
- Use the existing component source, co-located spec, and a similar playground page as the current API reference.
- Keep changes focused. Run the narrowest relevant test, then `pnpm test:types` and `pnpm lint`.

## Choose a component

Import every item from `vue-termui`. Native layout and rendering options pass through unless the wrapper documents otherwise.

| Need                    | Component     | Important contract                                                                          |
| ----------------------- | ------------- | ------------------------------------------------------------------------------------------- |
| Layout, border, spacing | `Box`         | Flexbox container with padding, margin, borders, positioning, overflow, and mouse handlers. |
| Scrolling               | `ScrollBox`   | Scrollable container. Constrain its viewport.                                               |
| Styled text             | `Text`        | Slot content, colors, wrapping, and text attributes. Defaults to `flexShrink: 0`.           |
| Line breaks             | `Newline`     | `count` defaults to 1.                                                                      |
| Single-line editing     | `Input`       | Synchronized `v-model`; emits `input`, `change`, and `enter`.                               |
| Multi-line editing      | `Textarea`    | `v-model` seeds once; Meta or Cmd plus Enter emits `submit`.                                |
| Vertical choice         | `Select`      | `v-model` is the highlighted index; `select` commits an option.                             |
| Horizontal choice       | `TabSelect`   | `v-model` is the highlighted index; movement and commit use separate events.                |
| Progress                | `ProgressBar` | Horizontal bar with `value`, optional `max`, width, character, and colors.                  |

## Box

`Box` is the flexbox layout container. These value types repeat below:

- `Dimension`: a cell count such as `20`, `'auto'`, or a percentage such as `'50%'`
- `Color`: a named/hex string or an OpenTUI `RGBA` value (`ColorInput`)
- Gap/padding: a cell count or percentage; margin and position also accept `'auto'`

### Size and flex

| Props                                            | Values                                                                                                                               | What they do                                                                                                       |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `width`, `height`                                | `Dimension`                                                                                                                          | Set the box size. Borders and padding use space inside it.                                                         |
| `minWidth`, `minHeight`, `maxWidth`, `maxHeight` | `Dimension`                                                                                                                          | Limit the size produced by content or flex layout.                                                                 |
| `flexDirection`                                  | `'row'`, `'row-reverse'`, `'column'`, `'column-reverse'`                                                                             | Set the main axis and child order.                                                                                 |
| `flexGrow`                                       | `number`                                                                                                                             | Claim a share of unused space. `0` does not grow.                                                                  |
| `flexShrink`                                     | `number`                                                                                                                             | Set how much the box may shrink. Explicit numeric width/height defaults this to `0`; otherwise it defaults to `1`. |
| `flexBasis`                                      | `number`, `'auto'`                                                                                                                   | Set the initial main-axis size before growing or shrinking.                                                        |
| `flexWrap`                                       | `'no-wrap'`, `'wrap'`, `'wrap-reverse'`                                                                                              | Keep children on one line or wrap them across lines.                                                               |
| `justifyContent`                                 | `'flex-start'`, `'center'`, `'flex-end'`, `'space-between'`, `'space-around'`, `'space-evenly'`                                      | Position children on the main axis.                                                                                |
| `alignItems`                                     | `'auto'`, `'flex-start'`, `'center'`, `'flex-end'`, `'stretch'`, `'baseline'`, `'space-between'`, `'space-around'`, `'space-evenly'` | Align all children on the cross axis.                                                                              |
| `alignSelf`                                      | same values as `alignItems`                                                                                                          | Override the parent's cross-axis alignment for this box.                                                           |
| `gap`, `rowGap`, `columnGap`                     | `number`, percentage                                                                                                                 | Add space between children on both axes or one axis.                                                               |

Numeric sizes are terminal cells. Percentage dimensions and flex growth adapt to available space. A fixed width can overflow a parent's interior because borders and padding consume cells; use `width="100%"` or `flexGrow` inside framed layouts.

```vue-html
<Box :width="60" :height="12" flexDirection="column" :gap="1" border :padding="1">
  <Box flexDirection="row" alignItems="center" :columnGap="2">
    <Text>Fixed</Text>
    <Box :flexGrow="1"><Text>Uses remaining width</Text></Box>
  </Box>
  <Box :flexGrow="1" justifyContent="center" alignItems="center">
    <Text>Centered in remaining space</Text>
  </Box>
</Box>
```

### Spacing

| Props                                                        | Values               | What they do                                                      |
| ------------------------------------------------------------ | -------------------- | ----------------------------------------------------------------- |
| `padding`                                                    | `number`, percentage | Set inner spacing on all sides.                                   |
| `paddingX`, `paddingY`                                       | `number`, percentage | Set left/right or top/bottom inner spacing.                       |
| `paddingTop`, `paddingRight`, `paddingBottom`, `paddingLeft` | `number`, percentage | Set one inner side. Side props override broader shorthands.       |
| `margin`                                                     | `Dimension`          | Set outer spacing on all sides. `'auto'` absorbs available space. |
| `marginX`, `marginY`                                         | `Dimension`          | Set left/right or top/bottom outer spacing.                       |
| `marginTop`, `marginRight`, `marginBottom`, `marginLeft`     | `Dimension`          | Set one outer side. Side props override broader shorthands.       |

### Position and overflow

| Props                            | Values                                 | What they do                                                                                                  |
| -------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `position`                       | `'static'`, `'relative'`, `'absolute'` | Use normal flow, offset normal flow, or remove the box from flow.                                             |
| `top`, `right`, `bottom`, `left` | `Dimension`                            | Offset a relative/absolute box from the named edge.                                                           |
| `zIndex`                         | `number`                               | Set sibling paint order; larger values paint later.                                                           |
| `overflow`                       | `'visible'`, `'hidden'`, `'scroll'`    | Paint overflow, clip it, or give Yoga scroll overflow semantics. Use `ScrollBox` for an interactive viewport. |

### Border and fill

| Props                                    | Values                                                                                                      | What they do                                                                                  |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `backgroundColor`                        | `Color`                                                                                                     | Set the cell background.                                                                      |
| `shouldFill`                             | `boolean`                                                                                                   | Fill the box background; defaults to `true`. Disable for border-only drawing.                 |
| `border`                                 | `boolean`, array of `'top'`, `'right'`, `'bottom'`, `'left'`                                                | Draw all border sides or only selected sides.                                                 |
| `borderStyle`                            | `'single'`, `'double'`, `'rounded'`, `'heavy'`                                                              | Select border characters.                                                                     |
| `customBorderChars`                      | `{ topLeft, topRight, bottomLeft, bottomRight, horizontal, vertical, topT, bottomT, leftT, rightT, cross }` | Replace every border character.                                                               |
| `borderColor`                            | `Color`                                                                                                     | Set the normal border color.                                                                  |
| `focusedBorderColor`                     | `Color`                                                                                                     | Set the border color while this box or a descendant has focus. The box need not be focusable. |
| `title`, `bottomTitle`                   | `string`                                                                                                    | Put text in the top or bottom border.                                                         |
| `titleColor`                             | `Color`                                                                                                     | Set title text color.                                                                         |
| `titleAlignment`, `bottomTitleAlignment` | `'left'`, `'center'`, `'right'`                                                                             | Align the matching border title.                                                              |

```vue-html
<Box
  :border="['top', 'bottom']"
  borderStyle="rounded"
  borderColor="#666"
  focusedBorderColor="#42b883"
  title=" Results "
  titleAlignment="center"
  backgroundColor="#111"
  :paddingX="2"
>
  <Text>Content</Text>
</Box>
```

### Visibility, focus, and identity

| Props                              | Values                      | What they do                                                                               |
| ---------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------ |
| `id`                               | `string`                    | Identify the native renderable for lookup and debugging.                                   |
| `visible`                          | `boolean`                   | Show the box. `false` removes it from flex layout and blurs it.                            |
| `opacity`                          | `number`                    | Set subtree opacity, clamped to `0`–`1`.                                                   |
| `focusable`                        | `boolean`                   | Allow focus; defaults to `false` for `Box`.                                                |
| `autofocus`                        | `boolean`                   | Focus on mount when focusable. The first mounted autofocus target wins.                    |
| `onFocus`, `onBlur`, `onDestroyed` | functions with no arguments | Handle wrapper lifecycle events; template equivalents are `@focus`, `@blur`, `@destroyed`. |
| `onSizeChange`                     | function with no arguments  | Run after layout changes the rendered width or height.                                     |

### Input handlers

All handlers receive the native event. Keyboard and paste handlers only run while the box is focused, so also set `focusable`.

| Props                                          | What they handle                         |
| ---------------------------------------------- | ---------------------------------------- |
| `onMouse`                                      | Every mouse event.                       |
| `onMouseDown`, `onMouseUp`, `onMouseMove`      | Button and pointer movement.             |
| `onMouseDrag`, `onMouseDragEnd`, `onMouseDrop` | Drag lifecycle.                          |
| `onMouseOver`, `onMouseOut`, `onMouseScroll`   | Hover boundaries and wheel/scroll input. |
| `onKeyDown`                                    | Focused keyboard input.                  |
| `onPaste`                                      | Focused paste input.                     |

### Low-level rendering

These native OpenTUI props are only relevant to custom rendering or animation:

| Props                         | Values                        | What they do                                                                                |
| ----------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------- |
| `buffered`                    | `boolean`                     | Render through a box-sized offscreen buffer. Set it when the box is created.                |
| `live`                        | `boolean`                     | Keep the renderer's live loop active for continuous updates.                                |
| `renderBefore`, `renderAfter` | `(buffer, deltaTime) => void` | Draw immediately before or after the box.                                                   |
| `enableLayout`                | `boolean`                     | Present in OpenTUI's public option type but currently has no runtime effect. Do not use it. |

Put layout siblings in a `Box`. Give `ScrollBox` a width, height, or flex constraint so it has a viewport. Its `scrollX` and `scrollY` options are constructor-only; change a `:key` to remount when they must change.

## Text

Put every visible string and interpolation inside `Text`. `Text` accepts slot content plus `fg`, `bg`, `wrap`, `bold`, `dim`, `italic`, `underline`, `strikethrough`, `inverse`, and `blink`.

Do not nest `Text`. For inline colors or attributes, pass `content` built with `t`, `fg`, `bg`, `bold`, `italic`, and the other styled-text helpers exported by `vue-termui`.

`Text` defaults to `flexShrink: 0`. A flex-shrunk wrapped text renderable can paint over following rows, so override this only with a tested layout. Use `Newline` for one or more explicit line breaks.

## Common component contracts

- `Input` is controlled through `v-model`. `input` fires for each edit, `change` after a committed change, and `enter` on Return.
- `Textarea` uses its model as the initial buffer, then owns its cursor, undo history, and content. Changing the model later does not replace the buffer. Change a `:key` to reset it. Meta or Cmd plus Enter emits `submit`.
- `Select` and `TabSelect` models contain an option index, not its value. `Select` options require `name` and can include `description` and `value`; it emits `select(option, index)` on commit. `TabSelect` options require `name` and `description`; it emits `changed` on movement and `selected` on commit.
- `ProgressBar` requires `value`; `max` defaults to 1, numeric `width` to 25, and
  `char` to `█`. Its width is a cell count, not a general layout `Dimension`, so
  percentages such as `width="100%"` are invalid. Derive a responsive number
  from `useTerminalSize`. Use `color` and `trackColor` for its filled and empty
  cells.
- `Input`, `Textarea`, `Select`, `TabSelect`, and `ScrollBox` are focusable by default. Use `autofocus` for the initial target and `focusable="false"` to remove an element from managed navigation. The first mounted autofocus target wins. A focused `ScrollBox` supports arrows, `hjkl`, PageUp/PageDown, Home/End, and the mouse wheel.

## Basic composition

```vue
<script setup lang="ts">
import { Box, Input, ref, Text } from 'vue-termui'

const name = ref('')
</script>

<template>
  <Box flexDirection="column" :gap="1" borderStyle="rounded" :padding="1">
    <Text bold fg="#42b883">Profile</Text>
    <Input v-model="name" width="100%" placeholder="Name" autofocus />
    <Text dim>{{ name || 'Waiting for input' }}</Text>
  </Box>
</template>
```

## Runtime

Creating an OpenTUI renderer requires Node.js 26.3 or newer with `--experimental-ffi`. Renderer tests use:

```bash
NODE_OPTIONS='--experimental-ffi --disable-warning=ExperimentalWarning' pnpm exec vitest run <spec>
```

The playground dev command already supplies the required flag:

```bash
pnpm --filter playground dev
```

For standalone apps and examples, typechecking and building cannot catch every
native render-tree constraint. After those checks, launch the built app briefly
under the real renderer, exercise at least one interaction, and quit cleanly:

```bash
node --experimental-ffi --disable-warning=ExperimentalWarning dist/main.js
```
