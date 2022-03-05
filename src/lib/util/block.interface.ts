import { BlockEvent, BlockStatus } from '.';
import { EthereumEvent } from '../core/interfaces';

export interface Block<T> {
  status: BlockEvent | BlockStatus | `${BlockEvent.BLOCK}.${BlockStatus}`;
  number: number;
  events: EthereumEvent<T>;
}

export interface PollBlock<T> {
  status: BlockEvent;
  number: number;
  events: EthereumEvent<T>;
}
