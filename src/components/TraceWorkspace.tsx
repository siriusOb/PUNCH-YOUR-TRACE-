import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { toPng } from 'html-to-image'

const punchGraphic = new URL(
  '../assets/punch-trace-index.png',
  import.meta.url,
).href

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
  | 'OUR TRACE'

type Section = {
  number: string
  title: SectionId
  menuTitle: string
  label: string
  body: string
  note: string
}

type AppUsageItem = {
  id: string
  name: string
  count: number
}

type AppCatalogItem = {
  id: string
  name: string
}

type ParticipantTrace = {
  id: string
  name: string
  role: string
  usage: AppUsageItem[]
}

type WorkDomain = {
  id: string
  label: string
}

const MAX_PARTICIPANTS = 4
const MIN_PARTICIPANTS = 2

const WORK_DOMAINS: WorkDomain[] = [
  { id: 'visual', label: 'VISUAL' },
  { id: 'research', label: 'RESEARCH' },
  { id: 'production', label: 'PRODUCTION' },
  { id: 'communication', label: 'COMMUNICATION' },
  { id: 'organization', label: 'ORGANIZATION' },
]

const APP_DOMAIN_MAP: Record<string, string> = {
  figma: 'visual',
  photoshop: 'visual',
  illustrator: 'visual',
  indesign: 'visual',
  'after-effects': 'production',
  'premiere-pro': 'production',
  'final-cut': 'production',
  safari: 'research',
  chrome: 'research',
  youtube: 'research',
  pinterest: 'research',
  chatgpt: 'research',
  notion: 'organization',
  finder: 'organization',
  spotify: 'organization',
  discord: 'communication',
  slack: 'communication',
  kakaotalk: 'communication',
  arc: 'research',
  'vs-code': 'production',
}

const RANDOM_ROLES = [
  'VISUAL DESIGNER',
  'UX / UI DESIGNER',
  'MOTION DESIGNER',
  'CONTENT DESIGNER',
  'RESEARCHER',
  'CREATIVE DIRECTOR',
]

const CLICK_DISTANCE = 8
const SAME_CLICK_TOLERANCE = 18
const MIN_INTERVAL = 14
const BASE_RING_RADIUS = 10
const RING_STEP = 8
const MAX_APP_COUNT = 9
const MAX_USAGE_COUNT = 99

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
    body: '내가 선택한 상위 9개 앱과 각 실행 횟수를 직접 입력합니다. 반복 횟수는 작은 펀치 단위의 중첩과 배제로 번역되어 사용 빈도를 하나의 그래픽 밀도로 읽습니다.',
    note: 'TOP 9 APP / COUNT → EXCLUDE PUNCH FIELD',
  },
  {
    number: '03',
    title: 'HOW I USE',
    menuTitle: 'HOW I USE',
    label: 'INTERACTION METHOD',
    body: 'CLICK은 ring으로, DRAG는 sampled point로 변환됩니다. 기록된 움직임은 하나의 개인 흔적으로 축적되고, 그 활동 범위는 CONTOUR로 다시 읽을 수 있습니다.',
    note: 'INPUT → SAMPLE → TRACE → CONTOUR',
  },
  {
    number: '04',
    title: 'OUR TRACE',
    menuTitle: 'OUR TRACE',
    label: 'COLLECTIVE WORK FIELD',
    body: '2–4명의 업무 카드를 비교해 공통 도구와 서로 다른 사용 패턴을 읽고, 각 개인의 작업 특성이 프로젝트 안에서 어떤 역할로 연결될 수 있는지 관계도로 정리합니다.',
    note: 'COMMON TOOL + PERSONAL STRENGTH → PROJECT ROLE',
  },
]

const APP_CATALOG: AppCatalogItem[] = [
  { id: 'figma', name: 'Figma' },
  { id: 'safari', name: 'Safari' },
  { id: 'photoshop', name: 'Photoshop' },
  { id: 'illustrator', name: 'Illustrator' },
  { id: 'indesign', name: 'InDesign' },
  { id: 'after-effects', name: 'After Effects' },
  { id: 'premiere-pro', name: 'Premiere Pro' },
  { id: 'chrome', name: 'Chrome' },
  { id: 'youtube', name: 'YouTube' },
  { id: 'notion', name: 'Notion' },
  { id: 'pinterest', name: 'Pinterest' },
  { id: 'chatgpt', name: 'ChatGPT' },
  { id: 'vs-code', name: 'VS Code' },
  { id: 'spotify', name: 'Spotify' },
  { id: 'finder', name: 'Finder' },
  { id: 'discord', name: 'Discord' },
  { id: 'slack', name: 'Slack' },
  { id: 'kakaotalk', name: 'KakaoTalk' },
  { id: 'arc', name: 'Arc' },
  { id: 'final-cut', name: 'Final Cut Pro' },
]

const DEFAULT_APP_USAGE: AppUsageItem[] = [
  { id: 'figma', name: 'Figma', count: 42 },
  { id: 'safari', name: 'Safari', count: 31 },
  { id: 'photoshop', name: 'Photoshop', count: 28 },
  { id: 'illustrator', name: 'Illustrator', count: 24 },
  { id: 'indesign', name: 'InDesign', count: 19 },
  { id: 'youtube', name: 'YouTube', count: 16 },
  { id: 'notion', name: 'Notion', count: 14 },
  { id: 'pinterest', name: 'Pinterest', count: 11 },
  { id: 'chatgpt', name: 'ChatGPT', count: 9 },
]

const shuffleItems = <T,>(items: T[]) => {
  const next = [...items]

  for (let index = next.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    ;[next[index], next[randomIndex]] = [next[randomIndex], next[index]]
  }

  return next
}

const createRandomParticipant = (index: number): ParticipantTrace => {
  const usage = shuffleItems(APP_CATALOG)
    .slice(0, MAX_APP_COUNT)
    .map((app) => ({
      id: app.id,
      name: app.name,
      count: Math.floor(Math.random() * 70) + 8,
    }))

  return {
    id: `participant-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`,
    name: `PERSON ${String.fromCharCode(65 + index)}`,
    role: RANDOM_ROLES[Math.floor(Math.random() * RANDOM_ROLES.length)],
    usage,
  }
}

const getRankedUsage = (usage: AppUsageItem[]) =>
  [...usage].sort((a, b) => b.count - a.count)

const getDomainTotals = (usage: AppUsageItem[]) => {
  const totals = WORK_DOMAINS.reduce<Record<string, number>>((acc, domain) => {
    acc[domain.id] = 0
    return acc
  }, {})

  usage.forEach((item) => {
    const domain = APP_DOMAIN_MAP[item.id] ?? 'organization'
    totals[domain] += item.count
  })

  return totals
}

const getWorkProfile = (usage: AppUsageItem[]) => {
  const totals = getDomainTotals(usage)

  const ranked = [...WORK_DOMAINS].sort(
    (a, b) => totals[b.id] - totals[a.id],
  )

  return {
    primary: ranked[0]?.label ?? '—',
    secondary: ranked[1]?.label ?? '—',
    totals,
  }
}

const getSharedApplications = (
  participants: ParticipantTrace[],
) => {
  const counts = new Map<
    string,
    {
      name: string
      people: number
      runs: number
    }
  >()

  participants.forEach((participant) => {
    participant.usage.forEach((item) => {
      const current = counts.get(item.id)

      if (current) {
        current.people += 1
        current.runs += item.count
      } else {
        counts.set(item.id, {
          name: item.name,
          people: 1,
          runs: item.count,
        })
      }
    })
  })

  return [...counts.entries()]
    .filter(([, item]) => item.people >= 2)
    .sort((a, b) => {
      if (b[1].people !== a[1].people) {
        return b[1].people - a[1].people
      }

      return b[1].runs - a[1].runs
    })
    .map(([id, item]) => ({
      id,
      ...item,
    }))
}

const getDistinctApplications = (
  participants: ParticipantTrace[],
) => {
  const counts = new Map<string, number>()

  participants.forEach((participant) => {
    participant.usage.forEach((item) => {
      counts.set(item.id, (counts.get(item.id) ?? 0) + 1)
    })
  })

  return participants.map((participant) => ({
    participant,
    apps: getRankedUsage(
      participant.usage.filter(
        (item) => (counts.get(item.id) ?? 0) === 1,
      ),
    ),
  }))
}

const clamp = (
  value: number,
  minimum: number,
  maximum: number,
) => Math.max(minimum, Math.min(maximum, value))

