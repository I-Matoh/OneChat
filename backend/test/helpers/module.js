function clearModules(paths) {
  for (const path of paths) {
    try {
      delete require.cache[require.resolve(path)];
    } catch {
      // Ignore cache misses in tests.
    }
  }
}

module.exports = { clearModules };
