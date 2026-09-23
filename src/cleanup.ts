// One place that runs every pending cleanup (temp copies, temporary boxes) when
// you press Ctrl-C or the process is told to stop, then exits.
type Task = () => unknown

const tasks = new Set<Task>()
let installed = false

export function onInterrupt(task: Task): () => void {
  if (!installed) {
    installed = true
    for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => void runAll())
  }
  tasks.add(task)
  return () => tasks.delete(task)
}

async function runAll(): Promise<never> {
  for (const task of [...tasks]) {
    try {
      await task()
    } catch (err) {
      console.error(`Cleanup step failed: ${(err as Error).message}`)
    }
  }
  process.exit(130)
}
