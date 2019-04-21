const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const express = require('express')();
const aws = require('aws-sdk');
const flags = require('./flags')

spawnSync('mkdir', ['-p', './cache'])

const invalid = {}

express.post('/:app/:key/file.ts', async (req, res) => {
  if (invalid[req.params.key]) { res.end(); return }

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
    invalid[req.params.key] = true
    return
  }
  else {
    setTimeout(() => {
      req.ffprobe = spawn('ffprobe', ['-i', `./cache/${req.params.key}.ts`, '-hide_banner', '-read_intervals', '%+5', '-loglevel', '38'])
      req.probe = ''
      req.ffprobe.stderr.on('data', (chunk) => req.probe += chunk.toString())
      req.ffprobe.on('close', (code) => {
        console.log(code, req.probe)
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
    }, 5500)
  }
})

function verifyProbe(req) {
  const probe = req.probe
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
  return {
    error: null,
    data: {
      streamer: 'fngg'
    }
  }
}

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
