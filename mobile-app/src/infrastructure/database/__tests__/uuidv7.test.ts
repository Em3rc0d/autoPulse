import { ProductIdGenerator } from '../product/uuidv7';

jest.mock('expo-crypto', () => ({
  getRandomBytes: (size: number) => {
    const arr = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
    return arr;
  }
}), { virtual: true });

describe('ProductIdGenerator (UUIDv7)', () => {
  let originalDateNow: () => number;
  let mockTime = 1000000000000;

  beforeAll(() => {
    originalDateNow = Date.now;
    Date.now = jest.fn(() => mockTime);
  });

  afterAll(() => {
    Date.now = originalDateNow;
  });

  beforeEach(() => {
    ProductIdGenerator.resetForTesting();
    mockTime = 1000000000000;
  });

  it('Generates valid UUIDs with version 7 and variant RFC (10xx)', () => {
    const id = ProductIdGenerator.generate();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('Generates 10,000 unique IDs in sequence without decreasing', () => {
    const ids = new Set<string>();
    let prevId = '';

    for (let i = 0; i < 10000; i++) {
      const id = ProductIdGenerator.generate();
      expect(ids.has(id)).toBe(false);
      ids.add(id);

      if (prevId) {
        expect(id >= prevId).toBe(true);
      }
      prevId = id;
    }

    expect(ids.size).toBe(10000);
  });

  it('Handles fixed clock (thousands of IDs in same ms)', () => {
    // Clock is fixed to mockTime
    const ids = new Set<string>();
    let prevId = '';

    for (let i = 0; i < 5000; i++) {
      const id = ProductIdGenerator.generate();
      ids.add(id);
      if (prevId) {
        expect(id >= prevId).toBe(true);
      }
      prevId = id;
    }

    expect(ids.size).toBe(5000);
  });

  it('Handles clock retrocession gracefully', () => {
    const id1 = ProductIdGenerator.generate();

    // Simulate clock going backwards
    mockTime -= 5000;

    const id2 = ProductIdGenerator.generate();

    // id2 must still be >= id1 lexicographically
    expect(id2 >= id1).toBe(true);
  });

  it('Handles sequence overflow', () => {
    // 0xFFF is 4095. So 4096th iteration in same ms will cause overflow
    const id1 = ProductIdGenerator.generate();

    for (let i = 0; i < 4095; i++) {
      ProductIdGenerator.generate();
    }

    const overflowId = ProductIdGenerator.generate();
    expect(overflowId >= id1).toBe(true);

    // Extract timestamp from id1 and overflowId to check if timestamp advanced
    const time1 = id1.substring(0, 13);
    const timeOverflow = overflowId.substring(0, 13);
    expect(timeOverflow > time1).toBe(true);
  });

  it('Handles application restart', () => {
    const id1 = ProductIdGenerator.generate();

    // Restart app
    ProductIdGenerator.resetForTesting();

    // Even if time doesn't advance much, random bytes ensure uniqueness
    const id2 = ProductIdGenerator.generate();
    expect(id1).not.toBe(id2);
  });

  it('Handles concurrent calls', () => {
    // Concurrent calls in JS run synchronously in the event loop,
    // but simulate generating an array of IDs at once
    const batch = Array.from({ length: 100 }, () => ProductIdGenerator.generate());
    const uniqueBatch = new Set(batch);
    expect(uniqueBatch.size).toBe(100);
  });
});
