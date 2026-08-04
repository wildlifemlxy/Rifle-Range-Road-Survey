import { Component } from 'react'

// Animates numeric-looking values (ints, decimals, negatives, "%"/other suffixes) from 0 up to the
// target on mount/update. Non-numeric values (e.g. plain text) are rendered as-is, unanimated.
class CountUp extends Component {
  state = { display: this.props.value }

  componentDidMount() {
    this.animate()
  }

  componentDidUpdate(prevProps) {
    if (prevProps.value !== this.props.value) this.animate()
  }

  componentWillUnmount() {
    cancelAnimationFrame(this.frame)
  }

  animate() {
    const match = String(this.props.value).match(/^(-?[\d,]+(?:\.\d+)?)(.*)$/)
    if (!match) {
      this.setState({ display: this.props.value })
      return
    }

    const numericText = match[1].replace(/,/g, '')
    const target = parseFloat(numericText)
    const suffix = match[2] || ''
    const decimals = (numericText.split('.')[1] || '').length
    const duration = 700
    const start = performance.now()

    cancelAnimationFrame(this.frame)
    const step = (now) => {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      const current = target * eased
      this.setState({ display: `${current.toFixed(decimals)}${suffix}` })
      if (t < 1) this.frame = requestAnimationFrame(step)
    }
    this.frame = requestAnimationFrame(step)
  }

  render() {
    return this.state.display
  }
}

export default CountUp
