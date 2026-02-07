export const createRhymeWorkerClient = () => {
  return {
    init: () => Promise.resolve(),
    getRhymes: async () => ({ results: { caret: [], lineLast: [] }, debug: {} }),
    getRhymeKeys: async () => ({ runtimeKey: 'none', keys: {} }),
    getWarning: () => null,
    getStatus: () => null,
    terminate: () => {},
  }
}
