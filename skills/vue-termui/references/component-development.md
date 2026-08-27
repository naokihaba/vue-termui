# Component development

Read the target component, its co-located spec, `src/components/utils.ts`, `src/renderer/nodeOps.ts`, and the closest sibling before editing. Treat installed OpenTUI types and its bundled implementation as the source of truth.

## Choose a template

- Container: `Box` or `ScrollBox`
- Editable value: `Input` or `Textarea`
- List with a silent model property: `Select`
- List with only an imperative model method: `TabSelect`
- Pure composition: `ProgressBar`
- Thin functional wrapper: `Text`, `Newline`, or `Markdown`

Default to a stateful `defineComponent` typed as `TuiComponent<Props, Element>` so refs expose a concrete `$el`. Use a functional component only when no public instance, lifecycle, or exposed method is useful.

## Wrapper contract

- Extend native options and `Omit` options managed by the wrapper or not honored by it.
- Spread `attrs` for native fallthrough. Do not forward optional values as explicit `undefined`; use `optionalBooleanProps` or `optionalProp`.
- Extend `RenderableEventProps`, spread `renderableProps` and `renderableEmits`, and call `setupRenderableEvents` after mount.
- Declare runtime props only for values the wrapper consumes. This also provides Boolean coercion where required.
- Declare runtime emit validators and use `satisfies ExtractEventsNames<Props, NativeOptions>`.
- Consume native event payloads when available. Otherwise read the current value from the renderable when emitting.
- Prefer a silent property setter through Vue's prop path for outside-to-native synchronization.
- Use a guarded `watch` only when OpenTUI exposes an imperative `setX()` method. Guard native-to-Vue updates against `props.modelValue` to prevent loops.
- Import Vue runtime APIs from `@vue/runtime-core` inside the library.
- Do not require consumers to import `@opentui/core`. Re-export only deliberately reviewed public abstractions.
- Keep doc comments short and stable. Explain what an API is for and let types carry details.

## Add a native wrapper

1. List matching exports from `@opentui/core`.
2. Read the renderable `.d.ts` for options, events, and option types.
3. Search OpenTUI's bundled `index.js` for setters, emitted events, and default keybindings.
4. Write `src/components/<Name>.spec.ts` first and confirm the new behavior fails.
5. Implement `src/components/<Name>.ts` from the closest template.
6. Add the host tag to `TuiElementTag` and the `createElement` switch in `src/renderer/nodeOps.ts`.
7. Export the component and public types from `src/index.ts`.
8. Add a focused playground page and a sidebar entry.

For fixed-width native controls inside bordered boxes, use percentage or flex width. Numeric widths can exceed the parent's interior.

## Verification

```bash
NODE_OPTIONS='--experimental-ffi --disable-warning=ExperimentalWarning' pnpm exec vitest run src/components/<Name>.spec.ts
pnpm test:types
pnpm lint
```

Run `pnpm test` when the change crosses packages, renderer behavior, build output, or public types. Update `AGENTS.md` when commands, architecture, component behavior, or tooling changes.
