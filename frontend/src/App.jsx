import { Route, Routes } from 'react-router-dom'
import Home from './pages/Home/Home'
import RoadBridge from './pages/RoadBridge/RoadBridge'
import Observations from './pages/Observations/Observations'
import { SurveyFiltersProvider } from './context/SurveyFiltersContext'

function App() {
  return (
    <SurveyFiltersProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/road-bridge" element={<RoadBridge />} />
        <Route path="/observations" element={<Observations />} />
      </Routes>
    </SurveyFiltersProvider>
  )
}

export default App
