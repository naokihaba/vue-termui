# Specialized components

Import these components and their supporting types from `vue-termui`.

## Markdown

`Markdown` renders terminal Markdown with syntax highlighting. Pass Markdown source through `content` and the required `SyntaxStyle` through `syntaxStyle`. Build the style with `SyntaxStyle.fromStyles`; headings, lists, emphasis, code fences, tables, and links use it. Set `:conceal="false"` to show Markdown markers.

It is a functional wrapper and does not expose a component instance. Use normal layout props to constrain long content or place it in a `ScrollBox` when it needs a viewport.

## Image

`Image` loads and renders terminal images asynchronously. Pass an `ImageSource` through `source` and provide a useful width, height, or flex constraint because an image has no intrinsic terminal layout size.

Use `fit` to control how the image fills its bounds: `'fit'` preserves the whole
image, `'cover'` fills and crops, and `'fill'` stretches to the exact bounds.
There is no `'contain'` value. Handle `load` and `error` for lifecycle state.
When imperative coordination is necessary, a stateful `Image` ref exposes its
native renderable through `$el`, including `loadPromise`. Prefer reactive props
and events when they express the operation.

`NativeImage` is the decoded image type accepted by `source`. Use its loading, decoding, RGBA, and resizing APIs when image data must be prepared before rendering. `ImageLoadError`, `ImageFit`, `ImageProtocol`, `ImageSource`, and the component prop/element types are also exported from `vue-termui`.
