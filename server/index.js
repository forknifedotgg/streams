const { spawn, spawnSync } = require('child_process');
const realfs = require('fs');
const express = require('express')();
const aws = require('aws-sdk');
const { fs } = require('memfs');

spawnSync('mkdir', ['-p', './streams'])
fs.mkdirpSync('./cache')

const invalid = {}
const sessions = {}

express.post('/:app/:stream_key', async (req, res) => {
  console.log(invalid, sessions)
  // extract app name and stream key of request incoming from nginx-rtmp tmux
  const { app, stream_key } = req.params
  // TODO: remove test line below
  req.on('data', (chunk) => console.log(chunk))
  // kill connection if already streaming or already invalid key
  if (invalid[stream_key] || sessions[stream_key]) { res.end(); return }

  // add session record for stream key
  sessions[stream_key] = req

  // TODO: move to where data is accessible or leave here if unimportant
  req.on('close', () => {
    sessions[stream_key] = null
    res.end()
    logStreamEnd(req)
  })
  req.on('end', () => {
    sessions[stream_key] = null
    res.end()
    logStreamEnd(req)
  })

  /**
   * Start caching a small segment for future analysis + keep the readableStream going
   * Done by piping the request body into an in-memory file named after the stream_key
   * Attempt to catch error (often trying to write to broken pipe) and log it
   */
  const cacheStreamWrite = fs.createWriteStream('./cache/' + stream_key)
  cacheStreamWrite.on('error', (error) => {
    console.log('cacheStreamRead error: ', error)
  })
  req.pipe(cacheStreamWrite)

  // verify whether the stream key is valid for the purpose of streaming with a db call
  const error = await verifyStreamKey(stream_key)
  /**
   * On error: unlink the in-memory segment, add invalid record for key, log invalid attempt, end connection, delete session connection, return
   */
  if (error) {
    fs.unlink('./cache/' + stream_key)
    invalid[stream_key] = true
    logInvalidAttempt(req, error)
    res.end()
    sessions[stream_key] = null
    return
  }

  // variable to store ffprobe output
  let probeStats = ''
  // get ffprobe child process, store in variable
  const probe = ffprobe()
  // on ffprobe output (stderr in this case, acts as stdout), add string data to probeStats
  probe.stderr.on('data', chunk => probeStats += chunk.toString())
  // on ffprobe end of output:
  probe.stderr.on('end', async () => {
    // get data and error from verifying the probeStats
    const { data, error } = verifyProbeStats(probeStats)
    console.log(data, error, probeStats)
    /**
     * If error with probeStats: unlink in-memory segment, log invalid attempt, end connection, delete session connection
     */
    if (error) {
      fs.unlink('./cache/' + stream_key)
      logInvalidAttempt(req, error)
      res.end()
      sessions[stream_key] = null
    }
    else {
      // Get writeable load balanced connection with transcoding server
      const outStream = await getWriteStream(req, data)
      console.log(typeof outStream)
      // listen for unpipe from in-memory cache write stream
      cacheStreamWrite.on('unpipe', (src) => {
        // pass the request and outstream to manageStream
        manageStream(req, outStream)
      })
      req.unpipe(cacheStreamWrite)
      cacheStreamWrite.end()
    }
  })
  // create a read stream from the in-memory segment
  const cacheStreamRead = fs.createReadStream('./cache/' + stream_key)
  // catch and log error from writing to broken pipe, etc.
  cacheStreamRead.on('error', (error) => {
    console.log('cacheStreamRead error: ', error)
  })
  // pipe in-memory segment to ffprobe stdin to trigger the streamcheck
  // TODO: Can't extract bitrate from this sample + audio channels shows 0
  cacheStreamRead.pipe(probe.stdin)
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
