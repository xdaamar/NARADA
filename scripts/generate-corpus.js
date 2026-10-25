// ─── GENERATOR BASIS DATA KORPUS PERTAHANAN & SOSIAL SIBER INDONESIA (2.500+ SAMPEL) ───
// SPRINT 7A & 7B: NARADA Cognitive Threat Defense System
// Menghasilkan 500 sampel berimbang per kategori: HOAKS, PROPAGANDA, BUZZER, DISINFORMASI, NETRAL

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const TARGET_FILE = path.resolve(__dirname, '../src/engine/data/defense-corpus.json')

// ─── 1. GENERATOR HOAKS (500 Sampel) ───
function generateHoaksSamples() {
  const samples = []

  // A. Bansos & BLT Phishing APK (100 sampel)
  const agencies = ['Kemensos RI', 'Kementerian Sosial', 'BPJS Ketenagakerjaan', 'Presiden Jokowi', 'Pemerintah Pusat']
  const amounts = ['Rp 600.000', 'Rp 1.200.000', 'Rp 2.400.000', 'Rp 3.500.000', 'Rp 5.000.000']
  const links = ['http://bit.ly/bansos-cair-2026', 'https://cekbansos-kemensos.vip/daftar', 'http://pkh-cair.site', 'https://dana-kaget-bansos.online']
  for (let i = 0; i < 100; i++) {
    const ag = agencies[i % agencies.length]
    const am = amounts[i % amounts.length]
    const lk = links[i % links.length]
    samples.push({
      text: `Bantuan sosial tunai tahap 3 sebesar ${am} dari ${ag} resmi dicairkan hari ini. Segera klaim dana bansos anda dengan mengunduh berkas APK ${lk} dan masukkan NIK KTP serta nomor rekening bank pada formulir pendaftaran sebelum kuota habis jam 24.00 malam ini. Sebarkan kabar gembira ini ke keluarga!`,
      category: 'HOAKS'
    })
  }

  // B. Bencana Alam Fiktif & Megathrust Jam 23.00 (80 sampel)
  const locs = ['Pesisir Pulau Jawa', 'Selat Sunda', 'Selatan Jawa Barat', 'Pantai Pacitan', 'Teluk Jakarta']
  const mags = ['M 8.7', 'M 8.9', 'M 9.1']
  for (let i = 0; i < 80; i++) {
    const loc = locs[i % locs.length]
    const mag = mags[i % mags.length]
    samples.push({
      text: `Peringatan darurat BMKG bocor! Gempa megathrust dahsyat magnitudo ${mag} dan tsunami setinggi 20 meter diprediksi akan menghantam ${loc} malam ini pukul 23.00 WIB. Warga diminta segera mengungsi ke tempat tinggi dan tinggalkan rumah sekarang juga demi keselamatan. BMKG sengaja sembunyikan info ini!`,
      category: 'HOAKS'
    })
  }

  // C. Alutsista Fiktif & Tender Palsu 24T (70 sampel)
  const alutsistas = ['pesawat tempur siluman', 'tank tempur rongsokan', 'sistem radar pertahanan udara fiktif', 'helikopter serbu bekas', 'kapal selam nuklir fiktif']
  for (let i = 0; i < 70; i++) {
    const item = alutsistas[i % alutsistas.length]
    samples.push({
      text: `Beredar dokumen rahasia pengadaan alutsista fiktif senilai 24 triliun rupiah yang melibatkan pejabat tinggi kementerian pertahanan. Anggaran negara diselundupkan untuk membeli ${item} tanpa persetujuan parlemen dan komisi DPR. Komisi pemberantasan korupsi dilarang memeriksa proyek rahasia ini.`,
      category: 'HOAKS'
    })
  }

  // D. Penculikan Anak & Perdagangan Organ Van Hitam (70 sampel)
  for (let i = 0; i < 70; i++) {
    samples.push({
      text: `Waspada modus penculikan anak sekolah marak terjadi di berbagai wilayah. Mobil van hitam keliling menculik balita untuk diambil organ tubuh ginjal, hati, dan kornea mata lalu dijual ke pasar gelap luar negeri. Jangan biarkan anak keluar sendirian, aparat seolah tutup mata terhadap sindikat penculik organ ini!`,
      category: 'HOAKS'
    })
  }

  // E. Pangan Plastik Berbahaya & Beras Beracun (60 sampel)
  for (let i = 0; i < 60; i++) {
    samples.push({
      text: `Hati-hati beredar beras plastik sintetis buatan pabrik kimia yang dicampur bahan pemutih berbahaya di pasar tradisional. Bila dimasak nasi menggumpal keras seperti lilin dan memicu kanker usus dalam waktu singkat. Telur palsu silikon dan garam campur beling kaca juga ditemukan di toko kelontong.`,
      category: 'HOAKS'
    })
  }

  // F. Penipuan Rekrutmen Bintara Calo Pelicin (60 sampel)
  for (let i = 0; i < 60; i++) {
    samples.push({
      text: `Penerimaan jalur khusus Bintara TNI AD dan Tamtama dibuka untuk kuota terbatas tanpa tes fisik dan tanpa seleksi ketat. Cukup transfer uang pelicin 50 juta rupiah ke rekening panitia jaminan kelulusan seratus persen dinas militer. Hubungi kontak whatsapp pengurus jalur kilat ini segera.`,
      category: 'HOAKS'
    })
  }

  // G. Phishing Kuota Internet Kemendikbud & Tilang APK & Dana Kaget (60 sampel)
  const subHoaks = [
    'Kementerian Pendidikan membagikan kuota data internet gratis 100 GB dan pulsa 200 ribu rupiah untuk semua guru dan pelajar. Klik tautan bit.ly/kuota-gratis-kemdikbud sekarang untuk aktivasi nomor kartu SIM anda.',
    'Pemberitahuan tilang elektronik ETLE kepolisian. Kendaraan anda tertangkap kamera melanggar batas kecepatan di jalan tol. Unduh dan buka file Surat_Tilang.apk berikut untuk melihat bukti foto pelanggaran dan nomor registrasi.',
    'Kabar gembira program dana kaget tunai dari presiden langsung cair ke saldo dompet digital DANA dan OVO sebesar 3 juta rupiah. Daftar instan hanya butuh nomor HP dan PIN login akun untuk verifikasi penerima dana hibah.',
    'Info darurat waduk bendungan air utama dikabarkan retak dan jebol malam ini akibat tekanan air luapan sungai. Warga di bantaran sungai hilir harus evakuasi mandiri dalam 1 jam sebelum air bah menerjang pemukiman penduduk.'
  ]
  for (let i = 0; i < 60; i++) {
    samples.push({
      text: subHoaks[i % subHoaks.length],
      category: 'HOAKS'
    })
  }

  return samples
}

