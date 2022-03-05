import Web3 from 'web3';
import { EventEmitter } from 'events';
import { safeMemoryCache } from 'safe-memory-cache';
import { EthereumEventsConfig } from '../../config';
import { BlockEvent, BlockStatus } from '../util';
import { BlockNotFoundError } from '../errors';
import { EthereumEvent } from './interfaces';
import { Block } from '../util/block.interface';

export class BlockPolling<T> {
  readonly #web3: Web3;
  readonly #eventFetcher: any;
  readonly #emitter: EventEmitter;
  #running: boolean = false;
  readonly #chunkSize: number;
  readonly #pollInterval: number;
  readonly #confirmations: number;
  readonly #backOff: number;
  readonly #eventCache: any;

  #latestQueriedBlock: number;

  constructor(
    web3: Web3,
    eventFetcher: any,
    options: IEthereumEventsConfig = {}
  ) {
    this.#web3 = web3;
    this.#eventFetcher = eventFetcher;
    this.#emitter = new EventEmitter();
    this.#chunkSize = options.chunkSize | EthereumEventsConfig.chunkSize;
    this.#pollInterval =
      options.pollInterval || EthereumEventsConfig.pollInterval;
    this.#confirmations =
      options.confirmations || EthereumEventsConfig.confirmations;
    this.#backOff = options.backOff || EthereumEventsConfig.backOff;
    this.#eventCache = safeMemoryCache({ limit: this.#confirmations });
  }

  start(startBlock: number) {
    this.#running = true;
    this.#poll(startBlock);
  }

  stop() {
    this.#running = false;
  }

  isRunning() {
    return this.#running;
  }

  on(event: BlockEvent, callback: (arg: Block<T>) => void) {
    this.#emitter.on(event, callback);
  }

  async #poll(fromBlock: number) {
    try {
      this.#web3.utils;
      const latestBlock = await this.#web3.eth.getBlockNumber();

      fromBlock = fromBlock || latestBlock;

      const toBlock = Math.min(fromBlock + this.#chunkSize - 1, latestBlock);
      const latestConfirmedQueriedBlock = Math.min(
        toBlock,
        latestBlock - this.#confirmations
      );

      if (toBlock !== this.#latestQueriedBlock) {
        const events = await this.#eventFetcher.getEvents(fromBlock, toBlock);

        for (let i = fromBlock; i <= toBlock; i++) {
          const status = this.#getBlockStatus(i, latestBlock);
          const blockEvents: EthereumEvent<T> = events.filter(
            (e) => e.blockNumber === i
          );

          this.#notify(i, status, blockEvents);
        }

        this.#latestQueriedBlock = toBlock;
      }

      const delay = toBlock === latestBlock ? this.#pollInterval : 0;
      const nextBlock = Math.max(fromBlock, latestConfirmedQueriedBlock + 1);

      setTimeout(() => this.#running && this.#poll(nextBlock), delay);
    } catch (err) {
      if (!(err instanceof BlockNotFoundError)) {
        this.#emitter.emit(BlockEvent.ERROR, err);
      }

      setTimeout(() => this.#running && this.#poll(fromBlock), this.#backOff);
    }
  }

  #notify(blockNumber: number, status: BlockStatus, events: EthereumEvent<T>) {
    if (status === BlockStatus.CONFIRMED) {
      this.#emitter.emit(BlockEvent.BLOCK, {
        number: blockNumber,
        status: status,
        events: events,
      });
    } else {
      const strBlockEvents = JSON.stringify(events);

      if (this.#eventCache.get(blockNumber) !== strBlockEvents) {
        this.#eventCache.set(blockNumber, strBlockEvents);
        this.#emitter.emit(BlockEvent.BLOCK, {
          number: blockNumber,
          status: status,
          events: events,
        } as Block<T>);
      }
    }
  }

  #getBlockStatus(blockNumber: number, latestBlock: number) {
    return blockNumber <= latestBlock - this.#confirmations
      ? BlockStatus.CONFIRMED
      : BlockStatus.UNCONFIRMED;
  }
}
