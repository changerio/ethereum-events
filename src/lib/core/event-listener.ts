import { EventEmitter } from 'events';
import { BlockPolling } from '.';
import { BlockEvent, BlockStatus } from '../util';
import { Block, PollBlock } from '../util/block.interface';
import { EthereumEvent } from './interfaces';

export class EventListener<T> {
  readonly #polling: BlockPolling<T>;
  readonly #emitter: EventEmitter;
  #running: boolean;
  #queues: Record<string, QueueCollection<Block<T>>>;
  #processing: Record<string, boolean>;

  constructor(polling: BlockPolling<T>) {
    this.#polling = polling;
    this.#emitter = new EventEmitter();
    this.#running = false;
    this.#queues = {};
    this.#processing = {};

    for (const status in BlockStatus) {
      this.#queues[BlockStatus[status]] = new QueueCollection<Block<T>>();
      this.#processing[BlockStatus[status]] = false;
    }

    this.#polling.on(BlockEvent.BLOCK, (block: PollBlock<T>) => {
      this.#queues[block.status].enqueue(block);
      this.#next(block.status);
    });

    this.#polling.on(
      BlockEvent.ERROR,
      (err) => this.#running && this.#emitter.emit(BlockEvent.ERROR, err)
    );
  }

  start(startBlock: number) {
    this.#running = true;
    this.#polling.start(startBlock);
  }

  stop() {
    this.#running = false;
    this.#polling.stop();
  }

  isRunning() {
    return this.#running;
  }

  on(
    event: `${BlockEvent.BLOCK}.${BlockStatus}`,
    callback: (
      number: number,
      events: EthereumEvent<T>,
      doneCallback: CallableFunction
    ) => void
  ) {
    this.#emitter.on(event, callback);
  }

  #next(status: BlockEvent) {
    const block = this.#queues[status].peek();

    if (this.#running && block && !this.#processing[status]) {
      const doneCallback = (err) => {
        if (err == null) {
          this.#queues[status].dequeue();
        }

        this.#processing[status] = false;
        this.#next(status);
      };

      this.#processing[status] = true;
      this.#emitter.emit(
        BlockEvent.BLOCK + status,
        block.number,
        block.events,
        doneCallback
      );
    }
  }
}
