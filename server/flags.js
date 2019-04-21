const http = require('http')
const fs = require('fs')

module.exports = [
    {
      name: 'uninitialized',
      callback: uninitialized
    },
    {
      name: 'dirty',
      callback: dirty
    },
    {
      name: 'adding',
      callback: adding
    },
    {
      name: 'running',
      callback: running
    },
    {
      name: 'stopped',
      callback: stopped
    }
  ]

function uninitialized(req, chunk) {
  console.log('uninitialized')
  if (req.cache) req.cache.write(chunk)
  else {
    req.cache = fs.createWriteStream(`./cache/${req.params.key}.ts`)
    req.cache.write(chunk)
    req.res.write('OK')
  }
}

function dirty(req, chunk) {
  console.log('dirty')
  if (req.verificationError.probe) postProbeError(req)
  req.on('close', () => {
    fs.unlink(`./cache/${req.params.key}.ts`)
  })
  req.res.end(typeof req.verificationError == 'string' ? req.verificationError : JSON.stringify(req.verificationError))
  req.destroy()
}

function adding(req, chunk) {

}

async function running(req, chunk) {
  console.log('running')
  if (req.transcoder) req.transcoder.write(chunk)
  else if (req.connecting) return
  else {
    console.log(req.verificationData)
    req.connecting = true
    setTimeout(() => req.transcoder = fs.createWriteStream(`./streams/${req.params.key}.ts`), 1800)
  }
}

function stopped(req, chunk) {

}
