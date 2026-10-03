import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from 'react'
import { toPng } from 'html-to-image'

type Point = {
  x: number
  y: number
  time: number
  speed: number
  gap: number
  seed: number
  angle: number
}

type ClickTrace = {
  id: number
  x: number
  y: number
  time: number
  radii: number[]
  shapeSeeds: number[]
}

type DragTrace = {
  id: number
  samples: Point[]
}

type ActiveDrag = {
  pointerId: number
  startX: number
  startY: number
  lastX: number
  lastY: number
  lastTime: number
  startTime: number
  clickScale: number
  samples: Point[]
  hasMoved: boolean
}

type SectionId =
  | 'ABOUT'
  | 'WHAT I USE'
  | 'HOW I USE'
  | 'MY TRACE'
  | 'OUR TRACE'

type Section = {
  number: string
  title: SectionId
  menuTitle: string
  label: string
  body: string
  note: string
}

const CLICK_DISTANCE = 8
const SAME_CLICK_TOLERANCE = 18
const MIN_INTERVAL = 14
const BASE_RING_RADIUS = 10
const RING_STEP = 8

const sections: Section[] = [
  {
    number: '01',
    title: 'ABOUT',
    menuTitle: 'INDEX',
    label: 'PROJECT STATEMENT',
    body: 'PUNCH TRACE는 디지털 환경 안에서 반복되는 클릭과 이동을 기록하고, 원형의 흔적과 밀도로 다시 읽는 시각 커뮤니케이션 프로젝트입니다.',
    note: 'FROM MY TRACE TO OUR TRACE',
  },
  {
    number: '02',
    title: 'WHAT I USE',
    menuTitle: 'WHAT I USE',
    label: 'APPLICATION INDEX',
    body: '매일 사용하는 도구와 화면을 동일한 원형 단위로 번역합니다. 위치와 반복은 사용의 빈도와 집중의 방향을 드러냅니다.',
    note: 'SAME UNIT / VARIABLE FREQUENCY',
  },
  {
    number: '03',
    title: 'HOW I USE',
    menuTitle: 'HOW I USE',
    label: 'INTERACTION METHOD',
    body: 'CLICK은 ring으로, DRAG는 sampled point로 변환됩니다. 행동은 사라지지 않고 화면 위에 관찰 가능한 흔적으로 남습니다.',
    note: 'INPUT → SAMPLE → CIRCULAR TRACE',
  },
  {
    number: '04',
    title: 'MY TRACE',
    menuTitle: 'MY TRACE',
    label: 'PERSONAL COMPOSITION',
    body: 'WHAT I USE에서 선택한 도구와 HOW I USE에서 만든 움직임이 하나의 개인 기록으로 합쳐집니다. 결과는 고정된 이미지가 아니라 현재까지 축적된 패턴입니다.',
    note: 'CHOICE + ACTION → PERSONAL TRACE',
  },
  {
    number: '05',
    title: 'OUR TRACE',
    menuTitle: 'OUR TRACE',
    label: 'COLLECTIVE FIELD',
    body: '각각의 MY TRACE는 하나의 공통 좌표계 위에서 겹쳐집니다. 같은 단위가 서로 다른 사람의 선택을 통해 다른 밀도와 관계를 만듭니다.',
    note: 'MULTIPLE MY TRACE → OUR TRACE',
  },
]

const toolNames = [
  'Figma',
  'Safari',
  'Photoshop',
  'Illustrator',
  'InDesign',
  'YouTube',
  'Notion',
  'Pinterest',
  'ChatGPT',
]

const toolLevels = [4, 3, 4, 2, 3, 2, 4, 2, 3]

const collectiveTraces = [
  [
    { x: 20, y: 24 },
    { x: 34, y: 30 },
    { x: 47, y: 44 },
    { x: 55, y: 65 },
    { x: 70, y: 53 },
    { x: 78, y: 30 },
  ],
  [
    { x: 26, y: 70 },
    { x: 35, y: 54 },
    { x: 48, y: 38 },
    { x: 63, y: 32 },
    { x: 74, y: 44 },
    { x: 83, y: 67 },
  ],
  [
    { x: 18, y: 50 },
    { x: 31, y: 46 },
    { x: 42, y: 52 },
    { x: 57, y: 58 },
    { x: 71, y: 45 },
    { x: 82, y: 52 },
  ],
  [
    { x: 25, y: 22 },
    { x: 42, y: 28 },
    { x: 53, y: 40 },
    { x: 62, y: 56 },
    { x: 65, y: 74 },
  ],
]

