const fs = require('fs');

const original = fs.promises.realpath.bind(fs.promises);

// Node's async realpath resolves a subst drive (R:) back to D:\myRepos\Salida.
// The sync realpath keeps the short drive letter, which is what keeps native
// build paths under Windows' 260-character limit.
fs.promises.realpath = async function realpath(target, options) {
  try {
    return fs.realpathSync(target, options);
  } catch (error) {
    return original(target, options);
  }
};
