export const createRhymeWorkerClient = () => {
  return {
    init: () => Promise.resolve(),
    getRhymes: async () => ({ caret: [], lineLast: [] }),
    terminate: () => {},
  }
}
