import './style.css'

type PlaylistItem = {
  id: string
  file: File
  url: string
  name: string
  kind: 'audio' | 'video' | 'unknown'
}

const VIDEO_EXT = /\.(mp4|webm|ogg|ogv|mov|m4v|mkv)$/i
const AUDIO_EXT = /\.(mp3|wav|ogg|oga|m4a|aac|flac|opus)$/i

function detectKind(file: File): PlaylistItem['kind'] {
  if (file.type.startsWith('video/') || VIDEO_EXT.test(file.name)) return 'video'
  if (file.type.startsWith('audio/') || AUDIO_EXT.test(file.name)) return 'audio'
  return 'unknown'
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const total = Math.floor(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = `
  <header class="topbar">
    <a class="brand" href="/" aria-label="Fast Media Player home">
      <span class="brand-mark">Fast</span>
      <span class="brand-sub">Media Player</span>
    </a>
    <div class="top-actions">
      <button type="button" class="btn btn-primary" id="open-files">Open files</button>
      <button type="button" class="btn" id="load-sample">Try sample</button>
      <input id="file-input" class="sr-only" type="file" accept="audio/*,video/*" multiple />
    </div>
  </header>

  <main class="layout">
    <section class="stage-wrap">
      <div class="stage empty" id="stage">
        <video id="player" playsinline></video>
        <div class="audio-viz" aria-hidden="true">
          <div class="viz-ring"><span>AUDIO</span></div>
        </div>
        <div class="drop-hint">
          <h1>Drop media to play</h1>
          <p>Open local audio or video, or try the sample clip. Playback stays on your device.</p>
        </div>
      </div>

      <div class="now-playing">
        <span class="label">Now playing</span>
        <span class="title" id="now-title">Nothing queued</span>
      </div>

      <div class="controls">
        <div class="progress-row">
          <span class="time" id="time-current">0:00</span>
          <input class="scrubber" id="scrubber" type="range" min="0" max="0" value="0" step="0.01" aria-label="Seek" />
          <span class="time end" id="time-duration">0:00</span>
        </div>
        <div class="transport">
          <div class="transport-main">
            <button type="button" class="icon-btn" id="prev" aria-label="Previous" title="Previous">
              <svg viewBox="0 0 24 24"><path d="M6 6h2v12H6V6zm3.5 6 8.5 6V6l-8.5 6z"/></svg>
            </button>
            <button type="button" class="icon-btn play" id="play" aria-label="Play" title="Play / Pause">
              <svg id="play-icon" viewBox="0 0 24 24"><path d="M8 5v14l11-7L8 5z"/></svg>
            </button>
            <button type="button" class="icon-btn" id="next" aria-label="Next" title="Next">
              <svg viewBox="0 0 24 24"><path d="M16 6h2v12h-2V6zM6 18l8.5-6L6 6v12z"/></svg>
            </button>
          </div>
          <div class="extras">
            <div class="volume">
              <button type="button" class="icon-btn" id="mute" aria-label="Mute" title="Mute">
                <svg id="mute-icon" viewBox="0 0 24 24"><path d="M3 10v4h4l5 5V5L7 10H3zm13.5 2c0-1.77-1-3.29-2.5-4.03v8.05c1.5-.74 2.5-2.26 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
              </button>
              <input id="volume" type="range" min="0" max="1" step="0.01" value="0.9" aria-label="Volume" />
            </div>
            <label class="sr-only" for="rate">Playback speed</label>
            <select class="select" id="rate" title="Playback speed">
              <option value="0.5">0.5×</option>
              <option value="0.75">0.75×</option>
              <option value="1" selected>1×</option>
              <option value="1.25">1.25×</option>
              <option value="1.5">1.5×</option>
              <option value="2">2×</option>
            </select>
          </div>
        </div>
      </div>
    </section>

    <aside class="playlist-panel">
      <div class="playlist-head">
        <h2>Playlist</h2>
        <span class="playlist-count" id="playlist-count">0 items</span>
      </div>
      <ul class="playlist" id="playlist"></ul>
    </aside>
  </main>

  <p class="footer-hint">
    Shortcuts: <kbd>Space</kbd> play/pause · <kbd>←</kbd><kbd>→</kbd> seek ·
    <kbd>↑</kbd><kbd>↓</kbd> volume · <kbd>M</kbd> mute · <kbd>N</kbd>/<kbd>P</kbd> next/prev
  </p>
`

const video = document.querySelector<HTMLVideoElement>('#player')!
const stage = document.querySelector<HTMLDivElement>('#stage')!
const fileInput = document.querySelector<HTMLInputElement>('#file-input')!
const openBtn = document.querySelector<HTMLButtonElement>('#open-files')!
const sampleBtn = document.querySelector<HTMLButtonElement>('#load-sample')!
const playlistEl = document.querySelector<HTMLUListElement>('#playlist')!
const playlistCount = document.querySelector<HTMLSpanElement>('#playlist-count')!
const nowTitle = document.querySelector<HTMLSpanElement>('#now-title')!
const scrubber = document.querySelector<HTMLInputElement>('#scrubber')!
const timeCurrent = document.querySelector<HTMLSpanElement>('#time-current')!
const timeDuration = document.querySelector<HTMLSpanElement>('#time-duration')!
const playBtn = document.querySelector<HTMLButtonElement>('#play')!
const playIcon = document.querySelector<SVGElement>('#play-icon')!
const prevBtn = document.querySelector<HTMLButtonElement>('#prev')!
const nextBtn = document.querySelector<HTMLButtonElement>('#next')!
const muteBtn = document.querySelector<HTMLButtonElement>('#mute')!
const muteIcon = document.querySelector<SVGElement>('#mute-icon')!
const volumeInput = document.querySelector<HTMLInputElement>('#volume')!
const rateSelect = document.querySelector<HTMLSelectElement>('#rate')!

const PLAY_PATH = 'M8 5v14l11-7L8 5z'
const PAUSE_PATH = 'M6 5h4v14H6V5zm8 0h4v14h-4V5z'
const VOLUME_PATH =
  'M3 10v4h4l5 5V5L7 10H3zm13.5 2c0-1.77-1-3.29-2.5-4.03v8.05c1.5-.74 2.5-2.26 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z'
const MUTED_PATH =
  'M16.5 12c0-1.77-1-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v4h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z'

let playlist: PlaylistItem[] = []
let currentIndex = -1
let scrubbing = false

function revokeAll() {
  for (const item of playlist) URL.revokeObjectURL(item.url)
}

function setPlayIcon(playing: boolean) {
  playIcon.innerHTML = `<path d="${playing ? PAUSE_PATH : PLAY_PATH}"/>`
  playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play')
}

function setMuteIcon(muted: boolean) {
  muteIcon.innerHTML = `<path d="${muted || video.volume === 0 ? MUTED_PATH : VOLUME_PATH}"/>`
  muteBtn.setAttribute('aria-label', muted ? 'Unmute' : 'Mute')
}

function renderPlaylist() {
  playlistCount.textContent = `${playlist.length} item${playlist.length === 1 ? '' : 's'}`
  playlistEl.replaceChildren()

  playlist.forEach((item, index) => {
    const li = document.createElement('li')
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = `track${index === currentIndex ? ' active' : ''}`
    btn.dataset.index = String(index)

    const idx = document.createElement('span')
    idx.className = 'track-index'
    idx.textContent = String(index + 1)

    const meta = document.createElement('span')
    meta.className = 'track-meta'
    const name = document.createElement('span')
    name.className = 'track-name'
    name.textContent = item.name
    name.title = item.name
    const type = document.createElement('span')
    type.className = 'track-type'
    type.textContent = item.kind === 'unknown' ? 'media' : item.kind
    meta.append(name, type)

    const remove = document.createElement('button')
    remove.type = 'button'
    remove.className = 'track-remove'
    remove.setAttribute('aria-label', `Remove ${item.name}`)
    remove.textContent = '×'
    remove.addEventListener('click', (event) => {
      event.stopPropagation()
      removeAt(index)
    })

    btn.append(idx, meta, remove)
    btn.addEventListener('click', () => playAt(index))
    li.append(btn)
    playlistEl.append(li)
  })
}

function updateStageMode(item: PlaylistItem | null) {
  stage.classList.toggle('empty', !item)
  stage.classList.toggle('audio-mode', Boolean(item && item.kind === 'audio'))
}

async function playAt(index: number, autoplay = true) {
  if (index < 0 || index >= playlist.length) return
  currentIndex = index
  const item = playlist[index]
  nowTitle.textContent = item.name
  updateStageMode(item)
  renderPlaylist()

  video.src = item.url
  video.load()
  if (autoplay) {
    try {
      await video.play()
    } catch {
      setPlayIcon(false)
    }
  }
}

function removeAt(index: number) {
  const [removed] = playlist.splice(index, 1)
  if (removed) URL.revokeObjectURL(removed.url)

  if (playlist.length === 0) {
    currentIndex = -1
    video.removeAttribute('src')
    video.load()
    nowTitle.textContent = 'Nothing queued'
    updateStageMode(null)
    scrubber.value = '0'
    scrubber.max = '0'
    timeCurrent.textContent = '0:00'
    timeDuration.textContent = '0:00'
    setPlayIcon(false)
    renderPlaylist()
    return
  }

  if (index < currentIndex) {
    currentIndex -= 1
    renderPlaylist()
  } else if (index === currentIndex) {
    const next = Math.min(index, playlist.length - 1)
    void playAt(next)
  } else {
    renderPlaylist()
  }
}

function addFiles(files: FileList | File[]) {
  const incoming = Array.from(files).filter(
    (file) =>
      file.type.startsWith('audio/') ||
      file.type.startsWith('video/') ||
      AUDIO_EXT.test(file.name) ||
      VIDEO_EXT.test(file.name),
  )

  if (incoming.length === 0) return

  const startEmpty = playlist.length === 0
  for (const file of incoming) {
    playlist.push({
      id: uid(),
      file,
      url: URL.createObjectURL(file),
      name: file.name,
      kind: detectKind(file),
    })
  }

  renderPlaylist()
  if (startEmpty) void playAt(0)
}

function playNext(delta: number) {
  if (playlist.length === 0) return
  const next = (currentIndex + delta + playlist.length) % playlist.length
  void playAt(next)
}

async function togglePlay() {
  if (!video.src) {
    if (playlist.length > 0) {
      await playAt(currentIndex >= 0 ? currentIndex : 0)
    }
    return
  }
  if (video.paused) {
    try {
      await video.play()
    } catch {
      setPlayIcon(false)
    }
  } else {
    video.pause()
  }
}

openBtn.addEventListener('click', () => fileInput.click())
fileInput.addEventListener('change', () => {
  if (fileInput.files) addFiles(fileInput.files)
  fileInput.value = ''
})

sampleBtn.addEventListener('click', async () => {
  sampleBtn.disabled = true
  sampleBtn.textContent = 'Loading…'
  try {
    const response = await fetch('/samples/sample.mp4')
    if (!response.ok) throw new Error('Sample missing')
    const blob = await response.blob()
    const file = new File([blob], 'sample-clip.mp4', { type: blob.type || 'video/mp4' })
    addFiles([file])
  } catch (error) {
    console.error(error)
    nowTitle.textContent = 'Could not load sample — open a local file instead'
  } finally {
    sampleBtn.disabled = false
    sampleBtn.textContent = 'Try sample'
  }
})

playBtn.addEventListener('click', () => void togglePlay())
prevBtn.addEventListener('click', () => playNext(-1))
nextBtn.addEventListener('click', () => playNext(1))

muteBtn.addEventListener('click', () => {
  video.muted = !video.muted
  setMuteIcon(video.muted)
})

volumeInput.addEventListener('input', () => {
  video.volume = Number(volumeInput.value)
  if (video.volume > 0) video.muted = false
  setMuteIcon(video.muted)
})

rateSelect.addEventListener('change', () => {
  video.playbackRate = Number(rateSelect.value)
})

scrubber.addEventListener('pointerdown', () => {
  scrubbing = true
})
scrubber.addEventListener('pointerup', () => {
  scrubbing = false
  video.currentTime = Number(scrubber.value)
})
scrubber.addEventListener('change', () => {
  video.currentTime = Number(scrubber.value)
})

video.addEventListener('play', () => setPlayIcon(true))
video.addEventListener('pause', () => setPlayIcon(false))
video.addEventListener('ended', () => {
  if (playlist.length > 1) playNext(1)
  else setPlayIcon(false)
})
video.addEventListener('loadedmetadata', () => {
  scrubber.max = String(video.duration || 0)
  timeDuration.textContent = formatTime(video.duration)
})
video.addEventListener('timeupdate', () => {
  if (!scrubbing) scrubber.value = String(video.currentTime)
  timeCurrent.textContent = formatTime(video.currentTime)
})
video.addEventListener('volumechange', () => setMuteIcon(video.muted))

window.addEventListener('dragover', (event) => {
  event.preventDefault()
  document.body.classList.add('drag-over')
})
window.addEventListener('dragleave', (event) => {
  if (event.relatedTarget === null) document.body.classList.remove('drag-over')
})
window.addEventListener('drop', (event) => {
  event.preventDefault()
  document.body.classList.remove('drag-over')
  if (event.dataTransfer?.files) addFiles(event.dataTransfer.files)
})

window.addEventListener('keydown', (event) => {
  const target = event.target as HTMLElement | null
  if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.isContentEditable)) {
    return
  }

  switch (event.key.toLowerCase()) {
    case ' ':
    case 'k':
      event.preventDefault()
      void togglePlay()
      break
    case 'arrowright':
      event.preventDefault()
      video.currentTime = Math.min(video.duration || 0, video.currentTime + 5)
      break
    case 'arrowleft':
      event.preventDefault()
      video.currentTime = Math.max(0, video.currentTime - 5)
      break
    case 'arrowup':
      event.preventDefault()
      video.volume = Math.min(1, video.volume + 0.05)
      volumeInput.value = String(video.volume)
      break
    case 'arrowdown':
      event.preventDefault()
      video.volume = Math.max(0, video.volume - 0.05)
      volumeInput.value = String(video.volume)
      break
    case 'm':
      video.muted = !video.muted
      setMuteIcon(video.muted)
      break
    case 'n':
      playNext(1)
      break
    case 'p':
      playNext(-1)
      break
  }
})

window.addEventListener('beforeunload', revokeAll)

video.volume = Number(volumeInput.value)
setPlayIcon(false)
setMuteIcon(false)
renderPlaylist()
updateStageMode(null)