// ─── 2. GENERATOR PROPAGANDA (500 Sampel) ───
function generatePropagandaSamples() {
  const samples = []

  // A. Separatisme Papua & Referendum Merdeka TPNPB OPM (130 sampel)
  const papuaRegions = ['Intan Jaya', 'Nduga', 'Puncak Jaya', 'Yahukimo', 'Maybrat', 'Pegunungan Bintang']
  for (let i = 0; i < 130; i++) {
    const reg = papuaRegions[i % papuaRegions.length]
    samples.push({
      text: `Bangsa Papua Barat menolak segala bentuk penjajahan NKRI dan otonomi khusus palsu di wilayah ${reg}. Kami menuntut hak penentuan nasib sendiri melalui referendum internasional merdeka penuh dari kolonialisme militer Jakarta. Komando TPNPB OPM menyatakan perang terbuka melawan aparat pendudukan sampai bendera Bintang Kejora berkibar bebas.`,
      category: 'PROPAGANDA'
    })
  }

  // B. Narasi Tentara Asing & Penjualan Kedaulatan IKN (100 sampel)
  for (let i = 0; i < 100; i++) {
    samples.push({
      text: `Kedaulatan Indonesia telah dijual kepada kekuatan asing. Ratusan tentara asing bersenjata lengkap dilaporkan telah menduduki pangkalan militer di Ibu Kota Nusantara IKN untuk mengontrol pemerintahan boneka. Dokumen rahasia membuktikan perjanjian sewa pulau terluar strategis 100 tahun kepada korporasi adidaya asing sebagai pangkalan intelijen militer.`,
      category: 'PROPAGANDA'
    })
  }

  // C. Agitasi Pemakzulan Presiden, Revolusi & Kudeta (90 sampel)
  for (let i = 0; i < 90; i++) {
    samples.push({
      text: `Rezim tiran ini sudah kehilangan legitimasi moral dan hukum. Seluruh elemen mahasiswa, buruh dan purnawirawan bersatu turun ke jalan menggelar aksi revolusi gulingkan presiden dan duduki gedung parlemen sekarang juga. Saatnya pembangkangan sipil total tolak bayar pajak dan lumpuhkan perekonomian penjajah lokal.`,
      category: 'PROPAGANDA'
    })
  }

  // D. Tuduhan Genosida Militer di Pedalaman (60 sampel)
  for (let i = 0; i < 60; i++) {
    samples.push({
      text: `Operasi militer TNI di pedalaman Papua adalah bentuk genosida sistematis terhadap masyarakat adat. Pasukan keamanan dituduh membakar kampung, membantai warga sipil tak berdosa dan mengusir ribuan pengungsi ke hutan rimba demi memuluskan eksploitasi tambang emas oligarki.`,
      category: 'PROPAGANDA'
    })
  }

  // E. Adu Domba SARA & Perang Saudara Horizontal (60 sampel)
  for (let i = 0; i < 60; i++) {
    samples.push({
      text: `Kelompok minoritas mulai berani menginjak harga diri mayoritas umat. Sudah saatnya kita bangkit mengangkat senjata berjihad mempertahankan akidah dan membersihkan tanah air dari antek-antek pengkhianat bangsa. Siapkan barisan perang suci melawan konspirasi pembusukan moral!`,
      category: 'PROPAGANDA'
    })
  }

  // F. Fitnah Perpecahan Panglima TNI vs Presiden & Bentrokan TNI-Polri (60 sampel)
  for (let i = 0; i < 60; i++) {
    samples.push({
      text: `Kabar pecah kongsi di lingkaran elit pertahanan. Panglima TNI secara tegas menolak mematuhi instruksi presiden untuk mengerahkan pasukan meredam unjuk rasa rakyat sehingga situasi darurat militer di ambang pintu. Konflik bersenjata antara aparat TNI dan Brimob Polri kembali pecah akibat perebutan pengamanan tambang liar.`,
      category: 'PROPAGANDA'
    })
  }

  return samples
}

