# Advanced usage

## Focus

- OpenTUI has no automatic global Tab order. Use `useFocusManager` for an ordered group and call `focus()` deliberately.
- The focus composable exposes a function ref for template binding. A normal ref object can be unwrapped to `null` by `<script setup>` when destructured.
- Set `focusable="false"` on interactive elements that should not participate. Containers are not focusable by default.
- A focused descendant can drive a `Box` border through `focusedBorderColor` without making the box itself focusable.

## Input events

- Use `onKeyDown` and `onKeyUp` composables for the renderer-wide keyboard stream.
- Use element `onKeyDown`, `onKeyUp`, and `onMouse*` props for local handling.
- Keyboard and mouse event modifiers are supported by the renderer integration. Mouse events bubble and support `stopPropagation()` and `preventDefault()` where applicable.
- Use `onPaste` for paste data and `decodePasteBytes` when text decoding is appropriate. Paste payloads can be binary.

## Refs and native access

Use `useTemplateRef` with stateful components, then reach the backing renderable through `$el`. This is useful for focus, scrolling, load state, and APIs that the wrapper intentionally leaves native, such as `scrollRef.value?.$el.scrollTo(0)` or an image's `$el.loadPromise`. Avoid native access when a reactive prop or emitted event already expresses the operation.

Functional wrappers such as `Text`, `Newline`, `ProgressBar`, and `Markdown` do not expose a component instance.

## Renderer constraints

- OpenTUI text nodes only belong inside a text renderable. Vue fragment anchors placed in layout containers are replaced internally with invisible box anchors.
- A lone string child of `Text` uses the fast content path. Interpolation or arrays can create text node renderables.
- A conditional `<template>` inside `Text` creates fragment anchors and can pass
  typechecking/building but fail when the native renderer mounts it. Compute the
  whole conditional line as a string, or render alternatives as separate
  `Text` components.
- Do not import another Vue runtime. A second `@vue/runtime-core` instance breaks vnode and provide/inject interoperability.
- `@opentui/core` is private to the library. Apps use types and helpers re-exported by `vue-termui`.

## Screen and lifecycle

- `useTerminalSize` updates reactively on resize.
- `useTitle` restores the title when its scope ends.
- `useInterval`, `useTimeout`, keyboard, resize, paste, and focus composables clean up with the Vue effect scope.
- `useRenderer` and `useExit` require an active vue-termui app context.
- Host APIs can be unavailable in containers or sandboxes even when Node exposes
  them (for example, `os.uptime()` can throw `EPERM`). Catch filesystem, process,
  network, and OS errors and keep the rest of the interface usable.
- Avoid top-level `await` in a root SFC's `<script setup>` unless the app supplies
  a Suspense boundary. It makes `setup()` async and an unsuspended root can mount
  blank. Initialize synchronously, then start asynchronous work in `onMounted`.

## Vite and SFCs

Use `vue-termui/vite` to compile `.vue` files for the custom renderer. Render functions using `h()` need no SFC plugin. Components and composables are explicitly imported; there is no auto-import or component resolver.

With `exactOptionalPropertyTypes`, do not explicitly forward `undefined` to
native props (`:backgroundColor="selected ? color : undefined"`). Use a concrete
fallback, conditional `v-bind`, or omit the key from an object.

## Three-dimensional scenes

Use `@vue-termui/three` only for terminal Three.js WebGPU scenes. Import Vue APIs from `vue-termui`. Node requires `--experimental-ffi`; Bun uses native `bun:ffi`. Animate with `onFrame`. When integrating TresJS, follow the existing `TresTerminal.vue` adapter because browser canvas, pointer, and animation-loop assumptions do not apply in the terminal.
