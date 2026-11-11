const stylesheet = document.createElement('link')
stylesheet.rel = 'stylesheet'
stylesheet.href = new URL('tour.css?view=guide-motion-v60', import.meta.url)
document.head.append(stylesheet)

const root = document.querySelector('#root')
const query = (selector) => root.querySelector(selector)
const buttons = (scope = root) => [...scope.querySelectorAll('button')]
const label = (element) => element.textContent.replace(/\s+/g, ' ').trim()
const button = (name, scope = root) => buttons(scope).find(element => label(element) === name)
const tab = (name) => buttons().find(element => label(element).replace(/^0[1-3]\s*/, '') === name)
const picker = (scope) => query(scope + ' [data-testid="tracker-drop"] button')
const personal = '.app-usage-editor'
const shared = '[data-testid="our-basis"]'
const studio = '[data-testid="p26-original-testprint"]'
const artboard = '[data-testid="p26-testprint-grid"]'
const motionReduced = matchMedia('(prefers-reduced-motion: reduce)').matches
const titles = ['PERSONAL TRACE', 'SHARED PATTERN', 'TEST PRINT']

const chapterLinks = titles.map((title, index) =>
  '<button type="button" data-jump="' + index + '"><span aria-hidden="true">0' + (index + 1) + '</span> ' + title + '</button>'
).join('')

const icon = path => `<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">${path}</svg>`
const pauseIcon = icon('<path d="M5.5 3.5v9m5-9v9" fill="none" stroke="currentColor" stroke-width="1.6"/>')
const playIcon = icon('<path d="m5 3 8 5-8 5z" fill="currentColor"/>')
const previousIcon = icon('<path d="m10 3-5 5 5 5" fill="none" stroke="currentColor" stroke-width="1.6"/>')
const nextIcon = icon('<path d="m6 3 5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.6"/>')

const panel = document.createElement('aside')
panel.id = 'punch-tour'
panel.setAttribute('aria-label', 'PUNCH YOUR TRACE walkthrough')
panel.innerHTML = `
  <div class="tour-line">
    <div class="tour-text">
      <span class="tour-chapter-number" aria-hidden="true"></span>
      <div class="tour-caption"><h2><span class="tour-section"></span><span class="tour-action"></span></h2><p class="tour-copy" lang="ko" aria-live="polite"></p></div>
    </div>
    <div class="tour-controls">
      <details class="tour-chapters"><summary>Chapters</summary><div class="tour-chapter-list">${chapterLinks}</div></details>
      <button type="button" class="tour-icon-button" data-command="pause" aria-keyshortcuts="Space" aria-label="Pause" title="Pause">${pauseIcon}</button>
      <button type="button" class="tour-icon-button" data-command="previous" aria-keyshortcuts="ArrowLeft" aria-label="Previous feature" title="Previous feature" disabled>${previousIcon}</button>
      <button type="button" class="tour-icon-button" data-command="next" aria-keyshortcuts="ArrowRight" aria-label="Next feature" title="Next feature">${nextIcon}</button>
    </div>
  </div>`
const exitGuide = document.createElement('button')
exitGuide.id = 'punch-tour-exit'
exitGuide.type = 'button'
exitGuide.title = 'Close guide'
exitGuide.setAttribute('aria-label', 'Close guide')
exitGuide.innerHTML = icon('<path d="m4 4 8 8m0-8-8 8" fill="none" stroke="currentColor" stroke-width="1.6"/>')
const livePreview = document.createElement('aside')
livePreview.id = 'punch-tour-live'
livePreview.setAttribute('aria-hidden', 'true')
livePreview.innerHTML = '<div class="tour-live-label">LIVE PREVIEW <strong></strong></div><div class="tour-live-art"></div>'
livePreview.hidden = true
const cursor = document.createElement('div')
cursor.id = 'punch-tour-cursor'
cursor.setAttribute('aria-hidden', 'true')
cursor.innerHTML = '<i></i><svg viewBox="0 0 26 32"><path d="M3 2v23l6-6 5 10 4-2-5-10 9-1z"/></svg>'
const reopen = document.createElement('button')
reopen.id = 'punch-tour-reopen'
reopen.textContent = 'Start guide'
const launch = document.createElement('div')
launch.id = 'punch-tour-launch'
const dismiss = document.createElement('button')
dismiss.type = 'button'
dismiss.textContent = 'Skip'
const launchLabel = document.createElement('span')
launchLabel.className = 'tour-launch-label'
launchLabel.textContent = 'PUNCH YOUR TRACE / 01—03'
launch.append(launchLabel, reopen, dismiss)
panel.hidden = cursor.hidden = launch.hidden = exitGuide.hidden = true
panel.append(exitGuide)
document.body.append(panel, livePreview, cursor, launch)

const chapterMenu = panel.querySelector('.tour-chapters')
const heading = panel.querySelector('.tour-section')
const actionLabel = panel.querySelector('.tour-action')
const chapterNumber = panel.querySelector('.tour-chapter-number')
const copy = panel.querySelector('.tour-copy')
const pauseButton = panel.querySelector('[data-command="pause"]')
const previousButton = panel.querySelector('[data-command="previous"]')
const nextButton = panel.querySelector('[data-command="next"]')
let run
let chapter = 0
let paused = false
let activeUnit = 0
const guideSpeed = .8 * .95
const motionEase = 'cubic-bezier(.42,0,.58,1)'
let demoRate = guideSpeed
const playbackRate = () => demoRate * (chapter === 2 ? 1.1 : 1)
let playback
let navigation = 0
let completionTimer
let closingAnimation
let replayFlight
let examplesReady = false
let highlighted
let lastCursor = null
let pointerMotion

function clearHighlight() {
  livePreview.hidden = true
  highlighted?.removeAttribute('data-punch-tour-target')
  highlighted = null
  pointerMotion?.cancel()
}

function caption(title, body, phase = '시연 중') {
  panel.dataset.phase = phase
  chapterNumber.textContent = String(chapter + 1).padStart(2, '0') + ' / ' + String(titles.length).padStart(2, '0')
  panel.setAttribute('aria-label', 'PUNCH YOUR TRACE walkthrough, chapter ' + (chapter + 1) + ' of ' + titles.length)
  heading.textContent = titles[chapter]
  actionLabel.textContent = title
  for (const item of chapterMenu.querySelectorAll('[data-jump]')) {
    if (Number(item.dataset.jump) === chapter) item.setAttribute('aria-current', 'step')
    else item.removeAttribute('aria-current')
  }
  copy.textContent = body || title
}

const exitDuration = motionReduced ? 0 : 220
const enterDuration = motionReduced ? 0 : 360
const captionTimeScale = 1.08
const chapterPace = () => [.8, .9, 1][chapter]
const readingTime = () => {
  const korean = (copy.textContent.match(/[가-힣]/g) ?? []).length
  const latin = (copy.textContent.match(/[A-Za-z0-9]+/g) ?? []).length
  return Math.max(1900, Math.min(6200, 600 + korean * 80 + latin * 250)) * .75 * captionTimeScale
}

async function transitionCaption(signal) {
  if (!panel.classList.contains('tour-caption-out')) {
    panel.classList.add('tour-caption-out')
    await hold(exitDuration, signal)
  }
}

async function revealCaption(signal, onReveal) {
  panel.classList.add('tour-caption-in')
  panel.classList.remove('tour-caption-out')
  if (!motionReduced) {
    await new Promise(requestAnimationFrame)
    await new Promise(requestAnimationFrame)
  }
  assertRunning(signal)
  panel.classList.remove('tour-caption-in')
  onReveal?.()
  await hold(enterDuration, signal)
}

function showPause() {
  pauseButton.title = paused ? 'Resume' : 'Pause'
  pauseButton.setAttribute('aria-label', pauseButton.title)
  pauseButton.innerHTML = paused ? playIcon : pauseIcon
  if (pointerMotion && ['running', 'paused'].includes(pointerMotion.playState)) {
    if (paused) pointerMotion.pause()
    else pointerMotion.play()
  }
}

function assertRunning(signal) {
  if (signal.aborted) throw signal.reason
}

async function hold(ms, signal, rate = playbackRate()) {
  ms /= rate
  let elapsed = 0
  while (elapsed < ms) {
    assertRunning(signal)
    const interval = Math.min(50, ms - elapsed)
    await new Promise(resolve => setTimeout(resolve, interval))
    if (!paused) elapsed += interval
  }
  assertRunning(signal)
}

// Shorten reading/idle time without accelerating cursor, click, scroll, or fades.
async function dwell(ms, signal, rate = playbackRate()) {
  await hold(ms * (chapter < 2 ? .84 : 1), signal, rate)
}

