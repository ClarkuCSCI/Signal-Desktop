// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { Readable } from 'stream';
import * as sinon from 'sinon';
import { noop } from 'lodash';

import { getStreamWithTimeout } from '../../util/getStreamWithTimeout';

describe('getStreamWithTimeout', () => {
  let sandbox: sinon.SinonSandbox;
  let clock: sinon.SinonFakeTimers;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    clock = sandbox.useFakeTimers();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('resolves on finished stream', async () => {
    const stream = new Readable({
      read: noop,
    });

    stream.push('hello');
    stream.push(' ');
    stream.push('world');
    stream.push(null);

    const abort = sinon.stub();
    const data = await getStreamWithTimeout(stream, {
      name: 'test',
      timeout: 1000,
      abortController: { abort },
    });

    assert.strictEqual(Buffer.from(data).toString(), 'hello world');
    sinon.assert.notCalled(abort);
  });

  it('does not timeout on slow but steady stream', async () => {
    const stream = new Readable({
      read: noop,
    });

    const abort = sinon.stub();
    const data = getStreamWithTimeout(stream, {
      name: 'test',
      timeout: 1000,
      abortController: { abort },
    });

    await clock.tickAsync(500);
    stream.push('hello ');
    await clock.tickAsync(500);
    stream.push('world');
    await clock.tickAsync(500);
    stream.push(null);
    await clock.nextAsync();

    assert.strictEqual(Buffer.from(await data).toString(), 'hello world');
    sinon.assert.notCalled(abort);
  });

  it('does timeout on slow but unsteady stream', async () => {
    const stream = new Readable({
      read: noop,
    });

    const abort = sinon.stub();
    const data = getStreamWithTimeout(stream, {
      name: 'test',
      timeout: 1000,
      abortController: { abort },
    });

    await clock.tickAsync(500);
    stream.push('hello ');
    await clock.tickAsync(500);
    stream.push('world');

    const promise = assert.isRejected(
      data,
      'getStreamWithTimeout(test) timed out'
    );

    await clock.tickAsync(1000);

    await promise;
    sinon.assert.called(abort);
  });

  it('rejects on timeout', async () => {
    const stream = new Readable({
      read: noop,
    });

    const abort = sinon.stub();
    const promise = assert.isRejected(
      getStreamWithTimeout(stream, {
        name: 'test',
        timeout: 1000,
        abortController: { abort },
      }),
      'getStreamWithTimeout(test) timed out'
    );

    await clock.tickAsync(1000);

    await promise;

    sinon.assert.called(abort);
  });

  it('rejects on stream error', async () => {
    const stream = new Readable({
      read: noop,
    });

    const abort = sinon.stub();
    const promise = assert.isRejected(
      getStreamWithTimeout(stream, {
        name: 'test',
        timeout: 1000,
        abortController: { abort },
      }),
      'welp'
    );

    stream.emit('error', new Error('welp'));

    await promise;
    sinon.assert.notCalled(abort);
  });
});
