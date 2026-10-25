/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA TACTICAL VISION: ADAPTIVE OTSU BINARIZER ENGINE
 * PUSSIBERAD TNI AD × CODEPOLITAN — KARTIKA CYBER HACKATHON 2026
 * ══════════════════════════════════════════════════════════════════════════
 * 
 * Pipeline Pra-pemrosesan Citra Tangkapan Layar:
 * 1. Grayscale Luminance Conversion: Y = 0.299*R + 0.587*G + 0.114*B
 * 2. Contrast Stretching / Histogram Normalization: I_norm = (I - min) / (max - min) * 255
 * 3. Otsu Global Binarization: Memaksimalkan variansi antar-kelas σ_B²(T)
 * 4. Border Sampling & Auto-Inversion: Deteksi mode gelap (Twitter, Telegram, TikTok dark mode)
 *    sehingga teks putih berlatar hitam dibalik menjadi teks hitam berlatar putih tajam.
 * ══════════════════════════════════════════════════════════════════════════
 */

export interface OtsuBinarizerResult {
  binarizedDataUrl: string
  originalDataUrl: string
  threshold: number
  isDarkMode: boolean
  width: number
  height: number
  processingLatencyMs: number
  metrics: {
    minLuminance: number
    maxLuminance: number
    borderAverageLuminance: number
    betweenClassVariance: number
  }
}

export interface OtsuProcessingOptions {
  invertOverride?: boolean | null // null = auto detect dark mode
  contrastStretching?: boolean
  borderSamplingThickness?: number // Default: 4 pixels
  outputFormat?: 'image/png' | 'image/jpeg'
  jpegQuality?: number
}

/**
 * Menghitung ambang batas optimal Otsu (T*) dari histogram keabuan 256 bin.
 * Formula:
 *   σ_B²(T) = ω_0(T) * ω_1(T) * [μ_0(T) - μ_1(T)]²
 *   T* = argmax_{0 <= T < 255} σ_B²(T)
 */
export function calculateOtsuThreshold(
  histogram: number[],
  totalPixels: number
): { threshold: number; maxVariance: number } {
  if (totalPixels <= 0) return { threshold: 128, maxVariance: 0 }

  let sum = 0
  for (let t = 0; t < 256; t++) {
    sum += t * histogram[t]
  }

  let sumB = 0
  let wB = 0
  let wF = 0
  let maxVariance = 0
  let threshold = 128

  for (let t = 0; t < 256; t++) {
    wB += histogram[t]
    if (wB === 0) continue

    wF = totalPixels - wB
    if (wF === 0) break

    sumB += t * histogram[t]

    const mB = sumB / wB
    const mF = (sum - sumB) / wF

    // Antar-kelas variansi: σ_B² = wB * wF * (mB - mF)²
    const betweenClassVariance = wB * wF * (mB - mF) * (mB - mF)

    if (betweenClassVariance > maxVariance) {
      maxVariance = betweenClassVariance
      threshold = t
    }
  }

  return { threshold, maxVariance }
}

/**
 * Menghitung rata-rata intensitas pada 4 tepi batas citra (border sampling).
 * Digunakan untuk mendeteksi apakah citra bertema gelap (Dark Mode).
 */
export function calculateBorderAverageLuminance(
  luminanceData: Uint8Array,
  width: number,
  height: number,
  thickness: number = 4
): number {
  if (width <= 0 || height <= 0) return 255

  let borderSum = 0
  let borderCount = 0
  const effThickness = Math.min(thickness, Math.floor(width / 2), Math.floor(height / 2))

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const isTopBorder = y < effThickness
      const isBottomBorder = y >= height - effThickness
      const isLeftBorder = x < effThickness
      const isRightBorder = x >= width - effThickness

      if (isTopBorder || isBottomBorder || isLeftBorder || isRightBorder) {
        borderSum += luminanceData[y * width + x]
        borderCount++
      }
    }
  }

  return borderCount > 0 ? borderSum / borderCount : 255
}

/**
 * Memuat gambar dari URL/DataURL ke HTMLImageElement
 */
function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = (e) => reject(new Error(`Gagal memuat citra untuk binarisasi: ${e}`))
    img.src = src
  })
}

/**
 * Pra-pemrosesan citra komprehensif menggunakan Algoritma Otsu Adaptive Binarizer
 * Menghasilkan citra binarisasi b/w beresolusi tinggi dengan kontras tajam untuk OCR Tesseract.
 */