async function find(get, signal) {
  for (let i = 0; i < 80; i++) {
    assertRunning(signal)
    const element = get()
    if (element?.isConnected) return element
    await hold(100, signal, 1)
  }
  console.error('Guide target unavailable:', get.toString())
  throw new Error('A required screen did not open.')
}

function clickPoint(element, rangeValue = element.value) {
  // Native hover is disabled, but the virtual pointer still checks occlusion.
  root.classList.add('tour-virtual-hit-test')
  try {
  const rect = element.getBoundingClientRect()
  if (element.matches('input[type="range"]')) {
    const fraction = (Number(rangeValue) - Number(element.min)) / (Number(element.max) - Number(element.min))
    const inset = 8
    const x = rect.left + inset + clamp(fraction, 0, 1) * (rect.width - inset * 2)
    const y = rect.top + rect.height / 2
    if (element.contains(document.elementFromPoint(x, y))) return [x, y]
  }
  for (const [u, v] of [[0.5, 0.5], [0.25, 0.5], [0.75, 0.5], [0.5, 0.25], [0.5, 0.75]]) {
    const x = rect.left + rect.width * u
    const y = rect.top + rect.height * v
    if (element.contains(document.elementFromPoint(x, y))) return [x, y]
  }
  return null
  } finally {
    root.classList.remove('tour-virtual-hit-test')
  }
}

const clamp = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max))

function scrollContainer(element) {
  for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(parent).overflowY) && parent.scrollHeight > parent.clientHeight + 2) return parent
  }
  return document.scrollingElement
}

function visibleBounds(scroller) {
  const frame = scroller === document.scrollingElement
    ? {top:0, bottom:innerHeight}
    : scroller.getBoundingClientRect()
  const nav = scroller.closest('.browser-page')?.querySelector('.page-menu')?.getBoundingClientRect()
  return {
    top: Math.max(frame.top, nav?.bottom ?? 0) + 12,
    bottom: Math.min(panel.getBoundingClientRect().top, frame.bottom) - 12
  }
}

async function settle(element, signal, keepCaption, scene, center = false, edge) {
  const scroller = scrollContainer(element)
  const {top, bottom} = visibleBounds(scroller)
  const rect = element.getBoundingClientRect()
  const members = (scene?.() ?? []).filter(Boolean).map(node => node.getBoundingClientRect()).filter(box => box.height)
  const group = [rect, ...members]
  const groupTop = Math.min(...group.map(box => box.top))
  const groupBottom = Math.max(...group.map(box => box.bottom))
  const fits = groupBottom - groupTop <= bottom - top
  const focusTop = fits ? groupTop : rect.top
  const focusBottom = fits ? groupBottom : Math.min(rect.bottom, rect.top + bottom - top)
  const visible = focusTop >= top - 2 && focusBottom <= bottom + 2
  if (!edge && visible && (!center || Math.abs((focusTop + focusBottom - top - bottom) / 2) < 52)) return

  const start = scroller.scrollTop
  const offset = edge === 'top' ? rect.top - top : edge === 'bottom' ? rect.bottom - bottom
    : (focusTop + focusBottom - top - bottom) / 2
  const end = clamp(start + offset, 0, scroller.scrollHeight - scroller.clientHeight)
  const distance = end - start
  if (Math.abs(distance) < (visible ? 14 : 2)) return
  const duration = clamp(300 + Math.abs(distance) * .46, 350, 1150)
  const scrollClass = keepCaption ? 'tour-result-scrolling' : 'tour-scrolling'
  hideNativePointer()
  panel.classList.add(scrollClass)
  const anchor = scroller.style.overflowAnchor
  scroller.style.overflowAnchor = 'none'
  try {
    if (motionReduced) {
      scroller.scrollTo({top:end, behavior:'instant'})
      await new Promise(requestAnimationFrame)
      return
    }
    let elapsed = 0
    let previous = performance.now()
    while (elapsed < duration) {
      const now = await new Promise(requestAnimationFrame)
      assertRunning(signal)
      if (!paused) elapsed += Math.min(40, Math.max(0, now - previous)) * playbackRate()
      previous = now
      const progress = Math.min(1, elapsed / duration)
      const eased = progress * progress * progress * (10 + progress * (6 * progress - 15))
      scroller.scrollTo({top:start + distance * eased, behavior:'instant'})
    }
    await hold(55, signal)
  } finally {
    scroller.style.overflowAnchor = anchor
    if (!signal.aborted) panel.classList.remove(scrollClass)
  }
}

function positionCursor([x, y]) {
  return 'translate(' + x + 'px,' + y + 'px)'
}

function tapFeedback() {
  if (motionReduced) return
  cursor.querySelector('i').animate(
    [
      {transform:'scale(.48)', opacity:0, offset:0},
      {transform:'scale(.88)', opacity:.38, offset:.3},
      {transform:'scale(1.6)', opacity:0, offset:1}
    ],
    {duration:440 / playbackRate(), easing:'cubic-bezier(.32,0,.24,1)'}
  )
}

function soften(element, duration = 240, opacity = .84) {
  if (element && !motionReduced) {
    element.animate([{opacity}, {opacity:1}], {duration:duration / playbackRate(), easing:'cubic-bezier(.22,.61,.36,1)'})
  }
}

async function transitionGuideContent(element, signal, update) {
  assertRunning(signal)
  const content = element.closest('.page-content')
  if (!content || motionReduced) {
    update()
    return
  }
  const scrollTop = content.scrollTop
  const commit = async () => {
    if (signal.aborted) return
    update()
    await new Promise(requestAnimationFrame)
    await new Promise(requestAnimationFrame)
    if (!signal.aborted && content.isConnected && Math.abs(content.scrollTop - scrollTop) > 1) {
      content.scrollTop = scrollTop
    }
  }
  const personalWorkspace = element.closest('.app-usage-workspace')
  const recordWorkspace = element.closest(howSource) ?? element.closest('[data-testid="shared-records"]')
  if (personalWorkspace || recordWorkspace) {
    await commit()
    assertRunning(signal)
    const changed = recordWorkspace ?? personalWorkspace.querySelector('.app-usage-preview') ?? personalWorkspace.querySelector('.app-usage-editor')
    soften(changed, 190, .9)
    return
  }
  if (document.startViewTransition) {
    document.documentElement.classList.add('tour-content-transition-active')
    content.classList.add('tour-content-transition')
    const transition = document.startViewTransition(commit)
    const skip = () => transition.skipTransition()
    signal.addEventListener('abort', skip, {once:true})
    try {
      await transition.finished
    } finally {
      signal.removeEventListener('abort', skip)
      content.classList.remove('tour-content-transition')
      document.documentElement.classList.remove('tour-content-transition-active')
    }
  } else {
    const fade = content.animate([{opacity:1}, {opacity:.7}], {duration:120 / playbackRate(), easing:motionEase, fill:'forwards'})
    try {
      await fade.finished
      assertRunning(signal)
      await commit()
    } finally {
      fade.cancel()
    }
    if (!signal.aborted) soften(content, 360, .7)
  }
  assertRunning(signal)
}

async function pointAtHeading(element, signal) {
  const section = element.closest('.p26-block, .work-relation-section, .tp-workflow, .tp26-studio, .how-live, .app-usage-preview') ?? element;
  const heading = section.querySelector('.p26-section-head strong, .trace-transform-head strong, .app-usage-section-head strong, h3, strong');
  if (!heading) return;
  const text = document.createRange();
  text.selectNodeContents(heading);
  const bounds = text.getBoundingClientRect();
  if (bounds.bottom < 0 || bounds.top > innerHeight) return;
  await moveCursor([Math.min(innerWidth - 24, bounds.right + 18), bounds.top + bounds.height / 2], signal);
}

async function point(element, signal, click = false, fast = false, keepCaption = false, rangeValue, speed = 1, scene, center = false) {
  clearHighlight()
  highlighted = element
  const styleMenu = element.closest('.tp26-family-nav')
  if (styleMenu) {
    const menu = styleMenu.getBoundingClientRect()
    const item = element.getBoundingClientRect()
    const delta = item.left < menu.left ? item.left - menu.left : Math.max(0, item.right - menu.right)
    if (delta) styleMenu.scrollTo({left:styleMenu.scrollLeft + delta, behavior:'instant'})
  }
  const card = click && element.matches('input[type="number"]') ? element.closest('[data-testid="p26-digit-card"]') : null
  const field = click && element.matches('select, input[type="range"]') ? element.closest('label') : null
  await settle(card ?? field ?? element, signal, keepCaption, scene, center)
  if (!click) {
    element.setAttribute('data-punch-tour-target', 'result')
    await pointAtHeading(element, signal)
    return
  }
  let destination = clickPoint(element, rangeValue)
  if (!destination) {
    await settle(element, signal, keepCaption, undefined, true)
    destination = clickPoint(element, rangeValue)
  }
  if (!destination) throw new Error('The next control is obscured.')

  await moveCursor(destination, signal, fast, speed)
  let current = clickPoint(element, rangeValue)
  if (!current) {
    await settle(card ?? field ?? element, signal, keepCaption, scene)
    current = clickPoint(element, rangeValue)
  }
  if (!current) throw new Error('The target moved out of view.')
  if (Math.hypot(current[0] - destination[0], current[1] - destination[1]) > 3) {
    await moveCursor(current, signal, true, 1.35)
  }
}

