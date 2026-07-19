import { fireEvent, render, screen } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import App from './App'

function setFabricDimensions() {
  const widthInputs = screen.getAllByLabelText(/^Width \(cm\)/i)
  const lengthInput = screen.getByLabelText(/^Length \(cm\)/i)
  fireEvent.input(widthInputs[0], { target: { value: '150' } })
  fireEvent.input(lengthInput, { target: { value: '200' } })
}

describe('App', () => {
  it('renders the title', () => {
    render(() => <App />)
    expect(screen.getByText('Sewing Partner')).toBeInTheDocument()
  })

  it('disables the pattern piece inputs until fabric dimensions are set', () => {
    render(() => <App />)
    expect(screen.getByRole('button', { name: /Add piece/i })).toBeDisabled()
    expect(screen.getByText(/Set the fabric width and length/i)).toBeInTheDocument()
  })

  it('enables the piece form once fabric width and length are set', () => {
    render(() => <App />)
    setFabricDimensions()
    expect(screen.getByRole('button', { name: /Add piece/i })).toBeEnabled()
  })

  it('shows a required error when adding a piece with an empty label', () => {
    render(() => <App />)
    setFabricDimensions()

    fireEvent.input(screen.getByLabelText(/^Label/i), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: /Add piece/i }))

    expect(screen.getByText(/Label is required/i)).toBeInTheDocument()
  })

  it('adds a piece to the list and auto-increments the next default label', () => {
    render(() => <App />)
    setFabricDimensions()

    const pieceWidthInput = screen.getAllByLabelText(/^Width \(cm\)/i)[1]
    const pieceHeightInput = screen.getByLabelText(/^Height \(cm\)/i)

    fireEvent.input(pieceWidthInput, { target: { value: '30' } })
    fireEvent.input(pieceHeightInput, { target: { value: '40' } })
    fireEvent.click(screen.getByRole('button', { name: /Add piece/i }))

    expect(screen.getByText(/1 — 30×40 \(cm\) × 1/)).toBeInTheDocument()
    expect((screen.getByLabelText(/^Label/i) as HTMLInputElement).value).toBe('2')
  })
})