// ─── 3. GENERATOR BUZZER (500 Sampel) ───
function generateBuzzerSamples() {
  const samples = []

  // A. Gerakan Tagar Botnet Astroturfing (120 sampel)
  const tags = [
    '#RezimPanik #GanyangPejabatKorup',
    '#KawalKemenangan #SatuKomando',
    '#ViralkanBiarViral #RakyatBergerak',
    '#TolakBuzzerRp #BoikotProduk',
    '#BongkarKonspirasi #KawalSampaiTuntas'
  ]
  for (let i = 0; i < 120; i++) {
    const tg = tags[i % tags.length]
    samples.push({
      text: `${tg} Viralkan kawan-kawan! Jangan biarkan penguasa tidur nyenyak. Ramaikan tagar ini di semua linimasa dan penuhi kolom komentar akun resmi pemerintah sampai trending topik nomor satu di Twitter X! Drop tweet serentak sekarang juga dengan akun ternak kita.`,
      category: 'BUZZER'
    })
  }

  // B. Spam Copypasta Serentak Grup Medsos (100 sampel)
  for (let i = 0; i < 100; i++) {
    samples.push({
      text: `Sebarkan pesan ini! Fakta membuktikan kebijakan baru ini hanya menyengsarakan rakyat jelata. Copy paste teks ini dan kirimkan ke 20 grup WhatsApp serta tagar media sosial agar masyarakat tidak tertipu tipu daya elit. Jangan biarkan postingan penting ini tenggelam gaes, bantu up terus!`,
      category: 'BUZZER'
    })
  }

  // C. Astroturfing Kampanye Boikot Terkoordinasi (80 sampel)
  for (let i = 0; i < 80; i++) {
    samples.push({
      text: `Gerakan boikot massal serentak! Mulai hari ini seluruh netizen wajib memboikot produk perusahaan ini dan berikan rating bintang satu di playstore. Mari kita buat mereka bangkrut dalam hitungan hari demi memberi pelajaran telak pada pemilik modal sombong!`,
      category: 'BUZZER'
    })
  }

  // D. Doxxing Identitas Pejabat & Sebar Nomor Kontak (70 sampel)
  for (let i = 0; i < 70; i++) {
    samples.push({
      text: `Bongkar habis boroknya! Ini dia nama lengkap, NIK, alamat rumah pribadi, dan nomor WhatsApp anak istri pejabat yang suka pamer kemewahan harta haram di media sosial. Silakan netizen silaturahmi langsung dan teror nomor ini siang malam!`,
      category: 'BUZZER'
    })
  }

  // E. Komentar Template Seragam Serang Akun Oposisi / Kritis (70 sampel)
  for (let i = 0; i < 70; i++) {
    samples.push({
      text: `Dasar akun provokator bayaran antek asing! Narasi kamu basi dan selalu memecah belah bangsa. Jangan sok suci kamu, aparat keamanan tolong segera tangkap pemilik akun penyebar fitnah ini demi ketertiban umum! Lapor blokir akun penyusup ini bareng-bareng kawan!`,
      category: 'BUZZER'
    })
  }

  // F. Pembunuhan Karakter & Serangan Botnet Jurnalis & Live Streaming (60 sampel)
  const buzzExtras = [
    'Terbongkar rekam jejak kelam calon gubernur nomor urut 1 yang terlibat skandal asusila dan korupsi dana bansos daerah. Jangan pilih pemimpin pembohong yang moralnya rusak dan khianati rakyat.',
    'Wartawan amplop tukang adu domba! Berita investigasi kamu pesanan sponsor politik oposisi. Netizen cerdas laporkan akun jurnalis ini dan blokir massal agar hilang dari peredaran dunia maya.',
    'Komentar kompak satu komando di live streaming pidato kenegaraan: Turunkan harga sembako, presiden tidak becus, kabinet gagal total! Copy paste terus menerus tanpa henti sampai server siaran macet!',
    'Beliau adalah tokoh berjasa yang dizalimi konspirasi lawan politik. Kasus hukum yang dituduhkan murni rekayasa kriminalisasi dan politisasi hukum. Kawal terus sampai beliau bebas dari tuduhan!'
  ]
  for (let i = 0; i < 60; i++) {
    samples.push({
      text: buzzExtras[i % buzzExtras.length],
      category: 'BUZZER'
    })
  }

  return samples
}

