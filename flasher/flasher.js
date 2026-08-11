import { ESPLoader, Transport } from '/thirdparty/esptool-js.bundle.js'

// Flash layout, matching arduino/esp32/partitions.csv. The bootloader sits at 0x0
// on every chip we build for (S3/C3/C6) — only the classic ESP32 uses 0x1000.
const LAYOUT = [
  { part: "bootloader", address: 0x0 },
  { part: "partitions", address: 0x8000 },
  { part: "bootapp0",   address: 0xe000 },
  { part: "app",        address: 0x10000 },
]

// esploader.main() returns a description like "ESP32-S3 (QFN56) (revision v0.2)",
// so match on the family rather than comparing the whole string.
const CHIP_PATTERNS = [
  { pattern: /ESP32-?S3/i, chip: "esp32s3" },
  { pattern: /ESP32-?C6/i, chip: "esp32c6" },
  { pattern: /ESP32-?C3/i, chip: "esp32c3" },
]

const el = id => document.getElementById(id)
const show = id => el(id).classList.remove("hidden")
const hide = id => el(id).classList.add("hidden")

let flashing = false

function log(line) {
  el("log").textContent += line + "\n"
  el("log").scrollTop = el("log").scrollHeight
}

function setStatus(text, isError) {
  el("status").textContent = text
  el("status").classList.toggle("error", !!isError)
}

function setProgress(fraction) {
  el("progress-bar").style.width = (fraction * 100).toFixed(1) + "%"
}

// esptool-js logs progress here; it writes partial lines, so buffer until newline.
let terminalBuffer = ""
const terminal = {
  clean() {
    el("log").textContent = ""
  },
  writeLine(data) {
    log(terminalBuffer + data)
    terminalBuffer = ""
  },
  write(data) {
    terminalBuffer += data
    let newline = terminalBuffer.lastIndexOf("\n")
    if (newline < 0) return
    log(terminalBuffer.slice(0, newline))
    terminalBuffer = terminalBuffer.slice(newline + 1)
  },
}

function chipFromDescription(description) {
  for (const { pattern, chip } of CHIP_PATTERNS) {
    if (pattern.test(description)) return chip
  }
  return null
}

async function fetchBinary(url) {
  let response = await fetch(url, { cache: "no-store" })
  // The OTA route answers 304 when the requested version isn't newer than the
  // stored one, so the app is fetched with version=-1. A 304 here means no
  // firmware has been uploaded for this chip at all.
  if (response.status == 304 || response.status == 404) {
    throw new Error(`No firmware available on the server for this chip (${url})`)
  }
  if (!response.ok) {
    throw new Error(`Couldn't download firmware (HTTP ${response.status})`)
  }
  return new Uint8Array(await response.arrayBuffer())
}

async function fetchArtifacts(chip) {
  let files = []
  for (const { part, address } of LAYOUT) {
    let url = part == "app"
      ? `/firmware/${chip}.bin?version=-1`
      : `/firmware/${chip}/${part}.bin`
    let data = await fetchBinary(url)
    log(`Downloaded ${part}: ${data.length} bytes`)
    files.push({ data, address })
  }
  return files
}

// reportProgress is per-file and counts compressed bytes, so weight each file's
// completion by its uncompressed size to get a meaningful overall bar.
function makeProgressReporter(files) {
  let totalBytes = files.reduce((sum, f) => sum + f.data.length, 0)
  let precedingBytes = files.map((_, i) =>
    files.slice(0, i).reduce((sum, f) => sum + f.data.length, 0))

  return (fileIndex, written, total) => {
    let fraction = total > 0 ? written / total : 0
    let done = precedingBytes[fileIndex] + fraction * files[fileIndex].data.length
    setProgress(done / totalBytes)
  }
}

async function flash() {
  if (flashing) return
  flashing = true
  el("flash-button").disabled = true
  hide("recovery")
  hide("done")
  terminal.clean()

  let transport = null
  try {
    let port
    try {
      port = await navigator.serial.requestPort()
    } catch (e) {
      // The user dismissed the device chooser — not an error worth reporting.
      setStatus("")
      return
    }

    setStatus("Connecting to the orb...")
    show("progress-wrap")
    setProgress(0)

    // Tracing accumulates every transferred byte into a string in memory, which
    // is far too much for a multi-megabyte write.
    transport = new Transport(port, false)
    let esploader = new ESPLoader({ transport, baudrate: 115200, terminal })

    let description
    try {
      description = await esploader.main()
    } catch (e) {
      log("Connection failed: " + e.message)
      setStatus("Couldn't connect to the orb.", true)
      show("recovery")
      return
    }

    let chip = chipFromDescription(description)
    if (!chip) {
      setStatus(`Unrecognized board: ${description}`, true)
      log("This page can only flash ESP32-S3, ESP32-C6 and ESP32-C3 boards.")
      return
    }
    log(`Detected ${description} -> ${chip}`)

    setStatus("Downloading firmware...")
    let files = await fetchArtifacts(chip)

    setStatus("Erasing the orb — this takes a moment...")
    await esploader.writeFlash({
      fileArray: files,
      flashMode: "keep",
      flashFreq: "keep",
      flashSize: "keep",
      eraseAll: true,
      compress: true,
      reportProgress: makeProgressReporter(files),
    })

    setProgress(1)
    setStatus("Restarting...")
    // The flash itself is already complete here, so a reset that doesn't take
    // is a cosmetic problem — unplugging the orb has the same effect.
    try {
      await esploader.after("hard_reset")
    } catch (e) {
      log("Couldn't reset the board automatically: " + e.message)
    }

    setStatus("")
    hide("progress-wrap")
    show("done")
  } catch (e) {
    log("Error: " + (e.stack || e.message))
    setStatus(e.message, true)
  } finally {
    if (transport) {
      try {
        await transport.disconnect()
      } catch (e) {
        log("Error closing the serial port: " + e.message)
      }
    }
    flashing = false
    el("flash-button").disabled = false
  }
}

if (navigator.serial) {
  show("main")
  el("flash-button").addEventListener("click", flash)
} else {
  show("unsupported")
}
