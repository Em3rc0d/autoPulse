---
name: High-Performance Diagnostic Interface
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#3a3939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#b9cacb'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#849495'
  outline-variant: '#3a494b'
  surface-tint: '#00dbe7'
  primary: '#e1fdff'
  on-primary: '#00363a'
  primary-container: '#00f2ff'
  on-primary-container: '#006a71'
  inverse-primary: '#00696f'
  secondary: '#ffbc7c'
  on-secondary: '#4b2800'
  secondary-container: '#fe9400'
  on-secondary-container: '#633700'
  tertiary: '#fff5f4'
  on-tertiary: '#690003'
  tertiary-container: '#ffd0ca'
  on-tertiary-container: '#c3000a'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#74f5ff'
  primary-fixed-dim: '#00dbe7'
  on-primary-fixed: '#002022'
  on-primary-fixed-variant: '#004f54'
  secondary-fixed: '#ffdcbf'
  secondary-fixed-dim: '#ffb874'
  on-secondary-fixed: '#2d1600'
  on-secondary-fixed-variant: '#6a3b00'
  tertiary-fixed: '#ffdad5'
  tertiary-fixed-dim: '#ffb4aa'
  on-tertiary-fixed: '#410001'
  on-tertiary-fixed-variant: '#930005'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  display-gauge:
    fontFamily: Space Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.04em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: 0.1em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 16px
  margin: 24px
  container-max: 600px
---

## Brand & Style
The design system captures the visceral energy of a high-end supercar’s digital cockpit. It is engineered for enthusiasts and professionals who demand precision, speed, and absolute clarity. The aesthetic balances a deep, "void-like" canvas with hyper-luminescent data visualizations.

The visual style utilizes **High-Contrast Glassmorphism**. UI elements are treated as precision instruments—semi-transparent crystalline layers that sit above a dark atmospheric base. Light is used as a functional tool: active states emit a soft, localized glow (bloom) to guide the eye, simulating the physical light emission of high-end OLED clusters.

## Colors
The palette is strictly functional, mirroring automotive instrumentation standards. 

- **Backgrounds:** A near-black charcoal creates infinite depth, ensuring the glow of data points pops with maximum contrast.
- **Electric Cyan (#00F2FF):** The "Nominal" state. Used for telemetry, active connections, and healthy engine vitals.
- **Neon Orange (#FF9500):** The "Warning" state. Reserved for non-critical faults or values nearing thresholds.
- **Pulse Red (#FF3B30):** The "Alert" state. High-urgency errors and critical engine failures.

Use a 20px backdrop blur on all surfaces to maintain legibility against the deep background.

## Typography
This design system employs a tiered typographic strategy to balance technical data with refined elegance.

- **Space Grotesk** is used for primary data readouts and headlines, providing a futuristic, geometric edge reminiscent of digital speedometers.
- **Inter** handles all body copy and descriptions, ensuring peak readability during movement.
- **JetBrains Mono** is utilized for metadata, VIN numbers, and sensor labels to evoke a "raw data" diagnostic feel.

All numerical data should use tabular figures to prevent horizontal jitter during real-time value updates.

## Layout & Spacing
The layout follows a **Center-Heavy Hierarchy**. In a mobile-first diagnostic context, the most critical data (RPM, Speed, or Error Codes) must reside in the center of the viewport to minimize eye travel.

- **Grid:** A 4-column mobile grid with generous 24px side margins to ensure thumbs don't obscure data.
- **Rhythm:** A 4px baseline grid ensures tight, technical alignment.
- **Visual Weight:** Use "Optical Centering" for gauges—primary metrics should be 15% larger than secondary support data.

## Elevation & Depth
Depth is created through transparency and blur rather than traditional drop shadows.

1.  **Level 0 (Base):** The #050505 canvas.
2.  **Level 1 (Cards):** Glassmorphic tiles with 20px blur and a 1px inner stroke (top-down lighting effect).
3.  **Level 2 (Active Elements):** Elements "glow" into the glass. Use outer glows (`box-shadow`) with colors matching the state (Cyan, Orange, or Red) but with low opacity (20-30%) and wide spread (30px+).
4.  **Scanning Effect:** A subtle, moving linear gradient (top to bottom) can be applied to active diagnostic cards to simulate a real-time system scan.

## Shapes
The shape language is "Technical-Aerodynamic." Avoid overly rounded or organic circles. Use subtle, precision-clipped corners to imply industrial manufacturing.

- **Standard Elements:** 4px to 8px radius.
- **Gauges:** Circular elements should use thin, high-contrast strokes rather than solid fills.
- **Connectors:** 45-degree angled lines for data callouts to reinforce the "schematic" feel.

## Components
- **Primary Action Button:** Full-width, high-gloss finish. Uses a "Ghost" style with a 2px Electric Cyan border and a subtle inner glow. Text is always uppercase.
- **Diagnostic Tiles:** Semi-transparent cards containing a "Label-Caps" header, a "Display-Gauge" value, and a sparkline graph at the bottom.
- **Status Pills:** Small, high-contrast chips. Cyan for "Live," Red for "Fault." These should pulse slowly (2s duration) when data is being actively pulled.
- **Gauges:** Semi-circular arcs with a gradient stroke. The "needle" is a bright, 2px wide line of light.
- **Data Input:** Darker than the background (#000000) with a Cyan bottom-border focus state. No 4-sided borders.
- **Critical Alert Overlay:** A full-screen blur with a "Pulse Red" vignette and a centered icon for immediate driver intervention.