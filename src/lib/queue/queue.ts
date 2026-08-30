/**
 * BullMQ-shaped queue adapter.
 *
 * The public surface (`add`, `process`, delayed jobs, attempts + backoff,
 * job events) mirrors BullMQ's `Queue`/`Worker` so the processor in
 * `mintProcessor.ts` is portable: swapping this file for a real
 * `new Queue(name, { connection: redis })` requires no processor changes.
 *
 * This in-runtime driver uses timers instead of Redis because the app's
 * server runtime has no long-lived Redis connection.
 */

import type { Job, JobOptions, LogLevel, MintStage, TaskLog } from "./types";

export type Processor<T, R> = (job: Job<T>) => Promise<R>;

type Listener = (log: TaskLog) => void;

export class Queue<T, R> {
  readonly name: string;
  private processor: Processor<T, R> | null = null;
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly logs = new Map<string, TaskLog[]>();
  private readonly listeners = new Set<Listener>();
  private counter = 0;

  constructor(name: string) {
    this.name = name;
  }

  /** Register the worker. One processor per queue, as with BullMQ workers. */
  process(processor: Processor<T, R>): void {
    this.processor = processor;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getLogs(taskId: string): TaskLog[] {
    return this.logs.get(taskId) ?? [];
  }

  async add(name: string, data: T, opts: JobOptions = {}): Promise<Job<T>> {
    this.counter += 1;
    const id = opts.jobId ?? `${this.name}:${this.counter}`;
    const job = this.createJob(id, name, data, opts, 0);
    this.schedule(job, opts.delay ?? 0);
    return job;
  }

  /** Cancel a not-yet-running delayed job. */
  remove(jobId: string): boolean {
    const timer = this.timers.get(jobId);
    if (!timer) return false;
    clearTimeout(timer);
    this.timers.delete(jobId);
    return true;
  }

  private createJob(
    id: string,
    name: string,
    data: T,
    opts: JobOptions,
    attemptsMade: number,
  ): Job<T> {
    const taskId = (data as { taskId?: string }).taskId ?? id;
    return {
      id,
      name,
      data,
      opts,
      attemptsMade,
      log: (level: LogLevel, stage: MintStage, message: string) => {
        const entry: TaskLog = { taskId, at: Date.now(), level, stage, message };
        const bucket = this.logs.get(taskId) ?? [];
        bucket.push(entry);
        this.logs.set(taskId, bucket);
        for (const listener of this.listeners) listener(entry);
      },
    };
  }

  private schedule(job: Job<T>, delay: number): void {
    const timer = setTimeout(
      () => {
        this.timers.delete(job.id);
        void this.run(job);
      },
      Math.max(0, delay),
    );
    this.timers.set(job.id, timer);
  }

  private async run(job: Job<T>): Promise<void> {
    if (!this.processor) return;
    try {
      await this.processor(job);
    } catch (error) {
      const attempts = job.opts.attempts ?? 1;
      const nextAttempt = job.attemptsMade + 1;
      if (nextAttempt < attempts) {
        const backoff = (job.opts.backoffMs ?? 1_000) * 2 ** job.attemptsMade;
        const retry = this.createJob(job.id, job.name, job.data, job.opts, nextAttempt);
        retry.log(
          "warn",
          "Failed",
          `Attempt ${nextAttempt} failed, retrying in ${backoff}ms: ${(error as Error).message}`,
        );
        this.schedule(retry, backoff);
        return;
      }
      job.log("error", "Failed", `Job failed permanently: ${(error as Error).message}`);
    }
  }
}

/** The single mint queue instance, mirroring a named BullMQ queue. */
export const MINT_QUEUE_NAME = "umi:mints";