async function moveCursor(destination, signal, fast = false, speed = 1) {
  const [x, y] = destination
  const from = lastCursor ?? [Math.max(8, x - 42), Math.min(innerHeight - 24, y + 30)]
  const distance = Math.hypot(x - from[0], y - from[1])
  // Small layout corrections should glide briefly, not replay a full-length move.
  const duration = (distance < 80
    ? clamp(130 + distance * 2, 140, 285)
    : fast ? clamp(220 + distance * .34, 285, 430) : clamp(255 + distance * .56, 350, 650)) / speed
  assertRunning(signal)
  cursor.hidden = false
  if (!motionReduced && distance > 1) {
    const motion = cursor.animate([
      {transform:positionCursor(from)},
      {transform:positionCursor(destination)}
    ], {duration:duration / playbackRate(), easing:motionEase, fill:'forwards'})
    pointerMotion = motion
    if (paused) motion.pause()
    const cancel = () => motion.cancel()
    signal.addEventListener('abort', cancel, {once:true})
    try {
      await motion.finished
      assertRunning(signal)
      cursor.style.transform = positionCursor(destination)
    } finally {
      signal.removeEventListener('abort', cancel)
      if (pointerMotion === motion) pointerMotion = undefined
      motion.cancel()
    }
  } else {
    cursor.style.transform = positionCursor(destination)
  }
  lastCursor = destination
}

function showLivePreview(control, source) {
  const graphic = source()
  if (!graphic) return
  const view = graphic.cloneNode(true)
  livePreview.querySelector('.tour-live-art').replaceChildren(view)
  const value = control.selectedOptions?.[0]?.textContent ?? control.closest('label')?.querySelector('b')?.textContent
  livePreview.querySelector('strong').textContent = value ?? ''
  const target = control.getBoundingClientRect()
  const footer = query('.trace-footer')?.getBoundingClientRect()
  livePreview.classList.toggle('tour-live-left', target.left + target.width / 2 > innerWidth / 2)
  livePreview.classList.toggle('tour-live-low', target.top < 255)
  livePreview.style.setProperty('--tour-live-bottom', innerHeight - (footer?.top ?? innerHeight) + 10 + 'px')
  livePreview.hidden = false
}

async function act(get, title, body, signal, apply = element => element.click(), fast = false, outcome, live, afterGroup = false, destinationValue, scene, readingScale = 1, center = true, frameResult) {
  const element = await find(get, signal)
  await transitionCaption(signal)
  await point(element, signal, true, fast, false, destinationValue, 1, scene, center)
  if (live) showLivePreview(element, live)
  await hold(live ? 480 : fast ? 200 : outcome ? 420 : 260, signal)
  assertRunning(signal)
  if (afterGroup) {
    tapFeedback()
    await apply(element, signal)
    assertRunning(signal)
    caption(title, body, '적용 결과')
    alignCaption()
    await frameResult?.(signal)
    if (outcome) await point(await find(outcome, signal), signal, false, false, false, undefined, 1, scene)
    await revealCaption(signal)
    await dwell(readingTime() * chapterPace() * readingScale, signal)
    return
  }
  caption(title, body)
  let applied
  await revealCaption(signal, () => {
    tapFeedback()
    applied = Promise.resolve(apply(element, signal)).then(() => {
      assertRunning(signal)
      if (live) showLivePreview(element, live)
    }).catch(error => error)
  })
  const failure = await applied
  if (failure) throw failure
  if (outcome) await point(await find(outcome, signal), signal, false, false, true)
  await dwell((fast ? 700 * captionTimeScale : readingTime()) * chapterPace() * readingScale, signal)
}

const importedExamples = new Map()

async function importExample(scope, ids, signal) {
  const input = query(scope + ' [data-testid="tracker-file-input"]')
  if (!input) throw new Error('The file picker is unavailable.')
  const records = await Promise.all([...ids].map(async id => {
    const name = 'Example-' + id + '.json'
    const response = await fetch(new URL(name, import.meta.url), {signal})
    if (!response.ok) throw new Error('예시 기록을 읽을 수 없습니다.')
    const content = await response.text()
    return {id, name, content, recordId:JSON.parse(content).export.contentSha256}
  }))
  const files = new DataTransfer()
  for (const {id, name, content, recordId} of records) {
    importedExamples.set(id, recordId)
    files.items.add(new File([content], name, {type:'application/json'}))
  }
  assertRunning(signal)
  input.dataset.punchTourImport = "true"
  input.files = files.files
  input.dispatchEvent(new Event('change', {bubbles:true}))
  delete input.dataset.punchTourImport
  await find(() => input.files.length === 0 ? input : null, signal)
  if (query(scope + ' [data-testid="tracker-import-error"]')) throw new Error('The sample record could not be opened.')
}

function setInput(element, value) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  setter.call(element, String(value))
  element.dispatchEvent(new Event('input', {bubbles:true}))
}

function choose(element, match) {
  const option = [...element.options].find(item => !item.disabled && match(item))
  if (!option) throw new Error('시연에 필요한 선택 항목을 찾지 못했습니다.')
  element.value = option.value
  element.dispatchEvent(new Event('change', {bubbles:true}))
}

const exampleRecord = (id, scope = root) => [...(scope?.querySelectorAll('[data-testid="tracker-record"]') ?? [])]
  .find(element => element.dataset.recordId === importedExamples.get(id))
const personRecord = (index) => root.querySelectorAll('[data-testid="participant-record"]')[index]
const firstOverlay = () => query('.our-comparison-section .p26-trace-overlay-card')
const participantApps = index => personRecord(index)?.closest('article')?.querySelector('.participant-app-grid')
const overlayScene = () => [
  query('.our-comparison-section .p26-shared-overlays .p26-section-head'),
  query('.our-comparison-section .p26-shared-overlays .p26-legend'),
  firstOverlay()
]
const importScene = () => [picker(personal), exampleRecord('A')]
const canvas = () => query(artboard + ' svg')
const style = (name) => button(name, query('.tp26-family-nav') ?? root)
const layout = name => button(name, query('.tp26-layout-choice') ?? root)
const range = (name) => [...root.querySelectorAll('.tp26-controls label')]
  .find(element => element.textContent.startsWith(name))?.querySelector('input[type="range"]')

async function result(get, title, body, signal, extraTime = 850, brief = false, scene, edge, readingScale = 1) {
  const element = await find(get, signal)
  await transitionCaption(signal)
  caption(title, typeof body === 'function' ? body(element) : body, '적용 결과')
  alignCaption()
  if (edge) {
    await settle(element, signal, false, scene, false, edge)
    await pointAtHeading(element, signal)
  }
  else await point(element, signal, false, false, false, undefined, 1, scene, !scene)
  await revealCaption(signal)
  await dwell((brief ? 1500 : readingTime() + extraTime * .75 * captionTimeScale) * chapterPace() * readingScale, signal)
}

const manualCount = () => query('[data-testid="p26-digit-card"] input[type="number"]')
const manualGraphic = (input, value) => {
  const graphic = input.closest('article')?.querySelector('.p26-digits')
  return graphic?.getAttribute('aria-label') === value ? graphic : null
}

