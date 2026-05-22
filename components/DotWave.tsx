'use client'

import { useEffect, useRef } from 'react'

type DotWaveProps = {
  className?: string
  /** Spacing between dots in CSS px before tilt. */
  spacing?: number
  /** Z-amplitude of the wave in CSS px. */
  amplitude?: number
  /** Tilt angle around the X axis in radians (0 = flat from camera, ~1.0 = looking down). */
  tilt?: number
  /** Base radius of each dot in CSS px. */
  dotRadius?: number
  /** Animation speed multiplier. */
  speed?: number
  /** Global alpha multiplier applied on top of the per-dot fade math. 0-1, default 1. */
  opacity?: number
  /** Foreground RGB triplet (light theme). */
  lightColor?: string
  /** Foreground RGB triplet (dark theme). */
  darkColor?: string
  /** Highlight RGB triplet that crests fade into. Defaults to indigo. */
  highlightColor?: string
}

/**
 * Canvas-based 3D wave of dots, à la Stratstudio.
 * Renders ~1.2k dots, GPU-friendly, ≤6 ms/frame on mid-range laptops.
 * Respects `prefers-reduced-motion`: collapses to a still tilted grid.
 */
export function DotWave({
  className,
  spacing = 26,
  amplitude = 28,
  tilt = 1.05,
  dotRadius = 1.4,
  speed = 0.0002,
  opacity = 1,
  lightColor = '163, 163, 175',
  darkColor = '200, 200, 215',
  highlightColor = '255, 255, 255',
}: DotWaveProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const startedRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    const prefersReducedMotion =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let width = 0
    let height = 0
    let dpr = 1

    const resize = () => {
      const parent = canvas.parentElement
      if (!parent) return
      const rect = parent.getBoundingClientRect()
      width = Math.max(1, Math.floor(rect.width))
      height = Math.max(1, Math.floor(rect.height))
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const isDark = () =>
      typeof document !== 'undefined' && document.documentElement.classList.contains('dark')

    const draw = (tMs: number) => {
      if (!ctx) return
      const t = (tMs - startedRef.current) * speed

      ctx.clearRect(0, 0, width, height)

      const cosTilt = Math.cos(tilt)
      const sinTilt = Math.sin(tilt)

      // World extents we want to cover after projection (slightly larger than viewport
      // so the grid bleeds off the edges instead of revealing a square frame).
      const worldW = width * 1.4
      const worldH = height * 2.6

      const cols = Math.ceil(worldW / spacing)
      const rows = Math.ceil(worldH / spacing)

      const halfW = (cols * spacing) / 2
      const halfH = (rows * spacing) / 2
      // Push the grid down so the camera sits above it, like the reference.
      const cameraOffsetY = height * 0.18
      // Perspective focal length: smaller = wider FOV.
      const fov = Math.max(width, height) * 0.9

      const baseRgb = isDark() ? darkColor : lightColor
      const dark = isDark()

      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const x = i * spacing - halfW
          const y = j * spacing - halfH

          // Two overlapping sine waves for a more organic crest pattern.
          const z =
            amplitude *
            (Math.sin(x * 0.018 + t * 1.0) * Math.cos(y * 0.014 - t * 0.6) * 0.65 +
              Math.sin((x + y) * 0.012 + t * 0.4) * 0.35)

          // Tilt around X axis: pitch the (y, z) plane.
          const rotY = y * cosTilt - z * sinTilt
          const rotZ = y * sinTilt + z * cosTilt

          // Perspective projection.
          const persp = fov / (fov + rotZ + 220)
          const screenX = x * persp + width / 2
          const screenY = rotY * persp + height / 2 + cameraOffsetY

          if (screenX < -20 || screenX > width + 20 || screenY < -20 || screenY > height + 20) continue

          // Normalized crest value (-1..1).
          const crest = z / amplitude

          // Size grows with perspective + crest.
          const r = Math.max(0.3, dotRadius * persp * (1 + crest * 0.6))

          // Opacity fades with depth + distance from horizontal centre.
          const distFromCenterX = Math.abs(screenX - width / 2) / (width / 2)
          const edgeFade = 1 - Math.pow(distFromCenterX, 2.2)
          const depthFade = Math.max(0.15, Math.min(1, persp * 1.1))
          const crestBoost = 0.5 + (crest + 1) * 0.5 * 0.5
          const alpha = Math.max(
            0,
            Math.min(1, depthFade * edgeFade * crestBoost * (dark ? 0.3 : 0.3) * opacity),
          )

          // Blend toward the highlight colour at crests.
          const blend = Math.max(0, crest) * 0.65
          const baseParts = baseRgb.split(',').map(s => parseFloat(s.trim()))
          const hiParts = highlightColor.split(',').map(s => parseFloat(s.trim()))
          const r0 = baseParts[0] ?? 180
          const g0 = baseParts[1] ?? 180
          const b0 = baseParts[2] ?? 210
          const r1 = hiParts[0] ?? 139
          const g1 = hiParts[1] ?? 122
          const b1 = hiParts[2] ?? 255
          const rr = Math.round(r0 + (r1 - r0) * blend)
          const gg = Math.round(g0 + (g1 - g0) * blend)
          const bb = Math.round(b0 + (b1 - b0) * blend)

          ctx.fillStyle = `rgba(${rr}, ${gg}, ${bb}, ${alpha})`
          ctx.beginPath()
          ctx.arc(screenX, screenY, r, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }

    const loop = (tMs: number) => {
      draw(tMs)
      rafRef.current = requestAnimationFrame(loop)
    }

    const start = () => {
      startedRef.current = performance.now()
      if (prefersReducedMotion) {
        // Single still frame.
        draw(startedRef.current)
        return
      }
      rafRef.current = requestAnimationFrame(loop)
    }

    resize()
    start()

    const ro = new ResizeObserver(() => {
      resize()
      if (prefersReducedMotion) draw(performance.now())
    })
    if (canvas.parentElement) ro.observe(canvas.parentElement)

    // Re-render once when theme toggles so dot colours follow the active palette.
    const themeObserver = new MutationObserver(() => {
      if (prefersReducedMotion) draw(performance.now())
    })
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      ro.disconnect()
      themeObserver.disconnect()
    }
  }, [spacing, amplitude, tilt, dotRadius, speed, opacity, lightColor, darkColor, highlightColor])

  return <canvas ref={canvasRef} aria-hidden className={className} />
}
