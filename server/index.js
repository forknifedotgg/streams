const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const express = require('express')();
const aws = require('aws-sdk');
const flags = require('./flags')

spawnSync('mkdir', ['-p', './cache'])

const invalid = {}

express.post('/:app/:stream_key', async (req, res) => {
  const { app, stream_key } = req.params

  if (invalid[stream_key] || sessions[stream_key]) { res.end(); return }

  req.uninitialized = true
  req.dirty = false
  req.adding = false
  req.running = false

  req.on('data', (chunk) => {
    for (let i = 0; i < flags.length; i ++) {
      const { name, callback } = flags[i]
      if (req[name]) { callback(req, chunk); break }
    }
  })

  const { data, error } = await verifyStreamKey(req)
  if (error) {
    req.verificationError = error
    req.dirty = true
    req.uninitialized = false
    invalid[stream_key] = true
    return
  }
  else {
    setTimeout(() => {
      req.ffprobe = spawn('ffprobe', ['-i', 'pipe:0', '-hide_banner', '-read_intervals', '%+4', '-loglevel', '38')
      req.probe = ''
      req.ffprobe.stderr.on('data', (chunk) => req.probe += chunk.toString())
      req.ffprobe.on('close', (code) => {
        req.probeCode = code
        const { data, error } = verifyProbe(req)
        if (error) {
          req.verificationError = error
          req.dirty = true
          req.uninitialized = false
        }
        else {
          req.verificationData = data
          req.running = true
          req.uninitialized = false
        }
      })
    }, 4000)
  }
})

/**
 * Open websocket with API server and listen for ad events or other pipe requests
 * Manipulate which data to write to the outStream based on events
 */
function manageStream(req, outStream) {
  console.log('managing stream')
  console.log(req.body)
  req.on('data', (chunk) => {
    console.log(chunk)
  })
}

// get connection with load balanced transcoder, send stream details in headers
async function getWriteStream(req, data) {
  return realfs.createWriteStream('./streams/' + req.params.stream_key + '.ts')
}

// return ffprobe child process
function ffprobe() {
  return spawn('ffprobe', ['-i', 'pipe:0', '-hide_banner', '-read_intervals', '%+4', '-loglevel', '38'])
}

// check if ffprobe output based on cached stream segment is conformant to our requirements
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

// verify user table, whether banned or if out of hours etc.
async function verifyStreamKey(stream_key) {
  return false
}

// record request information for stream with invalid key
async function logInvalidAttempt(req, data) {
}

// write to database stream details, useful for notifications and data logging
async function logStreamStart(req, data) {

}

async function logStreamEnd(req, data) {}

express.listen(10000)

/**
  req.on('close', () => {
    delete sessions[stream_key]
    res.end()
    logStreamEnd(req)
  })
  req.on('end', () => {
    delete sessions[stream_key] = null
    res.end()
    logStreamEnd(req)
  })

**/
