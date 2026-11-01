/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — EVIDENCE BROWSER LIFECYCLE & CAPTURE MANAGER (Sprint 7)
 * PUSSIBERAD TNI AD × CODEPOLITAN — KARTIKA CYBER HACKATHON 2026
 * ══════════════════════════════════════════════════════════════════════════
 * 
 * Pengelola WebContentsView Chromium Terisolasi untuk Investigasi Manual:
 * 1. Partisi Sesi Ephemeral (Tanpa persistensi cookie/kredensial ke disk).
 * 2. Isolasi penuh dari Node integration & preload script NARADA.
 * 3. Ekstraksi bounded metadata & manual selection teks.
 * 4. Pengambilan screenshot visible viewport dan kalkulasi SHA-256.
 * ══════════════════════════════════════════════════════════════════════════
 */

const { WebContentsView, session } = require('electron')
const crypto = require('crypto')
const { validateNavigationUrl } = require('./browser-security.cjs')

let currentView = null
let currentSession = null
let activeCaseId = null
let currentBounds = { x: 0, y: 0, width: 800, height: 600 }
let owningWindow = null

/**
 * Menghitung SHA-256 heksadesimal dari buffer biner
 */
function sha256Hex(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

/**
 * Menghasilkan serialisasi JSON kanonikal deterministik dari objek metadata (kunci terurut alfabetis)
 */
function canonicalizeManifestJson(obj) {
  const excludedKeys = new Set(['manifestSha256', 'screenshotDataUrl', 'integrityStatus', 'lastVerifiedAt'])
  function sortKeys(val) {
    if (val === null || typeof val !== 'object') return val
    if (Array.isArray(val)) return val.map(sortKeys)
    const sorted = {}
    Object.keys(val).filter(k => !excludedKeys.has(k)).sort().forEach(k => {
      sorted[k] = sortKeys(val[k])
    })
    return sorted
  }
  return JSON.stringify(sortKeys(obj))
}

/**
 * Mengirim event state browser ke renderer UI NARADA
 */
function sendBrowserState(stateName, payload = {}) {
  if (owningWindow && !owningWindow.isDestroyed()) {
    owningWindow.webContents.send('narada:evidence-browser:state-change', {
      state: stateName,
      ...payload
    })
  }
}

/**
 * Membuka dan menginisialisasi view browser bukti digital
 */
async function openEvidenceBrowser(win, { caseId, bounds }) {
  if (!win || win.isDestroyed()) {
    throw new Error('Jendela utama NARADA tidak valid')
  }

  owningWindow = win
  activeCaseId = caseId || null

  if (bounds) {
    currentBounds = bounds
  }

  // Jika sudah ada view terbuka sebelumnya, tutup terlebih dahulu
  if (currentView) {
    await closeEvidenceBrowser()
  }

  // Buat sesi ephemeral acak (tidak persist: ke disk)
  const partitionName = `ephemeral-evidence-${Date.now()}-${Math.floor(Math.random() * 10000)}`
  currentSession = session.fromPartition(partitionName, { cache: false })

  // Konfigurasi keamanan sesi: Tolak semua permintaan izin (kamera, mikrofon, geolokasi, dll.)
  currentSession.setPermissionRequestHandler((wc, permission, callback) => {
    callback(false)
  })

  // Batalkan seluruh unduhan berkas otomatis
  currentSession.on('will-download', (event) => {
    event.preventDefault()
    sendBrowserState('download-blocked', { message: 'Unduhan berkas otomatis dilarang di browser bukti' })
  })

  // Inisialisasi WebContentsView
  currentView = new WebContentsView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      session: currentSession
      // PENTING: Jangan menyertakan preload script NARADA ke remote content!
    }
  })

  const wc = currentView.webContents

  // Tolak pembuatan jendela / popup baru
  wc.setWindowOpenHandler(({ url }) => {
    sendBrowserState('popup-blocked', { url, message: 'Pembuatan popup baru diblokir' })
    return { action: 'deny' }
  })

  // Guard navigasi tingkat atas
  wc.on('will-navigate', (event, targetUrl) => {
    const check = validateNavigationUrl(targetUrl)
    if (!check.isValid) {
      event.preventDefault()
      sendBrowserState('navigation-blocked', {
        url: targetUrl,
        reason: check.rejectionReason
      })
    }
  })

  // Guard pengalihan (redirect)
  wc.on('will-redirect', (event, targetUrl) => {
    const check = validateNavigationUrl(targetUrl)
    if (!check.isValid) {
      event.preventDefault()
      sendBrowserState('navigation-blocked', {
        url: targetUrl,
        reason: `Pengalihan diblokir: ${check.rejectionReason}`
      })
    }
  })

  // Listener event status navigasi
  wc.on('did-start-loading', () => {
    sendBrowserState('loading', { isLoading: true })
  })

  const canNavBack = () => wc.navigationHistory ? wc.navigationHistory.canGoBack() : wc.canGoBack()
  const canNavForward = () => wc.navigationHistory ? wc.navigationHistory.canGoForward() : wc.canGoForward()

  wc.on('did-stop-loading', () => {
    sendBrowserState('loading', {
      isLoading: false,
      currentUrl: wc.getURL(),
      currentTitle: wc.getTitle(),
      canGoBack: canNavBack(),
      canGoForward: canNavForward()
    })
  })

  wc.on('did-navigate', (event, url) => {
    sendBrowserState('navigated', {
      currentUrl: url,
      currentTitle: wc.getTitle(),
      canGoBack: canNavBack(),
      canGoForward: canNavForward()
    })
  })

  wc.on('did-navigate-in-page', (event, url) => {
    sendBrowserState('navigated-in-page', {
      currentUrl: url,
      currentTitle: wc.getTitle(),
      canGoBack: canNavBack(),
      canGoForward: canNavForward()
    })
  })

  wc.on('page-title-updated', (event, title) => {
    sendBrowserState('title-updated', { currentTitle: title })
  })

  // Pemulihan jika remote renderer mengalami crash
  wc.on('render-process-gone', (event, details) => {
    console.warn('[EvidenceBrowser] Remote renderer process gone:', details)
    sendBrowserState('renderer-crashed', {
      reason: details.reason,
      exitCode: details.exitCode
    })
  })

  // Pasang view ke jendela utama
  win.contentView.addChildView(currentView)
  currentView.setBounds(currentBounds)

  return {
    success: true,
    activeCaseId,
    sessionPartition: partitionName
  }
}