async function showMetricChoices(element, signal) {
  const menu = document.createElement('div')
  menu.className = 'tour-metric-choices'
  menu.setAttribute('aria-hidden', 'true')
  let target
  for (const option of element.options) {
    if (option.disabled) continue
    const item = document.createElement('div')
    item.textContent = option.textContent
    if (option.value === 'app_activation_count') target = item
    menu.append(item)
  }
  if (!target) throw new Error('시연에 필요한 지표가 없습니다.')
  const rect = element.getBoundingClientRect()
  document.body.append(menu)
  const bounds = visibleBounds(scrollContainer(element))
  menu.style.width = Math.min(Math.max(rect.width, 190), innerWidth - 24) + 'px'
  menu.style.left = clamp(rect.left, 12, innerWidth - menu.offsetWidth - 12) + 'px'
  const below = Math.max(0, bounds.bottom - rect.bottom - 4)
  const above = Math.max(0, rect.top - bounds.top - 4)
  const opensBelow = menu.offsetHeight <= below || below >= above
  menu.style.maxHeight = Math.max(1, opensBelow ? below : above) + 'px'
  menu.style.top = (opensBelow ? rect.bottom + 4 : rect.top - menu.offsetHeight - 4) + 'px'
  try {
    menu.scrollTop = Math.max(0, target.offsetTop + target.offsetHeight - menu.clientHeight)
    soften(menu, 220, 0)
    await hold(150, signal)
    const row = target.getBoundingClientRect()
    await moveCursor([row.left + Math.min(35, row.width / 2), row.top + row.height / 2], signal, true)
    target.classList.add('tour-metric-choice-next')
    await hold(150, signal)
    tapFeedback()
    const close = motionReduced ? null : menu.animate([{opacity:1},{opacity:0}], {
      duration:180 / playbackRate(), easing:motionEase, fill:'forwards'
    })
    try {
      await transitionGuideContent(element, signal, () => {
        choose(element, item => item.value === 'app_activation_count')
      })
      await close?.finished
      assertRunning(signal)
    } finally {
      close?.cancel()
    }
  } finally {
    menu.remove()
  }
}

async function revealGuideSection(container, getSection, signal, update) {
  if (!container || motionReduced) return update()
  const before = getSection()?.getBoundingClientRect().height ?? 0
  let animation
  const observer = new MutationObserver(() => {
    const section = getSection()
    const after = section?.getBoundingClientRect().height ?? 0
    if (!section || Math.abs(after - before) < 1) return
    observer.disconnect()
    animation = section.animate([
      {height:before + 'px', opacity:before ? .8 : 0, overflow:'clip', boxSizing:'border-box'},
      {height:after + 'px', opacity:1, overflow:'clip', boxSizing:'border-box'}
    ], {duration:340 / playbackRate(), easing:motionEase})
  })
  observer.observe(container, {childList:true, subtree:true})
  const cancel = () => animation?.cancel()
  signal.addEventListener('abort', cancel, {once:true})
  try {
    await update()
    await animation?.finished
    assertRunning(signal)
  } finally {
    observer.disconnect()
    signal.removeEventListener('abort', cancel)
    cancel()
  }
}

// Keep a selected record anchored; only its selected colour should transition.
async function selectGuideRecord(record, signal) {
  const scroller = scrollContainer(record)
  const anchor = scroller.style.overflowAnchor
  const top = scroller.scrollTop
  scroller.style.overflowAnchor = 'none'
  try {
    assertRunning(signal)
    record.click()
    await new Promise(requestAnimationFrame)
    await new Promise(requestAnimationFrame)
    assertRunning(signal)
    scroller.scrollTop = top
  } finally {
    scroller.style.overflowAnchor = anchor
  }
}

async function simulatePickerClick(file, signal) {
  await point(file, signal, true, false, true)
  await hold(120, signal)
  assertRunning(signal)
  tapFeedback()
  file.dataset.punchTourClick = 'true'
  if (!motionReduced) file.animate([
    {backgroundColor:'#fff',color:'#111'},
    {backgroundColor:'#eef0f3',color:'#001ef7',offset:.35},
    {backgroundColor:'#fff',color:'#111'}
  ], {duration:440 / playbackRate(),easing:motionEase})
  try { await hold(420, signal) }
  finally { delete file.dataset.punchTourClick }
}

let personalSessionActive = false
function beginPersonalSession() {
  if (personalSessionActive) return false
  document.dispatchEvent(new Event('punch-guide-records-start'))
  query('.browser-shell')?.dispatchEvent(new Event('punch-guide-personal-start'))
  personalSessionActive = true
  examplesReady = false
  return true
}
function restorePersonalSession() {
  if (!personalSessionActive) return
  restoreTraceSession?.()
  document.dispatchEvent(new Event('punch-guide-records-end'))
  query('.browser-shell')?.dispatchEvent(new Event('punch-guide-personal-end'))
  personalSessionActive = false
  restoreGuideManual = undefined
}

let restoreTraceSession
function ensureTraceSession() {
  if (restoreTraceSession) return
  const workspace = query('.browser-shell')
  workspace.dispatchEvent(new Event('punch-guide-trace-start'))
  restoreTraceSession = () => {
    workspace.dispatchEvent(new Event('punch-guide-trace-end'))
    restoreTraceSession = undefined
  }
}

async function chooseDemoFile({mode, scope, ids, recordId, copy, scene, resetRecord = false, beforeModeChange, recordSpeed = 1}, signal) {
  await transitionCaption(signal)
  const modeButton = await find(() => query(mode), signal)
  const modeSelected = modeButton.getAttribute('aria-pressed') === 'true' || modeButton.classList.contains('is-selected')
  await point(modeButton, signal, true, false)
  await hold(120, signal)
  assertRunning(signal)
  tapFeedback()
  if (!modeSelected || resetRecord) {
    const workspace = modeButton.closest('.page-content')
    await revealGuideSection(workspace, () => query(scope)?.querySelector('.tk-list'), signal,
      () => transitionGuideContent(modeButton, signal, () => {
        if (resetRecord) modeButton.dataset.punchTourResetRecord = 'true'
        try {
          beforeModeChange?.()
          modeButton.click()
        } finally {
          delete modeButton.dataset.punchTourResetRecord
        }
      }))
  }

  const file = await find(() => picker(scope), signal)
  await point(file, signal, true, true, false, undefined, 1.25, scene)
  caption('CHOOSE FILE', copy)
  const workspace = query(scope)
  await Promise.all([
    revealCaption(signal, tapFeedback),
    revealGuideSection(workspace, () => workspace?.querySelector('.tk-list'), signal,
      () => importExample(scope, ids, signal))
  ])
  const record = await find(() => exampleRecord(recordId, query(scope)), signal)
  const previousRate = demoRate
  demoRate *= recordSpeed
  try {
    await point(record, signal, true, false, true, undefined, 1.12, () => [file, record])
    const target = clickPoint(record)
    if (target && Math.hypot(target[0] - lastCursor[0], target[1] - lastCursor[1]) > 2) {
      await moveCursor(target, signal, true, 1.25)
    }
    tapFeedback()
    await selectGuideRecord(record, signal)
    if (recordId === 'A') examplesReady = true
    await hold(200, signal)
  } finally {
    demoRate = previousRate
  }
}

let restoreGuideManual

async function manualInputDemo(signal) {
  if (!query('[data-testid="usage-mode-manual"]')) tab(titles[0])?.click()
  await act(() => query('[data-testid="usage-mode-manual"]'), 'MANUAL INPUT',
    'MANUAL INPUT에서는 기록 파일 없이 앱별 실행 횟수를 직접 조정할 수 있습니다.', signal,
    undefined, false, undefined, undefined, false, undefined, undefined, .6)
  const demoOption = !manualCount() && query('.app-usage-selection [data-app-id="figma"]')
  if (demoOption) demoOption.click()
  const count = await find(manualCount, signal)
  const originalValue = count.value
  let restored = false
  const restoreManual = () => {
    if (restored) return
    restored = true
    if (demoOption && demoOption.isConnected) demoOption.click()
    else if (count.isConnected) setInput(count, originalValue)
  }
  signal.addEventListener('abort', restoreManual, {once:true})
  restoreGuideManual = restoreManual
  try {
    setInput(count, 42)
    await find(() => manualGraphic(count, '42'), signal)
    await act(() => count.isConnected ? count : null, 'EDIT VALUE',
      '실행 횟수를 직접 바꾸면 입력한 숫자에 맞춰 카드의 펀치 모양이 달라집니다.', signal,
      async (element, runSignal) => {
        setInput(element, 58)
        soften(await find(() => manualGraphic(count, '58'), runSignal), 260, .82)
      }, false, () => count.closest('article'), undefined, false, undefined, undefined, .6)
  } catch (error) {
    restoreManual()
    throw error
  }
}

async function personalImportDemo(signal) {
  await chooseDemoFile({
    mode: '[data-testid="usage-mode-tracker"]', scope: personal, ids: 'AB', recordId: 'A',
    copy: '파일 선택에서 Tracker가 내보낸 PUNCH DATA를 불러오고, 목록에서 사용할 기록을 고릅니다.',
    scene: importScene, resetRecord: true, beforeModeChange: () => restoreGuideManual?.()
  }, signal)
  // Let the selected record settle before introducing its metric controls.
  await hold(420, signal)
}

