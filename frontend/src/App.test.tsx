import { fireEvent, render, screen } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import App from './App'

function setFabricWidth() {
  fireEvent.input(screen.getByLabelText(/^Fabric width \(cm\)/i), { target: { value: '150' } })
}

describe('App', () => {
  it('renders the title', () => {
    render(() => <App />)
    expect(screen.getByText('Sewing Partner')).toBeInTheDocument()
  })

  it('disables the pattern piece inputs until the fabric width is set', () => {
    render(() => <App />)
    expect(screen.getByRole('button', { name: /Add piece/i })).toBeDisabled()
    expect(screen.getByText(/Set the fabric width/i)).toBeInTheDocument()
  })

  it('enables the piece form once the fabric width is set', () => {
    render(() => <App />)
    setFabricWidth()
    expect(screen.getByRole('button', { name: /Add piece/i })).toBeEnabled()
  })

  it('shows a required error when adding a piece with an empty label', () => {
    render(() => <App />)
    setFabricWidth()

    fireEvent.input(screen.getByLabelText(/^Label/i), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: /Add piece/i }))

    expect(screen.getByText(/Label is required/i)).toBeInTheDocument()
  })

  it('adds a piece to the list and auto-increments the next default label', () => {
    render(() => <App />)
    setFabricWidth()

    const pieceWidthInput = screen.getByLabelText(/^Width \(cm\)/i)
    const pieceHeightInput = screen.getByLabelText(/^Height \(cm\)/i)

    fireEvent.input(pieceWidthInput, { target: { value: '30' } })
    fireEvent.input(pieceHeightInput, { target: { value: '40' } })
    fireEvent.click(screen.getByRole('button', { name: /Add piece/i }))

    expect(screen.getByText(/1 — 30×40 \(cm\) × 1/)).toBeInTheDocument()
    expect((screen.getByLabelText(/^Label/i) as HTMLInputElement).value).toBe('2')
  })
})