/**
 * Menavigasikan browser ke URL tertentu
 */
async function navigateBrowser(targetUrl) {
  if (!currentView || currentView.webContents.isDestroyed()) {
    throw new Error('Evidence Browser belum aktif')
  }

  const check = validateNavigationUrl(targetUrl)
  if (!check.isValid) {
    sendBrowserState('navigation-blocked', {
      url: targetUrl,
      reason: check.rejectionReason
    })
    return { success: false, reason: check.rejectionReason }
  }

  await currentView.webContents.loadURL(check.normalizedUrl)
  return { success: true, url: check.normalizedUrl }
}

/**
 * Navigasi mundur
 */
function goBack() {
  if (currentView && !currentView.webContents.isDestroyed() && currentView.webContents.canGoBack()) {
    currentView.webContents.goBack()
  }
}

/**
 * Navigasi maju
 */
function goForward() {
  if (currentView && !currentView.webContents.isDestroyed() && currentView.webContents.canGoForward()) {
    currentView.webContents.goForward()
  }
}

/**
 * Muat ulang halaman
 */
function reload() {
  if (currentView && !currentView.webContents.isDestroyed()) {
    currentView.webContents.reload()
  }
}

/**
 * Hentikan pemuatan
 */
function stopLoading() {
  if (currentView && !currentView.webContents.isDestroyed()) {
    currentView.webContents.stop()
  }
}

/**
 * Mengubah ukuran & posisi bounds view browser
 */
function setBrowserBounds(bounds) {
  if (!bounds) return
  currentBounds = bounds
  if (currentView) {
    currentView.setBounds(bounds)
  }
}

/**
 * Mengubah visibilitas view browser
 */
function setBrowserVisible(visible) {
  if (currentView && currentView.setVisible) {
    currentView.setVisible(visible)
  } else if (currentView && !visible) {
    currentView.setBounds({ x: -10000, y: -10000, width: 10, height: 10 })
  } else if (currentView && visible) {
    currentView.setBounds(currentBounds)
  }
}

/**
 * Script ekstraksi metadata & teks seleksi yang aman dan terisolasi
 */
const EXTRACT_PAGE_METADATA_SCRIPT = `
(() => {
  try {
    const sel = window.getSelection ? window.getSelection().toString() : '';
    const boundedSel = sel.length > 50000 ? sel.slice(0, 50000) : sel;
    const isTruncated = sel.length > 50000;

    const getMeta = (selector) => {
      const el = document.querySelector(selector);
      return el ? (el.getAttribute('content') || el.getAttribute('value') || '').trim() : '';
    };

    const canonicalEl = document.querySelector('link[rel="canonical"]');
    const canonicalUrl = canonicalEl ? (canonicalEl.getAttribute('href') || '').trim() : '';

    const title = document.title || getMeta('meta[property="og:title"]') || getMeta('meta[name="twitter:title"]') || '';
    const siteName = getMeta('meta[property="og:site_name"]') || '';
    const author = getMeta('meta[name="author"]') || getMeta('meta[property="article:author"]') || getMeta('meta[name="twitter:creator"]') || '';
    const publishedAtRaw = getMeta('meta[property="article:published_time"]') || getMeta('meta[name="pubdate"]') || getMeta('meta[name="date"]') || '';
    const description = getMeta('meta[name="description"]') || getMeta('meta[property="og:description"]') || '';

    return {
      success: true,
      selectedText: boundedSel,
      selectedTextLength: sel.length,
      isTruncated,
      canonicalUrl,
      pageTitle: title,
      siteName,
      author,
      publishedAtRaw,
      description
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
      selectedText: '',
      selectedTextLength: 0,
      isTruncated: false
    };
  }
})();
`

