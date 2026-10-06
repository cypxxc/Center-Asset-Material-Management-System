import '../setup/dom'
import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { ThemeProvider, useTheme, resetThemeStore } from '../../components/theme-provider'
import { ThemeToggle } from '../../components/theme-toggle'

beforeEach(() => {
  resetThemeStore()
  document.documentElement.classList.remove('dark')
  document.documentElement.removeAttribute('data-theme')
})

function ThemeConsumer() {
  const { theme, resolvedTheme, setTheme } = useTheme()
  return (
    <div>
      <span data-testid="current-theme">{theme}</span>
      <span data-testid="resolved-theme">{resolvedTheme}</span>
      <button onClick={() => setTheme('light')}>Set Light</button>
      <button onClick={() => setTheme('dark')}>Set Dark</button>
      <button onClick={() => setTheme('system')}>Set System</button>
    </div>
  )
}

test('ThemeProvider defaults to system theme and provides state', () => {
  render(
    <ThemeProvider>
      <ThemeConsumer />
    </ThemeProvider>
  )

  const currentTheme = screen.getByTestId('current-theme')
  assert.equal(currentTheme.textContent, 'system')
})

test('ThemeProvider allows switching theme to dark and light and updates DOM classes', () => {
  render(
    <ThemeProvider>
      <ThemeConsumer />
    </ThemeProvider>
  )

  const darkBtn = screen.getByText('Set Dark')
  act(() => {
    fireEvent.click(darkBtn)
  })

  assert.equal(screen.getByTestId('current-theme').textContent, 'dark')
  assert.equal(screen.getByTestId('resolved-theme').textContent, 'dark')
  assert.ok(document.documentElement.classList.contains('dark'))
  assert.equal(document.documentElement.getAttribute('data-theme'), 'dark')

  const lightBtn = screen.getByText('Set Light')
  act(() => {
    fireEvent.click(lightBtn)
  })

  assert.equal(screen.getByTestId('current-theme').textContent, 'light')
  assert.equal(screen.getByTestId('resolved-theme').textContent, 'light')
  assert.ok(!document.documentElement.classList.contains('dark'))
  assert.equal(document.documentElement.getAttribute('data-theme'), 'light')
})

test('ThemeToggle button renders and cycles themes on click', () => {
  render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>
  )

  const toggleBtn = screen.getByRole('button')
  assert.ok(toggleBtn)

  // Initial: 'system' -> click 1: 'light'
  act(() => {
    fireEvent.click(toggleBtn)
  })
  assert.ok(!document.documentElement.classList.contains('dark'))

  // Click 2: 'dark'
  act(() => {
    fireEvent.click(toggleBtn)
  })
  assert.ok(document.documentElement.classList.contains('dark'))

  // Click 3: 'system'
  act(() => {
    fireEvent.click(toggleBtn)
  })
  assert.ok(!document.documentElement.classList.contains('dark'))
})