async function visualizeDemo(signal) {
  if (!query('[data-testid="tracker-metric"]')) await preparePersonal(signal)
  await act(() => query('[data-testid="tracker-metric"]'), 'WHAT TO COUNT',
    '그래픽으로 표현할 데이터를 선택합니다.', signal,
    showMetricChoices, true, undefined, undefined, false, undefined,
    () => [exampleRecord('A', query(personal)), query('[data-testid="tracker-metric"]')], 1, false)
  await result(() => query('.app-usage-preview .app-usage-section-head'), 'APP SWITCH-INS',
    '선택한 지표로 카드의 숫자가 다시 계산되고, 펀치 그래픽도 그 숫자에 맞춰 바뀝니다.', signal, 100, false, () => [query('.app-usage-preview [data-testid="p26-digit-card"]')], undefined, .7)
  await hold(420, signal)
}

const howSource = '[data-testid="how-source"]'
const liveTrace = () => query('.how-live .mini-trace')
const traceToggle = () => query('.trace-footer .trace-toggle')
const traceExport = () => query('.trace-footer .trace-export-button')
const traceClear = () => query('.trace-footer .clear-button')
const contourExport = () => query('.how-contour .trace-contour-export-button')
const liveTraceScene = () => [query('.how-live .how-live-head'), liveTrace()]

function tracePointer(target, type, [clientX, clientY]) {
  target.dispatchEvent(new PointerEvent(type, {
    bubbles:true, pointerType:'mouse', pointerId:801, isPrimary:true,
    clientX, clientY, button:type === 'pointermove' ? -1 : 0,
    buttons:type === 'pointerup' ? 0 : 1, pressure:type === 'pointerup' ? 0 : .5
  }))
}

async function drawLiveTrace(signal) {
  const surface = await find(liveTrace, signal)
  const section = await find(() => query('.p26-legacy-how'), signal)
  const heading = await find(() => section.querySelector('h3'), signal)
  const description = section.querySelector('p')
  const controls = section.querySelector('.app-option-grid')
  await settle(heading, signal, true, () => [description, controls, surface], true)
  const bounds = visibleBounds(scrollContainer(heading))
  const rect = heading.getBoundingClientRect()
  const text = document.createRange()
  text.selectNodeContents(heading)
  const title = text.getBoundingClientRect()
  const x = fraction => rect.left + rect.width * fraction
  const titleY = title.top + title.height / 2
  const gapTop = description.getBoundingClientRect().bottom
  const gapBottom = controls.getBoundingClientRect().top
  const gapY = clamp((gapTop + gapBottom) / 2, bounds.top + 8, bounds.bottom - 8)
  const clicks = [
    {at:[title.left + title.width * .48, titleY], count:1, target:heading},
    {at:[x(.77), titleY], count:2, target:section},
    {at:[x(.89), gapY], count:1, target:section}
  ]
  for (const {at, count, target} of clicks) {
    await moveCursor(at, signal, true)
    for (let click = 0; click < count; click++) {
      tapFeedback()
      tracePointer(target, 'pointerdown', at)
      await hold(45, signal)
      tracePointer(target, 'pointerup', at)
      if (click + 1 < count) await hold(100, signal)
    }
    await hold(110, signal)
  }
  const from = [x(.31), gapY]
  const to = [x(.65), gapY]
  await moveCursor(from, signal, true)
  tracePointer(section, 'pointerdown', from)
  try {
    for (let step = 1; step <= 18; step++) {
      await hold(22, signal)
      const progress = (1 - Math.cos(Math.PI * step / 18)) / 2
      const at = [from[0] + (to[0] - from[0]) * progress,
        from[1] + (to[1] - from[1]) * progress - Math.sin(Math.PI * progress) * Math.min(5, (gapBottom - gapTop) / 3)]
      cursor.style.transform = positionCursor(at)
      lastCursor = at
      tracePointer(section, 'pointermove', at)
    }
  } finally {
    tracePointer(section, 'pointerup', lastCursor ?? from)
  }
  await find(() => surface.querySelectorAll('[data-ring]').length === 4 &&
    query('.trace-status > span:nth-child(3) b')?.textContent === '1' ? surface : null, signal)
}

async function interactionLiveDemo(signal) {
  ensureTraceSession()
  const restore = () => {}
  try {
    const live = await find(() => query('[data-testid="how-mode-live"]'), signal)
    await transitionCaption(signal)
    await settle(await find(() => query('.interaction-section-head'), signal), signal, false,
      () => [query('.interaction-section-head'), query('#punch-tour-live'), query('.how-live-head')], false, 'top')
    if (!live.classList.contains('is-selected')) {
      await point(live, signal, true, false)
      tapFeedback()
      live.click()
      await new Promise(requestAnimationFrame)
    }
    await point(await find(traceToggle, signal), signal, true, false)
    caption('LIVE INPUT', 'TRACE ON을 켜면 지금 화면에서 남기는 클릭과 드래그가 실시간 그래픽으로 바뀝니다.')
    alignCaption()
    await revealCaption(signal, () => {
      tapFeedback()
      if (traceToggle().getAttribute('aria-pressed') !== 'true') traceToggle().click()
    })
    await drawLiveTrace(signal)
    await dwell(550 * .75, signal)

    await act(traceExport, 'EXPORT TRACE', '하단 EXPORT에서 방금 만든 흔적을 그래픽으로 내보낼 수 있습니다.',
      signal, () => {}, false, undefined, undefined, true, undefined, undefined, .6)

    const clear = await find(traceClear, signal)
    await transitionCaption(signal)
    await point(clear, signal, true, true)
    tapFeedback()
    clear.click()
    await find(() => query('.how-contour .trace-contour-empty'), signal)

    await hold(420, signal)
    return restore
  } catch (error) {
    restore()
    throw error
  }
}

async function interactionImportDemo(signal) {
  ensureTraceSession()
  const restore = () => {}
  try {
    await chooseDemoFile({
      mode: '[data-testid="how-mode-tracker"]', scope: howSource, ids: ['Trace'], recordId: 'Trace', recordSpeed: 1.25,
      copy: '파일 선택에서 개별 클릭 좌표가 담긴 PUNCH DATA를 불러옵니다.'
    }, signal)
    await find(() => liveTrace()?.querySelector('[data-ring]') && !contourExport()?.disabled ? liveTrace() : null, signal)
    await result(liveTrace, 'IMPORTED TRACE',
      '기록에 담긴 클릭은 원래 화면 비율에 맞춰 그려집니다. 가까운 위치에서 반복된 클릭은 겹친 고리로 표시됩니다.',
      signal, 650, false, liveTraceScene, undefined, .6)

    await transitionCaption(signal)
    await point(await find(contourExport, signal), signal, true, true, false, undefined, 1,
      () => [query('.how-contour')])
    tapFeedback()
    caption('EXPORT CONTOUR', '클릭 위치와 밀도로 만든 윤곽 그래픽은 EXPORT CONTOUR에서 이미지로 내보낼 수 있습니다.')
    await revealCaption(signal)
    await dwell(readingTime() * chapterPace(), signal)
    await transitionCaption(signal)
    return restore
  } catch (error) {
    restore()
    throw error
  }
}

async function clickChapter(index, signal, finishPrevious) {
  await transitionCaption(signal)
  const menuTab = await find(() => tab(titles[index]), signal)
  const destination = clickPoint(menuTab)
  if (!destination) throw new Error('The next chapter tab is obscured.')
  await moveCursor(destination, signal)
  await hold(180, signal)
  tapFeedback()
  hideNativePointer()
  root.classList.add('tour-chapter-changing')
  try {
    menuTab.click()
    const content = await find(() => query(index === 2 ? '.tp26-family-nav' : '.our-trace-workspace'), signal)
    finishPrevious?.()
    const scroller = scrollContainer(content)
    scroller.scrollTo({top:0, behavior:'instant'})
    await new Promise(requestAnimationFrame)
    assertRunning(signal)
  } finally {
    if (!signal.aborted) root.classList.remove('tour-chapter-changing')
  }
  soften(query('.page-content'), 290, .72)
  if (index !== 1) await dwell(700, signal)
}

const sharedRecord = id => {
  const library = query('[data-testid="shared-records"]')
  return library ? exampleRecord(id, library) : null
}
const sharedRecordScene = () => [picker(shared), sharedRecord('A'), sharedRecord('B')]
const sharedCardsScene = () => [participantApps(0), participantApps(1)]