/**
 * Melakukan ekstraksi bukti digital (screenshot + teks terpilih + metadata) untuk peninjauan
 */
async function prepareCapture() {
  if (!currentView || currentView.webContents.isDestroyed()) {
    throw new Error('Evidence Browser tidak aktif')
  }

  const wc = currentView.webContents
  const finalUrl = wc.getURL()
  const nowIso = new Date().toISOString()

  // 1. Eksekusi script ekstraksi teks seleksi dan metadata
  let pageData = {
    selectedText: '',
    selectedTextLength: 0,
    isTruncated: false,
    canonicalUrl: '',
    pageTitle: wc.getTitle(),
    siteName: '',
    author: '',
    publishedAtRaw: '',
    description: ''
  }

  try {
    const rawResult = await wc.executeJavaScript(EXTRACT_PAGE_METADATA_SCRIPT)
    if (rawResult && rawResult.success) {
      pageData = rawResult
    }
  } catch (err) {
    console.warn('[EvidenceBrowser] Ekstraksi metadata script gagal:', err.message)
  }

  // 2. Capture viewport screenshot menggunakan capturePage Electron
  let nativeImg
  try {
    nativeImg = await wc.capturePage()
  } catch (err) {
    const { nativeImage } = require('electron')
    nativeImg = nativeImage.createFromBuffer(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'))
  }
  const pngBuffer = nativeImg.toPNG()
  const screenshotByteSha256 = sha256Hex(pngBuffer)
  const screenshotDataUrl = 'data:image/png;base64,' + pngBuffer.toString('base64')

  // 3. Hash teks seleksi
  const selectedTextUtf8Bytes = Buffer.from(pageData.selectedText || '', 'utf8')
  const selectedTextByteSha256 = sha256Hex(selectedTextUtf8Bytes)

  // 4. Struktur payload peninjauan bukti
  const rawMetadataManifest = {
    caseId: activeCaseId,
    finalUrl,
    canonicalUrl: pageData.canonicalUrl || undefined,
    pageTitle: pageData.pageTitle || wc.getTitle() || 'Untitled Page',
    siteName: pageData.siteName || undefined,
    author: pageData.author || undefined,
    publishedAtRaw: pageData.publishedAtRaw || undefined,
    description: pageData.description || undefined,
    selectedText: pageData.selectedText,
    selectedTextStatus: pageData.isTruncated ? 'truncated' : (pageData.selectedText ? 'present' : 'empty'),
    selectedTextByteSha256,
    screenshotByteSha256,
    capturedAt: nowIso,
    captureMethod: 'NARADA_BROWSER_VIEW_V1'
  }

  const manifestSha256 = sha256Hex(Buffer.from(canonicalizeManifestJson(rawMetadataManifest), 'utf8'))

  return {
    success: true,
    caseId: activeCaseId,
    finalUrl,
    canonicalUrl: pageData.canonicalUrl,
    pageTitle: rawMetadataManifest.pageTitle,
    siteName: pageData.siteName,
    author: pageData.author,
    publishedAtRaw: pageData.publishedAtRaw,
    description: pageData.description,
    selectedText: pageData.selectedText,
    selectedTextStatus: rawMetadataManifest.selectedTextStatus,
    selectedTextLength: pageData.selectedTextLength,
    isTruncated: pageData.isTruncated,
    screenshotDataUrl,
    screenshotByteSha256,
    selectedTextByteSha256,
    manifestSha256,
    capturedAt: nowIso
  }
}

/**
 * Menutup browser bukti digital dan membersihkan seluruh sesi sementara
 */
async function closeEvidenceBrowser() {
  if (currentView) {
    try {
      if (owningWindow && !owningWindow.isDestroyed()) {
        owningWindow.contentView.removeChildView(currentView)
      }

      if (!currentView.webContents.isDestroyed()) {
        currentView.webContents.stop()
        currentView.webContents.destroy()
      }
    } catch (e) {
      console.warn('[EvidenceBrowser] Error saat menutup view:', e)
    }
    currentView = null
  }

  if (currentSession) {
    try {
      await currentSession.clearStorageData()
      await currentSession.clearCache()
      await currentSession.clearAuthCache()
    } catch (e) {
      console.warn('[EvidenceBrowser] Error saat membersihkan sesi:', e)
    }
    currentSession = null
  }

  activeCaseId = null
  sendBrowserState('closed', { isClosed: true })
}

/**
 * Mendapatkan status instance browser saat ini
 */
function getBrowserStatus() {
  const isActive = Boolean(currentView && !currentView.webContents.isDestroyed())
  return {
    isActive,
    activeCaseId,
    currentUrl: isActive ? currentView.webContents.getURL() : '',
    currentTitle: isActive ? currentView.webContents.getTitle() : '',
    isLoading: isActive ? currentView.webContents.isLoading() : false
  }
}

module.exports = {
  openEvidenceBrowser,
  navigateBrowser,
  goBack,
  goForward,
  reload,
  stopLoading,
  setBrowserBounds,
  setBrowserVisible,
  prepareCapture,
  closeEvidenceBrowser,
  getBrowserStatus
}
