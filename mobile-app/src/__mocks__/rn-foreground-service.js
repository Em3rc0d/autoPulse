const service = {
  start: jest.fn(),
  stop: jest.fn(),
  stopAll: jest.fn(),
  add_task: jest.fn(),
  remove_task: jest.fn(),
};

module.exports = service;
module.exports.default = service;
