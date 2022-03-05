import Web3 from 'web3';
import { EthereumEventsConfig } from '../../config';
import { safeMemoryCache } from 'safe-memory-cache';
import { BlockNotFoundError } from '../errors';
import pLimit = require('p-limit');
import parseLog = require('eth-log-parser');
import { EthereumEvent } from './interfaces';
import { Log } from 'web3-core';

export class EventFetcher<T> {
  #web3: Web3;
  #contracts: any;
  #addresses: string[];
  #concurrency: number;
  #blockCache: any;

  constructor(web3: Web3, contracts: any, options: IEthereumEventsConfig = {}) {
    this.#web3 = web3;
    this.#contracts = contracts;
    this.#addresses = contracts.map((x) => x.address);
    this.#concurrency = options.concurrency || EthereumEventsConfig.concurrency;
    this.#blockCache = safeMemoryCache({ limit: 100 });
  }

  async getEvents(fromBlock: number, toBlock: number) {
    const logs = await this.#web3.eth.getPastLogs({
      address: this.#addresses,
      fromBlock: fromBlock,
      toBlock: toBlock,
    });

    const parsedLogs = this.#parse(logs);
    const filteredLogs = this.#filter(parsedLogs);
    const events = await this.#format(filteredLogs);

    return events;
  }

  #parse(logs: Log[]) {
    return logs.map((log) =>
      parseLog(
        log,
        this.#contracts.find(
          (c) => c.address.toLowerCase() === log.address.toLowerCase()
        ).abi
      )
    );
  }

  #filter(logs) {
    return logs.filter((log) => {
      const contract = this.#contracts.find(
        (c) => c.address.toLowerCase() === log.address.toLowerCase()
      );

      return contract.events ? contract.events.includes(log.event) : true;
    });
  }

  async #format(logs: any): Promise<EthereumEvent<T>[]> {
    const blockHashes = logs
      .map((log) => log.blockHash)
      .filter((e, i, a) => a.indexOf(e) === i);
    const blocks = await this.#getBlocks(blockHashes);

    return logs.map((log) => {
      const transactionHash = log.transactionHash;
      const transaction = blocks[log.blockHash].transactions.find(
        (e) => e.hash === transactionHash
      );
      const contract = this.#contracts.find(
        (c) => c.address.toLowerCase() === log.address.toLowerCase()
      );

      return {
        name: log.event,
        contract: contract.name,
        timestamp: blocks[log.blockHash].timestamp,
        blockHash: log.blockHash,
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
        transactionIndex: log.transactionIndex,
        from: transaction.from,
        to: log.address,
        logIndex: log.logIndex,
        values: log.returnValues,
      } as EthereumEvent<T>;
    });
  }

  async #getBlocks(blockHashes) {
    const results = [];
    const uncachedBlockHashes = [];

    for (let i = 0; i < blockHashes.length; i++) {
      const cachedBlock = this.#blockCache.get(blockHashes[i]);

      if (cachedBlock) {
        results[blockHashes[i]] = cachedBlock;
      } else {
        uncachedBlockHashes.push(blockHashes[i]);
      }
    }

    const limit = pLimit(this.#concurrency);
    const blocks = await Promise.all(
      uncachedBlockHashes.map((e) => limit(this.#web3.eth.getBlock, e, true))
    );

    if (blocks.indexOf(null) !== -1) {
      throw new BlockNotFoundError();
    }

    for (const block of blocks) {
      this.#blockCache.set(block.hash, block);

      results[block.hash] = block;
    }

    return results;
  }
}