// ─── 4. GENERATOR DISINFORMASI (500 Sampel) ───
function generateDisinformasiSamples() {
  const samples = []

  // A. Video Latihan Militer Dipelintir Perang Perbatasan (100 sampel)
  for (let i = 0; i < 100; i++) {
    samples.push({
      text: `Detik-detik mencekam! Rekaman video pertempuran sengit jet tempur dan artileri berat di perbatasan Kalimantan. Militer Indonesia mulai melancarkan serangan balasan terhadap pasukan negara tetangga yang melanggar batas wilayah. Pengerahan pasukan infanteri besar-besaran bersiap perang terbuka.`,
      category: 'DISINFORMASI'
    })
  }

  // B. Judul Clickbait Bombastis Memutarbalikkan Rilis Pers (90 sampel)
  for (let i = 0; i < 90; i++) {
    samples.push({
      text: `Mengejutkan! Pemerintah Akhirnya Akui Krisis Ekonomi Bangkrut dan Kas Negara Kosong Melompong! Ternyata begini pengakuan rahasia menteri saat konferensi pers tertutup yang disembunyikan dari publik. Judul berita sensasional yang memelintir fakta narasumber demi klik pembaca.`,
      category: 'DISINFORMASI'
    })
  }

  // C. Foto Bencana Gempa Lama Diklaim Terjadi Hari Ini (80 sampel)
  for (let i = 0; i < 80; i++) {
    samples.push({
      text: `Baru saja terjadi gempa dahsyat yang meluluhlantakkan ratusan rumah dan gedung bertingkat di pusat kota sore hari ini. Foto memperlihatkan reruntuhan bangunan hancur lebur dan korban bergelimpangan di jalan raya. Padahal ini dokumentasi foto bencana gempa tsunami masa lalu yang didaur ulang.`,
      category: 'DISINFORMASI'
    })
  }

  // D. Manipulasi Grafik Statistik Inflasi & Utang Negara (80 sampel)
  for (let i = 0; i < 80; i++) {
    samples.push({
      text: `Lihat grafik lonjakan utang negara yang sengaja disembunyikan dari laporan resmi APBN. Kenaikan kurva eksponensial ini membuktikan ekonomi nasional berada di titik kehancuran total dan terancam default utang luar negeri. Grafik dipotong sumbu vertikalnya untuk manipulasi persepsi publik.`,
      category: 'DISINFORMASI'
    })
  }

  // E. Surat Edaran Palsu Berkop Kementerian Keuangan & Pajak Tabungan (50 sampel)
  for (let i = 0; i < 50; i++) {
    samples.push({
      text: `Beredar surat edaran resmi bertanda tangan menteri keuangan tentang pengenaan pajak tambahan 20 persen bagi pemilik rekening tabungan di atas sepuluh juta rupiah yang akan mulai diberlakukan bulan depan. Selebaran format palsu dengan stempel hasil rekayasa cropping komputer.`,
      category: 'DISINFORMASI'
    })
  }

  // F. Potongan Pidato Pejabat & Foto Satelit Radar Invasi Asing (50 sampel)
  for (let i = 0; i < 50; i++) {
    samples.push({
      text: `Potongan video pernyataan jenderal TNI yang viral di media sosial. Beliau tampak menyatakan bahwa tentara siap mengambil alih kendali roda pemerintahan jika situasi politik semakin tidak menentu. Klip sengaja dipotong di tengah kalimat untuk menghilangkan konteks aslinya.`,
      category: 'DISINFORMASI'
    })
  }

  // G. Manipulasi Screenshot Berita Online & Konspirasi Kriminal (50 sampel)
  const disinfoExtras = [
    'Foto tangkapan satelit militer membuktikan puluhan kapal perang induk armada asing sedang berlayar merapat mendekati kepulauan Natuna untuk merebut ladang minyak dan gas lepas pantai Indonesia.',
    'Kematian misterius seorang saksi kunci kasus korupsi besar diduga kuat melibatkan eksekutor penembak jitu militer terlatih untuk melenyapkan barang bukti persidangan dan melindungi dalang intelektual.',
    'Langit utara mencekam! Konvoi jet tempur supersonik asing terbang rendah menerobos ruang udara kedaulatan Indonesia tanpa izin dan bersiap membombardir instalasi militer strategis kita.',
    'Beredar tangkapan layar headline berita media online Kompas yang menyebutkan bahwa subsidi BBM akan dicabut total per 1 November dan harga bensin pertalite naik drastis menjadi tiga puluh ribu rupiah per liter.'
  ]
  for (let i = 0; i < 50; i++) {
    samples.push({
      text: disinfoExtras[i % disinfoExtras.length],
      category: 'DISINFORMASI'
    })
  }

  return samples
}

