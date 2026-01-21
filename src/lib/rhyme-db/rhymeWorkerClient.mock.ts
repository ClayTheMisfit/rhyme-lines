export const createRhymeWorkerClient = () => {
  return {
    init: () => Promise.resolve(),
    getRhymes: async () => ({ results: { caret: [], lineLast: [] }, debug: {} }),
    getWarning: () => null,
    getStatus: () => null,
    terminate: () => {},
  }
}
