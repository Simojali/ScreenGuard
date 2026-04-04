const { rebuild } = require('@electron/rebuild')

exports.default = async function(context) {
  await rebuild({
    buildPath: context.appOutDir,
    electronVersion: context.electronVersion,
    arch: context.arch,
  })
}