// ─── 5. GENERATOR NETRAL (Informasi Faktual Resmi) (500 Sampel) ───
function generateNetralSamples() {
  const samples = []

  // A. Siaran Pers Latihan Gabungan & Teritorial Kodiklatad / Dispenad (120 sampel)
  for (let i = 0; i < 120; i++) {
    samples.push({
      text: `Komando Pembina Doktrin, Pendidikan dan Latihan TNI AD (Kodiklatad) menyelenggarakan Latihan Antar Kecabangan Kartika Yudha 2026 di Pusat Latihan Tempur Puslatpur Baturaja. Latihan ini bertujuan meningkatkan profesionalisme dan interoperabilitas prajurit matra darat dalam operasi militer perang dengan melibatkan satuan Kavaleri, Infanteri, dan Artileri Medan modern.`,
      category: 'NETRAL'
    })
  }

  // B. Klarifikasi Pers Puspen TNI Terkait Sengketa Lahan & Disiplin (80 sampel)
  for (let i = 0; i < 80; i++) {
    samples.push({
      text: `Pusat Penerangan TNI (Puspen TNI) memberikan klarifikasi resmi bahwa tidak ada prajurit yang terlibat dalam sengketa lahan perkebunan di daerah tersebut. Institusi TNI menjunjung tinggi supremasi hukum dan menghormati hak kepemilikan tanah masyarakat adat setempat serta berkomitmen menjaga perdamaian dan ketertiban.`,
      category: 'NETRAL'
    })
  }

  // C. Informasi Cuaca Maritim & Gempa Resmi BMKG (80 sampel)
  for (let i = 0; i < 80; i++) {
    samples.push({
      text: `Badan Meteorologi, Klimatologi, dan Geofisika (BMKG) menginformasikan prakiraan cuaca maritim untuk wilayah perairan Indonesia. Masyarakat pesisir dan nelayan diimbau tetap waspada terhadap potensi gelombang tinggi 2.5 meter di Samudra Hindia bagian barat Sumatera. Hasil monitoring sensor seismograf mendeteksi aktivitas tektonik normal tanpa ancaman tsunami.`,
      category: 'NETRAL'
    })
  }

  // D. Program Ketahanan Pangan Babinsa Bersama Kelompok Tani (60 sampel)
  for (let i = 0; i < 60; i++) {
    samples.push({
      text: `Bintara Pembina Desa (Babinsa) Koramil 08 jajaran Kodim mendampingi kelompok tani dalam kegiatan panen raya padi sawah. Kegiatan ini merupakan wujud nyata kemanunggalan TNI dengan rakyat dalam mendukung program swasembada ketahanan pangan nasional di berbagai pelosok desa binaan teritorial.`,
      category: 'NETRAL'
    })
  }

  // E. Siaran Pers Kemhan Kunjungan Bilateral & Kerjasama Pertahanan (60 sampel)
  for (let i = 0; i < 60; i++) {
    samples.push({
      text: `Kementerian Pertahanan Republik Indonesia merilis hasil pertemuan bilateral menteri pertahanan dengan delegasi mitra strategis. Kedua belah pihak sepakat memperkuat kerja sama pendidikan perwira, transfer teknologi alutsista, dan latihan penanggulangan terorisme maritim demi menjaga stabilitas kawasan regional.`,
      category: 'NETRAL'
    })
  }

  // F. Pengumuman Rekrutmen Prajurit TNI AD Gratis Tanpa Biaya (50 sampel)
  for (let i = 0; i < 50; i++) {
    samples.push({
      text: `Dinas Penerangan TNI Angkatan Darat (Dispenad) menegaskan bahwa seluruh proses pendaftaran dan seleksi calon prajurit Taruna Akmil, Bintara PK, dan Tamtama PK TNI AD tidak dipungut biaya sepeser pun alias gratis. Jangan percaya calo atau pihak yang menjanjikan kelulusan dengan meminta imbalan uang. Laporkan oknum ke panitia daerah setempat.`,
      category: 'NETRAL'
    })
  }

  // G. Rapat Pimpinan TNI AD Bencana Alam & BNPB / Bapanas / Bakti Sosial (50 sampel)
  const netralExtras = [
    'Badan Pangan Nasional (Bapanas) bersama Perum Bulog memastikan stok cadangan beras pemerintah mencukupi kebutuhan nasional hingga akhir tahun. Penyaluran bantuan beras dan operasi pasar murah terus berjalan teratur di seluruh provinsi.',
    'Prajurit Satuan Tugas Pengamanan Perbatasan (Satgas Pamtas) TNI AD menggelar bakti sosial pengobatan massal dan pembagian buku pelajaran di desa pedalaman perbatasan Papua Nugini guna meningkatkan taraf kesehatan dan pendidikan anak bangsa.',
    'Kepala Staf Angkatan Darat (Kasad) memimpin rapat koordinasi penanggulangan bencana alam bersama seluruh Pangdam jajaran TNI AD untuk menyiagakan personel dan peralatan zeni dalam menghadapi potensi cuaca ekstrem di berbagai daerah.',
    'Badan Nasional Penanggulangan Bencana (BNPB) bekerja sama dengan pemerintah daerah dan relawan menyalurkan logistik bantuan darurat bagi warga terdampak banjir lahar dingin. Tim reaksi cepat gabungan terus mendirikan tenda pengungsian dan dapur umum.'
  ]
  for (let i = 0; i < 50; i++) {
    samples.push({
      text: netralExtras[i % netralExtras.length],
      category: 'NETRAL'
    })
  }

  return samples
}

// ─── EKSEKUSI PEMBUATAN FILE KORPUS ───
console.log('Memulai generasi korpus leksikal 2.500 sampel seimbang...')
const hoaks = generateHoaksSamples()
const propaganda = generatePropagandaSamples()
const buzzer = generateBuzzerSamples()
const disinformasi = generateDisinformasiSamples()
const netral = generateNetralSamples()

const allCorpus = [...hoaks, ...propaganda, ...buzzer, ...disinformasi, ...netral]

console.log(`Statistik Sampel yang Dihasilkan:`)
console.log(`- HOAKS: ${hoaks.length}`)
console.log(`- PROPAGANDA: ${propaganda.length}`)
console.log(`- BUZZER: ${buzzer.length}`)
console.log(`- DISINFORMASI: ${disinformasi.length}`)
console.log(`- NETRAL: ${netral.length}`)
console.log(`TOTAL KORPUS: ${allCorpus.length} sampel teks`)

fs.mkdirSync(path.dirname(TARGET_FILE), { recursive: true })
fs.writeFileSync(TARGET_FILE, JSON.stringify(allCorpus, null, 2), 'utf-8')
console.log(`✅ Berkas korpus berhasil disimpan di: ${TARGET_FILE}`)