const clamp = (
  value: number,
  minimum: number,
  maximum: number,
) => Math.max(minimum, Math.min(maximum, value))

const formatTime = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(
    seconds % 60,
  ).padStart(2, '0')}`

const createPunchSeed = () =>
  Math.floor(Math.random() * 2_147_483_647)

const seededRandom = (seed: number) => {
  let value = seed | 0
  value = Math.imul(value ^ (value >>> 16), 2246822519)
  value = Math.imul(value ^ (value >>> 13), 3266489917)
  value ^= value >>> 16
  return ((value >>> 0) % 10000) / 10000
}

const angleDistance = (a: number, b: number) => {
  const difference = Math.abs(a - b) % (Math.PI * 2)
  return difference > Math.PI ? Math.PI * 2 - difference : difference
}

const smoothPulse = (distance: number, width: number) => {
  const normalized = clamp(distance / Math.max(width, 0.0001), 0, 1)
  const cosine = Math.cos(normalized * Math.PI * 0.5)
  return cosine * cosine
}

const buildPunchPath = (
  cx: number,
  cy: number,
  radius: number,
  seed: number,
  scaleX = 1,
  scaleY = 1,
  rotation = 0,
) => {
  // A real punched hole stays mostly circular. The irregularity is confined to
  // one small section of the perimeter rather than being distributed everywhere.
  const segments = 48
  const deformationAngle = seededRandom(seed + 91) * Math.PI * 2
  const deformationMode = Math.floor(seededRandom(seed + 113) * 3)
  const deformationWidth =
    deformationMode === 2
      ? 0.12 + seededRandom(seed + 127) * 0.08
      : 0.19 + seededRandom(seed + 127) * 0.11
  const deformationStrength =
    deformationMode === 0
      ? 0.10 + seededRandom(seed + 149) * 0.08
      : deformationMode === 1
        ? -(0.075 + seededRandom(seed + 149) * 0.065)
        : 0.14 + seededRandom(seed + 149) * 0.10
  const shoulderAngle =
    deformationAngle +
    (seededRandom(seed + 173) > 0.5 ? 1 : -1) *
      (0.045 + seededRandom(seed + 191) * 0.06)
  const shoulderWidth = 0.055 + seededRandom(seed + 209) * 0.035
  const shoulderStrength = deformationMode === 2
    ? deformationStrength * (0.38 + seededRandom(seed + 227) * 0.16)
    : deformationStrength * 0.16
  const points: string[] = []
  const cosRotation = Math.cos(rotation)
  const sinRotation = Math.sin(rotation)

  for (let index = 0; index < segments; index += 1) {
    const angle = (index / segments) * Math.PI * 2 - Math.PI / 2
    const mainInfluence = smoothPulse(
      angleDistance(angle, deformationAngle),
      deformationWidth,
    )
    const shoulderInfluence = smoothPulse(
      angleDistance(angle, shoulderAngle),
      shoulderWidth,
    )

    // One localized defect: a shallow dent, a small outward bulge, or a
    // slightly sharper pulled edge. Everywhere else remains a clean circle.
    const radialScale =
      1 +
      mainInfluence * deformationStrength +
      shoulderInfluence * shoulderStrength

    const localRadius = radius * radialScale
    const localX = Math.cos(angle) * localRadius * scaleX
    const localY = Math.sin(angle) * localRadius * scaleY
    const x = cx + localX * cosRotation - localY * sinRotation
    const y = cy + localX * sinRotation + localY * cosRotation
    points.push(`${x.toFixed(2)} ${y.toFixed(2)}`)
  }

  return `M ${points.join(' L ')} Z`
}

const DRAG_SIZE_MULTIPLIER = 1.5

const pointRadius = (point: Point) =>
  clamp(
    (1.05 + point.speed * 1.55) * 1.5 * DRAG_SIZE_MULTIPLIER,
    2.45,
    4.5,
  )

const getTraceColor = () =>
  getComputedStyle(document.documentElement)
    .getPropertyValue('--pt-blue')
    .trim() || '#1838ff'

const download = (dataUrl: string, filename: string) => {
  const anchor = document.createElement('a')
  anchor.href = dataUrl
  anchor.download = filename
  anchor.click()
}

function PunchPattern() {
  return (
    <div className="punch-pattern" aria-label="사용 도구 빈도 패턴">
      {toolNames.map((tool, index) => (
        <div
          className={`punch-cell level-${toolLevels[index]}`}
          key={tool}
        >
          <span className="punch-index">0{index + 1}</span>
          <i aria-hidden="true" />
          <span className="punch-name">{tool}</span>
        </div>
      ))}
    </div>
  )
}

function SampleActionGraphic() {
  return (
    <div className="action-graphic" aria-label="클릭과 드래그의 변환 예시">
      <div className="action-block">
        <span className="action-label">CLICK</span>
        <span className="action-ring" />
        <small>RING / ACCUMULATE</small>
      </div>
      <div className="action-arrow">→</div>
      <div className="action-block">
        <span className="action-label">DRAG</span>
        <div className="action-dots">
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
        <small>POINT / SAMPLE</small>
      </div>
    </div>
  )
}

function AboutExample() {
  return (
    <div className="index-grid" aria-label="프로젝트 작동 구조">
      <div>
        <b>01</b>
        <span>ACTION</span>
        <strong>CLICK / DRAG</strong>
      </div>
      <div>
        <b>02</b>
        <span>TRACE</span>
        <strong>RING / POINT</strong>
      </div>
      <div>
        <b>03</b>
        <span>ACCUMULATION</span>
        <strong>REPEAT / OVERLAP</strong>
      </div>
      <div>
        <b>04</b>
        <span>PATTERN</span>
        <strong>MY TRACE / OUR TRACE</strong>
      </div>
    </div>
  )
}

function MiniTracePreview({
  clicks,
  drags,
  activeSamples,
  fieldWidth,
  fieldHeight,
}: {
  clicks: ClickTrace[]
  drags: DragTrace[]
  activeSamples: Point[]
  fieldWidth: number
  fieldHeight: number
}) {
  const scaleX = 320 / Math.max(fieldWidth, 1)
  const scaleY = 180 / Math.max(fieldHeight, 1)
  const radiusScale = Math.min(scaleX, scaleY)

  const projectPoint = (x: number, y: number) => ({
    x: clamp(x * scaleX, 0, 320),
    y: clamp(y * scaleY, 0, 180),
  })

  return (
    <div className="mini-trace-wrap" aria-label="현재 TRACE 미리보기">
      <svg
        viewBox="0 0 320 180"
        className="mini-trace"
        preserveAspectRatio="none"
      >
        {clicks.map((click) =>
          click.radii.map((radius, index) => {
            const center = projectPoint(click.x, click.y)
            const scaledRadius = radius * radiusScale
            return (
              <path
                key={`mini-click-${click.id}-${index}`}
                d={buildPunchPath(
                  center.x,
                  center.y,
                  Math.max(2, Math.min(scaledRadius, 24)),
                  click.shapeSeeds[index],
                )}
                fill={index === 0 ? 'var(--pt-blue)' : 'none'}
                stroke={index === 0 ? 'none' : 'var(--pt-blue)'}
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
            )
          }),
        )}
        {drags.flatMap((drag) =>
          drag.samples.map((point, index) => {
            const center = projectPoint(point.x, point.y)
            return (
              <path
                key={`mini-drag-${drag.id}-${index}`}
                d={buildPunchPath(
                  center.x,
                  center.y,
                  Math.max(1.65, pointRadius(point) * radiusScale),
                  point.seed,
                )}
                fill="var(--pt-blue)"
                opacity={0.55 + point.speed * 0.26}
              />
            )
          }),
        )}
        {activeSamples.map((point, index) => {
          const center = projectPoint(point.x, point.y)
          return (
            <path
              key={`mini-active-${index}`}
              d={buildPunchPath(
                center.x,
                center.y,
                Math.max(1.65, pointRadius(point) * radiusScale),
                point.seed,
              )}
              fill="var(--pt-blue)"
              opacity=".68"
            />
          )
        })}
      </svg>
    </div>
  )
}

function OurTraceGraphic() {
  return (
    <div className="our-field-wrap" aria-label="여러 MY TRACE를 겹친 OUR TRACE">
      <svg viewBox="0 0 100 90" className="our-field">
        <rect x="0" y="0" width="100" height="90" fill="var(--pt-white)" />
        {collectiveTraces.map((trace, traceIndex) => (
          <g key={traceIndex} opacity={0.42 + traceIndex * 0.08}>
            {trace.map((point, index) => (
              <circle
                key={`${traceIndex}-${index}`}
                cx={point.x}
                cy={point.y}
                r="1.5"
                fill="var(--pt-blue)"
              />
            ))}
          </g>
        ))}
        <g opacity="0.7">
          <circle cx="54" cy="48" r="6" fill="none" stroke="var(--pt-blue)" />
          <circle cx="54" cy="48" r="12" fill="none" stroke="var(--pt-blue)" />
          <circle cx="54" cy="48" r="19" fill="none" stroke="var(--pt-blue)" />
        </g>
      </svg>
    </div>
  )
}

function ContentExample({
  section,
  clicks,
  drags,
  activeSamples,
  fieldWidth,
  fieldHeight,
}: {
  section: Section
  clicks: ClickTrace[]
  drags: DragTrace[]
  activeSamples: Point[]
  fieldWidth: number
  fieldHeight: number
}) {
  if (section.title === 'WHAT I USE') {
    return <PunchPattern />
  }

  if (section.title === 'HOW I USE') {
    return (
      <div className="how-layout">
        <SampleActionGraphic />
        <div className="how-live">
          <div>
            <span className="live-index">LIVE / FIELD</span>
            <strong>MOVE, CLICK, REPEAT.</strong>
          </div>
          <MiniTracePreview
            clicks={clicks}
            drags={drags}
            activeSamples={activeSamples}
            fieldWidth={fieldWidth}
            fieldHeight={fieldHeight}
          />
        </div>
      </div>
    )
  }

  if (section.title === 'MY TRACE') {
    return (
      <div className="my-trace-layout">
        <MiniTracePreview
          clicks={clicks}
          drags={drags}
          activeSamples={activeSamples}
          fieldWidth={fieldWidth}
          fieldHeight={fieldHeight}
        />
        <div className="my-trace-meta">
          <div>
            <span>01</span>
            <strong>TOOL SET</strong>
            <small>WHAT I USE</small>
          </div>
          <div>
            <span>02</span>
            <strong>MOTION LOG</strong>
            <small>HOW I USE</small>
          </div>
          <div>
            <span>03</span>
            <strong>PERSONAL FIELD</strong>
            <small>ACCUMULATED TRACE</small>
          </div>
        </div>
      </div>
    )
  }

  if (section.title === 'OUR TRACE') {
    return (
      <div className="our-trace-layout">
        <OurTraceGraphic />
        <div className="our-trace-meta">
          <div>
            <span>MY / 01</span>
            <i />
          </div>
          <div>
            <span>MY / 02</span>
            <i />
          </div>
          <div>
            <span>MY / 03</span>
            <i />
          </div>
          <strong>OUR / FIELD</strong>
        </div>
      </div>
    )
  }

  return <AboutExample />
}

export function TraceWorkspace() {
  const [clicks, setClicks] = useState<ClickTrace[]>([])
  const [drags, setDrags] = useState<DragTrace[]>([])
  const [activeSamples, setActiveSamples] = useState<Point[]>([])
  const [selectedPanel, setSelectedPanel] = useState<SectionId>('ABOUT')
  const [elapsed, setElapsed] = useState(0)
  const [exportOpen, setExportOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [fieldSize, setFieldSize] = useState({ width: 1, height: 1 })

  const activeRef = useRef<ActiveDrag | null>(null)
  const shellRef = useRef<HTMLElement | null>(null)
  const serialRef = useRef(0)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setElapsed((value) => value + 1)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const element = shellRef.current
    if (!element) return

    const updateSize = () => {
      setFieldSize({
        width: Math.max(1, element.clientWidth),
        height: Math.max(1, element.clientHeight),
      })
    }

    updateSize()

    const observer = new ResizeObserver(updateSize)
    observer.observe(element)

    return () => observer.disconnect()
  }, [])

  const reset = useCallback(() => {
    activeRef.current = null
    setClicks([])
    setDrags([])
    setActiveSamples([])
  }, [])

  useEffect(() => {
    const cancel = () => {
      activeRef.current = null
      setActiveSamples([])
    }
    window.addEventListener('blur', cancel)
    return () => window.removeEventListener('blur', cancel)
  }, [])

  const pointFromEvent = (event: PointerEvent<HTMLElement>) => {
    const bounds = shellRef.current?.getBoundingClientRect()
    if (!bounds) return null
    return {
      x: clamp(event.clientX - bounds.left, 0, bounds.width),
      y: clamp(event.clientY - bounds.top, 0, bounds.height),
    }
  }

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return
    const point = pointFromEvent(event)
    if (!point) return

    const now = performance.now()
    const pressure =
      event.pressure > 0 && event.pressure < 1 ? event.pressure : 0.5

    const first: Point = {
      ...point,
      time: now,
      speed: 0,
      gap: 0,
      seed: createPunchSeed(),
      angle: 0,
    }

    activeRef.current = {
      pointerId: event.pointerId,
      startX: point.x,
      startY: point.y,
      lastX: point.x,
      lastY: point.y,
      lastTime: now,
      startTime: now,
      clickScale: pressure,
      samples: [first],
      hasMoved: false,
    }

  }

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const active = activeRef.current
    if (!active || active.pointerId !== event.pointerId) return

    const point = pointFromEvent(event)
    if (!point) return

    const movementFromStart = Math.hypot(
      point.x - active.startX,
      point.y - active.startY,
    )

    if (!active.hasMoved && movementFromStart < CLICK_DISTANCE) return

    active.hasMoved = true

    try {
      event.currentTarget.setPointerCapture?.(event.pointerId)
    } catch {
      // Pointer capture is not required for simple clicks.
    }

    const now = performance.now()
    const elapsedTime = Math.max(1, now - active.lastTime)
    const distance = Math.hypot(
      point.x - active.lastX,
      point.y - active.lastY,
    )
    const speed = distance / elapsedTime
    const targetGap = clamp(3 + speed * 44, 3.5, 22)

    if (distance < targetGap && elapsedTime < MIN_INTERVAL) return
    if (distance < targetGap) return

    const steps = Math.max(1, Math.floor(distance / targetGap))
    const samples = [...active.samples]

    for (let step = 1; step <= steps; step += 1) {
      const ratio = Math.min(1, (step * targetGap) / distance)
      samples.push({
        x: active.lastX + (point.x - active.lastX) * ratio,
        y: active.lastY + (point.y - active.lastY) * ratio,
        time: active.lastTime + elapsedTime * ratio,
        speed,
        gap: targetGap,
        seed: createPunchSeed(),
        angle: Math.atan2(point.y - active.lastY, point.x - active.lastX),
      })
    }

    active.lastX = point.x
    active.lastY = point.y
    active.lastTime = now
    active.samples = samples
    setActiveSamples(samples)
  }

  const addClick = (x: number, y: number, scale: number) => {
    setClicks((current) => {
      let nearestIndex = -1
      let nearestDistance = Number.POSITIVE_INFINITY

      current.forEach((click, index) => {
        const distance = Math.hypot(click.x - x, click.y - y)
        if (distance < nearestDistance) {
          nearestIndex = index
          nearestDistance = distance
        }
      })

      if (
        nearestIndex >= 0 &&
        nearestDistance <= SAME_CLICK_TOLERANCE
      ) {
        return current.map((click, index) =>
          index === nearestIndex
            ? {
                ...click,
                time: Date.now(),
                radii: [
                  ...click.radii,
                  click.radii[click.radii.length - 1] + RING_STEP * scale,
                ],
                shapeSeeds: [...click.shapeSeeds, createPunchSeed()],
              }
            : click,
        )
      }

      return [
        ...current,
        {
          id: ++serialRef.current,
          x,
          y,
          time: Date.now(),
          radii: [BASE_RING_RADIUS * scale],
          shapeSeeds: [createPunchSeed()],
        },
      ]
    })
  }

  const finishPointer = (event: PointerEvent<HTMLElement>) => {
    const active = activeRef.current
    if (!active || active.pointerId !== event.pointerId) return

    const totalDistance = Math.hypot(
      active.lastX - active.startX,
      active.lastY - active.startY,
    )

    if (!active.hasMoved && totalDistance < CLICK_DISTANCE) {
      const holdDuration = performance.now() - active.startTime
      const durationScale = clamp(
        0.8 +
          (Math.min(holdDuration, 900) / 900) * 0.55 +
          (active.clickScale - 0.5) * 0.15,
        0.8,
        1.5,
      )
      addClick(active.startX, active.startY, durationScale)
    } else if (active.samples.length > 1) {
      setDrags((current) => [
        ...current,
        {
          id: ++serialRef.current,
          samples: active.samples,
        },
      ])
    }

    try {
      event.currentTarget.releasePointerCapture?.(event.pointerId)
    } catch {
      // Pointer capture may already have been released by the browser.
    }

    activeRef.current = null
    setActiveSamples([])
  }


  const renderPoint = (
    point: Point,
    index: number,
    key: string,
  ) => {
    const opacity = clamp(
      0.56 + point.speed * 0.4,
      0.56,
      0.88,
    )

    return (
      <path
        key={key}
        className="trace-dot trace-enter"
        d={buildPunchPath(
          point.x,
          point.y,
          pointRadius(point),
          point.seed,
        )}
        fill="var(--pt-blue)"
        style={{
          opacity,
          animationDelay: `${Math.min(index * 6, 120)}ms`,
        }}
      />
    )
  }

  const totalClicks = useMemo(
    () => clicks.reduce((total, click) => total + click.radii.length, 0),
    [clicks],
  )

  const totalPoints = useMemo(
    () =>
      drags.reduce((total, trace) => total + trace.samples.length, 0) +
      activeSamples.length,
    [activeSamples.length, drags],
  )

  const section =
    sections.find((item) => item.title === selectedPanel) ?? sections[0]

  const getTraceBounds = useCallback(() => {
    const items: Array<{
      x: number
      y: number
      radius: number
    }> = []

    clicks.forEach((click) => {
      click.radii.forEach((radius) => {
        items.push({
          x: click.x,
          y: click.y,
          radius: radius + 2,
        })
      })
    })

    drags.forEach((drag) => {
      drag.samples.forEach((point) => {
        items.push({
          x: point.x,
          y: point.y,
          radius: pointRadius(point) + 1,
        })
      })
    })

    activeSamples.forEach((point) => {
      items.push({
        x: point.x,
        y: point.y,
        radius: pointRadius(point) + 1,
      })
    })

    if (!items.length) return null

    const minX = Math.min(...items.map((item) => item.x - item.radius))
    const minY = Math.min(...items.map((item) => item.y - item.radius))
    const maxX = Math.max(...items.map((item) => item.x + item.radius))
    const maxY = Math.max(...items.map((item) => item.y + item.radius))

    return {
      minX,
      minY,
      maxX,
      maxY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY),
    }
  }, [activeSamples, clicks, drags])

  const exportTraceOnly = useCallback(async () => {
    const bounds = getTraceBounds()
    if (!bounds) return

    setExporting(true)
    try {
      const traceColor = getTraceColor()
      const padding = 24
      const width = Math.ceil(bounds.width + padding * 2)
      const height = Math.ceil(bounds.height + padding * 2)
      const offsetX = bounds.minX - padding
      const offsetY = bounds.minY - padding

      const circles = [
        ...clicks.flatMap((click) =>
          click.radii.map((radius, index) =>
            `<path d="${buildPunchPath(
              click.x - offsetX,
              click.y - offsetY,
              radius,
              click.shapeSeeds[index],
            )}" fill="${index === 0 ? traceColor : 'none'}" stroke="${
              index === 0 ? 'none' : traceColor
            }" stroke-width="1.6" stroke-linejoin="round" />`,
          ),
        ),
        ...drags.flatMap((drag) =>
          drag.samples.map(
            (point) =>
              `<path d="${buildPunchPath(
                point.x - offsetX,
                point.y - offsetY,
                pointRadius(point),
                point.seed,
              )}" fill="${traceColor}" opacity="${clamp(
                0.52 + point.speed * 0.42,
                0.56,
                0.88,
              )}" />`,
          ),
        ),
        ...activeSamples.map(
          (point) =>
            `<path d="${buildPunchPath(
              point.x - offsetX,
              point.y - offsetY,
              pointRadius(point),
              point.seed,
            )}" fill="${traceColor}" opacity="0.68" />`,
        ),
      ].join('')

      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${circles}</svg>`
      const image = new Image()
      const source = URL.createObjectURL(
        new Blob([svg], {
          type: 'image/svg+xml;charset=utf-8',
        }),
      )

      await new Promise<void>((resolve, reject) => {
        image.onload = () => {
          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          canvas.getContext('2d')?.drawImage(image, 0, 0)
          URL.revokeObjectURL(source)
          download(canvas.toDataURL('image/png'), 'punch-trace-only.png')
          resolve()
        }
        image.onerror = () => {
          URL.revokeObjectURL(source)
          reject(new Error('TRACE ONLY export failed'))
        }
        image.src = source
      })
    } finally {
      setExporting(false)
    }
  }, [activeSamples, clicks, drags, getTraceBounds])

  const exportTraceField = useCallback(async () => {
    const shell = shellRef.current
    if (!shell) return

    setExporting(true)
    try {
      const fieldBackground =
        getComputedStyle(document.documentElement)
          .getPropertyValue('--pt-white')
          .trim() || '#ffffff'
      const dataUrl = await toPng(shell, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: fieldBackground,
      })
      download(dataUrl, 'punch-trace-field.png')
    } finally {
      setExporting(false)
    }
  }, [])

  const renderSectionContent = (): ReactNode => (
    <ContentExample
      section={section}
      clicks={clicks}
      drags={drags}
      activeSamples={activeSamples}
      fieldWidth={fieldSize.width}
      fieldHeight={fieldSize.height}
    />
  )

  return (
    <main className="trace-app">
      <section
        ref={shellRef}
        className="browser-shell"
        aria-label="PUNCH TRACE 프로젝트 웹 박스"
        onPointerDownCapture={onPointerDown}
        onPointerMoveCapture={onPointerMove}
        onPointerUpCapture={finishPointer}
        onPointerCancelCapture={finishPointer}
      >
        <div className="browser-chrome">
          <div className="browser-controls" aria-label="브라우저 조작부">
            <span />
            <span />
            <span />
          </div>
          <div className="browser-address">
            punch-trace://archive/{section.number.toLowerCase()}-
            {section.menuTitle.toLowerCase().replaceAll(' ', '-')}
          </div>
          <p className="browser-mode">WORKSPACE / LIVE</p>
        </div>

        <div className="workspace-ruler" aria-hidden="true">
          <span>0</span>
          <span>100</span>
          <span>200</span>
          <span>300</span>
          <span>400</span>
          <span>500</span>
        </div>

        <div className="browser-page">
          <aside className="page-menu" aria-label="프로젝트 섹션">
            <div className="project-mark">
              <span className="accent-mark" />
              <strong>PUNCH TRACE</strong>
              <small>FROM MY TRACE TO OUR TRACE</small>
            </div>

            <p className="panel-label">ARCHIVE / INDEX</p>

            {sections.map((item) => (
              <button
                key={item.title}
                type="button"
                className={selectedPanel === item.title ? 'is-selected' : ''}
                onClick={() => setSelectedPanel(item.title)}
              >
                <b>{item.number}</b>
                <span>{item.menuTitle}</span>
              </button>
            ))}

            <div className="menu-bottom-note">
              <span>UNIT</span>
              <strong>HOLE / RING</strong>
              <span>RULE</span>
              <strong>REPEAT / OVERLAP</strong>
            </div>
          </aside>

          <div className="page-content">
            <div className="content-heading">
              <p className="page-eyebrow">
                {section.label} / {section.number}
              </p>
              <h2>{section.menuTitle}</h2>
              <p className="page-copy">{section.body}</p>
            </div>

            {renderSectionContent()}

            <p className="content-note">{section.note}</p>
          </div>

          <aside className="inspector-panel" aria-label="정보와 속성">
            <section>
              <p className="panel-label">INFORMATION</p>
              <dl>
                <div>
                  <dt>PROJECT</dt>
                  <dd>PUNCH TRACE</dd>
                </div>
                <div>
                  <dt>SECTION</dt>
                  <dd>
                    {section.number} / {section.menuTitle}
                  </dd>
                </div>
                <div>
                  <dt>MODE</dt>
                  <dd>LIVE CAPTURE</dd>
                </div>
              </dl>
            </section>

            <section>
              <p className="panel-label">CURRENT SESSION</p>
              <dl>
                <div>
                  <dt>TIME</dt>
                  <dd>{formatTime(elapsed)}</dd>
                </div>
                <div>
                  <dt>CLICKS</dt>
                  <dd>{totalClicks}</dd>
                </div>
                <div>
                  <dt>DRAGS</dt>
                  <dd>{drags.length}</dd>
                </div>
                <div>
                  <dt>POINTS</dt>
                  <dd>{totalPoints}</dd>
                </div>
              </dl>
            </section>
          </aside>

        </div>

        <section className="trace-space" aria-hidden="true">
          <svg className="trace-canvas">
            {clicks.flatMap((click) =>
              click.radii.map((radius, index) => (
                <path
                  key={`${click.id}-${index}`}
                  className={`${index === 0 ? 'trace-core' : 'trace-ring'} trace-enter`}
                  d={buildPunchPath(
                    click.x,
                    click.y,
                    radius,
                    click.shapeSeeds[index],
                  )}
                  fill={index === 0 ? 'var(--pt-blue)' : 'none'}
                  stroke={index === 0 ? 'none' : 'var(--pt-blue)'}
                  strokeWidth={index === 0 ? undefined : 1.6}
                  strokeLinejoin="round"
                  style={{
                    animationDelay: `${index * 36}ms`,
                  }}
                />
              )),
            )}

            {drags.flatMap((drag) =>
              drag.samples.map((point, index) =>
                renderPoint(point, index, `${drag.id}-${index}`),
              ),
            )}

            {activeSamples.map((point, index) =>
              renderPoint(point, index, `active-${index}`),
            )}
          </svg>
        </section>
      </section>

      <footer className="trace-footer" data-no-trace>
        <div className="trace-status" aria-label="세션 상태">
          <span>
            SESSION TIME <b>{formatTime(elapsed)}</b>
          </span>
          <span>
            CLICKS <b>{totalClicks}</b>
          </span>
          <span>
            DRAGS <b>{drags.length}</b>
          </span>
          <span>
            TRACE POINTS <b>{totalPoints}</b>
          </span>
        </div>

        <div className="footer-actions">
          <div className="export-menu">
            <button
              className="press"
              type="button"
              data-no-trace
              onClick={() => setExportOpen((open) => !open)}
              aria-expanded={exportOpen}
              disabled={exporting}
            >
              {exporting ? 'EXPORTING' : 'EXPORT'}
            </button>

            {exportOpen && (
              <div className="export-options" data-no-trace>
                <button
                  type="button"
                  disabled={exporting || !getTraceBounds()}
                  onClick={() => {
                    setExportOpen(false)
                    void exportTraceOnly()
                  }}
                >
                  TRACE ONLY
                </button>
                <button
                  type="button"
                  disabled={exporting}
                  onClick={() => {
                    setExportOpen(false)
                    void exportTraceField()
                  }}
                >
                  TRACE + FIELD
                </button>
              </div>
            )}
          </div>

          <button
            className="press clear-button"
            type="button"
            data-no-trace
            onClick={reset}
          >
            CLEAR
          </button>
        </div>
      </footer>
    </main>
  )
}
