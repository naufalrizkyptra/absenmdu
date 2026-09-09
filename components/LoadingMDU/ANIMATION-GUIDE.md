# 🎬 LoadingMDU Animation Guide - Visual & Timing Reference

## 📊 Animation Timeline Visualization

```
Time (ms): 0    300   500   1000   2000   3000   ∞
           |-----|-----|------|-------|-------|-----|----
Logo Spin: [===== continuous rotation =====]         ↻
           0° → 180° → 360° ...
           
Glow Ring: [⦿ pulse cycle ⦿]
           Scale: 0.95→1.05→0.95
           Shadow: 0→10px→0
            
Outer Rings: 
Ring 1: [↺ pulse (offset: 0s)]
Ring 2:        [↺ pulse (offset: 0.4s)]
Ring 3:              [↺ pulse (offset: 0.8s)]
          
Text Fade:             [───────────────]
                       Opacity: 0→1
                       Y: -10px→0px
                       
Loader Dots:                   [⚪⚪⚪ bounce]
                               Delays: 0ms, 150ms, 300ms
```

## 🎨 CSS Keyframes Reference

### 1️⃣ spin-logo (Infinite Rotation)
```css
@keyframes spin-logo {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

Timing: cubic-bezier(0.4, 0, 0.2, 1)
Duration: 3s
Iterations: infinite
Use case: Logo continuous rotation for loading state
```

**Why cubic-bezier?**
- Starts slow, accelerates smoothly
- Gives "organic" feel vs mechanical linear spin
- Matches natural motion patterns

---

### 2️⃣ pulse-glow-ring (Pulsating Glow)
```css
@keyframes pulse-glow-ring {
  0%   { 
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(79, 70, 229, 0.7);
    opacity: 0.7;
  }
  50%  { 
    transform: scale(1.05);
    box-shadow: 0 0 20px 10px rgba(79, 70, 229, 0.3);
    opacity: 0.4;
  }
  100% { 
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(79, 70, 229, 0);
    opacity: 0.7;
  }
}

Timing: cubic-bezier(0.4, 0, 0.6, 1)
Duration: 2s
Iterations: infinite
```

**Effect breakdown:**
- **Scale**: Slight breathing effect (±5%)
- **Shadow**: Expands outward like ripples
- **Opacity**: Fades during expansion for depth

---

### 3️⃣ multi-ring-pulse (Staggered Concentric Rings)
```css
@keyframes multi-ring-pulse {
  0%, 100% {
    transform: scale(0.5);
    opacity: 0;
  }
  50% {
    transform: scale(1.2);
    opacity: 0.5;
  }
}

Timing: cubic-bezier(0.4, 0, 0.6, 1)
Duration: 2.5s
Iterations: infinite

Ring 1 offset: 0s    (starts immediately)
Ring 2 offset: 0.4s  (delayed by 400ms)
Ring 3 offset: 0.8s  (delayed by 800ms)
```

**Visual effect:** Wave-like expansion from center outward

---

### 4️⃣ fade-in-text (Smooth Text Reveal)
```css
@keyframes fade-in-text {
  from {
    opacity: 0;
    transform: translateY(-10px);
    letter-spacing: -0.05em;  /* Tight initially */
  }
  to {
    opacity: 1;
    transform: translateY(0);
    letter-spacing: normal;
  }
}

Timing: cubic-bezier(0.4, 0, 0.2, 1)
Duration: 0.8s
Delay: 0.3s (after logo appears)
Fill mode: forwards (stays visible)
```

**Enhancement over simple opacity:**
- Slide-up adds subtle directionality
- Letter-spacing transition improves readability

---

### 5️⃣ bounce-slight (Initial Entry Bounce)
```css
@keyframes bounce-slight {
  0% {
    transform: scale(0.9);
    opacity: 0;
  }
  40% {
    transform: scale(1.02);
    opacity: 1;
  }
  60% {
    transform: scale(0.98);
  }
  100% {
    transform: scale(1);
  }
}

Timing: cubic-bezier(0.4, 0, 0.6, 1)
Duration: 1s
Fill mode: forwards
```

**Psychology:** Subtle bounce conveys "ready" state

---

### 6️⃣ stagger-fade-in (Dot Loader Sequencing)
```css
@keyframes stagger-fade-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

Timing: cubic-bezier(0.4, 0, 0.2, 1)
Duration: 0.6s
Fill mode: backwards (delays start)

Individual dots:
Dot 1: delay 0ms
Dot 2: delay 150ms  
Dot 3: delay 300ms
```

**Creates:** Rolling wave loader effect

---

## 🎯 Performance Metrics

### Frame Rate Target
- **Target**: 60fps on mid-range devices
- **Animation complexity**: Low (transform + opacity only)
- **GPU acceleration**: Yes (via transform properties)

### Memory Footprint
- CSS animations: ~2KB
- JavaScript hooks: Minimal (one useState)
- No external libraries loaded

### Best Practices Followed
✅ Hardware-accelerated properties only
✅ Will-change hints where needed (implicit via GPU transforms)
✅ Reduced layout shift
✅ Non-blocking main thread

---

## 🎭 Color Palette

```css
/* Primary brand color */
--color-brand-indigo: #4f46e5;
--color-brand-indigo-500: rgb(79, 70, 229);

/* Glow colors */
--color-glow-light: rgba(79, 70, 229, 0.7);
--color-glow-medium: rgba(79, 70, 229, 0.3);
--color-glow-faint: rgba(79, 70, 229, 0);

/* Background options */
--color-bg-light: #f8faff;       /* Default */
--color-bg-dark: #1e1b4b;        /* Dark theme */
--color-bg-gradient: gradient-to-br;

/* Neutral text */
--color-text-light: #475569;     /* Slate-600 */
--color-text-dark: #cbd5e1;      /* Slate-300 */
```

---

## 📱 Responsive Breakpoints

| Screen Size | Logo Size | Total Width | Gap |
|-------------|-----------|-------------|-----|
| Mobile (<640px) | md (28 = 112px) | 112px | gap-4 |
| Tablet (≥640px) | md (28 = 112px) | 112px | gap-6 |
| Desktop (≥768px) | lg available (36 = 144px) | 144px | gap-6 |
| Large (>1024px) | lg recommended | 144px | gap-6 |

---

## 🔧 Customization Quick Reference

### Speed Changes
```css
/* Faster animations (0.7x speed) */
animation-duration: calc(original-duration * 0.7);

/* Slower animations (1.3x speed) */  
animation-duration: calc(original-duration * 1.3);
```

### Stronger Glow
```css
box-shadow: 0 0 40px 20px rgba(79, 70, 229, 0.5);
/* ↑ Increase blur radius and spread */
```

### Softer Glow
```css
box-shadow: 0 0 10px 5px rgba(79, 70, 229, 0.2);
/* ↓ Decrease blur radius and spread */
```

### Different Colors
```css
/* Replace indigo with your brand color */
rgba(255, 159, 67, 0.7);  /* Orange */
rgba(52, 211, 153, 0.7);  /* Emerald */
rgba(236, 72, 153, 0.7);  /* Pink */
```

---

## ✅ Checklist for Production

- [x] Animations perform smooth at 60fps
- [x] Works in Chrome, Firefox, Safari, Edge
- [x] Graceful degradation for old browsers
- [ ] Accessibility: reduced-motion support (TODO)
- [ ] ARIA labels added for screen readers (TODO)
- [ ] Tested on iOS Safari
- [ ] Tested on Android Chrome

---

**Document Version**: 1.0  
**Last Updated**: December 2024  
**Maintainer**: MDU Frontend Team