async function appCardsDemo(signal) {
  await transitionCaption(signal)
  caption('COMPARE RECORDS', '파일 선택 아래 목록에서 기록을 고르면 선택한 순서대로 참가자 카드에 적용됩니다.')
  alignCaption()
  const file = await find(() => picker(shared), signal)
  await point(file, signal, true, false, false)
  await revealCaption(signal)
  await simulatePickerClick(file, signal)
  const previousRate = demoRate
  demoRate *= 1.25
  try {
    for (const [index, example] of ['A', 'B'].entries()) {
      const record = await find(() => sharedRecord(example), signal)
      await point(record, signal, true, true, true, undefined, 1, sharedRecordScene)
      tapFeedback()
      await transitionGuideContent(record, signal, () => record.click())
      await find(() => personRecord(index)?.value === importedExamples.get(example) ? personRecord(index) : null, signal)
      if (index === 0) await hold(260, signal)
    }
  } finally {
    demoRate = previousRate
  }
  await dwell(500, signal, guideSpeed)
  const apps = await find(() => participantApps(0), signal)
  await settle(apps, signal, true, sharedCardsScene, true)
  await dwell(readingTime() * chapterPace(), signal)
}

async function prepareComparison(signal) {
  for (const example of ['A', 'B']) {
    const record = await find(() => sharedRecord(example), signal)
    if (record.getAttribute('aria-pressed') !== 'true') {
      record.click()
      await find(() => sharedRecord(example)?.getAttribute('aria-pressed') === 'true' ? sharedRecord(example) : null, signal)
    }
  }
}

async function ourTraceDemo(signal) {
  await prepareComparison(signal)
  await result(firstOverlay, 'OUR TRACE',
    '같은 앱의 사용량을 그린 두 이미지가 겹쳐집니다. A는 파란색, B는 민트 윤곽입니다.', signal, 450, false, overlayScene)
}

async function overlapDemo(signal) {
  await prepareComparison(signal)
  await result(() => query('.p26-moved-overlap .p26-shared-chart-wrap'), 'OVERLAP GRAPH',
    '공통 앱의 작은 사용량을 큰 사용량으로 나눈 비율이 0~10단계 높이로 표시됩니다.', signal, 650, false,
    () => [query('.p26-moved-overlap .p26-section-head'), query('.p26-moved-overlap .p26-shared-chart-wrap')])
}

async function teamDemo(signal) {
  await prepareComparison(signal)
  const button = await find(() => query('.our-export-bottom .our-export-button'), signal)
  await transitionCaption(signal)
  caption('TEAM PROFILE', '팀의 작업 특성을 살펴보고, 아래 EXPORT WORK FIELD에서 비교 카드를 내보낼 수 있습니다.', '적용 결과')
  alignCaption()
  await settle(button.closest('.our-export-bottom'), signal, false, undefined, false, 'bottom')
  await Promise.all([
    revealCaption(signal),
    point(button, signal, true, false, true, undefined, .75)
  ])
  tapFeedback()
  await dwell(readingTime() * chapterPace(), signal)
}

async function settlePrintArtwork(signal) {
  await new Promise(requestAnimationFrame)
  await new Promise(requestAnimationFrame)
  assertRunning(signal)
  const sources = new Set([...canvas()?.querySelectorAll('image') ?? []].map(image => image.getAttribute('href')).filter(Boolean))
  const decoding = [...sources].map(source => {
    const image = new Image()
    image.src = source
    return image.decode()
  })
  await Promise.race([Promise.allSettled(decoding), hold(900, signal)])
  assertRunning(signal)
  soften(canvas(), 290, .77)
}

async function glideRange(element, target, signal) {
  const start = Number(element.value)
  if (motionReduced || start === target) {
    setInput(element, target)
    return
  }

  const track = document.createElement('div')
  track.className = 'tour-range-motion'
  track.setAttribute('aria-hidden', 'true')
  track.append(document.createElement('i'), document.createElement('b'))
  document.body.append(track)
  element.classList.add('tour-range-moving')
  const fraction = value => (value - Number(element.min)) / (Number(element.max) - Number(element.min))
  const paint = value => {
    const rect = element.getBoundingClientRect()
    const position = 8 + fraction(value) * (rect.width - 16)
    track.style.left = rect.left + 'px'
    track.style.top = (rect.top + rect.height / 2) + 'px'
    track.style.width = rect.width + 'px'
    track.style.setProperty('--tour-thumb', position + 'px')
  }

  try {
    paint(start)
    let elapsed = 0
    let previous = performance.now()
    const duration = 520
    while (elapsed < duration) {
      const now = await new Promise(requestAnimationFrame)
      assertRunning(signal)
      if (!paused) elapsed += Math.min(34, Math.max(0, now - previous)) * playbackRate()
      previous = now
      const progress = Math.min(1, elapsed / duration)
      const eased = progress * progress * progress * (10 + progress * (6 * progress - 15))
      paint(start + (target - start) * eased)
    }
    setInput(element, target)
    element.classList.remove('tour-range-moving')
    track.style.opacity = '0'
    await hold(120, signal)
  } finally {
    track.remove()
    element.classList.remove('tour-range-moving')
  }
}

async function printDemo(signal) {
  await selectPrintOption(() => layout('GRID'), signal)
  await selectPrintOption(() => style('TRACE'), signal)
  caption('GRAPHIC STYLE', '상단 바에서 원하는 이미지 스타일을 선택할 수 있습니다.')
  alignCaption()
  const start = await find(() => query('.tp26-topline, .tp26-family-nav'), signal)
  await settle(start, signal, false, undefined, false, 'top')
  const punch = await find(() => style('PUNCH'), signal)
  await point(punch, signal, true, true)
  await revealCaption(signal, () => {
    tapFeedback()
    punch.click()
  })
  await settlePrintArtwork(signal)
  await hold(800, signal)
  const density = await find(() => style('DENSITY'), signal)
  await point(density, signal, true, true, true)
  tapFeedback()
  density.click()
  await settlePrintArtwork(signal)
  await hold(800, signal)
  const characteristic = await find(() => style('CHARACTERISTIC'), signal)
  await point(characteristic, signal, true, true, true)
  tapFeedback()
  characteristic.click()
  await settlePrintArtwork(signal)
  await dwell(readingTime(), signal)
}

async function selectPrintOption(get, signal) {
  const option = await find(get, signal)
  if (option.getAttribute('aria-pressed') !== 'true') option.click()
}

async function compositionDemo(signal) {
  await transitionCaption(signal)
  await selectPrintOption(() => style('CHARACTERISTIC'), signal)
  await selectPrintOption(() => layout('GRID'), signal)
  await find(() => layout('GRID')?.getAttribute('aria-pressed') === 'true' &&
    !canvas()?.classList.contains('tp26-artboard--row') ? canvas() : null, signal)
  await settlePrintArtwork(signal)

  const row = await find(() => layout('ROW'), signal)
  await point(row, signal, true, true)
  caption('COMPOSITION', 'GRID에서 ROW로 바꾸면 앱 그래픽이 한 줄로 나란히 배치됩니다.')
  await revealCaption(signal)
  await hold(360, signal)
  tapFeedback()
  row.click()
  await find(() => canvas()?.classList.contains('tp26-artboard--row') ? canvas() : null, signal)
  await settlePrintArtwork(signal)
  await dwell(readingTime(), signal)
}

async function framePrintResult(signal) {
  const actions = await find(() => query('.tp26-actions'), signal)
  await settle(actions, signal, false, undefined, false, 'bottom')
}

async function adjustmentDemo(signal) {
  await selectPrintOption(() => style('CHARACTERISTIC'), signal)
  await selectPrintOption(() => layout('ROW'), signal)
  setInput(await find(() => range('PATTERN REPEAT'), signal), 2)
  await new Promise(requestAnimationFrame)
  await transitionCaption(signal)
  const copy = 'PATTERN REPEAT로 반복 횟수를 바꾸고, 조절 바에서 그래픽의 비율과 간격을 다듬을 수 있습니다.'
  const sixRepeats = 4
  await act(() => range('PATTERN REPEAT'), 'ADJUST', copy, signal, async (repeat, runSignal) => {
    await glideRange(repeat, sixRepeats, runSignal)
    await settlePrintArtwork(runSignal)
    await find(() => canvas()?.getAttribute('aria-label')?.includes('6회') ? canvas() : null, runSignal)
  }, false, undefined, undefined, true, sixRepeats, undefined, .85, false)
}

async function selectWorkflowExample(signal) {
  const recordId = importedExamples.get('A')
  const record = await find(() => {
    const select = query('.tp26-record-select')
    return select && [...select.options].some(option => option.value === recordId) ? select : null
  }, signal)
  if (record.value !== recordId) choose(record, option => option.value === recordId)
}

async function workflowDemo(signal) {
  await selectWorkflowExample(signal)
  const save = await find(() => query('.tp-workflow-save'), signal)
  await result(() => save.closest('.tp-workflow-export'), 'WORKFLOW',
    '앱 전환 순서에 따른 그래픽 흐름으로 나의 작업 흐름을 시각화합니다.',
    signal, 500, false, () => [query('#tp-workflow-title'), query('.tp-workflow-board')], 'bottom', 1 / 1.4)
}

