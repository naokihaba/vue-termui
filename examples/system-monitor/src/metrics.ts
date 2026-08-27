import { cpus, freemem, loadavg, totalmem, uptime } from 'node:os'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export interface ProcessInfo {
  pid: number
  cpu: number
  memory: number
  command: string
  user: string
}

export interface Metrics {
  cpu: number
  memory: number
  usedMemory: number
  totalMemory: number
  load: readonly number[]
  uptime: number
  processes: ProcessInfo[]
}

interface CpuSample {
  idle: number
  total: number
}

let previousCpu = sampleCpu()

function sampleCpu(): CpuSample {
  let idle = 0
  let total = 0
  for (const cpu of cpus()) {
    idle += cpu.times.idle
    total += Object.values(cpu.times).reduce((sum, time) => sum + time, 0)
  }
  return { idle, total }
}

function cpuUsage(): number {
  const current = sampleCpu()
  const idle = current.idle - previousCpu.idle
  const total = current.total - previousCpu.total
  previousCpu = current
  return total ? Math.max(0, Math.min(100, (1 - idle / total) * 100)) : 0
}

async function readProcesses(): Promise<ProcessInfo[]> {
  try {
    const { stdout } = await execFileAsync('ps', ['-axo', 'pid=,pcpu=,pmem=,user=,comm=', '-r'])
    return stdout
      .trim()
      .split('\n')
      .slice(0, 30)
      .map((line) => {
        const match = line.trim().match(/^(\d+)\s+([\d.]+)\s+([\d.]+)\s+(\S+)\s+(.+)$/)
        if (!match) return null
        return {
          pid: Number(match[1]),
          cpu: Number(match[2]),
          memory: Number(match[3]),
          user: match[4]!,
          command: match[5]!,
        }
      })
      .filter((process): process is ProcessInfo => process !== null)
  } catch {
    return []
  }
}

export async function readMetrics(): Promise<Metrics> {
  const totalMemory = totalmem()
  const usedMemory = totalMemory - freemem()
  let systemUptime = 0
  try {
    systemUptime = uptime()
  } catch {
    // Some sandboxes deny libuv's uptime syscall; the other metrics still work.
  }
  return {
    cpu: cpuUsage(),
    memory: (usedMemory / totalMemory) * 100,
    usedMemory,
    totalMemory,
    load: loadavg(),
    uptime: systemUptime,
    processes: await readProcesses(),
  }
}
