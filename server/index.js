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

  fs.createWriteStream('./cache/' + stream_key)

  const valid = await verifyStreamKey(stream_key)
  if (!valid) {
    fs.unlink('./cache/' + stream_key)
    invalid[stream_key] = true
    logInvalidAttempt(req)
    res.end()
    if (sessions[stream_key]) delete sessions[stream_key]
  }

  let data = ''
  const probe = ffprobe(stream_key)
  probe.stderr.on('data', chunk => data += chunk.toString())
  probe
})

function ffprobe(stream_key) {
  return spawn('ffprobe', ['-i', 'pipe:0', '-hide_banner', '-read_intervals', '"%+2"'])
}

async function verifyStreamKey(stream_key) {
  return true
  // verify user table, whether banned or if out of hours etc.
}

async function logInvalidAttempt(req) {
  // record request information for stream with invalid key
}

express.listen(10000)