async function finishDemo(signal) {
  await selectWorkflowExample(signal)
  const save = await find(() => query('.tp-workflow-save'), signal)
  await transitionCaption(signal)
  caption('GUIDE COMPLETE', '이제 내 기록을 불러와 직접 그래픽을 만들어 보세요. 가이드를 다시 보려면 오른쪽의 GUIDE를 누르세요.', '적용 결과')
  alignCaption()
  if (!clickPoint(save)) await settle(save, signal, false)
  const destination = clickPoint(save)
  if (!destination) throw new Error('저장 버튼이 화면에 보이지 않습니다.')
  await Promise.all([revealCaption(signal), moveCursor(destination, signal, false, .8 / 1.1)])
  // Final pointer arrival is followed by an exact, unscaled half-second beat.
  await hold(500, signal, 1)
  assertRunning(signal)
  await showReplay(save.getBoundingClientRect(), false)
}

const units = [
  {chapter:0, demo:manualInputDemo},
  {chapter:0, demo:personalImportDemo},
  {chapter:0, demo:visualizeDemo},
  {chapter:0, demo:interactionLiveDemo},
  {chapter:0, demo:interactionImportDemo},
  {chapter:1, demo:appCardsDemo},
  {chapter:1, demo:ourTraceDemo},
  {chapter:1, demo:overlapDemo},
  {chapter:1, demo:teamDemo},
  {chapter:2, demo:printDemo, rate:1.4},
  {chapter:2, demo:compositionDemo},
  {chapter:2, demo:adjustmentDemo},
  {chapter:2, demo:workflowDemo}
]

async function preparePersonal(signal) {
  tab(titles[0])?.click()
  const mode = await find(() => query('[data-testid="usage-mode-tracker"]'), signal)
  mode.click()
  await find(() => picker(personal), signal)
  await importExample(personal, 'AB', signal)
  const record = await find(() => exampleRecord('A', query(personal)), signal)
  if (record.getAttribute('aria-pressed') !== 'true') record.click()
  examplesReady = true
}

const captionLine = panel.querySelector('.tour-line')
let reservedCaptionHeight = 0
function alignCaption() {
  if (panel.hidden) return
  const footer = query('.trace-footer')?.getBoundingClientRect()
  const footerSpace = footer ? innerHeight - footer.top : 56
  const needed = Math.ceil(captionLine.getBoundingClientRect().height) + 28
  reservedCaptionHeight = Math.max(reservedCaptionHeight, needed)
  document.body.style.setProperty('--tour-footer-space', footerSpace + 'px')
  document.body.style.setProperty('--tour-content-height', reservedCaptionHeight + 'px')
}

window.addEventListener('resize', alignCaption)
new ResizeObserver(alignCaption).observe(captionLine)

let nativePointerTimer
let lastNativePosition
function hideNativePointer() {
  clearTimeout(nativePointerTimer)
  document.body.classList.remove('tour-native-pointer-visible')
}

function setGuideCursor(active) {
  hideNativePointer()
  document.body.classList.toggle('tour-pointer-active', active)
  cursor.hidden = !active
}

document.addEventListener('pointermove', event => {
  if (!event.isTrusted || event.pointerType !== 'mouse') return
  const position = [event.screenX, event.screenY]
  const moved = lastNativePosition
    ? position.some((coordinate, axis) => coordinate !== lastNativePosition[axis])
    : Boolean(event.movementX || event.movementY)
  lastNativePosition = position
  // Scrolling can retarget a stationary pointer and emit a trusted event.
  if (!moved || !document.body.classList.contains('tour-pointer-active') ||
      panel.matches('.tour-scrolling,.tour-result-scrolling') ||
      root.classList.contains('tour-chapter-changing')) return
  clearTimeout(nativePointerTimer)
  document.body.classList.add('tour-native-pointer-visible')
  nativePointerTimer = setTimeout(hideNativePointer, 850)
}, {passive:true})

function setDemoRate(rate) {
  demoRate = rate * guideSpeed
  panel.style.setProperty('--tour-caption-enter', 360 / playbackRate() + 'ms')
  panel.style.setProperty('--tour-caption-exit', 220 / playbackRate() + 'ms')
  document.documentElement.style.setProperty('--tour-content-fade', 360 / playbackRate() + 'ms')
}

async function play(from, singleChapter) {
  root.classList.remove('tour-chapter-changing')
  panel.classList.remove('tour-scrolling', 'tour-result-scrolling', 'tour-user-scrolling', 'tour-caption-in')
  clearHighlight()
  lastCursor = [Math.max(12, innerWidth - 48), 108]
  cursor.style.transform = positionCursor(lastCursor)
  setGuideCursor(true)
  run = new AbortController()
  const {signal} = run
  paused = false
  showPause()
  panel.classList.add('tour-caption-out')
  reservedCaptionHeight = 0
  document.body.style.removeProperty('--tour-content-height')
  panel.inert = false
  panel.hidden = exitGuide.hidden = false
  document.body.classList.add('tour-dock-active')
  alignCaption()
  launch.hidden = true
  let finishUnit
  let finishShared
  let completed = false
  const selectedChapter = units[from]?.chapter
  try {
    for (let index = from; index < units.length; index++) {
      const unit = units[index]
      if (singleChapter && unit.chapter !== selectedChapter) break
      activeUnit = index
      previousButton.disabled = index === 0
      chapter = unit.chapter
      setDemoRate(unit.rate ?? (chapter === 0 ? 1 : 1.2))
      if (chapter === 2 && !examplesReady) {
        await preparePersonal(signal)
      }
      const content = chapter === 0 ? query('[data-testid="usage-mode-manual"]')
        : chapter === 1 ? query('.our-trace-workspace') : query('.tp26-family-nav')
      const finishPrevious = () => {
        // Restore the outgoing trace after the new chapter has mounted, never
        // while its record list is still visible and can shrink the scroll area.
        if (unit.demo !== interactionLiveDemo && unit.demo !== interactionImportDemo) restoreTraceSession?.()
        finishUnit?.()
        finishUnit = undefined
        if (chapter !== 1) {
          finishShared?.()
          finishShared = undefined
        }
      }
      if (!content && chapter > 0) {
        await clickChapter(chapter, signal, finishPrevious)
      } else {
        finishPrevious()
        if (!content) tab(titles[0])?.click()
      }
      if (chapter === 1 && !finishShared) {
        if (!sharedRecord('A') || !sharedRecord('B')) {
          await find(() => picker(shared), signal)
          await importExample(shared, 'AB', signal)
          await find(() => sharedRecord('A') && sharedRecord('B'), signal)
        }
        // Shared imports do not imply a personal record is selected for TEST PRINT.
        const workspace = await find(() => query('.browser-shell'), signal)
        workspace.dispatchEvent(new Event('punch-guide-comparison-start'))
        finishShared = () => workspace.dispatchEvent(new Event('punch-guide-comparison-end'))
        await new Promise(requestAnimationFrame)
        assertRunning(signal)
      }
      finishUnit = await unit.demo(signal)
    }
    if (!singleChapter || selectedChapter === 2) {
      activeUnit = units.length
      nextButton.disabled = true
      previousButton.disabled = false
      chapter = 2
      setDemoRate(1.2)
      if (!query('.tp26-actions')) {
        if (!examplesReady) await preparePersonal(signal)
        await clickChapter(2, signal, finishUnit)
        finishUnit = undefined
      }
      await finishDemo(signal)
      assertRunning(signal)
      completed = true
    }
    setGuideCursor(false)
    panel.dataset.phase = '시연 완료'
  } catch (error) {
    if (signal.aborted) return
    clearHighlight()
    setGuideCursor(false)
    caption('시연을 이어갈 수 없습니다', error.message, '다시 재생 가능')
    panel.classList.remove('tour-caption-out')
  } finally {
    if (!signal.aborted) {
      await transitionGuideSession(() => {
        finishUnit?.()
        finishShared?.()
        if (completed) {
          panel.hidden = exitGuide.hidden = true
          document.body.classList.remove('tour-dock-active')
        }
        restorePersonalSession()
      }, completed)
    } else {
      finishUnit?.()
      finishShared?.()
    }
    if (!signal.aborted) {
      pauseButton.disabled = true
    }
  }
}

