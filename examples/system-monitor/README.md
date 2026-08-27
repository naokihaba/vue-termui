# Pulse

A live system monitor built with `vue-termui`. It reads local CPU, memory, load,
uptime, and process data using Node APIs and standard Unix commands.

```bash
pnpm --filter @vue-termui/example-system-monitor dev
```

Use `↑`/`↓` or `j`/`k` to select a process, `c`/`m` to sort by CPU or memory,
`p` to pause updates, `r` to refresh, and `q` to quit.
