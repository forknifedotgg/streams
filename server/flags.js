module.exports = [
    {
      name: 'uninitialized',
      callback: uninitialized
    },
    {
      name: 'dirty',
      callback: (req) => {}
    },
    {
      name: 'adding',
      callback: (req) => {}
    },
    {
      name: 'running',
      callback: (req) => {}
    },
    {
      name: 'stopped',
      callback: (req) => {}
    }
  ]

function uninitialized(req, chunk) {
  if (req.cache) req.cache.write(chunk)
  else {
    req.cache = fs.createWriteStream(`./cache/${req.params.key}.ts`)
    req.cache.write(chunk)
    req.res.write('OK')
  }
}

function dirty(req, chunk) {
  if (req.verificationError.probe) postProbeError(req)
  req.on('close', () => {
    fs.unlink(`./cache/${req.params.key}.ts`)
  })
  req.res.end(typeof req.verificationError == 'string' ? req.verificationError : JSON.stringify(req.verificationError))
  req.destroy()
}

function adding(req, chunk) {

}

function running(req, chunk) {

}

function stopped(req, chunk) {

}