let sessionFade = Promise.resolve()
function transitionGuideSession(update, fadePanel = false) {
  const task = sessionFade.catch(() => {}).then(async () => {
    const originalOpacity = root.style.opacity
    let animation
    let panelFade
    document.body.classList.add('tour-session-changing')
    try {
      if (!motionReduced) {
        animation = root.animate([{opacity:1},{opacity:0}], {duration:180,easing:motionEase,fill:'forwards'})
        if (fadePanel) panelFade = panel.animate([{opacity:1},{opacity:0}], {duration:180,easing:motionEase,fill:'forwards'})
        await animation.finished
      }
      await update()
      // React state, the restored tab, and its scroll position settle while hidden.
      await new Promise(requestAnimationFrame)
      await new Promise(requestAnimationFrame)
      await new Promise(requestAnimationFrame)
      placeReplay()
      animation?.cancel()
      root.style.opacity = '0'
      if (!motionReduced) {
        animation = root.animate([{opacity:0},{opacity:1}], {duration:280,easing:motionEase,fill:'forwards'})
        await animation.finished
      }
    } finally {
      root.style.opacity = originalOpacity
      animation?.cancel()
      panelFade?.cancel()
      document.body.classList.remove('tour-session-changing')
    }
  })
  sessionFade = task
  return task
}

async function start(index, singleChapter = false) {
  clearReplayFlight()
  cancelCompletionClose()
  const request = ++navigation
  closingAnimation?.cancel()
  chapterMenu.open = false
  run?.abort()
  pointerMotion?.cancel()
  await playback
  if (request !== navigation) return
  await sessionFade
  if (request !== navigation) return
  if (!personalSessionActive) {
    await transitionGuideSession(() => {
      beginPersonalSession()
      const content = query('.page-content')
      if (content) scrollContainer(content).scrollTo({top:0,behavior:'instant'})
    })
    if (request !== navigation) return
  }
  nextButton.disabled = false
  pauseButton.disabled = false
  playback = play(index, singleChapter)
}

async function close(origin) {
  if (panel.hidden || panel.inert) return
  cancelCompletionClose()
  const request = ++navigation
  paused = true
  pointerMotion?.pause()
  root.classList.remove('tour-chapter-changing')
  panel.classList.remove('tour-scrolling', 'tour-result-scrolling', 'tour-user-scrolling', 'tour-caption-in')
  clearHighlight()
  setGuideCursor(false)
  panel.inert = true
  if (!motionReduced) {
    const animation = panel.animate([{opacity:1}, {opacity:0}], {
      duration:480, easing:'ease-in-out', fill:'forwards'
    })
    closingAnimation = animation
    try {
      await animation.finished
    } catch {
      return
    } finally {
      if (closingAnimation === animation) closingAnimation = undefined
    }
    if (request !== navigation) return
    panel.hidden = exitGuide.hidden = true
    animation.cancel()
  } else {
    panel.hidden = exitGuide.hidden = true
  }
  if (personalSessionActive) {
    await transitionGuideSession(async () => {
      run?.abort()
      await playback
      restorePersonalSession()
    })
  } else {
    await playback
  }
  document.body.classList.remove('tour-dock-active')
  showReplay(origin)
}

function cancelCompletionClose() {
  clearTimeout(completionTimer)
  completionTimer = undefined
}

function scheduleCompletionClose() {
  cancelCompletionClose()
  completionTimer = setTimeout(close, 2500)
}

exitGuide.addEventListener('click', () => close(exitGuide.getBoundingClientRect()))
for (const type of ['pointermove', 'pointerdown', 'wheel', 'keydown']) {
  document.addEventListener(type, event => {
    if (event.isTrusted && completionTimer !== undefined) scheduleCompletionClose()
  }, {passive:true})
}

function togglePause() {
  if (pauseButton.disabled) return
  paused = !paused
  showPause()
}

function moveFeature(offset) {
  const next = activeUnit + offset
  if (offset > 0 && nextButton.disabled) return
  if (next >= 0 && next <= units.length) void start(next)
}

function moveChapter(index, singleChapter = false) {
  const firstUnit = units.findIndex(unit => unit.chapter === index)
  if (firstUnit >= 0) void start(firstUnit, singleChapter)
}

panel.addEventListener('click', event => {
  const control = event.target.closest('button')
  if (!control) return
  if (control.dataset.jump !== undefined) return moveChapter(Number(control.dataset.jump), true)
  if (control.dataset.command === 'previous') return moveFeature(-1)
  if (control.dataset.command === 'next') return moveFeature(1)
  if (control.dataset.command === 'pause') togglePause()
})

const guideShortcuts = {
  ' ': togglePause,
  ArrowLeft: () => moveFeature(-1),
  ArrowRight: () => moveFeature(1),
  ArrowUp: () => moveChapter(chapter - 1),
  ArrowDown: () => {
    if (chapter < titles.length - 1) moveChapter(chapter + 1)
    else if (activeUnit < units.length) void start(units.length)
  }
}

document.addEventListener('keydown', event => {
  if (panel.hidden || panel.inert || event.defaultPrevented) return
  if (event.key === 'Escape') {
    if (chapterMenu.open) {
      chapterMenu.open = false
      chapterMenu.querySelector('summary').focus()
    } else close()
    return
  }
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.isComposing) return
  if (event.target instanceof Element &&
      (event.target.isContentEditable || event.target.closest('input, select, textarea, [role="slider"]'))) return
  const action = Object.hasOwn(guideShortcuts, event.key) && guideShortcuts[event.key]
  if (!action) return
  event.preventDefault()
  if (!event.repeat) action()
})

function placeReplay() {
  if (launch.hidden || !launch.classList.contains('tour-launch-dismissed')) return
  const index = query('.trace-index-heading')
  if (index?.getClientRects().length) {
    if (launch.parentElement !== index) index.append(launch)
    launch.classList.add('tour-launch-in-index')
  } else {
    if (launch.parentElement !== document.body) document.body.append(launch)
    launch.classList.remove('tour-launch-in-index')
    const menu = query('.page-menu')
    launch.style.setProperty('--tour-replay-top', Math.round((menu?.getBoundingClientRect().bottom ?? 84) + 12) + 'px')
  }
}

window.addEventListener('resize', placeReplay)

function clearReplayFlight() {
  replayFlight?.remove()
  replayFlight = undefined
  reopen.style.removeProperty('visibility')
}

function showReplay(origin, restoreFocus = true) {
  launch.classList.add('tour-launch-dismissed')
  reopen.textContent = 'GUIDE'
  reopen.setAttribute('aria-label', 'GUIDE')
  launch.hidden = false
  placeReplay()
  if (!origin?.width || motionReduced) {
    if (restoreFocus) reopen.focus()
    return Promise.resolve()
  }

  clearReplayFlight()
  const destination = reopen.getBoundingClientRect()
  const flight = document.createElement('div')
  replayFlight = flight
  flight.className = 'tour-replay-flight'
  flight.setAttribute('aria-hidden', 'true')
  flight.textContent = reopen.textContent
  flight.style.left = destination.left + 'px'
  flight.style.top = destination.top + 'px'
  flight.style.width = destination.width + 'px'
  flight.style.height = destination.height + 'px'
  document.body.append(flight)
  reopen.style.visibility = 'hidden'

  const inset = 12
  const x = clamp(origin.left + (origin.width - destination.width) / 2,
    inset, document.documentElement.clientWidth - destination.width - inset)
  const y = clamp(origin.top + (origin.height - destination.height) / 2,
    inset, document.documentElement.clientHeight - destination.height - inset)
  const atOrigin = `translate(${x - destination.left}px,${y - destination.top}px)`
  const animation = flight.animate([
    {opacity:0, transform:atOrigin + ' scale(.72)'},
    {opacity:1, transform:atOrigin, offset:.2, easing:'cubic-bezier(.32,0,.24,1)'},
    {opacity:1, transform:'none'}
  ], {duration:720, fill:'both'})
  return animation.finished.then(() => {
    if (replayFlight !== flight) return
    clearReplayFlight()
    if (restoreFocus) reopen.focus()
  }, () => {
    if (replayFlight === flight) clearReplayFlight()
  })
}

reopen.addEventListener('click', () => start(0))
dismiss.addEventListener('click', () => showReplay(dismiss.getBoundingClientRect()))
let scrollIdle
root.addEventListener('scroll', () => {
  if (panel.hidden || panel.matches('.tour-scrolling,.tour-result-scrolling')) return
  panel.classList.add('tour-user-scrolling')
  clearTimeout(scrollIdle)
  scrollIdle = setTimeout(() => panel.classList.remove('tour-user-scrolling'), 130)
}, {capture:true, passive:true})

const ready = setInterval(() => {
  if (!tab(titles[0]) || query('.trace-intro-overlay')) return
  clearInterval(ready)
  launch.hidden = false
}, 100)
