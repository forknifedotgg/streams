const { spawn } = require('child_process');
const express = require('express')();
const aws = require('aws-sdk');
const { fs } = require('memfs');

fs.mkdirpSync('./cache')

const invalid = {}
const sessions = {}

express.post('/:app/:stream_key', async (req, res) => {
  // extract app name and stream key of request incoming from nginx-rtmp tmux
  const { app, stream_key } = req.params

  // kill connection if already streaming or already invalid key
  if (invalid[stream_key] || sessions[stream_key]) { res.end(); return }

  // add session record for stream key
  sessions[stream_key] = req

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
    if (sessions[stream_key]) delete sessions[stream_key]
    return
  }

  // variable to store ffprobe output
  let probeStats = ''
  // get ffprobe child process, store in variable
  const probe = ffprobe()
  // on ffprobe output (stderr in this case, acts as stdout), add string data to probeStats
  probe.stderr.on('data', chunk => probeState += chunk.toString())
  // on ffprobe end of output:
  probe.stderr.on('end', () => {
    // get data and error from verifying the probeStats
    const { data, error } = verifyProbeStats(probeStats)
    /**
     * If error with probeStats: unlink in-memory segment, log invalid attempt, end connection, delete session connection
     */
    if (error) {
      fs.unlink('./cache/' + stream_key)
      logInvalidAttempt(req, error)
      res.end()
      if (sessions[stream_key]) delete sessions[stream_key]
    }
    else {
      // Get writeable load balanced connection with transcoding server
      const outStream = await getWriteStream(req, data)
      // listen for unpipe from in-memory cache write stream
      cacheStreamWrite.on('unpipe', (src) => {
        // pass the request and outstream to manageStream
        manageStream(req, outStream)
      })
    }
  })
  // create a read stream from the in-memory segment
  const cacheStreamRead = fs.createReadStream('./cache/' + stream_key)
  // catch and log error from writing to broken pipe, etc.
  cacheStreamRead.on('error', (error) => {
    console.log('cacheStreamRead error: ', error)
  })
  // pipe in-memory segment to ffprobe stdin to trigger the streamcheck
  cacheStreamRead.pipe(probe.stdin)

})

/**
 * Open websocket with API server and listen for ad events or other pipe requests
 * Manipulate which data to write to the outStream based on events
 */
async function manageStream(req, outStream) {
  
}

// get connection with load balanced transcoder, send stream details in headers
async function getWriteStream(req, data) {}

// return ffprobe child process
function ffprobe() {
  return spawn('ffprobe', ['-i', 'pipe:0', '-hide_banner', '-read_intervals', '"%+2"'])
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

express.listen(10000)
