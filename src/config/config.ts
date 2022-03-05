export class EthereumEventsConfig implements IEthereumEventsConfig {
  static pollInterval?: number = 13000;
  static confirmations?: number = 12;
  static chunkSize?: number = 10000;
  static concurrency?: number = 10;
  static backOff?: number = 1000;
}