export async function preprocessImageWithOtsu(
  imageSrc: string,
  options: OtsuProcessingOptions = {}
): Promise<OtsuBinarizerResult> {
  const startTime = performance.now()
  const {
    invertOverride = null,
    contrastStretching = true,
    borderSamplingThickness = 4,
    outputFormat = 'image/png',
    jpegQuality = 0.95,
  } = options

  // 1. Muat citra ke elemen Image
  const img = await loadImageElement(imageSrc)
  const width = img.naturalWidth || img.width
  const height = img.naturalHeight || img.height

  if (width === 0 || height === 0) {
    throw new Error('Dimensi citra tidak valid (0x0)')
  }

  // 2. Siapkan Canvas Offscreen
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })

  if (!ctx) {
    throw new Error('Gagal menginisialisasi 2D Canvas context')
  }

  // Gambar citra asli ke canvas
  ctx.drawImage(img, 0, 0, width, height)
  const imageData = ctx.getImageData(0, 0, width, height)
  const rgba = imageData.data
  const totalPixels = width * height

  // 3. Konversi Grayscale Luminance: Y = 0.299R + 0.587G + 0.114B
  const luminance = new Uint8Array(totalPixels)
  let minLum = 255
  let maxLum = 0

  for (let i = 0; i < totalPixels; i++) {
    const r = rgba[i * 4]
    const g = rgba[i * 4 + 1]
    const b = rgba[i * 4 + 2]
    // Standar ITU-R BT.601
    const y = Math.round(0.299 * r + 0.587 * g + 0.114 * b)
    luminance[i] = y

    if (y < minLum) minLum = y
    if (y > maxLum) maxLum = y
  }

  // 4. Contrast Stretching (Normalisasi rentang dinamis 0-255)
  const histogram = new Array(256).fill(0)
  const lumRange = maxLum - minLum

  if (contrastStretching && lumRange > 10 && lumRange < 255) {
    for (let i = 0; i < totalPixels; i++) {
      const normalized = Math.round(((luminance[i] - minLum) / lumRange) * 255)
      luminance[i] = normalized
      histogram[normalized]++
    }
  } else {
    for (let i = 0; i < totalPixels; i++) {
      histogram[luminance[i]]++
    }
  }

  // 5. Perhitungan Ambang Batas Optimal Otsu
  const { threshold, maxVariance } = calculateOtsuThreshold(histogram, totalPixels)

  // 6. Border Sampling & Deteksi Mode Gelap (Polaritas)
  const borderAvg = calculateBorderAverageLuminance(
    luminance,
    width,
    height,
    borderSamplingThickness
  )

  // Jika latar belakang gelap (borderAvg < threshold atau borderAvg < 128), berarti mode gelap (teks putih di atas hitam)
  const detectedDarkMode = borderAvg < threshold || borderAvg < 128
  const shouldInvert = invertOverride !== null ? invertOverride : detectedDarkMode

  // 7. Binarisasi Piksel (Tesseract OCR optimal pada teks hitam (0) di atas putih (255))
  for (let i = 0; i < totalPixels; i++) {
    const lum = luminance[i]
    let binValue: number

    if (lum > threshold) {
      // Objek terang
      binValue = shouldInvert ? 0 : 255
    } else {
      // Objek gelap
      binValue = shouldInvert ? 255 : 0
    }

    const idx = i * 4
    rgba[idx] = binValue     // R
    rgba[idx + 1] = binValue // G
    rgba[idx + 2] = binValue // B
    rgba[idx + 3] = 255      // Alpha tetap 100% solid
  }

  // Tulis kembali data binarisasi ke canvas
  ctx.putImageData(imageData, 0, 0)
  const binarizedDataUrl = canvas.toDataURL(outputFormat, jpegQuality)

  const latency = Math.round(performance.now() - startTime)

  return {
    binarizedDataUrl,
    originalDataUrl: imageSrc,
    threshold,
    isDarkMode: detectedDarkMode,
    width,
    height,
    processingLatencyMs: latency,
    metrics: {
      minLuminance: minLum,
      maxLuminance: maxLum,
      borderAverageLuminance: Math.round(borderAvg),
      betweenClassVariance: Math.round(maxVariance),
    },
  }
}
