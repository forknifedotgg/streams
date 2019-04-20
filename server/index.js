const { spawn } = require('child_process');
const express = require('express')();
const aws = require('aws-sdk');
const { fs } = require('memfs');

fs.mkdirpSync('./cache')

const invalid = {}
const sessions = {}

express.post('/:app/:stream_key', async (req, res) => {
  const { app, stream_key } = req.params

  if (invalid[stream_key] || sessions[stream_key]) { res.end(); return }

  sessions[stream_key] = req

  const cacheStreamWrite = fs.createWriteStream('./cache/' + stream_key)
  cacheStreamWrite.on('error', (error) => {
    console.log('cacheStreamRead error: ', error)
  })
  req.pipe(cacheStreamWrite)

  const error = await verifyStreamKey(stream_key)
  if (error) {
    fs.unlink('./cache/' + stream_key)
    invalid[stream_key] = true
    logInvalidAttempt(req, error)
    res.end()
    if (sessions[stream_key]) delete sessions[stream_key]
    return
  }

  let probeStats = ''
  const probe = ffprobe()
  probe.stderr.on('data', chunk => probeState += chunk.toString())
  probe.stderr.on('end', () => {
    const { data, error } = verifyProbeStats(probeStats)
    if (error) {
      fs.unlink('./cache/' + stream_key)
      logInvalidAttempt(req, error)
      res.end()
      if (sessions[stream_key]) delete sessions[stream_key]
    }
    else {
      const outStream = await getWriteStream(req, data)
      cacheStreamWrite.on('unpipe', (src) => {
        req.pipe(outStream)
      })
      logStreamStart(req, data)
    }
  })
  const cacheStreamRead = fs.createReadStream('./cache/' + stream_key)
  cacheStreamRead.on('error', (error) => {
    console.log('cacheStreamRead error: ', error)
  })
  cacheStreamRead.pipe(probe.stdin)

})


async function getWriteStream(req, data) {}

function ffprobe() {
  return spawn('ffprobe', ['-i', 'pipe:0', '-hide_banner', '-read_intervals', '"%+2"'])
}

function verifyProbeStats(probeStats) {
  return {
    error: null,
    data: {
      video: {
        resolution: '',
        fps: '',
        bitrate: '',
      },
      audio: {
        samplerate: '',
        channels: '',
        bitrate: ''
      }
    }
  }
}

async function verifyStreamKey(stream_key) {
  return false
  // verify user table, whether banned or if out of hours etc.
}

async function logInvalidAttempt(req, data) {
  // record request information for stream with invalid key
}

async function logStreamStart(req, data) {

}

express.listen(10000)
