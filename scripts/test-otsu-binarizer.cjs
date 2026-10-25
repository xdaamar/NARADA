/**
 * Uji Verifikasi Matematika Algoritma Otsu Global Thresholding
 */

function calculateOtsuThreshold(histogram, totalPixels) {
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

    const betweenClassVariance = wB * wF * (mB - mF) * (mB - mF)

    if (betweenClassVariance > maxVariance) {
      maxVariance = betweenClassVariance
      threshold = t
    }
  }

  return { threshold, maxVariance }
}

// Bimodal distribution test: Background peak around 50, Text peak around 200
const histogram = new Array(256).fill(0);
for (let i = 40; i <= 60; i++) histogram[i] = 100;   // 2100 background pixels
for (let i = 190; i <= 210; i++) histogram[i] = 100; // 2100 foreground pixels
const totalPixels = 4200;

const result = calculateOtsuThreshold(histogram, totalPixels);
console.log('Otsu Bimodal Test Result:', result);

if (result.threshold >= 60 && result.threshold <= 190) {
  console.log('✅ OTSU MATHEMATICAL THRESHOLD VERIFIED (Optimal separating hyper-plane between peaks)');
} else {
  console.error('❌ OTSU THRESHOLD FAILED');
  process.exit(1);
}
