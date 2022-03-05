'use strict';
const chai = require('chai');
import { EventListener } from '../src/lib/core';
import { EthereumEvents } from '../src';

chai.should();

describe('External API', function () {
  it('should create an instance of EthereumEvents', function () {
    const web3: any = {},
      contracts = [],
      options = {};
    const ethereumEvents = new EthereumEvents(web3, contracts, options);

    ethereumEvents.should.be.an.instanceOf(EventListener);
  });
});
