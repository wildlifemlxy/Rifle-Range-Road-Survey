import { Component } from 'react'
import { Route, Routes } from 'react-router-dom'
import Home from './pages/Home/Home'
import Dashboard from './pages/Dashboard/Dashboard'
import { SurveyFiltersProvider } from './context/SurveyFiltersContext'

class App extends Component {
  render() {
    return (
      <SurveyFiltersProvider>
        <Routes>
          {/*<Route path="/" element={<Home />} />*/}
          {/*<Route path="/dashboard" element={<Dashboard />} />*/}
          <Route path="/" element={<Dashboard />} />
        </Routes>
      </SurveyFiltersProvider>
    )
  }
}

export default App;
