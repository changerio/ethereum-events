import Web3 from 'web3';
import { EthereumEventsConfig } from './config';
import { BlockPolling, EventListener } from './lib/core';
import { EventFetcher } from './lib/core/event-fetcher';

export class EthereumEvents<T> extends EventListener<T> {
  constructor(web3: Web3, contracts: any, options: EthereumEventsConfig) {
    const eventFetcher = new EventFetcher<T>(web3, contracts, options);
    const polling = new BlockPolling<T>(web3, eventFetcher, options);

    super(polling);
  }
}

module.exports = EthereumEvents;
