import { useState } from 'react'
import { TraceWorkspace } from './components/TraceWorkspace'
function Intro({ onStart }: { onStart: () => void }) {
  return (
    <main className="intro-app">
      <section className="intro-content" aria-labelledby="intro-title">
        <p className="trace-kicker"><span className="accent-mark" />PUNCH TRACE</p>
        <h1 id="intro-title">ABSTRACTED<br />TRAJECTORY</h1>
        <p className="intro-copy">CLICK AND DRAG ARE RECORDED AS TRACE.</p>
        <button className="start-button press" type="button" onClick={onStart}>START TRACE</button>
      </section>
    </main>
  )
}
export default function App() {
  const [started, setStarted] = useState(true)
  return started ? <TraceWorkspace /> : <Intro onStart={() => setStarted(true)} />
}
