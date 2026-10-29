import { Routes, Route } from 'react-router-dom'
import CanvasEditor from './pages/CanvasEditor'
import Terminal from './pages/Terminal'

function App() {
  return (
    <Routes>
      <Route path="/" element={<CanvasEditor />} />
      <Route path="/terminal" element={<Terminal />} />
    </Routes>
  )
}

export default App;