const formatTime = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(
    seconds % 60,
  ).padStart(2, '0')}`

const createPunchSeed = () => Math.floor(Math.random() * 2_147_483_647)

const seededRandom = (seed: number) => {
  let value = seed | 0

  value = Math.imul(value ^ (value >>> 16), 2246822519)
  value = Math.imul(value ^ (value >>> 13), 3266489917)
  value ^= value >>> 16

  return ((value >>> 0) % 10000) / 10000
}

const stringToSeed = (value: string) => {
  let hash = 2166136261

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

const angleDistance = (a: number, b: number) => {
  const difference = Math.abs(a - b) % (Math.PI * 2)
  return difference > Math.PI
    ? Math.PI * 2 - difference
    : difference
}

const smoothPulse = (distance: number, width: number) => {
  const normalized = clamp(
    distance / Math.max(width, 0.0001),
    0,
    1,
  )

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
  const segments = 48

  const deformationAngle =
    seededRandom(seed + 91) *
    Math.PI *
    2

  const deformationMode = Math.floor(
    seededRandom(seed + 113) * 3,
  )

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

  const shoulderWidth =
    0.055 + seededRandom(seed + 209) * 0.035

  const shoulderStrength =
    deformationMode === 2
      ? deformationStrength *
        (0.38 + seededRandom(seed + 227) * 0.16)
      : deformationStrength * 0.16

  const points: string[] = []

  const cosRotation = Math.cos(rotation)
  const sinRotation = Math.sin(rotation)

  for (let index = 0; index < segments; index += 1) {
    const angle =
      (index / segments) *
        Math.PI *
        2 -
      Math.PI / 2

    const mainInfluence = smoothPulse(
      angleDistance(angle, deformationAngle),
      deformationWidth,
    )

    const shoulderInfluence = smoothPulse(
      angleDistance(angle, shoulderAngle),
      shoulderWidth,
    )

    const radialScale =
      1 +
      mainInfluence * deformationStrength +
      shoulderInfluence * shoulderStrength

    const localRadius = radius * radialScale

    const localX =
      Math.cos(angle) * localRadius * scaleX

    const localY =
      Math.sin(angle) * localRadius * scaleY

    const x =
      cx +
      localX * cosRotation -
      localY * sinRotation

    const y =
      cy +
      localX * sinRotation +
      localY * cosRotation

    points.push(`${x.toFixed(2)} ${y.toFixed(2)}`)
  }

  return `M ${points.join(' L ')} Z`
}

type PunchUnit = {
  x: number
  y: number
  radius: number
  seed: number
  scaleX: number
  scaleY: number
  rotation: number
}

const buildExcludePunchUnits = (
  item: AppUsageItem,
): PunchUnit[] => {
  const count = clamp(
    Math.round(item.count),
    1,
    MAX_USAGE_COUNT,
  )

  const seed = stringToSeed(`${item.id}-${count}`)
  const units: PunchUnit[] = []

  const spread =
    18 + Math.min(19, Math.sqrt(count) * 3.3)

  for (let index = 0; index < count; index += 1) {
    const randomA = seededRandom(seed + index * 47 + 7)
    const randomB = seededRandom(seed + index * 47 + 19)
    const randomC = seededRandom(seed + index * 47 + 31)
    const randomD = seededRandom(seed + index * 47 + 43)

    const orbit = Math.sqrt(randomA) * spread

    const angle =
      randomB * Math.PI * 2 +
      (index / Math.max(count, 1)) * 0.72

    const waveX =
      Math.sin(index * 0.73 + randomC * 2) * 3.5

    const waveY =
      Math.cos(index * 0.61 + randomD * 2) * 3.5

    const radius =
      8.0 +
      randomC * 4.3 -
      Math.min(1.0, count * 0.004)

    units.push({
      x:
        80 +
        Math.cos(angle) * orbit +
        waveX,

      y:
        80 +
        Math.sin(angle) * orbit * 0.82 +
        waveY,

      radius,

      seed: stringToSeed(
        `${item.id}-${count}-${index}`,
      ),

      scaleX: 0.88 + randomD * 0.24,
      scaleY: 0.88 + randomA * 0.22,
      rotation: (randomB - 0.5) * 0.32,
    })
  }

  return units
}

const buildExcludePunchPaths = (
  item: AppUsageItem,
) =>
  buildExcludePunchUnits(item).map((unit) =>
    buildPunchPath(
      unit.x,
      unit.y,
      unit.radius,
      unit.seed,
      unit.scaleX,
      unit.scaleY,
      unit.rotation,
    ),
  )

const buildMergedPunchUnits = (
  item: AppUsageItem,
): PunchUnit[] => {
  const count = clamp(
    Math.round(item.count),
    1,
    MAX_USAGE_COUNT,
  )

  const seed = stringToSeed(
    `merged-${item.id}-${count}`,
  )

  const units: PunchUnit[] = []

  const spread =
    9 +
    Math.min(14, Math.sqrt(count) * 2.15)

  for (let index = 0; index < count; index += 1) {
    const randomA = seededRandom(seed + index * 53 + 5)
    const randomB = seededRandom(seed + index * 53 + 17)
    const randomC = seededRandom(seed + index * 53 + 29)
    const randomD = seededRandom(seed + index * 53 + 41)

    const orbit = Math.sqrt(randomA) * spread

    const angle =
      randomB * Math.PI * 2 +
      (index / Math.max(count, 1)) * 0.9

    const radius = 10.5 + randomC * 3.8

    units.push({
      x:
        80 +
        Math.cos(angle) * orbit +
        (randomD - 0.5) * 1.8,

      y:
        80 +
        Math.sin(angle) * orbit * 0.82 +
        (randomA - 0.5) * 1.8,

      radius,

      seed: stringToSeed(
        `merged-${item.id}-${count}-${index}`,
      ),

      scaleX: 0.94 + randomD * 0.13,
      scaleY: 0.94 + randomA * 0.13,
      rotation: (randomB - 0.5) * 0.24,
    })
  }

  return units
}

const buildOuterContourPath = (
  item: AppUsageItem,
) => {
  const units = buildExcludePunchUnits(item)
  const steps = 72
  const points: string[] = []

  const contourSeed = stringToSeed(
    `${item.id}-contour-${item.count}`,
  )

  for (let index = 0; index < steps; index += 1) {
    const angle =
      (index / steps) *
        Math.PI *
        2 -
      Math.PI / 2

    let maxDistance = 0

    units.forEach((unit) => {
      const dx = unit.x - 80
      const dy = unit.y - 80

      const projection =
        dx * Math.cos(angle) +
        dy * Math.sin(angle)

      const perpendicular = Math.abs(
        dx * Math.sin(angle) -
        dy * Math.cos(angle),
      )

      if (
        projection <= 0 ||
        perpendicular >= unit.radius
      ) {
        return
      }

      const depth = Math.sqrt(
        Math.max(
          0,
          unit.radius * unit.radius -
            perpendicular * perpendicular,
        ),
      )

      maxDistance = Math.max(
        maxDistance,
        projection + depth,
      )
    })

    const jitter =
      0.45 +
      seededRandom(
        contourSeed + index * 17,
      ) * 0.9

    const radius = Math.max(
      6,
      maxDistance + jitter,
    )

    points.push(
      `${(
        80 +
        Math.cos(angle) * radius
      ).toFixed(2)} ${(
        80 +
        Math.sin(angle) * radius
      ).toFixed(2)}`,
    )
  }

  return `M ${points.join(' L ')} Z`
}

const pointRadius = (point: Point) =>
  clamp(
    (1.05 + point.speed * 1.55) *
      1.5 *
      1.5,
    2.45,
    4.5,
  )

const getTraceColor = () =>
  getComputedStyle(document.documentElement)
    .getPropertyValue('--pt-blue')
    .trim() || '#1838ff'

const rankedUsageForPanel = (
  usage: AppUsageItem[],
) =>
  [...usage].sort(
    (a, b) => b.count - a.count,
  )

const formatPercent = (
  value: number,
) =>
  `${Math.round(value * 100)}%`

const getTraceCharacter = (
  bounds: {
    width: number
    height: number
  } | null,
  occupancy: number,
) => {
  if (!bounds) {
    return 'EMPTY FIELD'
  }

  const ratio =
    bounds.width /
    Math.max(bounds.height, 1)

  if (
    ratio > 1.8 ||
    ratio < 0.56
  ) {
    return 'LINEAR / EXTENDED'
  }

  if (occupancy > 0.42) {
    return 'DENSE / OVERLAPPED'
  }

  if (occupancy < 0.12) {
    return 'SCATTERED / LOCAL'
  }

  return 'BALANCED FIELD'
}

const download = (
  dataUrl: string,
  filename: string,
) => {
  const anchor =
    document.createElement('a')

  anchor.href = dataUrl
  anchor.download = filename
  anchor.click()
}

function AppUsageGraphic({
  item,
  compact = false,
  contour = false,
  merge = false,
}: {
  item: AppUsageItem
  compact?: boolean
  contour?: boolean
  merge?: boolean
}) {
  const excludePaths =
    buildExcludePunchPaths(item)

  const mergedUnits = merge
    ? buildMergedPunchUnits(item)
    : []

  const scale =
    compact ? 1.08 : 1.42

  return (
    <svg
      viewBox="0 0 160 160"
      className={
        contour
          ? 'app-pattern-svg app-pattern-contour'
          : compact
            ? 'app-pattern-svg'
            : 'app-card-svg'
      }
      aria-hidden={contour}
      aria-label={
        contour
          ? undefined
          : `${item.name}, ${item.count}회 실행`
      }
    >
      <g
        transform={
          contour
            ? undefined
            : `translate(80 80) scale(${scale}) translate(-80 -80)`
        }
      >
        {item.count > 0 &&
        contour ? (
          <path
            d={buildOuterContourPath(item)}
            fill="none"
            stroke="var(--pt-blue)"
            strokeWidth="1.45"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ) : item.count > 0 &&
          merge ? (
          mergedUnits.map(
            (unit, index) => (
              <path
                key={`${item.id}-merged-${item.count}-${index}`}
                d={buildPunchPath(
                  unit.x,
                  unit.y,
                  unit.radius,
                  unit.seed,
                  unit.scaleX,
                  unit.scaleY,
                  unit.rotation,
                )}
                fill="var(--pt-blue)"
                stroke="none"
              />
            ),
          )
        ) : item.count > 0 ? (
          <path
            d={excludePaths.join(' ')}
            fill="var(--pt-blue)"
            fillRule="evenodd"
            clipRule="evenodd"
            stroke="none"
            strokeLinejoin="round"
          />
        ) : null}
      </g>
    </svg>
  )
}

function AppUsageCard({
  item,
  rank,
  onCountChange,
}: {
  item: AppUsageItem
  rank: number
  onCountChange: (
    id: string,
    value: string,
  ) => void
}) {
  return (
    <article className="app-usage-card">
      <div className="app-card-head">
        <span className="app-card-rank">
          {String(rank).padStart(2, '0')}
        </span>

        <strong className="app-card-name">
          {item.name}
        </strong>

        <label className="app-card-count">
          <span>RUNS</span>

          <input
            className="app-card-count-input"
            type="number"
            min="1"
            max={MAX_USAGE_COUNT}
            inputMode="numeric"
            value={item.count}
            onChange={(event) =>
              onCountChange(
                item.id,
                event.currentTarget.value,
              )
            }
          />
        </label>
      </div>

      <div className="app-card-graphic">
        <AppUsageGraphic item={item} />
      </div>
    </article>
  )
}

function AppPatternStrip({
  usage,
}: {
  usage: AppUsageItem[]
}) {
  return (
    <section className="app-pattern-section">
      <div className="app-pattern-head">
        <div>
          <span>TRACE PATTERN</span>
          <strong>
            NINE APPLICATION FIELD
          </strong>
        </div>

        <div className="app-usage-count">
          01—09 / OUTER CONTOUR
        </div>
      </div>

      <div className="app-pattern-strip">
        {usage.map((item) => (
          <div
            className="app-pattern-item"
            key={`${item.id}-${item.count}`}
          >
            <AppUsageGraphic
              item={item}
              contour
            />
          </div>
        ))}
      </div>
    </section>
  )
}

function SampleActionGraphic() {
  return (
    <div
      className="action-graphic"
      aria-label="클릭과 드래그의 변환 예시"
    >
      <div className="action-block">
        <span className="action-label">
          CLICK
        </span>

        <span className="action-ring" />

        <small>
          RING / ACCUMULATE
        </small>
      </div>

      <div className="action-arrow">
        →
      </div>

      <div className="action-block">
        <span className="action-label">
          DRAG
        </span>

        <div className="action-dots">
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>

        <small>
          POINT / SAMPLE
        </small>
      </div>
    </div>
  )
}

function AboutExample() {
  return (
    <section
      className="index-overview"
      aria-label="PUNCH TRACE 사용 안내"
    >
      <header className="index-manual-head">
        <div className="index-manual-title">
          <span className="index-meta">
            PUNCH TRACE / INDEX
          </span>

          <h1>
            PUNCH YOUR TRACE
          </h1>

          <p className="index-tagline">
            We click, we punch!
          </p>
        </div>

        <div className="index-manual-intro">
          <span className="index-label">
            DIGITAL TRACE / RECORDING SERVICE
          </span>

          <p>
            사용자가 선택한 범위의 디지털 활동을 기록하고,
            사용 방식과 관계를 하나의 시각적 흔적으로 변환합니다.
          </p>
        </div>
      </header>

      <div className="index-manual-rule" />

      <section className="index-manual-step">
        <div className="index-manual-step-meta">
          <span>01</span>
          <strong>CHOOSE</strong>
        </div>

        <div className="index-manual-step-body">
          <div className="index-manual-command">
            <span>
              SELECT WHAT YOU WANT TO TRACE
            </span>
            <b>→ SET YOUR RANGE</b>
          </div>

          <p className="index-manual-copy">
            먼저 무엇을 볼 것인지와 어느 기간을 기록할 것인지 선택합니다.
          </p>

          <div className="index-manual-data-grid">
            <div>
              <span>RANGE</span>
              <strong>
                APP / WEB / PROJECT
              </strong>
            </div>

            <div>
              <span>PERIOD</span>
              <strong>
                DAY / WEEK / PROJECT PERIOD
              </strong>
            </div>
          </div>
        </div>
      </section>

      <section className="index-manual-step">
        <div className="index-manual-step-meta">
          <span>02</span>
          <strong>TRACE</strong>
        </div>

        <div className="index-manual-step-body">
          <div className="index-manual-command">
            <span>
              USE IT AS USUAL
            </span>

            <b>
              → COLLECT YOUR TRACE
            </b>
          </div>

          <p className="index-manual-copy">
            선택한 범위 안에서의 디지털 활동을 기록합니다.
            행동은 개별 기록으로 남고, 반복된 행동은 하나의
            패턴으로 축적됩니다.
          </p>

          <div className="index-manual-inline-data">
            <span>ACTIVITY</span>
            <strong>
              CLICK / RUN / USE / RELATE
            </strong>
          </div>

          <SampleActionGraphic />
        </div>
      </section>

      <section className="index-manual-step">
        <div className="index-manual-step-meta">
          <span>03</span>
          <strong>
            FILTER &amp; ENCODE
          </strong>
        </div>

        <div className="index-manual-step-body">
          <div className="index-manual-command">
            <span>
              TURN ACTIVITY INTO HOLES
            </span>

            <b>
              → ENCODE THE TRACE
            </b>
          </div>

          <p className="index-manual-copy">
            기록된 데이터를 기준에 따라 추려내고,
            정해진 좌표와 규칙에 따라 펀치의 형태로 변환합니다.
          </p>

          <div className="index-manual-data-grid">
            <div>
              <span>DATA</span>

              <strong>
                USAGE TIME / USAGE COUNT / RELATION
              </strong>
            </div>

            <div>
              <span>RULE</span>

              <strong>
                POSITION / SIZE / DENSITY / OVERLAP
              </strong>
            </div>
          </div>

          <div className="index-manual-translation">
            <div>
              <span>CLICK</span>
              <i className="index-punch-dot" />
              <small>HOLE</small>
            </div>

            <div>
              <span>REPEAT</span>
              <i className="index-punch-stack" />
              <small>DENSITY</small>
            </div>

            <div>
              <span>RELATE</span>
              <i className="index-punch-overlap" />
              <small>OVERLAP</small>
            </div>
          </div>
        </div>
      </section>

      <section className="index-manual-step">
        <div className="index-manual-step-meta">
          <span>04</span>
          <strong>PUNCH</strong>
        </div>

        <div className="index-manual-step-body">
          <div className="index-manual-command">
            <span>
              MAKE YOUR TRACE PHYSICAL
            </span>

            <b>
              → PUNCH YOUR TRACE
            </b>
          </div>

          <p className="index-manual-copy">
            변환된 정보를 실제 카드의 좌표로 옮겨 타공합니다.
            하나의 행동은 하나의 흔적이 되고, 반복된 행동은
            중첩된 밀도로 남습니다.
          </p>

          <figure className="index-image-plate">
            <div className="index-image-frame">
              <img
                src={punchGraphic}
                alt="PUNCH TRACE 펀치 그래픽"
                loading="eager"
                decoding="async"
                onLoad={(event) => {
                  event.currentTarget.parentElement?.classList.remove(
                    'is-empty',
                  )
                }}
                onError={(event) => {
                  event.currentTarget.parentElement?.classList.add(
                    'is-empty',
                  )
                }}
              />

              <div
                className="index-image-placeholder"
                aria-hidden="true"
              >
                <span>
                  ADD IMAGE
                </span>

                <small>
                  src / assets / punch-trace-index.png
                </small>
              </div>
            </div>

            <figcaption>
              <span>
                PUNCH TRACE / VISUAL SAMPLE
              </span>

              <strong>
                DIGITAL TRACE → PUNCH CARD
              </strong>
            </figcaption>
          </figure>
        </div>
      </section>

      <section className="index-manual-step">
        <div className="index-manual-step-meta">
          <span>05</span>
          <strong>SHARE</strong>
        </div>

        <div className="index-manual-step-body">
          <div className="index-manual-command">
            <span>
              PUT YOUR TRACE INTO RELATION
            </span>

            <b>
              → FROM MY TRACE TO OUR TRACE
            </b>
          </div>

          <p className="index-manual-copy">
            완성된 기록을 다른 사람의 기록과 비교하거나 함께 사용합니다.
            개인의 패턴은 공유된 작업 맥락으로 확장됩니다.
          </p>

          <div className="index-manual-relation">
            <div>
              <span>MY TRACE</span>

              <strong>
                WHAT I USE / HOW I USE
              </strong>
            </div>

            <b>→</b>

            <div>
              <span>OUR TRACE</span>

              <strong>
                SHARED APPLICATION / OVERLAP / WORK FIELD
              </strong>
            </div>
          </div>
        </div>
      </section>

      <section className="index-manual-read">
        <div className="index-manual-read-head">
          <span>
            READ THE SYSTEM
          </span>

          <b>
            USE THIS TRACE
          </b>
        </div>

        <div className="index-manual-read-list">
          <div>
            <b>01</b>
            <span>INDEX</span>
            <small>
              SYSTEM / PROJECT
            </small>
          </div>

          <div>
            <b>02</b>
            <span>WHAT I USE</span>
            <small>
              WHAT / APPLICATION / FREQUENCY
            </small>
          </div>

          <div>
            <b>03</b>
            <span>HOW I USE</span>
            <small>
              HOW / INTERACTION / CONTOUR
            </small>
          </div>

          <div>
            <b>04</b>
            <span>OUR TRACE</span>
            <small>
              OUR / SHARED RELATION / WORK FIELD
            </small>
          </div>
        </div>
      </section>
    </section>
  )
}

function getTraceContourClusters({
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
  type TraceGlyph = {
    x: number
    y: number
    radius: number
    weight: number
  }

  const scaleX =
    320 /
    Math.max(fieldWidth, 1)

  const scaleY =
    180 /
    Math.max(fieldHeight, 1)

  const radiusScale =
    Math.min(
      scaleX,
      scaleY,
    )

  const glyphs: TraceGlyph[] = []

  clicks.forEach((click) => {
    const maxRadius =
      Math.max(
        ...click.radii,
        8,
      )

    glyphs.push({
      x: clamp(
        click.x * scaleX,
        0,
        320,
      ),
      y: clamp(
        click.y * scaleY,
        0,
        180,
      ),
      radius: clamp(
        maxRadius *
          radiusScale *
          0.78,
        3.5,
        18,
      ),
      weight:
        1 +
        maxRadius / 20,
    })
  })

  drags.forEach((drag) => {
    drag.samples.forEach(
      (point) => {
        glyphs.push({
          x: clamp(
            point.x * scaleX,
            0,
            320,
          ),
          y: clamp(
            point.y * scaleY,
            0,
            180,
          ),
          radius: clamp(
            pointRadius(point) *
              radiusScale *
              1.65,
            2.5,
            9,
          ),
          weight:
            0.75 +
            point.speed *
              0.45,
        })
      },
    )
  })

  activeSamples.forEach(
    (point) => {
      glyphs.push({
        x: clamp(
          point.x * scaleX,
          0,
          320,
        ),
        y: clamp(
          point.y * scaleY,
          0,
          180,
        ),
        radius: clamp(
          pointRadius(point) *
            radiusScale *
            1.65,
          2.5,
          9,
        ),
        weight: 0.8,
      })
    },
  )

  if (!glyphs.length) {
    return []
  }

  const parent = glyphs.map(
    (_, index) => index,
  )

  const find = (
    value: number,
  ): number => {
    let current = value

    while (
      parent[current] !==
      current
    ) {
      parent[current] =
        parent[parent[current]]

      current =
        parent[current]
    }

    return current
  }

  const union = (
    a: number,
    b: number,
  ) => {
    const rootA = find(a)
    const rootB = find(b)

    if (
      rootA !==
      rootB
    ) {
      parent[rootB] =
        rootA
    }
  }

  for (
    let a = 0;
    a < glyphs.length;
    a += 1
  ) {
    for (
      let b = a + 1;
      b < glyphs.length;
      b += 1
    ) {
      const first =
        glyphs[a]

      const second =
        glyphs[b]

      const distance =
        Math.hypot(
          first.x -
            second.x,
          first.y -
            second.y,
        )

      const threshold =
        Math.max(
          22,
          (first.radius +
            second.radius) *
            1.9,
        )

      if (
        distance <=
        threshold
      ) {
        union(a, b)
      }
    }
  }

  const groups =
    new Map<
      number,
      TraceGlyph[]
    >()

  glyphs.forEach(
    (glyph, index) => {
      const key =
        find(index)

      const current =
        groups.get(key) ??
        []

      current.push(glyph)
      groups.set(
        key,
        current,
      )
    },
  )

  return Array.from(
    groups.values(),
  ).map(
    (
      group,
      groupIndex,
    ) => {
      const totalWeight =
        group.reduce(
          (sum, glyph) =>
            sum +
            glyph.weight,
          0,
        )

      const center =
        group.reduce(
          (
            sum,
            glyph,
          ) => ({
            x:
              sum.x +
              glyph.x *
                glyph.weight,
            y:
              sum.y +
              glyph.y *
                glyph.weight,
          }),
          {
            x: 0,
            y: 0,
          },
        )

      center.x /=
        totalWeight

      center.y /=
        totalWeight

      const bins = 48

      const radii =
        Array.from(
          {
            length:
              bins,
          },
          () => 0,
        )

      group.forEach(
        (glyph) => {
          const dx =
            glyph.x -
            center.x

          const dy =
            glyph.y -
            center.y

          const distance =
            Math.hypot(
              dx,
              dy,
            )

          const angle =
            (Math.atan2(
              dy,
              dx,
            ) +
              Math.PI *
                2) %
            (Math.PI * 2)

          const index =
            Math.floor(
              (angle /
                (Math.PI *
                  2)) *
                bins,
            ) % bins

          radii[
            index
          ] = Math.max(
            radii[index],
            distance +
              glyph.radius *
                1.25,
          )
        },
      )

      const nonZero =
        radii.filter(
          (value) =>
            value > 0,
        )

      const fallback =
        nonZero.length
          ? Math.max(
              5,
              Math.min(
                ...nonZero,
              ),
            )
          : 7

      for (
        let index = 0;
        index < bins;
        index += 1
      ) {
        if (
          radii[index] === 0
        ) {
          radii[
            index
          ] = fallback
        }
      }

      const smoothed =
        radii.map(
          (
            _,
            index,
          ) => {
            let total = 0
            let divisor = 0

            for (
              let offset = -2;
              offset <= 2;
              offset += 1
            ) {
              const sampleIndex =
                (index +
                  offset +
                  bins) %
                bins

              const weight =
                3 -
                Math.abs(
                  offset,
                )

              total +=
                radii[
                  sampleIndex
                ] *
                weight

              divisor +=
                weight
            }

            return (
              total /
              divisor
            )
          },
        )

      const maxRadius =
        Math.max(
          ...smoothed,
          8,
        )

      const padding =
        Math.min(
          5.5,
          maxRadius * 0.12,
        )

      const seed =
        groupIndex * 137 +
        group.length * 29

      return smoothed.map(
        (
          radius,
          index,
        ) => {
          const angle =
            (index / bins) *
            Math.PI *
            2

          const micro =
            1 +
            Math.sin(
              seed +
                index * 1.41,
            ) *
              0.025 +
            Math.sin(
              seed *
                0.37 +
                index * 0.61,
            ) *
              0.016

          return {
            x:
              center.x +
              Math.cos(angle) *
                (radius +
                  padding) *
                micro,

            y:
              center.y +
              Math.sin(angle) *
                (radius +
                  padding) *
                micro,
          }
        },
      )
    },
  )
}

function TraceContourPreview({
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
  const clusters =
    getTraceContourClusters({
      clicks,
      drags,
      activeSamples,
      fieldWidth,
      fieldHeight,
    })

  if (!clusters.length) {
    return (
      <div className="trace-contour-empty">
        <span>
          NO TRACE YET
        </span>

        <small>
          CREATE A TRACE ABOVE
        </small>
      </div>
    )
  }

  return (
    <div className="trace-contour-wrap">
      <svg
        viewBox="0 0 320 180"
        className="trace-contour-svg"
        preserveAspectRatio="none"
        aria-label="활동 구간별 흔적 범위를 외곽선으로 변환한 CONTOUR"
      >
        <g className="trace-contour-shapes">
          {clusters.map(
            (
              cluster,
              index,
            ) => (
              <path
                key={`contour-${index}`}
                d={`M ${cluster
                  .map(
                    (point) =>
                      `${point.x.toFixed(
                        2,
                      )} ${point.y.toFixed(
                        2,
                      )}`,
                  )
                  .join(
                    ' L ',
                  )} Z`}
              />
            ),
          )}
        </g>
      </svg>
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
  const scaleX =
    320 /
    Math.max(
      fieldWidth,
      1,
    )

  const scaleY =
    180 /
    Math.max(
      fieldHeight,
      1,
    )

  const radiusScale =
    Math.min(
      scaleX,
      scaleY,
    )

  const projectPoint = (
    x: number,
    y: number,
  ) => ({
    x: clamp(
      x * scaleX,
      0,
      320,
    ),

    y: clamp(
      y * scaleY,
      0,
      180,
    ),
  })

  return (
    <div
      className="mini-trace-wrap"
      aria-label="현재 TRACE 미리보기"
    >
      <svg
        viewBox="0 0 320 180"
        className="mini-trace"
        preserveAspectRatio="xMidYMid meet"
      >
        {clicks.map(
          (click) =>
            click.radii.map(
              (
                radius,
                index,
              ) => {
                const center =
                  projectPoint(
                    click.x,
                    click.y,
                  )

                const scaledRadius =
                  radius *
                  radiusScale

                return (
                  <path
                    key={`mini-click-${click.id}-${index}`}
                    d={buildPunchPath(
                      center.x,
                      center.y,
                      Math.max(
                        2,
                        Math.min(
                          scaledRadius,
                          24,
                        ),
                      ),
                      click.shapeSeeds[
                        index
                      ],
                    )}
                    fill={
                      index === 0
                        ? 'var(--pt-blue)'
                        : 'none'
                    }
                    stroke={
                      index === 0
                        ? 'none'
                        : 'var(--pt-blue)'
                    }
                    strokeWidth="1.2"
                    strokeLinejoin="round"
                  />
                )
              },
            ),
        )}

        {drags.flatMap(
          (drag) =>
            drag.samples.map(
              (
                point,
                index,
              ) => {
                const center =
                  projectPoint(
                    point.x,
                    point.y,
                  )

                return (
                  <path
                    key={`mini-drag-${drag.id}-${index}`}
                    d={buildPunchPath(
                      center.x,
                      center.y,
                      Math.max(
                        1.65,
                        pointRadius(
                          point,
                        ) *
                          radiusScale,
                      ),
                      point.seed,
                    )}
                    fill="var(--pt-blue)"
                    opacity={
                      0.55 +
                      point.speed *
                        0.26
                    }
                  />
                )
              },
            ),
        )}

        {activeSamples.map(
          (
            point,
            index,
          ) => {
            const center =
              projectPoint(
                point.x,
                point.y,
              )

            return (
              <path
                key={`mini-active-${index}`}
                d={buildPunchPath(
                  center.x,
                  center.y,
                  Math.max(
                    1.65,
                    pointRadius(
                      point,
                    ) *
                      radiusScale,
                  ),
                  point.seed,
                )}
                fill="var(--pt-blue)"
                opacity=".68"
              />
            )
          },
        )}
      </svg>
    </div>
  )
}

const formatParticipantAppName = (
  name: string,
) => {
  const manualBreaks: Record<
    string,
    string
  > = {
    KakaoTalk:
      'Kakao\nTalk',

    'After Effects':
      'After\nEffects',

    'Premiere Pro':
      'Premiere\nPro',

    'Final Cut Pro':
      'Final Cut\nPro',

    'Visual Studio Code':
      'Visual Studio\nCode',
  }

  return (
    manualBreaks[name] ??
    name
  )
}

const ParticipantTraceCard =
  memo(
    function ParticipantTraceCard({
      participant,
      index,
      canRemove,
      onChange,
      onRemove,
    }: {
      participant: ParticipantTrace
      index: number
      canRemove: boolean
      onChange: (
        next: ParticipantTrace,
      ) => void
      onRemove: () => void
    }) {
      const profile =
        getWorkProfile(
          participant.usage,
        )

      const rankedUsage =
        getRankedUsage(
          participant.usage,
        )

      const [
        openAppSlot,
        setOpenAppSlot,
      ] =
        useState<
          number | null
        >(null)

      useEffect(() => {
        if (
          openAppSlot === null
        ) {
          return
        }

        const closeOnOutsidePointer =
          (
            event: globalThis.PointerEvent,
          ) => {
            const target =
              event.target

            if (
              target instanceof
                Element &&
              target.closest(
                '.participant-app-name-control',
              )
            ) {
              return
            }

            setOpenAppSlot(null)
          }

        document.addEventListener(
          'pointerdown',
          closeOnOutsidePointer,
          true,
        )

        return () =>
          document.removeEventListener(
            'pointerdown',
            closeOnOutsidePointer,
            true,
          )
      }, [openAppSlot])

      const updateParticipant =
        (
          patch: Partial<ParticipantTrace>,
        ) => {
          onChange({
            ...participant,
            ...patch,
          })
        }

      const updateApp = (
        slotIndex: number,
        patch: Partial<AppUsageItem>,
      ) => {
        onChange({
          ...participant,
          usage:
            participant.usage.map(
              (
                item,
                itemIndex,
              ) =>
                itemIndex ===
                slotIndex
                  ? {
                      ...item,
                      ...patch,
                    }
                  : item,
            ),
        })
      }

      return (
        <article className="participant-trace-card">
          <div className="participant-card-topline">
            <div className="participant-card-id">
              <span>
                PERSON /{' '}
                {String(
                  index + 1,
                ).padStart(
                  2,
                  '0',
                )}
              </span>

              <strong>
                {profile.primary}
              </strong>
            </div>

            <div className="participant-card-actions">
              <button
                type="button"
                className="participant-remove-button"
                disabled={!canRemove}
                onClick={onRemove}
                aria-label={`${participant.name} 제거`}
              >
                ×
              </button>
            </div>
          </div>

          <div className="participant-person-meta">
            <label>
              <span>
                NAME
              </span>

              <input
                type="text"
                value={
                  participant.name
                }
                onChange={(event) =>
                  updateParticipant({
                    name: event.currentTarget.value,
                  })
                }
              />
            </label>

            <label>
              <span>
                ROLE
              </span>

              <input
                type="text"
                value={
                  participant.role
                }
                onChange={(event) =>
                  updateParticipant({
                    role: event.currentTarget.value,
                  })
                }
              />
            </label>
          </div>

          <div className="participant-app-grid">
            {rankedUsage.map(
              (
                item,
                rankedIndex,
              ) => {
                const originalIndex =
                  participant.usage.findIndex(
                    (usageItem) =>
                      usageItem.id ===
                      item.id,
                  )

                const usedByOthers =
                  new Set(
                    participant.usage
                      .filter(
                        (
                          usageItem,
                        ) =>
                          usageItem.id !==
                          item.id,
                      )
                      .map(
                        (
                          usageItem,
                        ) =>
                          usageItem.id,
                      ),
                  )

                return (
                  <div
                    className="participant-app-cell"
                    key={`${participant.id}-${item.id}`}
                  >
                    <div
                      className={`participant-app-cell-head ${
                        openAppSlot ===
                        rankedIndex
                          ? 'is-menu-open'
                          : ''
                      }`}
                    >
                      <span>
                        {String(
                          rankedIndex +
                            1,
                        ).padStart(
                          2,
                          '0',
                        )}
                      </span>

                      <div className="participant-app-name-control">
                        <span
                          className="participant-app-name"
                          title={
                            item.name
                          }
                        >
                          {formatParticipantAppName(
                            item.name,
                          )}
                        </span>

                        <div className="participant-app-picker">
                          <button
                            type="button"
                            className="participant-app-picker-button"
                            data-no-trace
                            aria-label={`${item.name} 앱 변경`}
                            aria-expanded={
                              openAppSlot ===
                              rankedIndex
                            }
                            onPointerDown={(
                              event,
                            ) => {
                              event.stopPropagation()
                            }}
                            onClick={(
                              event,
                            ) => {
                              event.stopPropagation()

                              setOpenAppSlot(
                                (
                                  current,
                                ) =>
                                  current ===
                                  rankedIndex
                                    ? null
                                    : rankedIndex,
                              )
                            }}
                          >
                            +
                          </button>

                          {openAppSlot ===
                            rankedIndex && (
                            <div
                              className="participant-app-option-menu"
                              data-no-trace
                              role="listbox"
                              aria-label="앱 목록"
                            >
                              {APP_CATALOG
                                .filter(
                                  (
                                    app,
                                  ) =>
                                    app.id ===
                                      item.id ||
                                    !usedByOthers.has(
                                      app.id,
                                    ),
                                )
                                .map(
                                  (
                                    app,
                                  ) => (
                                    <button
                                      key={
                                        app.id
                                      }
                                      type="button"
                                      className={
                                        app.id ===
                                        item.id
                                          ? 'is-current'
                                          : ''
                                      }
                                      data-no-trace
                                      onPointerDown={(
                                        event,
                                      ) => {
                                        event.stopPropagation()
                                      }}
                                      onClick={(
                                        event,
                                      ) => {
                                        event.stopPropagation()

                                        updateApp(
                                          originalIndex,
                                          {
                                            id: app.id,
                                            name: app.name,
                                          },
                                        )

                                        setOpenAppSlot(
                                          null,
                                        )
                                      }}
                                    >
                                      {
                                        app.name
                                      }
                                    </button>
                                  ),
                                )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="participant-app-graphic">
                      <AppUsageGraphic
                        item={item}
                        compact
                        merge
                      />
                    </div>

                    <label className="participant-run-field">
                      <span>
                        RUNS
                      </span>

                      <input
                        type="number"
                        min="0"
                        max={MAX_USAGE_COUNT}
                        step="1"
                        inputMode="numeric"
                        value={
                          item.count ===
                          0
                            ? ''
                            : String(
                                item.count,
                              )
                        }
                        onDoubleClick={(
                          event,
                        ) =>
                          event.currentTarget.select()
                        }
                        onChange={(
                          event,
                        ) => {
                          const raw =
                            event.currentTarget.value.replace(
                              /\D/g,
                              '',
                            )

                          if (
                            raw ===
                            ''
                          ) {
                            updateApp(
                              originalIndex,
                              {
                                count: 0,
                              },
                            )

                            return
                          }

                          const parsed =
                            Number(
                              raw,
                            )

                          if (
                            !Number.isFinite(
                              parsed,
                            )
                          ) {
                            return
                          }

                          updateApp(
                            originalIndex,
                            {
                              count:
                                clamp(
                                  Math.round(
                                    parsed,
                                  ),
                                  0,
                                  MAX_USAGE_COUNT,
                                ),
                            },
                          )
                        }}
                        onBlur={(
                          event,
                        ) => {
                          if (
                            event.currentTarget
                              .value ===
                            ''
                          ) {
                            updateApp(
                              originalIndex,
                              {
                                count: 0,
                              },
                            )
                          }
                        }}
                      />
                    </label>
                  </div>
                )
              },
            )}
          </div>
        </article>
      )
    },
  )

function OurTraceExportCard({
  participant,
  index,
}: {
  participant: ParticipantTrace
  index: number
}) {
  const profile =
    getWorkProfile(
      participant.usage,
    )

  const rankedUsage =
    getRankedUsage(
      participant.usage,
    )

  return (
    <article className="our-export-person-card">
      <div className="our-export-person-head">
        <span>
          PERSON /{' '}
          {String(
            index + 1,
          ).padStart(
            2,
            '0',
          )}
        </span>

        <strong>
          {participant.name}
        </strong>
      </div>

      <div className="our-export-project-role">
        <small>
          {participant.role}
        </small>
      </div>

      <div className="our-export-app-grid">
        {rankedUsage.map(
          (
            item,
            itemIndex,
          ) => (
            <div
              className="our-export-app-cell"
              key={`${participant.id}-${item.id}`}
            >
              <span>
                {String(
                  itemIndex + 1,
                ).padStart(
                  2,
                  '0',
                )}
              </span>

              <AppUsageGraphic
                item={item}
                compact
                merge
              />

              <div className="our-export-app-meta">
                <strong>
                  {formatParticipantAppName(
                    item.name,
                  )}
                </strong>

                <span>
                  {item.count} RUNS
                </span>
              </div>
            </div>
          ),
        )}
      </div>

      <div className="our-export-profile">
        <span>
          WORK FOCUS
        </span>

        <strong>
          {profile.primary} /{' '}
          {profile.secondary}
        </strong>
      </div>
    </article>
  )
}

const getParticipantAppSet = (
  participant: ParticipantTrace,
) =>
  new Set(
    participant.usage.map(
      (item) => item.id,
    ),
  )

function WorkRelationMap({
  participants,
  shared,
}: {
  participants: ParticipantTrace[]
  shared: ReturnType<
    typeof getSharedApplications
  >
}) {
  const width = 760
  const height = 214
  const personY = 28
  const appY = 108

  const peopleCount =
    Math.max(
      participants.length,
      2,
    )

  const usableWidth =
    width - 120

  const personPositions =
    participants.map(
      (_, index) =>
        peopleCount === 1
          ? width / 2
          : 60 +
            (usableWidth *
              index) /
              (peopleCount - 1),
    )

  const relationApps =
    shared.slice(0, 7)

  const appPositions =
    relationApps.map(
      (_, index) =>
        relationApps.length ===
        1
          ? width / 2
          : 110 +
            (width - 220) *
              (index /
                (relationApps.length -
                  1)),
    )

  const sharedByApp =
    new Map(
      relationApps.map(
        (item) => [
          item.id,
          participants.filter(
            (participant) =>
              participant.usage.some(
                (usageItem) =>
                  usageItem.id ===
                  item.id,
              ),
          ),
        ],
      ),
    )

  return (
    <div className="work-relation-map">
      <div className="work-relation-map-head">
        <div>
          <span>
            PEOPLE / APPLICATION RELATION
          </span>

          <strong>
            SHARED APPLICATION
          </strong>
        </div>

        <span>
          {
            relationApps.length
          }{' '}
          SHARED NODES
        </span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="work-relation-svg"
        role="img"
        aria-label="참여자와 공통 애플리케이션 관계 그래프"
      >
        <line
          x1="18"
          y1="175"
          x2={
            width - 18
          }
          y2="175"
          stroke="var(--pt-line)"
          strokeWidth="1"
        />

        {relationApps.map(
          (
            item,
            appIndex,
          ) => {
            const appX =
              appPositions[
                appIndex
              ]

            const connectedPeople =
              sharedByApp.get(
                item.id,
              ) ?? []

            const maxRuns =
              Math.max(
                ...participants.map(
                  (
                    participant,
                  ) =>
                    participant.usage.find(
                      (
                        usageItem,
                      ) =>
                        usageItem.id ===
                        item.id,
                    )?.count ?? 0,
                ),
                1,
              )

            const radius =
              8 +
              Math.min(
                9,
                maxRuns / 14,
              )

            return (
              <g
                key={
                  item.id
                }
              >
                {connectedPeople.map(
                  (
                    participant,
                  ) => {
                    const personIndex =
                      participants.findIndex(
                        (
                          candidate,
                        ) =>
                          candidate.id ===
                          participant.id,
                      )

                    return (
                      <line
                        key={`${participant.id}-${item.id}`}
                        x1={
                          personPositions[
                            personIndex
                          ]
                        }
                        y1={
                          personY + 10
                        }
                        x2={
                          appX
                        }
                        y2={
                          appY -
                          radius
                        }
                        stroke="var(--pt-blue)"
                        strokeWidth="1"
                        opacity=".22"
                      />
                    )
                  },
                )}

                <circle
                  cx={appX}
                  cy={appY}
                  r={radius}
                  fill="var(--pt-white)"
                  stroke="var(--pt-blue)"
                  strokeWidth="1.4"
                />

                <text
                  x={appX}
                  y={
                    appY +
                    2.5
                  }
                  textAnchor="middle"
                  fill="var(--pt-blue)"
                  fontSize="8"
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                >
                  {
                    item.people
                  }
                </text>

                <text
                  x={appX}
                  y={
                    appY +
                    radius +
                    13
                  }
                  textAnchor="middle"
                  fill="var(--pt-black)"
                  fontSize="7.5"
                  fontFamily="Arial, Helvetica, sans-serif"
                >
                  {item.name.length >
                  12
                    ? `${item.name.slice(
                        0,
                        11,
                      )}…`
                    : item.name}
                </text>
              </g>
            )
          },
        )}

        {participants.map(
          (
            participant,
            index,
          ) => {
            const x =
              personPositions[
                index
              ]

            const distinctCount =
              getDistinctApplications(
                participants,
              ).find(
                (entry) =>
                  entry.participant.id ===
                  participant.id,
              )?.apps.length ??
              0

            return (
              <g
                key={
                  participant.id
                }
              >
                <circle
                  cx={x}
                  cy={personY}
                  r="13"
                  fill="var(--pt-blue)"
                />

                <text
                  x={x}
                  y={
                    personY +
                    3.5
                  }
                  textAnchor="middle"
                  fill="var(--pt-white)"
                  fontSize="8"
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                >
                  {String.fromCharCode(
                    65 +
                      index,
                  )}
                </text>

                <text
                  x={x}
                  y={
                    personY +
                    28
                  }
                  textAnchor="middle"
                  fill="var(--pt-black)"
                  fontSize="8"
                  fontFamily="Arial, Helvetica, sans-serif"
                >
                  {participant.name.length >
                  15
                    ? `${participant.name.slice(
                        0,
                        14,
                      )}…`
                    : participant.name}
                </text>

                <text
                  x={x}
                  y="190"
                  textAnchor="middle"
                  fill="var(--pt-gray)"
                  fontSize="7"
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                >
                  {
                    distinctCount
                  }{' '}
                  UNIQUE
                </text>
              </g>
            )
          },
        )}

        {relationApps.length ===
          0 && (
          <text
            x={
              width / 2
            }
            y={105}
            textAnchor="middle"
            fill="var(--pt-gray)"
            fontSize="9"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          >
            NO SHARED APPLICATION / PRIVATE WORK PATTERNS
          </text>
        )}
      </svg>
    </div>
  )
}

function WorkFocusMatrix({
  participants,
}: {
  participants: ParticipantTrace[]
}) {
  const totals =
    participants.map(
      (participant) => ({
        participant,
        totals:
          getDomainTotals(
            participant.usage,
          ),
      }),
    )

  const maxTotal =
    Math.max(
      ...totals.flatMap(
        (item) =>
          Object.values(
            item.totals,
          ),
      ),
      1,
    )

  return (
    <section className="work-relation-section">
      <div className="work-relation-section-head">
        <div>
          <span>
            WORK FOCUS
          </span>

          <strong>
            TRAITS
          </strong>
        </div>

        <span>
          TOOL GROUP / RUNS
        </span>
      </div>

      <div className="focus-matrix">
        {totals.map(
          ({
            participant,
            totals:
              domainTotals,
          }, participantIndex) => (
            <div
              className="focus-person"
              key={
                participant.id
              }
            >
              <div className="focus-person-head">
                <span>
                  {String.fromCharCode(
                    65 +
                      participantIndex,
                  )}
                </span>

                <strong>
                  {participant.name}
                </strong>
              </div>

              <div className="focus-domain-grid">
                {WORK_DOMAINS.map(
                  (
                    domain,
                  ) => {
                    const value =
                      domainTotals[
                        domain.id
                      ] ?? 0

                    return (
                      <div
                        className="focus-domain-row"
                        key={
                          domain.id
                        }
                      >
                        <span>
                          {
                            domain.label
                          }
                        </span>

                        <div className="focus-domain-track">
                          <i
                            style={{
                              width: `${Math.max(
                                2,
                                (value /
                                  maxTotal) *
                                  100,
                              )}%`,
                            }}
                          />
                        </div>

                        <strong>
                          {value}
                        </strong>
                      </div>
                    )
                  },
                )}
              </div>
            </div>
          ),
        )}
      </div>
    </section>
  )
}

function SharedApplicationSet({
  participants,
}: {
  participants: ParticipantTrace[]
}) {
  const pairs: Array<{
    first: ParticipantTrace
    second: ParticipantTrace
    shared: number
    union: number
    similarity: number
    sharedApps: string[]
  }> = []

  for (
    let firstIndex = 0;
    firstIndex <
    participants.length;
    firstIndex += 1
  ) {
    for (
      let secondIndex =
        firstIndex + 1;
      secondIndex <
      participants.length;
      secondIndex += 1
    ) {
      const first =
        participants[
          firstIndex
        ]

      const second =
        participants[
          secondIndex
        ]

      const firstSet =
        getParticipantAppSet(
          first,
        )

      const secondSet =
        getParticipantAppSet(
          second,
        )

      const sharedIds =
        [...firstSet].filter(
          (id) =>
            secondSet.has(id),
        )

      const union =
        new Set([
          ...firstSet,
          ...secondSet,
        ]).size

      pairs.push({
        first,
        second,
        shared:
          sharedIds.length,
        union,

        similarity:
          union === 0
            ? 0
            : sharedIds.length /
              union,

        sharedApps:
          sharedIds
            .map(
              (id) =>
                APP_CATALOG.find(
                  (app) =>
                    app.id ===
                    id,
                )?.name ?? id,
            )
            .slice(0, 5),
      })
    }
  }

  return (
    <div className="work-relation-section similarity-section">
      <div className="work-relation-section-head">
        <div>
          <span>
            SHARED APPLICATION
          </span>

          <strong>
            OVERLAP
          </strong>
        </div>

        <span>
          SHARED / TOTAL
        </span>
      </div>

      <div className="similarity-explainer">
        <div className="similarity-legend">
          <i />
          <span>
            BLUE = SHARED TOOL SET
          </span>
        </div>

        <p>
          두 사람의 앱 구성을 비교해 공통 도구 비율을 보여줍니다.
          막대가 길수록 공통 도구가 많습니다.
        </p>
      </div>

      <div className="shared-application-set">
        <div className="shared-application-set-head">
          <span>
            SHARED TOOL SET
          </span>

          <strong>
            {
              getSharedApplications(
                participants,
              ).length
            }{' '}
            TOOLS
          </strong>
        </div>

        {getSharedApplications(
          participants,
        ).length > 0 ? (
          <div className="shared-application-token-grid">
            {getSharedApplications(
              participants,
            )
              .slice(0, 9)
              .map(
                (item) => (
                  <div
                    className="shared-application-token"
                    key={
                      item.id
                    }
                  >
                    <AppUsageGraphic
                      item={{
                        id: item.id,
                        name:
                          item.name,
                        count:
                          Math.max(
                            0,
                            Math.round(
                              item.runs /
                                Math.max(
                                  item.people,
                                  1,
                                ),
                            ),
                          ),
                      }}
                      compact
                      merge
                    />

                    <div>
                      <strong>
                        {item.name}
                      </strong>

                      <span>
                        {
                          item.people
                        }{' '}
                        PEOPLE /{' '}
                        {item.runs} RUNS
                      </span>
                    </div>
                  </div>
                ),
              )}
          </div>
        ) : (
          <div className="work-empty-panel">
            NO SHARED APPLICATION
          </div>
        )}
      </div>

      {pairs.length === 0 ? (
        <div className="work-empty-panel">
          NEED AT LEAST 2 PEOPLE
        </div>
      ) : (
        <div className="similarity-pair-list">
          {pairs.map(
            (
              pair,
              index,
            ) => (
              <div
                className="similarity-pair"
                key={`${pair.first.id}-${pair.second.id}`}
              >
                <div className="similarity-pair-label">
                  <span>
                    PAIR{' '}
                    {String(
                      index + 1,
                    ).padStart(
                      2,
                      '0',
                    )}
                  </span>

                  <strong>
                    {pair.first.name}{' '}
                    ×{' '}
                    {pair.second.name}
                  </strong>
                </div>

                <div className="similarity-pair-middle">
                  <div className="similarity-pair-bar">
                    <i
                      style={{
                        width: `${Math.max(
                          5,
                          pair.similarity *
                            100,
                        )}%`,
                      }}
                    />
                  </div>

                  <div className="similarity-shared-apps">
                    {pair.sharedApps.length >
                    0
                      ? pair.sharedApps.map(
                          (app) => (
                            <span
                              key={
                                app
                              }
                            >
                              {app}
                            </span>
                          ),
                        )
                      : (
                        <span>
                          NO SHARED APP
                        </span>
                      )}
                  </div>
                </div>

                <div className="similarity-pair-value">
                  <strong>
                    {formatPercent(
                      pair.similarity,
                    )}
                  </strong>

                  <span>
                    {pair.shared}{' '}
                    SHARED /{' '}
                    {pair.union}{' '}
                    TOTAL
                  </span>
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  )
}

const TEAM_ROLE_MAP: Record<
  string,
  string
> = {
  visual:
    'VISUAL LEAD',

  research:
    'RESEARCH / INSIGHT',

  production:
    'PRODUCTION / MOTION',

  communication:
    'COORDINATION / COMMUNICATION',

  organization:
    'SYSTEM / PROJECT LEAD',
}

const getPrimaryDomainId = (
  usage: AppUsageItem[],
) => {
  const profile =
    getWorkProfile(
      usage,
    )

  return (
    WORK_DOMAINS.find(
      (domain) =>
        domain.label ===
        profile.primary,
    )?.id ??
    'organization'
  )
}

const getSuggestedTeamRole = (
  participant: ParticipantTrace,
) => {
  const domainId =
    getPrimaryDomainId(
      participant.usage,
    )

  return (
    TEAM_ROLE_MAP[
      domainId
    ] ??
    participant.role
  )
}

const TEAM_CHARACTER_MAP: Record<
  string,
  string
> = {
  visual:
    '형태와 시각 체계를 구체화하는 경향',

  research:
    '자료와 관찰을 구조화해 방향을 찾는 경향',

  production:
    '아이디어를 실제 결과물로 전환하는 경향',

  communication:
    '의견과 작업 흐름을 연결하는 경향',

  organization:
    '일정과 정보, 작업 구조를 정리하는 경향',
}

const getSuggestedCharacter = (
  participant: ParticipantTrace,
) => {
  const domainId =
    getPrimaryDomainId(
      participant.usage,
    )

  return (
    TEAM_CHARACTER_MAP[
      domainId
    ] ??
    '도구 사용 패턴을 바탕으로 고유한 작업 방식을 형성'
  )
}

function TeamFieldGraphic({
  participants,
}: {
  participants: ParticipantTrace[]
}) {
  return (
    <section className="team-field-section">
      <div className="work-relation-section-head">
        <div>
          <span>
            FROM PERSONAL TRACE TO PROJECT ROLE
          </span>

          <strong>
            TEAM PROFILE
          </strong>
        </div>

        <span>
          {participants.length} PEOPLE / STRENGTH → ROLE
        </span>
      </div>

      <div className="team-profile-header">
        <span>
          PRIMARY TOOL / WORK CHARACTER
        </span>

        <span aria-hidden="true" />

        <span>
          TEAM ROLE
        </span>
      </div>

      <div className="team-profile-list">
        {participants.map(
          (
            participant,
            index,
          ) => {
            const profile =
              getWorkProfile(
                participant.usage,
              )

            const rankedUsage =
              getRankedUsage(
                participant.usage,
              )

            const primaryApp =
              rankedUsage[0]

            const suggestedRole =
              getSuggestedTeamRole(
                participant,
              )

            const totalRuns =
              participant.usage.reduce(
                (
                  sum,
                  item,
                ) =>
                  sum +
                  item.count,
                0,
              )

            return (
              <div
                className="team-profile-row"
                key={
                  participant.id
                }
              >
                <div className="team-profile-strength">
                  <div className="team-profile-person">
                    <span>
                      {String.fromCharCode(
                        65 +
                          index,
                      )}
                    </span>

                    <strong>
                      {participant.name}
                    </strong>
                  </div>

                  <div className="team-profile-primary">
                    <div className="team-profile-primary-graphic">
                      {primaryApp ? (
                        <AppUsageGraphic
                          item={
                            primaryApp
                          }
                          compact
                          merge
                        />
                      ) : null}
                    </div>

                    <div className="team-profile-primary-copy">
                      <span>
                        PRIMARY TOOL
                      </span>

                      <strong>
                        {
                          primaryApp?.name ??
                          '—'
                        }
                      </strong>

                      <small>
                        {
                          primaryApp?.count ??
                          0
                        }{' '}
                        RUNS /{' '}
                        {totalRuns}{' '}
                        TOTAL
                      </small>
                    </div>
                  </div>

                  <div className="team-profile-character">
                    <span>
                      WORK CHARACTER
                    </span>

                    <strong>
                      {
                        getSuggestedCharacter(
                          participant,
                        )
                      }
                    </strong>
                  </div>
                </div>

                <div
                  className="team-profile-connector"
                  aria-hidden="true"
                >
                  <i>
                    →
                  </i>
                </div>

                <div className="team-profile-role">
                  <span>
                    PROJECT ROLE
                  </span>

                  <strong>
                    {suggestedRole}
                  </strong>

                  <small>
                    {participant.role}
                  </small>

                  <p>
                    {profile.primary ===
                    'VISUAL'
                      ? '시각 체계를 정리하고 결과물의 방향을 구체화'
                      : profile.primary ===
                          'RESEARCH'
                        ? '자료와 관찰을 연결해 프로젝트의 근거를 확장'
                        : profile.primary ===
                            'PRODUCTION'
                          ? '아이디어를 실제 결과물과 실행 단계로 전환'
                          : profile.primary ===
                              'COMMUNICATION'
                            ? '팀의 의견과 작업 흐름을 연결하고 조율'
                            : '일정과 정보, 작업 구조를 정리하고 관리'}
                  </p>
                </div>
              </div>
            )
          },
        )}
      </div>
    </section>
  )
}

const participantPrimaryFieldsForSummary = (
  participants: ParticipantTrace[],
) =>
  participants
    .map(
      (participant) =>
        getWorkProfile(
          participant.usage,
        ).primary,
    )
    .filter(
      (
        value,
        index,
        values,
      ) =>
        values.indexOf(
          value,
        ) === index,
    )

function OurTraceComparison({
  participants,
}: {
  participants: ParticipantTrace[]
}) {
  const shared =
    getSharedApplications(
      participants,
    )

  const uniqueToolCount =
    new Set(
      participants.flatMap(
        (participant) =>
          participant.usage.map(
            (item) =>
              item.id,
          ),
      ),
    ).size

  const sharedToolCount =
    shared.length

  const overlapRatio =
    uniqueToolCount === 0
      ? 0
      : sharedToolCount /
        uniqueToolCount

  return (
    <div className="our-comparison-section">
      <div className="our-comparison-head">
        <div>
          <span>
            WORK RELATION
          </span>
        </div>

        <span>
          {participants.length} PEOPLE /{' '}
          {uniqueToolCount} UNIQUE TOOLS
        </span>
      </div>

      <div className="relation-stat-strip">
        <div>
          <span>
            COMMON
          </span>

          <strong>
            {sharedToolCount}
          </strong>

          <small>
            SHARED TOOLS
          </small>
        </div>

        <div>
          <span>
            SIMILARITY
          </span>

          <strong>
            {formatPercent(
              overlapRatio,
            )}
          </strong>

          <small>
            COMMON / UNION
          </small>
        </div>

        <div>
          <span>
            PRIMARY FIELDS
          </span>

          <strong>
            {
              participantPrimaryFieldsForSummary(
                participants,
              ).length
            }
          </strong>

          <small>
            WORK FOCUS
          </small>
        </div>
      </div>

      <WorkRelationMap
        participants={
          participants
        }
        shared={shared}
      />

      <SharedApplicationSet
        participants={
          participants
        }
      />

      <WorkFocusMatrix
        participants={
          participants
        }
      />

      <TeamFieldGraphic
        participants={
          participants
        }
      />

      <div className="our-complement-strip">
        <span>
          COMPLEMENT
        </span>

        <strong>
          {participants
            .map(
              (participant) =>
                getWorkProfile(
                  participant.usage,
                ).primary,
            )
            .filter(
              (
                value,
                index,
                values,
              ) =>
                values.indexOf(
                  value,
                ) === index,
            )
            .join(
              ' × ',
            ) ||
            'UNDEFINED FIELD'}
        </strong>

        <small>
          SAME TOOLS CAN FORM DIFFERENT WORK PATTERNS.
        </small>
      </div>
    </div>
  )
}

const OurTraceWorkspace =
  memo(
    function OurTraceWorkspace({
      participants,
      onChangeParticipants,
    }: {
      participants: ParticipantTrace[]
      onChangeParticipants: (
        next: ParticipantTrace[],
      ) => void
    }) {
      const exportRef =
        useRef<HTMLDivElement | null>(
          null,
        )

      const [
        exporting,
        setExporting,
      ] =
        useState(false)

      const [
        workProjectTitle,
        setWorkProjectTitle,
      ] =
        useState('PROJECT')

      const setParticipant =
        (
          next: ParticipantTrace,
        ) => {
          onChangeParticipants(
            participants.map(
              (participant) =>
                participant.id ===
                next.id
                  ? next
                  : participant,
            ),
          )
        }

      const removeParticipant =
        (
          id: string,
        ) => {
          if (
            participants.length <=
            MIN_PARTICIPANTS
          ) {
            return
          }

          onChangeParticipants(
            participants.filter(
              (participant) =>
                participant.id !==
                id,
            ),
          )
        }

      const getNextParticipantIndex =
        () => {
          const usedNames =
            new Set(
              participants.map(
                (participant) =>
                  participant.name,
              ),
            )

          const candidates =
            Array.from(
              {
                length:
                  MAX_PARTICIPANTS,
              },
              (_, index) =>
                `PERSON ${String.fromCharCode(
                  65 + index,
                )}`,
            )

          return candidates.findIndex(
            (name) =>
              !usedNames.has(
                name,
              ),
          )
        }

      const addParticipant =
        () => {
          if (
            participants.length >=
            MAX_PARTICIPANTS
          ) {
            return
          }

          const nextIndex =
            getNextParticipantIndex()

          const safeIndex =
            nextIndex >= 0
              ? nextIndex
              : participants.length

          onChangeParticipants([
            ...participants,
            createRandomParticipant(
              safeIndex,
            ),
          ])
        }

      const exportWorkField =
        useCallback(
          async () => {
            const source =
              exportRef.current

            if (
              !source ||
              !participants.length
            ) {
              return
            }

            setExporting(
              true,
            )

            const stage =
              document.createElement(
                'div',
              )

            stage.style.position =
              'fixed'

            stage.style.left =
              '-1400px'

            stage.style.top =
              '0'

            stage.style.width =
              '1240px'

            stage.style.background =
              '#ffffff'

            stage.style.padding =
              '0'

            stage.style.margin =
              '0'

            stage.style.zIndex =
              '-9999'

            stage.style.pointerEvents =
              'none'

            const board =
              source.cloneNode(
                true,
              ) as HTMLDivElement

            board.removeAttribute(
              'aria-hidden',
            )

            board.style.position =
              'relative'

            board.style.left =
              '0'

            board.style.top =
              '0'

            board.style.width =
              '1200px'

            board.style.minHeight =
              '0'

            board.style.margin =
              '0'

            board.style.background =
              '#ffffff'

            board.style.padding =
              '34px'

            board.style.setProperty(
              'display',
              'block',
              'important',
            )

            board.style.setProperty(
              'visibility',
              'visible',
              'important',
            )

            board.style.setProperty(
              'opacity',
              '1',
              'important',
            )

            board.style.setProperty(
              'position',
              'relative',
              'important',
            )

            board.style.setProperty(
              'left',
              '0',
              'important',
            )

            board.style.setProperty(
              'top',
              '0',
              'important',
            )

            stage.appendChild(
              board,
            )

            document.body.appendChild(
              stage,
            )

            try {
              await new Promise<void>(
                (resolve) => {
                  requestAnimationFrame(
                    () =>
                      requestAnimationFrame(
                        () =>
                          resolve(),
                      ),
                  )
                },
              )

              const dataUrl =
                await toPng(
                  board,
                  {
                    cacheBust:
                      true,
                    pixelRatio: 2,
                    backgroundColor:
                      '#ffffff',
                  },
                )

              download(
                dataUrl,
                'punch-trace-our-work-field.png',
              )
            } finally {
              stage.remove()
              setExporting(
                false,
              )
            }
          },
          [
            participants,
            workProjectTitle,
          ],
        )

      const shared =
        getSharedApplications(
          participants,
        )

      return (
        <div className="our-trace-workspace">
          <section
            className="our-work-project-field"
            data-no-trace
          >
            <div>
              <span>
                PROJECT
              </span>

              <strong>
                WORK FIELD
              </strong>
            </div>

            <input
              type="text"
              value={
                workProjectTitle
              }
              onChange={(
                event,
              ) =>
                setWorkProjectTitle(
                  event
                    .currentTarget
                    .value,
                )
              }
              placeholder="PROJECT"
              aria-label="워크 필드 프로젝트 제목"
            />
          </section>

          <section className="our-participant-controls">
            <div>
              <span>
                PARTICIPANTS
              </span>

              <strong>
                WORK FIELD /{' '}
                {participants.length}{' '}
                PEOPLE
              </strong>
            </div>

            <div className="our-participant-control-actions">
              <span className="participant-count-status">
                {
                  participants.length
                }{' '}
                /{' '}
                {MAX_PARTICIPANTS}
              </span>

              <button
                type="button"
                className="our-add-person-button"
                disabled={
                  participants.length >=
                  MAX_PARTICIPANTS
                }
                onClick={
                  addParticipant
                }
              >
                + PERSON
              </button>
            </div>
          </section>

          <p className="our-trace-helper">
            새로운 사람을 추가하면 기존 인물은 그대로 유지되고
            새 인물만 랜덤 데이터로 생성됩니다. 각 카드에서
            이름, 역할, 앱, RUNS를 독립적으로 수정할 수 있습니다.
          </p>

          <div className="participant-card-stack">
            {participants.map(
              (
                participant,
                index,
              ) => (
                <ParticipantTraceCard
                  key={
                    participant.id
                  }
                  participant={
                    participant
                  }
                  index={
                    index
                  }
                  canRemove={
                    participants.length >
                    MIN_PARTICIPANTS
                  }
                  onChange={
                    setParticipant
                  }
                  onRemove={() =>
                    removeParticipant(
                      participant.id,
                    )
                  }
                />
              ),
            )}
          </div>

          <OurTraceComparison
            participants={
              participants
            }
          />

          <div className="our-export-bottom">
            <div>
              <span>
                EXPORT / WORK FIELD
              </span>

              <strong>
                {participants.length}{' '}
                PEOPLE /{' '}
                {shared.length}{' '}
                SHARED TOOLS
              </strong>
            </div>

            <button
              type="button"
              className="our-export-button"
              disabled={
                exporting
              }
              onClick={() =>
                void exportWorkField()
              }
            >
              {exporting
                ? 'EXPORTING'
                : 'EXPORT WORK FIELD'}
            </button>
          </div>

          <div
            ref={exportRef}
            className="our-trace-export-board"
            aria-hidden="true"
          >
            <div className="our-export-title">
              <div>
                <span>
                  PUNCH TRACE / COLLECTIVE FIELD
                </span>

                <small>
                  {
                    workProjectTitle
                  }
                </small>
              </div>

              <strong>
                OUR TRACE / WORK FIELD
              </strong>
            </div>

            <div className="our-export-people">
              {participants.map(
                (
                  participant,
                  index,
                ) => (
                  <OurTraceExportCard
                    key={
                      participant.id
                    }
                    participant={
                      participant
                    }
                    index={
                      index
                    }
                  />
                ),
              )}
            </div>

            <div className="our-export-comparison">
              <OurTraceComparison
                participants={
                  participants
                }
              />
            </div>
          </div>
        </div>
      )
    },
  )

function ContentExample({
  section,
  clicks,
  drags,
  activeSamples,
  fieldWidth,
  fieldHeight,
  appUsage,
  onAppUsageChange,
  participants,
  onParticipantsChange,
}: {
  section: Section
  clicks: ClickTrace[]
  drags: DragTrace[]
  activeSamples: Point[]
  fieldWidth: number
  fieldHeight: number
  appUsage: AppUsageItem[]
  onAppUsageChange: (
    next: AppUsageItem[],
  ) => void
  participants: ParticipantTrace[]
  onParticipantsChange: (
    next: ParticipantTrace[],
  ) => void
}) {
  if (
    section.title ===
    'WHAT I USE'
  ) {
    return (
      <AppUsagePanel
        usage={
          appUsage
        }
        onChange={
          onAppUsageChange
        }
      />
    )
  }

  if (
    section.title ===
    'HOW I USE'
  ) {
    return (
      <div className="how-layout">
        <SampleActionGraphic />

        <div className="how-live">
          <div className="trace-transform-head how-live-head">
            <div>
              <span>
                LIVE / FIELD
              </span>

              <strong>
                MOVE,
                <br />
                CLICK,
                <br />
                REPEAT.
              </strong>
            </div>

            <small>
              LIVE TRACE / CURRENT ACTIVITY
            </small>
          </div>

          <MiniTracePreview
            clicks={
              clicks
            }
            drags={
              drags
            }
            activeSamples={
              activeSamples
            }
            fieldWidth={
              fieldWidth
            }
            fieldHeight={
              fieldHeight
            }
          />
        </div>

        <div className="how-contour">
          <div className="trace-transform-head">
            <div>
              <span>
                PERSONAL TRACE
              </span>

              <strong>
                CONTOUR
              </strong>
            </div>

            <small>
              TRACE → SINGLE FORM
            </small>
          </div>

          <TraceContourPreview
            clicks={
              clicks
            }
            drags={
              drags
            }
            activeSamples={
              activeSamples
            }
            fieldWidth={
              fieldWidth
            }
            fieldHeight={
              fieldHeight
            }
          />

          <div className="trace-transform-explainer">
            <span>
              RAW TRACE
            </span>

            <b>
              →
            </b>

            <span>
              POSITION + DENSITY
            </span>

            <b>
              →
            </b>

            <span>
              CONTOUR
            </span>
          </div>
        </div>
      </div>
    )
  }

  if (
    section.title ===
    'OUR TRACE'
  ) {
    return (
      <OurTraceWorkspace
        participants={
          participants
        }
        onChangeParticipants={
          onParticipantsChange
        }
      />
    )
  }

  return (
    <AboutExample />
  )
}

function AppUsagePanel({
  usage,
  onChange,
}: {
  usage: AppUsageItem[]
  onChange: (
    next: AppUsageItem[],
  ) => void
}) {
  const visualSetRef =
    useRef<HTMLDivElement | null>(
      null,
    )

  const [
    exportingCards,
    setExportingCards,
  ] =
    useState(false)

  const selectedIds =
    useMemo(
      () =>
        new Set(
          usage.map(
            (item) => item.id,
          ),
        ),
      [usage],
    )

  const rankedUsage =
    useMemo(
      () =>
        [...usage].sort(
          (a, b) =>
            b.count -
            a.count,
        ),
      [usage],
    )

  const toggleApp = (
    app: AppCatalogItem,
  ) => {
    const exists =
      selectedIds.has(
        app.id,
      )

    if (exists) {
      onChange(
        usage.filter(
          (item) =>
            item.id !==
            app.id,
        ),
      )

      return
    }

    if (
      usage.length >=
      MAX_APP_COUNT
    ) {
      return
    }

    onChange([
      ...usage,
      {
        id: app.id,
        name: app.name,
        count: 1,
      },
    ])
  }

  const updateCount = (
    id: string,
    rawValue: string,
  ) => {
    if (
      rawValue === ''
    ) {
      return
    }

    const parsed =
      Number(rawValue)

    if (
      !Number.isFinite(
        parsed,
      )
    ) {
      return
    }

    const nextCount =
      clamp(
        Math.round(
          parsed,
        ),
        1,
        MAX_USAGE_COUNT,
      )

    onChange(
      usage.map(
        (item) =>
          item.id === id
            ? {
                ...item,
                count: nextCount,
              }
            : item,
      ),
    )
  }

  const clearAll = () =>
    onChange([])

  const randomizeApps =
    () => {
      const shuffled = [
        ...APP_CATALOG,
      ]

      for (
        let index =
          shuffled.length -
          1;
        index > 0;
        index -= 1
      ) {
        const randomIndex =
          Math.floor(
            Math.random() *
              (index + 1),
          )

        ;[
          shuffled[index],
          shuffled[
            randomIndex
          ],
        ] = [
          shuffled[
            randomIndex
          ],
          shuffled[index],
        ]
      }

      const nextUsage =
        shuffled
          .slice(
            0,
            MAX_APP_COUNT,
          )
          .map(
            (app) => ({
              id: app.id,
              name: app.name,
              count:
                Math.floor(
                  Math.random() *
                    MAX_USAGE_COUNT,
                ) + 1,
            }),
          )

      onChange(
        nextUsage,
      )
    }

  const exportAppSet =
    useCallback(
      async () => {
        const source =
          visualSetRef.current

        if (
          !source ||
          rankedUsage.length ===
            0
        ) {
          return
        }

        setExportingCards(
          true,
        )

        const stage =
          document.createElement(
            'div',
          )

        stage.className =
          'app-export-stage'

        const board =
          document.createElement(
            'div',
          )

        board.className =
          'app-export-board'

        const header =
          document.createElement(
            'div',
          )

        header.className =
          'app-export-title'

        header.innerHTML =
          '<span>PUNCH TRACE / APPLICATION INDEX</span><strong>TOP 9 APPLICATION TRACE</strong>'

        const visualClone =
          source.cloneNode(
            true,
          ) as HTMLDivElement

        visualClone.classList.add(
          'app-export-visual-set',
        )

        visualClone
          .querySelectorAll<HTMLElement>(
            '.app-usage-preview > .app-usage-section-head, .app-export-bottom',
          )
          .forEach(
            (
              element,
            ) =>
              element.remove(),
          )

        const inputGroups =
          visualClone.querySelectorAll<HTMLElement>(
            '.app-card-count',
          )

        inputGroups.forEach(
          (
            group,
            index,
          ) => {
            const count =
              rankedUsage[
                index
              ]?.count ?? 0

            const replacement =
              document.createElement(
                'span',
              )

            replacement.className =
              'app-card-count-export'

            replacement.textContent =
              `${count} RUNS`

            group.replaceChildren(
              replacement,
            )
          },
        )

        board.appendChild(
          header,
        )

        board.appendChild(
          visualClone,
        )

        stage.appendChild(
          board,
        )

        document.body.appendChild(
          stage,
        )

        try {
          await new Promise<void>(
            (
              resolve,
            ) => {
              requestAnimationFrame(
                () =>
                  requestAnimationFrame(
                    () =>
                      resolve(),
                  ),
              )
            },
          )

          const dataUrl =
            await toPng(
              board,
              {
                cacheBust:
                  true,
                pixelRatio: 2,
                backgroundColor:
                  '#ffffff',
              },
            )

          download(
            dataUrl,
            'punch-trace-app-set.png',
          )
        } finally {
          stage.remove()
          setExportingCards(
            false,
          )
        }
      },
      [
        rankedUsage,
      ],
    )

  return (
    <div className="app-usage-workspace">
      <section className="app-usage-editor">
        <div className="app-usage-section-head">
          <div>
            <span>
              APPLICATION SET
            </span>

            <strong>
              SELECT YOUR TOP 9
            </strong>
          </div>

          <div className="app-usage-count">
            {
              usage.length
            }{' '}
            /{' '}
            {MAX_APP_COUNT}
          </div>
        </div>

        <p className="app-usage-helper">
          원하는 앱을 최대 9개 선택하세요.
          아래 카드에서 실행 횟수를 바로 조정하면
          해당 그래픽과 순위가 즉시 변경됩니다.
        </p>

        <div className="app-option-grid">
          {APP_CATALOG.map(
            (app) => {
              const selected =
                selectedIds.has(
                  app.id,
                )

              const disabled =
                !selected &&
                usage.length >=
                  MAX_APP_COUNT

              return (
                <button
                  key={
                    app.id
                  }
                  type="button"
                  className={`app-option ${
                    selected
                      ? 'is-selected'
                      : ''
                  }`}
                  disabled={
                    disabled
                  }
                  onClick={() =>
                    toggleApp(
                      app,
                    )
                  }
                >
                  <span>
                    {app.name}
                  </span>

                  <small>
                    {selected
                      ? 'SELECTED'
                      : disabled
                        ? 'FULL'
                        : 'ADD'}
                  </small>
                </button>
              )
            },
          )}
        </div>
      </section>

      <div
        ref={
          visualSetRef
        }
        className="app-visual-set"
      >
        <section className="app-usage-preview">
          <div className="app-usage-section-head">
            <div>
              <span>
                TOP 9 APPLICATIONS
              </span>

              <strong>
                COUNT + GRAPHIC
              </strong>
            </div>

            <div className="app-card-actions">
              <button
                type="button"
                className="app-random-button"
                onClick={
                  randomizeApps
                }
              >
                RANDOM
              </button>

              <button
                type="button"
                className="app-clear-button"
                disabled={
                  !usage.length
                }
                onClick={
                  clearAll
                }
              >
                RESET
              </button>
            </div>
          </div>

          <div className="app-card-grid">
            {rankedUsage.map(
              (
                item,
                index,
              ) => (
                <AppUsageCard
                  key={item.id}
                  item={item}
                  rank={
                    index + 1
                  }
                  onCountChange={
                    updateCount
                  }
                />
              ),
            )}
          </div>
        </section>

        <AppPatternStrip
          usage={
            rankedUsage
          }
        />

        <div className="app-export-bottom">
          <span>
            EXPORT / 01—09 + OUTER CONTOUR
          </span>

          <button
            type="button"
            className="app-export-button"
            disabled={
              !rankedUsage.length ||
              exportingCards
            }
            onClick={() =>
              void exportAppSet()
            }
          >
            {exportingCards
              ? 'EXPORTING'
              : 'EXPORT SET'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function TraceWorkspace() {
  const [clicks, setClicks] =
    useState<
      ClickTrace[]
    >([])

  const [drags, setDrags] =
    useState<
      DragTrace[]
    >([])

  const [
    activeSamples,
    setActiveSamples,
  ] =
    useState<Point[]>(
      [],
    )

  const [
    selectedPanel,
    setSelectedPanel,
  ] =
    useState<SectionId>(
      'ABOUT',
    )

  const [
    elapsed,
    setElapsed,
  ] = useState(0)

  const [
    exportOpen,
    setExportOpen,
  ] =
    useState(false)

  const [
    exporting,
    setExporting,
  ] =
    useState(false)

  const [
    fieldSize,
    setFieldSize,
  ] =
    useState({
      width: 1,
      height: 1,
    })

  const [
    traceEnabled,
    setTraceEnabled,
  ] =
    useState(true)

  const [
    appUsage,
    setAppUsage,
  ] =
    useState<
      AppUsageItem[]
    >(
      DEFAULT_APP_USAGE,
    )

  const [
    participants,
    setParticipants,
  ] =
    useState<
      ParticipantTrace[]
    >(() => [
      createRandomParticipant(
        0,
      ),
      createRandomParticipant(
        1,
      ),
    ])

  const activeRef =
    useRef<ActiveDrag | null>(
      null,
    )

  const shellRef =
    useRef<HTMLElement | null>(
      null,
    )

  const serialRef =
    useRef(0)

  useEffect(() => {
    const timer =
      window.setInterval(
        () => {
          setElapsed(
            (value) =>
              value + 1,
          )
        },
        1000,
      )

    return () =>
      window.clearInterval(
        timer,
      )
  }, [])

  useEffect(() => {
    const element =
      shellRef.current

    if (!element) {
      return
    }

    const updateSize =
      () => {
        setFieldSize({
          width: Math.max(
            1,
            element.clientWidth,
          ),

          height: Math.max(
            1,
            element.clientHeight,
          ),
        })
      }

    updateSize()

    const observer =
      new ResizeObserver(
        updateSize,
      )

    observer.observe(
      element,
    )

    return () =>
      observer.disconnect()
  }, [])

  const reset =
    useCallback(
      () => {
        activeRef.current =
          null

        setClicks([])
        setDrags([])
        setActiveSamples([])
      },
      [],
    )

  const toggleTraceMode =
    useCallback(
      () => {
        setTraceEnabled(
          (current) => {
            const next =
              !current

            if (!next) {
              activeRef.current =
                null

              setActiveSamples(
                [],
              )
            }

            return next
          },
        )
      },
      [],
    )

  useEffect(() => {
    const cancel =
      () => {
        activeRef.current =
          null

        setActiveSamples(
          [],
        )
      }

    window.addEventListener(
      'blur',
      cancel,
    )

    return () =>
      window.removeEventListener(
        'blur',
        cancel,
      )
  }, [])

  useEffect(() => {
    const handlePointerDown =
      (
        event: globalThis.PointerEvent,
      ) => {
        const shell =
          shellRef.current

        if (!shell) {
          return
        }

        const target =
          event.target

        if (
          !(
            target instanceof
            Node
          ) ||
          !shell.contains(
            target,
          )
        ) {
          return
        }

        onPointerDown(
          event,
        )
      }

    const handlePointerMove =
      (
        event: globalThis.PointerEvent,
      ) => {
        if (
          !activeRef.current
        ) {
          return
        }

        onPointerMove(
          event,
        )
      }

    const handlePointerUp =
      (
        event: globalThis.PointerEvent,
      ) => {
        if (
          !activeRef.current
        ) {
          return
        }

        finishPointer(
          event,
        )
      }

    const handlePointerCancel =
      (
        event: globalThis.PointerEvent,
      ) => {
        if (
          !activeRef.current
        ) {
          return
        }

        finishPointer(
          event,
        )
      }

    document.addEventListener(
      'pointerdown',
      handlePointerDown,
      true,
    )

    document.addEventListener(
      'pointermove',
      handlePointerMove,
      true,
    )

    document.addEventListener(
      'pointerup',
      handlePointerUp,
      true,
    )

    document.addEventListener(
      'pointercancel',
      handlePointerCancel,
      true,
    )

    return () => {
      document.removeEventListener(
        'pointerdown',
        handlePointerDown,
        true,
      )

      document.removeEventListener(
        'pointermove',
        handlePointerMove,
        true,
      )

      document.removeEventListener(
        'pointerup',
        handlePointerUp,
        true,
      )

      document.removeEventListener(
        'pointercancel',
        handlePointerCancel,
        true,
      )
    }
  }, [traceEnabled])

  useEffect(() => {
    activeRef.current =
      null

    setActiveSamples(
      [],
    )
  }, [selectedPanel])

  const pointFromEvent = (
    event: globalThis.PointerEvent,
  ) => {
    const bounds =
      shellRef.current?.getBoundingClientRect()

    if (!bounds) {
      return null
    }

    return {
      x: clamp(
        event.clientX -
          bounds.left,
        0,
        bounds.width,
      ),

      y: clamp(
        event.clientY -
          bounds.top,
        0,
        bounds.height,
      ),
    }
  }

  const onPointerDown = (
    event: globalThis.PointerEvent,
  ) => {
    if (
      !traceEnabled ||
      event.button !== 0
    ) {
      return
    }

    const target =
      event.target

    if (
      target instanceof
        Element &&
      target.closest(
        'input, select, textarea, [data-no-trace]',
      )
    ) {
      return
    }

    const point =
      pointFromEvent(
        event,
      )

    if (!point) {
      return
    }

    const now =
      performance.now()

    const pressure =
      event.pressure > 0 &&
      event.pressure < 1
        ? event.pressure
        : 0.5

    const first: Point = {
      ...point,
      time: now,
      speed: 0,
      gap: 0,
      seed:
        createPunchSeed(),
      angle: 0,
    }

    activeRef.current = {
      pointerId:
        event.pointerId,

      startX:
        point.x,

      startY:
        point.y,

      lastX:
        point.x,

      lastY:
        point.y,

      lastTime:
        now,

      startTime:
        now,

      clickScale:
        pressure,

      samples: [
        first,
      ],

      hasMoved:
        false,
    }
  }

  const onPointerMove = (
    event: globalThis.PointerEvent,
  ) => {
    const active =
      activeRef.current

    if (
      !active ||
      active.pointerId !==
        event.pointerId
    ) {
      return
    }

    if (
      !traceEnabled
    ) {
      return
    }

    const point =
      pointFromEvent(
        event,
      )

    if (!point) {
      return
    }

    const movementFromStart =
      Math.hypot(
        point.x -
          active.startX,
        point.y -
          active.startY,
      )

    if (
      !active.hasMoved &&
      movementFromStart <
        CLICK_DISTANCE
    ) {
      return
    }

    active.hasMoved =
      true

    try {
      ;(
        shellRef.current as
          | HTMLElement
          | null
      )?.setPointerCapture?.(
        event.pointerId,
      )
    } catch {
      // Pointer capture is optional.
    }

    const now =
      performance.now()

    const elapsedTime =
      Math.max(
        1,
        now -
          active.lastTime,
      )

    const distance =
      Math.hypot(
        point.x -
          active.lastX,
        point.y -
          active.lastY,
      )

    const speed =
      distance /
      elapsedTime

    const targetGap =
      clamp(
        3 +
          speed * 44,
        3.5,
        22,
      )

    if (
      distance <
        targetGap &&
      elapsedTime <
        MIN_INTERVAL
    ) {
      return
    }

    if (
      distance <
      targetGap
    ) {
      return
    }

    const steps =
      Math.max(
        1,
        Math.floor(
          distance /
            targetGap,
        ),
      )

    const samples = [
      ...active.samples,
    ]

    for (
      let step = 1;
      step <= steps;
      step += 1
    ) {
      const ratio =
        Math.min(
          1,
          (step *
            targetGap) /
            distance,
        )

      samples.push({
        x:
          active.lastX +
          (point.x -
            active.lastX) *
            ratio,

        y:
          active.lastY +
          (point.y -
            active.lastY) *
            ratio,

        time:
          active.lastTime +
          elapsedTime *
            ratio,

        speed,

        gap:
          targetGap,

        seed:
          createPunchSeed(),

        angle:
          Math.atan2(
            point.y -
              active.lastY,
            point.x -
              active.lastX,
          ),
      })
    }

    active.lastX =
      point.x

    active.lastY =
      point.y

    active.lastTime =
      now

    active.samples =
      samples

    setActiveSamples(
      samples,
    )
  }

  const addClick = (
    x: number,
    y: number,
    scale: number,
  ) => {
    setClicks(
      (current) => {
        let nearestIndex =
          -1

        let nearestDistance =
          Number.POSITIVE_INFINITY

        current.forEach(
          (
            click,
            index,
          ) => {
            const distance =
              Math.hypot(
                click.x - x,
                click.y - y,
              )

            if (
              distance <
              nearestDistance
            ) {
              nearestIndex =
                index

              nearestDistance =
                distance
            }
          },
        )

        if (
          nearestIndex >= 0 &&
          nearestDistance <=
            SAME_CLICK_TOLERANCE
        ) {
          return current.map(
            (
              click,
              index,
            ) =>
              index ===
              nearestIndex
                ? {
                    ...click,
                    time:
                      Date.now(),

                    radii: [
                      ...click.radii,
                      click.radii[
                        click.radii.length -
                          1
                      ] +
                        RING_STEP *
                          scale,
                    ],

                    shapeSeeds: [
                      ...click.shapeSeeds,
                      createPunchSeed(),
                    ],
                  }
                : click,
          )
        }

        return [
          ...current,
          {
            id:
              ++serialRef.current,

            x,
            y,

            time:
              Date.now(),

            radii: [
              BASE_RING_RADIUS *
                scale,
            ],

            shapeSeeds: [
              createPunchSeed(),
            ],
          },
        ]
      },
    )
  }

  const finishPointer = (
    event: globalThis.PointerEvent,
  ) => {
    const active =
      activeRef.current

    if (
      !active ||
      active.pointerId !==
        event.pointerId
    ) {
      return
    }

    if (
      !traceEnabled
    ) {
      activeRef.current =
        null

      setActiveSamples(
        [],
      )

      return
    }

    const totalDistance =
      Math.hypot(
        active.lastX -
          active.startX,
        active.lastY -
          active.startY,
      )

    if (
      !active.hasMoved &&
      totalDistance <
        CLICK_DISTANCE
    ) {
      const holdDuration =
        performance.now() -
        active.startTime

      const durationScale =
        clamp(
          0.8 +
            (Math.min(
              holdDuration,
              900,
            ) /
              900) *
              0.55 +
            (active.clickScale -
              0.5) *
              0.15,
          0.8,
          1.5,
        )

      addClick(
        active.startX,
        active.startY,
        durationScale,
      )
    } else if (
      active.samples.length >
      1
    ) {
      setDrags(
        (current) => [
          ...current,
          {
            id:
              ++serialRef.current,
            samples:
              active.samples,
          },
        ],
      )
    }

    try {
      ;(
        shellRef.current as
          | HTMLElement
          | null
      )?.releasePointerCapture?.(
        event.pointerId,
      )
    } catch {
      // Pointer capture may already be released.
    }

    activeRef.current =
      null

    setActiveSamples(
      [],
    )
  }

  const renderPoint = (
    point: Point,
    index: number,
    key: string,
  ) => {
    const opacity =
      clamp(
        0.56 +
          point.speed *
            0.4,
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
          animationDelay: `${Math.min(
            index * 6,
            120,
          )}ms`,
        }}
      />
    )
  }

  const totalClicks =
    useMemo(
      () =>
        clicks.reduce(
          (
            total,
            click,
          ) =>
            total +
            click.radii.length,
          0,
        ),
      [clicks],
    )

  const totalPoints =
    useMemo(
      () =>
        drags.reduce(
          (
            total,
            trace,
          ) =>
            total +
            trace.samples
              .length,
          0,
        ) +
        activeSamples.length,
      [
        activeSamples.length,
        drags,
      ],
    )

  const section =
    sections.find(
      (item) =>
        item.title ===
        selectedPanel,
    ) ??
    sections[0]

  const getTraceBounds =
    useCallback(
      () => {
        const items: Array<{
          x: number
          y: number
          radius: number
        }> = []

        clicks.forEach(
          (
            click,
          ) => {
            click.radii.forEach(
              (
                radius,
              ) => {
                items.push(
                  {
                    x: click.x,
                    y: click.y,
                    radius:
                      radius +
                      2,
                  },
                )
              },
            )
          },
        )

        drags.forEach(
          (
            drag,
          ) => {
            drag.samples.forEach(
              (
                point,
              ) => {
                items.push(
                  {
                    x:
                      point.x,
                    y:
                      point.y,
                    radius:
                      pointRadius(
                        point,
                      ) + 1,
                  },
                )
              },
            )
          },
        )

        activeSamples.forEach(
          (
            point,
          ) => {
            items.push(
              {
                x:
                  point.x,
                y:
                  point.y,
                radius:
                  pointRadius(
                    point,
                  ) + 1,
              },
            )
          },
        )

        if (
          !items.length
        ) {
          return null
        }

        const minX =
          Math.min(
            ...items.map(
              (
                item,
              ) =>
                item.x -
                item.radius,
            ),
          )

        const minY =
          Math.min(
            ...items.map(
              (
                item,
              ) =>
                item.y -
                item.radius,
            ),
          )

        const maxX =
          Math.max(
            ...items.map(
              (
                item,
              ) =>
                item.x +
                item.radius,
            ),
          )

        const maxY =
          Math.max(
            ...items.map(
              (
                item,
              ) =>
                item.y +
                item.radius,
            ),
          )

        return {
          minX,
          minY,
          maxX,
          maxY,

          width:
            Math.max(
              1,
              maxX - minX,
            ),

          height:
            Math.max(
              1,
              maxY - minY,
            ),
        }
      },
      [
        activeSamples,
        clicks,
        drags,
      ],
    )

  const traceBounds =
    getTraceBounds()

  const fieldArea =
    Math.max(
      1,
      fieldSize.width *
        fieldSize.height,
    )

  const boundsArea =
    traceBounds
      ? traceBounds.width *
        traceBounds.height
      : 0

  const fieldOccupancy =
    clamp(
      boundsArea /
        fieldArea,
      0,
      1,
    )

  const totalActions =
    totalClicks +
    drags.length

  const clickShare =
    totalActions > 0
      ? totalClicks /
        totalActions
      : 0

  const dragShare =
    totalActions > 0
      ? drags.length /
        totalActions
      : 0

  const pointDensity =
    clamp(
      totalPoints /
        Math.max(
          fieldArea /
            12000,
          1,
        ),
      0,
      99,
    )

  const dominantApp =
    [...appUsage].sort(
      (a, b) =>
        b.count -
        a.count,
    )[0] ?? null

  const totalAppRuns =
    appUsage.reduce(
      (
        total,
        item,
      ) =>
        total +
        item.count,
      0,
    )

  const dominantForm =
    clickShare >=
    dragShare
      ? 'RING'
      : 'POINT'

  const traceCharacter =
    getTraceCharacter(
      traceBounds,
      fieldOccupancy,
    )

  const sharedParticipantApps =
    getSharedApplications(
      participants,
    )

  const participantFocus =
    participants.map(
      (participant) => ({
        participant,
        profile:
          getWorkProfile(
            participant.usage,
          ),
      }),
    )

  const participantPrimaryFields =
    participantFocus
      .map(
        (item) =>
          item.profile.primary,
      )
      .filter(
        (
          value,
          index,
          values,
        ) =>
          values.indexOf(
            value,
          ) === index,
      )

  const exportTraceOnly =
    useCallback(
      async () => {
        const bounds =
          getTraceBounds()

        if (!bounds) {
          return
        }

        setExporting(
          true,
        )

        try {
          const traceColor =
            getTraceColor()

          const padding =
            24

          const width =
            Math.ceil(
              bounds.width +
                padding * 2,
            )

          const height =
            Math.ceil(
              bounds.height +
                padding * 2,
            )

          const offsetX =
            bounds.minX -
            padding

          const offsetY =
            bounds.minY -
            padding

          const paths = [
            ...clicks.flatMap(
              (
                click,
              ) =>
                click.radii.map(
                  (
                    radius,
                    index,
                  ) =>
                    `<path d="${buildPunchPath(
                      click.x -
                        offsetX,
                      click.y -
                        offsetY,
                      radius,
                      click.shapeSeeds[
                        index
                      ],
                    )}" fill="${
                      index ===
                      0
                        ? traceColor
                        : 'none'
                    }" stroke="${
                      index ===
                      0
                        ? 'none'
                        : traceColor
                    }" stroke-width="1.6" stroke-linejoin="round" />`,
                ),
            ),

            ...drags.flatMap(
              (
                drag,
              ) =>
                drag.samples.map(
                  (
                    point,
                  ) =>
                    `<path d="${buildPunchPath(
                      point.x -
                        offsetX,
                      point.y -
                        offsetY,
                      pointRadius(
                        point,
                      ),
                      point.seed,
                    )}" fill="${traceColor}" opacity="${clamp(
                      0.52 +
                        point.speed *
                          0.42,
                      0.56,
                      0.88,
                    )}" />`,
                ),
            ),

            ...activeSamples.map(
              (
                point,
              ) =>
                `<path d="${buildPunchPath(
                  point.x -
                    offsetX,
                  point.y -
                    offsetY,
                  pointRadius(
                    point,
                  ),
                  point.seed,
                )}" fill="${traceColor}" opacity="0.68" />`,
            ),
          ].join('')

          const svg =
            `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${paths}</svg>`

          const image =
            new Image()

          const source =
            URL.createObjectURL(
              new Blob(
                [svg],
                {
                  type: 'image/svg+xml;charset=utf-8',
                },
              ),
            )

          await new Promise<void>(
            (
              resolve,
              reject,
            ) => {
              image.onload =
                () => {
                  const canvas =
                    document.createElement(
                      'canvas',
                    )

                  canvas.width =
                    width

                  canvas.height =
                    height

                  canvas
                    .getContext(
                      '2d',
                    )
                    ?.drawImage(
                      image,
                      0,
                      0,
                    )

                  URL.revokeObjectURL(
                    source,
                  )

                  download(
                    canvas.toDataURL(
                      'image/png',
                    ),
                    'punch-trace-only.png',
                  )

                  resolve()
                }

              image.onerror =
                () => {
                  URL.revokeObjectURL(
                    source,
                  )

                  reject(
                    new Error(
                      'TRACE ONLY export failed',
                    ),
                  )
                }

              image.src =
                source
            },
          )
        } finally {
          setExporting(
            false,
          )
        }
      },
      [
        activeSamples,
        clicks,
        drags,
        getTraceBounds,
      ],
    )

  const exportTraceField =
    useCallback(
      async () => {
        const shell =
          shellRef.current

        if (!shell) {
          return
        }

        setExporting(
          true,
        )

        try {
          const fieldBackground =
            getComputedStyle(
              document.documentElement,
            )
              .getPropertyValue(
                '--pt-white',
              )
              .trim() ||
            '#ffffff'

          const dataUrl =
            await toPng(
              shell,
              {
                cacheBust:
                  true,
                pixelRatio: 2,
                backgroundColor:
                  fieldBackground,
              },
            )

          download(
            dataUrl,
            'punch-trace-field.png',
          )
        } finally {
          setExporting(
            false,
          )
        }
      },
      [],
    )

  const renderSectionContent =
    (): ReactNode => (
      <ContentExample
        section={
          section
        }
        clicks={
          clicks
        }
        drags={
          drags
        }
        activeSamples={
          activeSamples
        }
        fieldWidth={
          fieldSize.width
        }
        fieldHeight={
          fieldSize.height
        }
        appUsage={
          appUsage
        }
        onAppUsageChange={
          setAppUsage
        }
        participants={
          participants
        }
        onParticipantsChange={
          setParticipants
        }
      />
    )

  return (
    <main className="trace-app">
      <section
        ref={
          shellRef
        }
        className="browser-shell"
        aria-label="PUNCH TRACE 프로젝트 웹 박스"
      >
        <div className="browser-chrome">
          <div
            className="browser-controls"
            aria-label="브라우저 조작부"
          >
            <span />
            <span />
            <span />
          </div>

          <div className="browser-address">
            punch-trace://archive/
            {section.number.toLowerCase()}-
            {section.menuTitle
              .toLowerCase()
              .replace(
                / /g,
                '-',
              )}
          </div>

          <p className="browser-mode">
            {traceEnabled
              ? 'WORKSPACE / TRACE ON'
              : 'WORKSPACE / TRACE OFF'}
          </p>
        </div>

        <div
          className="workspace-ruler"
          aria-hidden="true"
        >
          <span>0</span>
          <span>100</span>
          <span>200</span>
          <span>300</span>
          <span>400</span>
          <span>500</span>
        </div>

        <div className="browser-page">
          <aside
            className="page-menu"
            aria-label="프로젝트 섹션"
          >
            <div className="project-mark">
              <span className="accent-mark" />

              <strong>
                PUNCH TRACE
              </strong>

              <small>
                FROM MY TRACE TO OUR TRACE
              </small>
            </div>

            <p className="panel-label">
              ARCHIVE / INDEX
            </p>

            {sections.map(
              (item) => (
                <button
                  key={
                    item.title
                  }
                  type="button"
                  className={
                    selectedPanel ===
                    item.title
                      ? 'is-selected'
                      : ''
                  }
                  onClick={() =>
                    setSelectedPanel(
                      item.title,
                    )
                  }
                >
                  <b>
                    {item.number}
                  </b>

                  <span>
                    {
                      item.menuTitle
                    }
                  </span>
                </button>
              ),
            )}

            <div className="menu-bottom-note">
              <span>
                UNIT
              </span>

              <strong>
                HOLE / RING
              </strong>

              <span>
                RULE
              </span>

              <strong>
                REPEAT / EXCLUDE
              </strong>
            </div>
          </aside>

          <div className="page-content">
            <div className="content-heading">
              <p className="page-eyebrow">
                {section.label}{' '}
                / {section.number}
              </p>

              <h2>
                {section.menuTitle}
              </h2>

              <p className="page-copy">
                {
                  section.body
                }
              </p>
            </div>

            {renderSectionContent()}

            <p className="content-note">
              {
                section.note
              }
            </p>
          </div>

          <aside
            className="inspector-panel trace-index-panel"
            aria-label="TRACE INDEX 분석 패널"
          >
            <div className="trace-index-heading">
              <p className="panel-label">
                TRACE INDEX
              </p>

              <span>
                {section.number} /{' '}
                {
                  section.menuTitle
                }
              </span>
            </div>

            {section.title ===
              'ABOUT' && (
              <>
                <section className="trace-analysis-block">
                  <p className="trace-analysis-kicker">
                    CORE IDEA
                  </p>

                  <div className="trace-big-label">
                    CLICK → PUNCH → TRACE
                  </div>

                  <span className="trace-analysis-note">
                    디지털 행동을 물리적 흔적의 구조로
                    번역한다.
                  </span>
                </section>

                <section className="trace-analysis-block">
                  <p className="trace-analysis-kicker">
                    VISUAL UNITS
                  </p>

                  <div className="trace-system-map">
                    <div>
                      <span>
                        CLICK
                      </span>

                      <strong>
                        RING
                      </strong>
                    </div>

                    <div>
                      <span>
                        DRAG
                      </span>

                      <strong>
                        POINT
                      </strong>
                    </div>

                    <div>
                      <span>
                        REPEAT
                      </span>

                      <strong>
                        DENSITY
                      </strong>
                    </div>
                  </div>
                </section>

                <section className="trace-analysis-block">
                  <p className="trace-analysis-kicker">
                    TRACE LEVEL
                  </p>

                  <div className="trace-big-label">
                    EVENT → PATTERN → RELATION
                  </div>

                  <span className="trace-analysis-note">
                    하나의 행동에서 개인과 관계의
                    패턴으로 확장한다.
                  </span>
                </section>

                <section className="trace-analysis-block">
                  <p className="trace-analysis-kicker">
                    NAVIGATION
                  </p>

                  <div className="trace-analysis-row">
                    <span>
                      01
                    </span>

                    <strong>
                      INDEX / SYSTEM
                    </strong>
                  </div>

                  <div className="trace-analysis-row">
                    <span>
                      02
                    </span>

                    <strong>
                      WHAT I USE / FREQUENCY
                    </strong>
                  </div>

                  <div className="trace-analysis-row">
                    <span>
                      03
                    </span>

                    <strong>
                      HOW I USE / INTERACTION + CONTOUR
                    </strong>
                  </div>

                  <div className="trace-analysis-row">
                    <span>
                      04
                    </span>

                    <strong>
                      OUR TRACE / RELATION
                    </strong>
                  </div>
                </section>
              </>
            )}

            {section.title ===
              'WHAT I USE' && (
              <>
                <section className="trace-analysis-block">
                  <p className="trace-analysis-kicker">
                    APPLICATION SET
                  </p>

                  <div className="trace-stat-large">
                    <strong>
                      {String(
                        appUsage.length,
                      ).padStart(
                        2,
                        '0',
                      )}
                    </strong>

                    <span>
                      / 09 SELECTED
                    </span>
                  </div>

                  <div className="trace-analysis-row">
                    <span>
                      TOTAL RUNS
                    </span>

                    <strong>
                      {
                        totalAppRuns
                      }
                    </strong>
                  </div>

                  <div className="trace-analysis-row">
                    <span>
                      MOST USED
                    </span>

                    <strong>
                      {dominantApp?.name ??
                        '—'}
                    </strong>
                  </div>
                </section>

                <section className="trace-analysis-block">
                  <p className="trace-analysis-kicker">
                    USAGE DISTRIBUTION
                  </p>

                  <div className="trace-distribution">
                    {rankedUsageForPanel(
                      appUsage,
                    ).map(
                      (
                        item,
                      ) => {
                        const maxCount =
                          Math.max(
                            ...appUsage.map(
                              (
                                app,
                              ) =>
                                app.count,
                            ),
                            1,
                          )

                        const width =
                          (item.count /
                            maxCount) *
                          100

                        return (
                          <div
                            className="trace-distribution-row"
                            key={
                              item.id
                            }
                          >
                            <span>
                              {
                                item.name
                              }
                            </span>

                            <div className="trace-distribution-bar">
                              <i
                                style={{
                                  width: `${width}%`,
                                }}
                              />
                            </div>

                            <b>
                              {
                                item.count
                              }
                            </b>
                          </div>
                        )
                      },
                    )}
                  </div>
                </section>
              </>
            )}

            {section.title ===
              'HOW I USE' && (
              <>
                <section className="trace-analysis-block">
                  <p className="trace-analysis-kicker">
                    ACTION RATIO
                  </p>

                  <div className="trace-ratio">
                    <div>
                      <span>
                        CLICK
                      </span>

                      <strong>
                        {formatPercent(
                          clickShare,
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        DRAG
                      </span>

                      <strong>
                        {formatPercent(
                          dragShare,
                        )}
                      </strong>
                    </div>
                  </div>

                  <div className="trace-ratio-track">
                    <i
                      style={{
                        width: `${clickShare * 100}%`,
                      }}
                    />
                  </div>
                </section>

                <section className="trace-analysis-block">
                  <p className="trace-analysis-kicker">
                    MOTION INDEX
                  </p>

                  <div className="trace-analysis-row">
                    <span>
                      POINT DENSITY
                    </span>

                    <strong>
                      {
                        Math.round(
                          pointDensity,
                        )
                      }
                      %
                    </strong>
                  </div>

                  <div className="trace-analysis-row">
                    <span>
                      DOMINANT FORM
                    </span>

                    <strong>
                      {
                        dominantForm
                      }
                    </strong>
                  </div>

                  <div className="trace-analysis-row">
                    <span>
                      TRACE MODE
                    </span>

                    <strong>
                      {traceEnabled
                        ? 'CAPTURE'
                        : 'HIDDEN'}
                    </strong>
                  </div>
                </section>

                <section className="trace-analysis-block">
                  <p className="trace-analysis-kicker">
                    PERSONAL FORM
                  </p>

                  <div className="trace-big-label">
                    {
                      traceCharacter
                    }
                  </div>

                  <span className="trace-analysis-note">
                    TRACE → LOCAL ACTIVITY →
                    CONTOUR
                  </span>
                </section>
              </>
            )}

            {section.title ===
              'OUR TRACE' && (
              <>
                <section className="trace-analysis-block">
                  <p className="trace-analysis-kicker">
                    WORK FIELD
                  </p>

                  <div className="trace-stat-large">
                    <strong>
                      {String(
                        participants.length,
                      ).padStart(
                        2,
                        '0',
                      )}
                    </strong>

                    <span>
                      PARTICIPANTS
                    </span>
                  </div>

                  <div className="trace-analysis-row">
                    <span>
                      SHARED TOOLS
                    </span>

                    <strong>
                      {
                        sharedParticipantApps.length
                      }
                    </strong>
                  </div>

                  <div className="trace-analysis-row">
                    <span>
                      PRIMARY FIELDS
                    </span>

                    <strong>
                      {
                        participantPrimaryFields.length
                      }
                    </strong>
                  </div>
                </section>

                <section className="trace-analysis-block">
                  <p className="trace-analysis-kicker">
                    COMMON GROUND
                  </p>

                  <div className="trace-big-label">
                    {sharedParticipantApps
                      .slice(0, 3)
                      .map(
                        (item) =>
                          item.name,
                      )
                      .join(
                        ' / ',
                      ) ||
                      'NO SHARED TOOL'}
                  </div>

                  <span className="trace-analysis-note">
                    {
                      participantPrimaryFields.join(
                        ' × ',
                      )
                    }
                  </span>
                </section>
              </>
            )}
          </aside>
        </div>

        <section
          className={`trace-space ${
            traceEnabled
              ? 'trace-is-visible'
              : 'trace-is-hidden'
          }`}
          aria-hidden={
            !traceEnabled
          }
        >
          <svg className="trace-canvas">
            {clicks.flatMap(
              (
                click,
              ) =>
                click.radii.map(
                  (
                    radius,
                    index,
                  ) => (
                    <path
                      key={`${click.id}-${index}`}
                      className={`${
                        index === 0
                          ? 'trace-core'
                          : 'trace-ring'
                      } trace-enter`}
                      d={buildPunchPath(
                        click.x,
                        click.y,
                        radius,
                        click.shapeSeeds[
                          index
                        ],
                      )}
                      fill={
                        index === 0
                          ? 'var(--pt-blue)'
                          : 'none'
                      }
                      stroke={
                        index === 0
                          ? 'none'
                          : 'var(--pt-blue)'
                      }
                      strokeWidth={
                        index === 0
                          ? undefined
                          : 1.6
                      }
                      strokeLinejoin="round"
                      style={{
                        animationDelay: `${index * 36}ms`,
                      }}
                    />
                  ),
                ),
            )}

            {drags.flatMap(
              (
                drag,
              ) =>
                drag.samples.map(
                  (
                    point,
                    index,
                  ) =>
                    renderPoint(
                      point,
                      index,
                      `${drag.id}-${index}`,
                    ),
                ),
            )}

            {activeSamples.map(
              (
                point,
                index,
              ) =>
                renderPoint(
                  point,
                  index,
                  `active-${index}`,
                ),
            )}
          </svg>
        </section>
      </section>

      <footer
        className="trace-footer"
        data-no-trace
      >
        <div
          className="trace-status"
          aria-label="세션 상태"
        >
          <span>
            SESSION TIME{' '}
            <b>
              {formatTime(
                elapsed,
              )}
            </b>
          </span>

          <span>
            CLICKS{' '}
            <b>
              {
                totalClicks
              }
            </b>
          </span>

          <span>
            DRAGS{' '}
            <b>
              {
                drags.length
              }
            </b>
          </span>

          <span>
            TRACE POINTS{' '}
            <b>
              {
                totalPoints
              }
            </b>
          </span>
        </div>

        <div className="footer-actions">
          <button
            className={`press trace-toggle ${
              traceEnabled
                ? 'is-on'
                : ''
            }`}
            type="button"
            aria-pressed={
              traceEnabled
            }
            onClick={
              toggleTraceMode
            }
          >
            TRACE{' '}
            {traceEnabled
              ? 'ON'
              : 'OFF'}
          </button>

          <div className="export-menu">
            <button
              className="press"
              type="button"
              data-no-trace
              onClick={() =>
                setExportOpen(
                  (
                    open,
                  ) =>
                    !open,
                )
              }
              aria-expanded={
                exportOpen
              }
              disabled={
                exporting
              }
            >
              {exporting
                ? 'EXPORTING'
                : 'EXPORT'}
            </button>

            {exportOpen && (
              <div
                className="export-options"
                data-no-trace
              >
                <button
                  type="button"
                  disabled={
                    exporting ||
                    !getTraceBounds()
                  }
                  onClick={() => {
                    setExportOpen(
                      false,
                    )

                    void exportTraceOnly()
                  }}
                >
                  TRACE ONLY
                </button>

                <button
                  type="button"
                  disabled={
                    exporting
                  }
                  onClick={() => {
                    setExportOpen(
                      false,
                    )

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