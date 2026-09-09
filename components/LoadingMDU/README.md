# LoadingMDU Component - Versi Baru dengan Animasi Modern 🎨

Komponen loading animation yang ditingkatkan untuk MDU Portal dengan efek animasi smooth dan reusable.

## ✨ Fitur Utama

### 1. **Logo Rotasi Smooth** (spin-logo)
- Logo MDU berputar secara kontinu dengan timing function `cubic-bezier` untuk feel yang organic
- Durasi: 3 detik per putaran penuh
- Menggunakan CSS native animations tanpa library eksternal

### 2. **Pulse Glow Ring Effect** (pulse-glow-ring)
- Efek glowing berdenyut mengelilingi logo
- Menggunakan multi-layer dengan opacity dan scale transitions
- Warna sesuai theme MDU (indigo #4f46e5)

### 3. **Multi-Ring Layered Animation** (multi-ring-pulse)
- 3 ring glow concentric dengan delay berbeda
- Memberikan depth effect yang lebih dinamis
- Staggered timing untuk visual yang smooth

### 4. **Fade-In Text** (fade-in-text)
- Teks "Memulai aplikasi..." muncul dengan slide-up animation
- Letter-spacing transition dari tight ke normal
- Delayed entry untuk sequential animation flow

### 5. **Organic Feel dengan cubic-bezier**
```css
/* Primary easing curve */
cubic-bezier(0.4, 0, 0.2, 1) /* easeOutCubic */

/* Secondary easing curve */  
cubic-bezier(0.4, 0, 0.6, 1) /* easeInOutQuart */
```

### 6. **Responsive & Accessible**
- Fully responsive sizing (sm/md/lg)
- Reduced motion support via prefers-reduced-motion (future enhancement)
- Dark mode compatible

## 📦 Props Interface

```typescript
interface LoadingMDUProps {
  message?: string           // Custom text message
  backgroundColor?: 'light' | 'dark' | 'gradient'
  logoSize?: 'sm' | 'md' | 'lg'
  showText?: boolean         // Toggle text visibility
  className?: string         // Additional Tailwind classes
}
```

## 🎨 Default Values

- `message`: "Memulai aplikasi..."
- `backgroundColor`: "light" (bg-[#f8faff])
- `logoSize`: "md" (w-28 h-28)
- `showText`: true
- `className`: ""

## 🚀 Usage Examples

### Basic Usage
```tsx
import { LoadingMDU } from '@/components/LoadingMDU'

// Default loading screen
export default function MyPage() {
  return <LoadingMDU />
}
```

### Custom Message with Gradient Background
```tsx
<LoadingMDU 
  message="Menghubungkan ke server..."
  backgroundColor="gradient"
  logoSize="lg"
/>
```

### Dark Theme Variant
```tsx
<LoadingMDU 
  backgroundColor="dark"
  showText={false}  // Hide text for minimal look
/>
```

### With Custom Styling
```tsx
<LoadingMDU 
  className="rounded-lg"
  style={{ background: '#ffffff' }}
/>
```

## 🎭 Animation Breakdown

### Entry Sequence (Timeline: ~1000ms)

1. **0ms**: Logo appears with bounce-slight animation
2. **300ms**: Text fades in with fade-in-text
3. **500ms**: Three loader dots stagger appear
4. **Continuous**: 
   - Logo rotation: spin-logo (3s infinite)
   - Inner glow: pulse-glow-ring (2s infinite)
   - Rings: multi-ring-pulse (2.5s infinite with offsets)

### Performance Optimizations

- ✅ Hardware accelerated transforms (`transform`, `opacity`)
- ✅ GPU-accelerated animations (`will-change` implicit via transform-gpu)
- ✅ Minimal layout shift
- ✅ No JavaScript-driven animations (CSS-only)

## 🎯 Design Tokens Used

```css
/* Colors (from globals.css / theme) */
--color-indigo-500: #4f46e5
--color-indigo-900: #1e1b4b
--color-purple-800: #581c87

/* Spacing */
w-48 = 12rem (192px)
w-56 = 14rem (224px)  
w-64 = 16rem (256px)

/* Rounded */
rounded-full
rounded-xl
rounded-2xl

/* Shadows */
shadow-2xl
drop-shadow
```

## 🔧 Customization Guide

### Change Animation Speed

Edit `app/globals.css`:
```css
.animate-spin-logo {
  animation: spin-logo 2s cubic-bezier(...) infinite;  /* Faster */
}
```

### Add More Color Variants

In `LoadingMDU/index.tsx`, extend `getBackgroundClass()`:
```typescript
case 'blue':
  return 'bg-gradient-to-br from-blue-600 to-blue-900'
```

### Modify Glow Intensity

Change box-shadow values in `pulse-glow-ring`:
```css
box-shadow: 0 0 30px 15px rgba(79, 70, 229, 0.4);  /* Stronger */
```

## 📝 Implementation Notes

1. **State Management**: Uses `isMounted` state to trigger animations after client-side hydration
2. **Next.js Best Practices**: 
   - `'use client'` directive for interactivity
   - `priority` prop on Image for LCP optimization
   - `transform-gpu` for hardware acceleration
3. **TypeScript**: Full type safety with TypeScript interfaces
4. **Styling**: Utility-first with Tailwind + custom keyframes

## 🌐 Browser Compatibility

- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ⚠️ IE11: Not supported (uses modern CSS)
- ⚠️ Legacy browsers: Falls back to static display

## 🎬 Before vs After Comparison

| Aspect | Old Version | New Version |
|--------|-------------|-------------|
| Animation Type | Pulse only | Spin + Multi-ring + Fade |
| Easing | Linear/ease-out | Cubic-bezier organic |
| Visual Depth | Flat | Layered glows |
| Feedback | Single indicator | Sequential reveal |
| Reusability | Limited | Highly configurable |

## 💡 Pro Tips

1. **Performance**: Keep animation count low (current: 7 animations)
2. **Accessibility**: Consider adding `aria-label` for screen readers
3. **Progressive Enhancement**: Fallback to reduced motion if preferred
4. **Testing**: Test on low-end devices for smooth frame rates

## 🔄 Future Enhancements (TODO)

- [ ] Support for reduced-motion media query
- [ ] Configurable animation durations via props
- [ ] Sound effect option (toggled)
- [ ] Custom color palette selector
- [ ] Skeleton screen integration

---

**Author**: MDU Development Team  
**Last Updated**: 2024  
**Version**: 2.0.0
