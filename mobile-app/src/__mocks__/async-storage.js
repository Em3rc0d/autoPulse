const store = new Map();

const AsyncStorage = {
  getItem: jest.fn(async key => store.has(key) ? store.get(key) : null),
  setItem: jest.fn(async (key, value) => { store.set(key, value); }),
  removeItem: jest.fn(async key => { store.delete(key); }),
  clear: jest.fn(async () => { store.clear(); }),
  getAllKeys: jest.fn(async () => Array.from(store.keys())),
  multiGet: jest.fn(async keys => keys.map(key => [key, store.has(key) ? store.get(key) : null])),
  multiSet: jest.fn(async pairs => { pairs.forEach(([key, value]) => store.set(key, value)); }),
  multiRemove: jest.fn(async keys => { keys.forEach(key => store.delete(key)); }),
};

module.exports = AsyncStorage;
module.exports.default = AsyncStorage;
