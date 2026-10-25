// ─── GENERATOR BASIS DATA KORPUS PERTAHANAN & SOSIAL SIBER INDONESIA (2.500+ SAMPEL) ───
// SPRINT 7A: NARADA Cognitive Threat Defense System
// Menghasilkan 500 sampel per kategori (HOAKS, PROPAGANDA, BUZZER, DISINFORMASI, NETRAL)

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const TARGET_FILE = path.resolve(__dirname, '../src/engine/data/defense-corpus.json')

// ─── 1. GENERATOR KOMPONEN HOAKS (500+ Sampel) ───
function generateHoaksSamples() {
  const samples = []
  
  // A. Bansos & BLT Phishing (150 sampel)
  const bansosAgencies = ['Kemensos RI', 'BPJS Ketenagakerjaan', 'Presiden Jokowi', 'Pemerintah Pusat', 'Kementerian Keuangan', 'Dinas Sosial']
  const bansosAmounts = ['Rp 600.000', 'Rp 1.200.000', 'Rp 2.400.000', 'Rp 3.500.000', 'Rp 5.000.000', 'Rp 10.000.000']
  const bansosLinks = ['http://bit.ly/bansos-cair-2026', 'https://cekbansos-kemensos.vip/daftar', 'http://pkh-tahap1-cair.site', 'https://dana-kaget-bansos.online', 'https://bantuan-pemerintah-resmi.top']
  const bansosTriggers = [
    'Bantuan langsung tunai tahap awal resmi dicairkan hari ini untuk seluruh pemilik e-KTP.',
    'Segera daftarkan NIK Anda sebelum kuota penerima subsidi habis ditutup malam ini.',
    'Kabar gembira bagi warga pemegang kartu keluarga, subsidi saldo tunai siap diklaim sekarang.',
    'Pemerintah menyalurkan dana bantuan darurat penanganan inflasi tanpa potongan apapun.',
    'Jangan lewatkan pencairan saldo bantuan sosial tunai gelombang terbaru lewat tautan resmi ini.'
  ]

  for (let i = 0; i < 150; i++) {
    const agency = bansosAgencies[i % bansosAgencies.length]
    const amount = bansosAmounts[i % bansosAmounts.length]
    const link = bansosLinks[i % bansosLinks.length]
    const trigger = bansosTriggers[i % bansosTriggers.length]
    samples.push({
      text: `PEMBERITAHUAN RESMI: ${trigger} Bantuan sebesar ${amount} dari ${agency} langsung masuk ke rekening bank Anda. Klik tautan verifikasi berikut: ${link} dan masukkan nomor NIK KTP serta nomor WhatsApp aktif Anda. Sebarkan kabar ini ke saudara sebelum kuota habis.`,
      category: 'HOAKS'
    })
  }

  // B. Bencana Alam Fiktif & Megathrust (100 sampel)
  const gempaLocations = ['Selat Sunda', 'Selatan Jawa Barat', 'Pesisir Mentawai Sumatera', 'Sesar Lembang', 'Pantai Pacitan', 'Teluk Jakarta']
  const gempaMagnitudes = ['M 8.7', 'M 8.9', 'M 9.1', 'M 9.3']
  const gempaTimes = ['pukul 23.30 WIB malam ini', 'nanti tengah malam', 'dalam tempo 24 jam ke depan', 'dini hari nanti']
  for (let i = 0; i < 100; i++) {
    const loc = gempaLocations[i % gempaLocations.length]
    const mag = gempaMagnitudes[i % gempaMagnitudes.length]
    const time = gempaTimes[i % gempaTimes.length]
    samples.push({
      text: `PERINGATAN DARURAT BMKG BOCOR! Gempa dahsyat Megathrust kekuatan ${mag} berpotensi tsunami setinggi 20 meter diprediksi melanda wilayah ${loc} tepat pada ${time}. Air laut dikabarkan sudah mulai surut drastis. BMKG sengaja menyembunyikan kabar ini agar tidak menimbulkan kepanikan warga. Segera evakuasi ke dataran tinggi dan bagikan pesan darurat ini!`,
      category: 'HOAKS'
    })
  }

  // C. Pangan & Kesehatan Berbahaya Fiktif (90 sampel)
  const panganItems = [
    'Beras sintetis bercampur biji plastik kimia asal luar negeri beredar bebas di pasar tradisional',
    'Telur palsu berbahan silikon berbahaya buatan pabrik ilegal tanpa izin edar BPOM',
    'Garam dapur kemasan yang terbukti dicampur butiran beling kaca halus pemotong lambung',
    'Permen susu anak-anak yang disusupi narkoba jenis baru perusak sel saraf otak',
    'Vaksin imunisasi program pemerintah yang diam-diam disuntikkan microchip magnetik 5G pelacak'
  ]
  for (let i = 0; i < 90; i++) {
    const item = panganItems[i % panganItems.length]
    samples.push({
      text: `VIRALKAN DEMI KESELAMATAN KELUARGA! Waspada ${item}. Hasil uji bakar membuktikan saat digoreng berbau sangit seperti plastik terbakar dan menggumpal keras. Banyak korban anak dilarikan ke rumah sakit setelah mengonsumsinya. Jangan beli produk ini dan sebarkan ke semua grup keluarga Anda!`,
      category: 'HOAKS'
    })
  }

  // D. Alutsista & Militer Fiktif (90 sampel)
  const alutsistaHoaks = [
    'Skandal pengadaan 42 unit jet tempur siluman fiktif senilai 24 triliun rupiah yang ternyata hanya maket kayu',
    'Sebanyak 15 tank tempur utama meledak terbakar saat latihan di perbatasan karena memakai amunisi kadaluwarsa',
    'Sistem radar pertahanan udara ibu kota mati total akibat peretasan massal hacker tanpa bisa diperbaiki aparat',
    'Kapal perang jenis korvet buatan baru tenggelam di dermaga pangkalan laut akibat plat baja lambung bocor karatan',
    'Helikopter serbu militer dilaporkan hilang kontak dan jatuh di hutan lindung akibat korupsi suku cadang bekas'
  ]
  for (let i = 0; i < 90; i++) {
    const item = alutsistaHoaks[i % alutsistaHoaks.length]
    samples.push({
      text: `BOCOR DOKUMEN RAHASIA! ${item}. Pihak kementerian dan komando berusaha menutup-nutupi kerugian negara dari rakyat. Saksi mata di lapangan dilarang mengambil rekaman foto. Viralkan sebelum aparat membungkam media berita investigasi!`,
      category: 'HOAKS'
    })
  }

  // E. Penipuan Rekrutmen TNI/Polri (70 sampel)
  for (let i = 0; i < 70; i++) {
    const angkatan = ['TNI Angkatan Darat', 'TNI Angkatan Laut', 'TNI Angkatan Udara', 'Mabes TNI'][i % 4]
    const nominal = ['50 juta', '75 juta', '100 juta', '150 juta'][i % 4]
    samples.push({
      text: `DIBUKA PENERIMAAN BINTARA & TAMTAMA ${angkatan} JALUR KHUSUS KELUARGA BESAR. Dijamin lolos seleksi pantukhir tanpa tes fisik berat dengan biaya administrasi penempatan ${nominal}. Kuota terbatas 20 orang. Hubungi nomor Mayor Infantri palsu di link pendaftaran darurat telegram berikut sekarang.`,
      category: 'HOAKS'
    })
  }

  return samples
}

// ─── 2. GENERATOR KOMPONEN PROPAGANDA (500+ Sampel) ───
function generatePropagandaSamples() {
  const samples = []

  // A. Separatisme Papua & TPNPB/OPM (180 sampel)
  const papuaRegions = ['Intan Jaya', 'Nduga', 'Puncak Jaya', 'Yahukimo', 'Maybrat', 'Pegunungan Bintang']
  const separatistNarratives = [
    'Komando TPNPB Organisasi Papua Merdeka mengklaim berhasil menguasai wilayah strategis dan mengusir aparat militer kolonial.',
    'Seruan boikot total seluruh program Otonomi Khusus Otsus Jilid II dan tuntutan referendum penentuan nasib sendiri bangsa Papua Barat.',
    'Pemerintah Jakarta dituding melakukan genosida rasial dan militerisasi tanah adat Papua demi eksploitasi tambang emas.',
    'Pejuang kemerdekaan Papua Barat mengibarkan bendera Bintang Kejora dan mendesak intervensi pasukan perdamaian Dewan Keamanan PBB.',
    'Operasi militer gabungan dituduh membakar perkampungan warga sipil dan memaksa ribuan pengungsi kelaparan di pegunungan.'
  ]
  for (let i = 0; i < 180; i++) {
    const reg = papuaRegions[i % papuaRegions.length]
    const nar = separatistNarratives[i % separatistNarratives.length]
    samples.push({
      text: `SIARAN PERS KEMERDEKAAN WEST PAPUA: Wilayah ${reg} bergolak. ${nar} Kami menyerukan seluruh rakyat Papua untuk mogok sipil nasional melawan pendudukan ilegal aparat keamanan Indonesia. Papua bukan Merah Putih, Papua merdeka!`,
      category: 'PROPAGANDA'
    })
  }

  // B. Delegitimasi TNI AD & Kepemimpinan Nasional (170 sampel)
  const delegitimasiNarratives = [
    'Panglima TNI dan jajaran perwira tinggi dikabarkan menggelar rapat darurat rahasia untuk melancarkan kudeta militer terhadap istana.',
    'Isu pemecatan mendadak Kepala Staf Angkatan Darat KSAD karena menolak perintah presiden untuk mengerahkan pasukan memukul demonstran.',
    'Dwifungsi ABRI kembali dibangkitkan untuk menempatkan jenderal aktif menduduki jabatan sipil dan membungkam suara kritis mahasiswa.',
    'Anggaran pertahanan ratusan triliun rupiah sengaja dialokasikan untuk mendanai pemenangan dinasti politik penguasa.',
    'Prajurit militer tingkat bawah dikabarkan mulai melakukan pembangkangan komando karena gaji dan uang lauk pauk dipotong atasan.'
  ]
  for (let i = 0; i < 170; i++) {
    const nar = delegitimasiNarratives[i % delegitimasiNarratives.length]
    samples.push({
      text: `ANALISIS INTELIJEN STRATEGIS: Situasi ketatanegaraan berada di ujung tanduk. ${nar} Rezim panik dan mengorbankan integritas prajurit sapta marga. Saatnya rakyat bersatu mendukung perwira patriotik untuk merebut kembali kedaulatan bangsa dari oligarki!`,
      category: 'PROPAGANDA'
    })
  }

  // C. Agitasi SARA, Disintegrasi, & Sentimen Anti-Asing (150 sampel)
  const agitasiNarratives = [
    'Ratusan ribu tentara asing Tiongkok menyamar sebagai pekerja tambang nikel di kawasan industri Morowali bersenjata lengkap siap kuasai NKRI.',
    'Skenario adu domba berdarah sengaja dirancang antara korps Brimob Polri dan prajurit TNI AD demi memuluskan darurat militer.',
    'Kebangkitan gerakan neo-komunisme PKI gaya baru yang menyusup ke dalam lingkaran kementerian strategis untuk mengganti ideologi Pancasila.',
    'Konflik komunal bernuansa agama sengaja dipicu di daerah luar Jawa untuk memecah belah persatuan dan kesatuan bangsa.',
    'Aset strategis pangkalan militer nusantara digadaikan kepada negara adidaya asing demi melunasi utang proyek infrastruktur mercusuar.'
  ]
  for (let i = 0; i < 150; i++) {
    const nar = agitasiNarratives[i % agitasiNarratives.length]
    samples.push({
      text: `SERUAN JIHAD DAN JAGA TANAH AIR: Waspadai konspirasi besar pengkhianatan kedaulatan negara. ${nar} Jika kita berdiam diri, tanah air kita akan jatuh ke tangan penjajah asing dan bangsa pribumi menjadi budak di negeri sendiri!`,
      category: 'PROPAGANDA'
    })
  }

  return samples
}

// ─── 3. GENERATOR KOMPONEN BUZZER (500+ Sampel) ───
function generateBuzzerSamples() {
  const samples = []

  // A. Gerakan Tagar Terkoordinasi & Astroturfing (200 sampel)
  const hashtags = [
    '#RezimPanikTakutRakyat #BongkarKonspirasi',
    '#GanyangBuzzerRp #KawalPilkadaBersih',
    '#TolakKorupsiAlutsista #AuditKemhanSekarang',
    '#ViralkanBiarViral #RakyatBergerak2026',
    '#BoikotMediaPenjilat #SuaraKebenaran'
  ]
  const botTemplates = [
    'Jujur saya awalnya netral dan tidak mau ikut campur urusan politik, tapi setelah melihat video viral ini hati saya tergerak. Betapa dzalimnya perlakuan aparat terhadap rakyat kecil.',
    'Jangan biarkan postingan penting ini tenggelam gaes! Pasukan buzzer bayaran rezim sudah mulai menyerbu kolom komentar untuk membelokkan opini publik.',
    'Tolong viralkan ke seluruh grup WhatsApp keluarga dan tetangga Anda sebelum akun ini ditakedown atau di-banned oleh kominfo!',
    'Ketik AMIN dan bagikan status ini minimal 5 kali di beranda Anda jika Anda peduli dengan nasib masa depan anak cucu di negeri ini.',
    'Satu suara Anda sangat berharga untuk menumbangkan arogansi kekuasaan yang terus menindas hak-hak dasar masyarakat tertindas.'
  ]
  for (let i = 0; i < 200; i++) {
    const ht = hashtags[i % hashtags.length]
    const bt = botTemplates[i % botTemplates.length]
    samples.push({
      text: `${bt} Naikkan trending topik Twitter X sekarang juga! Ramaikan tagar ${ht} agar dunia internasional tahu apa yang sebenarnya terjadi di Indonesia.`,
      category: 'BUZZER'
    })
  }

  // B. Polarisasi Politik & Pembunuhan Karakter Tokoh (150 sampel)
  const tokohList = ['Menteri Pertahanan', 'Panglima TNI', 'Kepala Staf Angkatan Darat', 'Gubernur Lemhannas', 'Ketua Komisi I DPR RI']
  const polarisasiThemes = [
    'terbukti menerima suap gratifikasi proyek pengadaan helikopter tempur fiktif melalui rekening luar negeri anak kandungnya.',
    'tertangkap basah menggelar pertemuan rahasia dengan taipan oligarki gelap untuk membagi-bagikan konsesi tambang di pulau terluar.',
    'menginstruksikan anak buahnya menyebarkan fitnah keji di medsos untuk menghancurkan elektabilitas lawan politiknya dalam pilkada.',
    'memiliki rekam jejak kelam pelanggaran hak asasi manusia berat masa lalu yang sengaja diputihkan oleh pengadilan militer.',
    'panik kehilangan kekuasaan hingga menyewa puluhan influencer media sosial bayaran untuk memoles citra bobroknya.'
  ]
  for (let i = 0; i < 150; i++) {
    const tokoh = tokohList[i % tokohList.length]
    const theme = polarisasiThemes[i % polarisasiThemes.length]
    samples.push({
      text: `TOPENGNYA AKHIRNYA TERBONGKAR! Sosok pejabat ${tokoh} yang selama ini diagung-agungkan media ternyata ${theme} Jejak digital tidak bisa berbohong gaes. Bagikan link postingan ini seluas-luasnya agar masyarakat tidak tertipu lagi!`,
      category: 'BUZZER'
    })
  }

  // C. Spam Komentar Botnet & Agitasi Kolom Balasan (150 sampel)
  const spamComments = [
    'BuzzerRp mana suaranya kok mendadak mingkem gak bisa jawab fakta telak ini wkwkwk',
    'Up up up terus jangan kasih kendor ramaikan kolom komentar sebelum dihapus admin antek rezim',
    'Admin akun ini jelas dibayar pakai uang pajak rakyat buat membela koruptor tak tahu malu',
    'Info A1 dari orang dalam istana menyebutkan petinggi militer sedang sibuk mengamankan aset haramnya',
    'Kawal terus sidang kasus ini sampai tuntas jangan sampai ada rekayasa hukum seperti yang sudah-sudah'
  ]
  for (let i = 0; i < 150; i++) {
    const comment = spamComments[i % spamComments.length]
    samples.push({
      text: `KOMENTAR VIRAL: "${comment}" - Serbu akun resmi @tni_angkatan_darat dan @kemhanri sekarang juga. Tunjukkan kekuatan netizen +62 demi menegakkan keadilan dan kebenaran hakiki!`,
      category: 'BUZZER'
    })
  }

  return samples
}

// ─── 4. GENERATOR KOMPONEN DISINFORMASI (500+ Sampel) ───
function generateDisinformasiSamples() {
  const samples = []

  // A. Video/Foto Latihan Militer Dipelintir Konteks (180 sampel)
  const militerEvents = [
    'Video latihan tempur antar-kecabangan TNI AD di Baturaja tahun 2021',
    'Iring-iringan parade kendaraan taktis Maung dan panser Anoa pada peringatan HUT TNI di Monas',
    'Rekaman pendaratan amfibi korps marinir dalam latihan gabungan Armada Jaya di Dabo Singkep',
    'Dokumentasi manuver jet tempur F-16 dan Sukhoi dalam operasi pengamanan patroli udara Alki',
    'Kegiatan apel kesiapsiagaan pasukan pengamanan KTT internasional di Bali'
  ]
  const pelintiranNarratives = [
    'diklaim sebagai detik-detik pengerahan pasukan infanteri besar-besaran untuk mengepung perbatasan negara tetangga bersiap perang terbuka.',
    'dipelintir menjadi bukti persiapan militer mengambil alih kekuasaan gedung parlemen dan mengumumkan darurat militer sipil.',
    'disebarkan dengan narasi palsu seolah bentrokan bersenjata sungguhan yang menewaskan ratusan prajurit di medan tempur.',
    'diklaim secara keliru sebagai serangan mendadak pasukan koalisi asing yang membombardir wilayah perairan nusantara.',
    'diedit dengan suara tembakan palsu untuk meyakinkan publik bahwa perang saudara antarfaksi militer telah meletus.'
  ]
  for (let i = 0; i < 180; i++) {
    const ev = militerEvents[i % militerEvents.length]
    const pel = pelintiranNarratives[i % pelintiranNarratives.length]
    samples.push({
      text: `CEK FAKTA KONTEKS: Beredar video viral dengan klaim mengerikan di TikTok. Faktanya, rekaman tersebut adalah ${ev} yang secara sengaja ${pel} Pembuat konten memotong watermark resmi Dispenad untuk menyesatkan opini publik.`,
      category: 'DISINFORMASI'
    })
  }

  // B. Judul Clickbait Pemutarbalik Fakta (160 sampel)
  const clickbaitTitles = [
    'GEMPAR! Panglima TNI Akui Wilayah Kedaulatan Laut Natuna Utara Resmi Diserahkan ke Negara Tetangga',
    'AKHIRNYA BERSUARA: Jenderal Bintang Empat Nyatakan Tolak Tunduk pada Perintah Menteri Pertahanan',
    'MENGEJUTKAN! Hasil Uji Lab Independen Buktikan Beras Bantuan Pemerintah Mengandung Zat Kimia Beracun',
    'BERITA DUKA: Gudang Amunisi Terbesar Militer Meledak Rata dengan Tanah Akibat Sabotase Spionase Asing',
    'RESMI DIKETUK PALU: Pajak Rakyat Dinaikkan 500 Persen Khusus untuk Membeli Pesawat Mewah Pejabat'
  ]
  for (let i = 0; i < 160; i++) {
    const title = clickbaitTitles[i % clickbaitTitles.length]
    samples.push({
      text: `DISINFORMASI KLIKBAIT: "${title}" - Judul berita daring ini sangat manipulatif dan bertolak belakang 180 derajat dengan isi rilis pers resmi narasumber di dalam artikel. Judul sengaja dipasang bombastis demi mendulang adsense dan menyulut kemarahan warganet.`,
      category: 'DISINFORMASI'
    })
  }

  // C. Manipulasi Kutipan & Dokumen Palsu Berkop Surat (160 sampel)
  const pejabatList = ['KSAD Jenderal TNI', 'Menteri Koordinator Polkam', 'Pangdam Jaya', 'Kapuspen TNI', 'Kepala BMKG']
  for (let i = 0; i < 160; i++) {
    const pej = pejabatList[i % pejabatList.length]
    samples.push({
      text: `MANIPULASI DOKUMEN & KUTIPAN: Beredar selebaran PDF berkop surat rahasia berstempel Garuda yang mengatasnamakan ${pej}. Setelah diverifikasi, format tata naskah dinas militer terbukti palsu, nomor registrasi surat tidak terdaftar, dan tanda tangan digital adalah hasil manipulasi cropping aplikasi Photoshop.`,
      category: 'DISINFORMASI'
    })
  }

  return samples
}

// ─── 5. GENERATOR KOMPONEN NETRAL (Informasi Faktual Resmi) (500+ Sampel) ───
function generateNetralSamples() {
  const samples = []

  // A. Siaran Pers Resmi Dispenad & Puspen TNI (180 sampel)
  const tniEvents = [
    {
      loc: 'Pusat Latihan Tempur Kodiklatad Baturaja Sumatera Selatan',
      units: 'Batalyon Kavaleri Tank Leopard 2RI, Skadron Helikopter Serbu Apache AH-64E, dan Batalyon Artileri Medan Astros II MK6',
      act: 'menggelar Latihan Tempur Antar-Kecabangan Latancab Terpadu guna menguji kesiapan operasional prajurit dan sistem integrasi tembakan senjata modern'
    },
    {
      loc: 'wilayah Kodim 0812/Lamongan Jawa Timur',
      units: 'Prajurit Babinsa bersama kelompok tani gabungan Gapoktan',
      act: 'melaksanakan panen raya padi di lahan percontohan ketahanan pangan seluas 50 hektar dengan hasil panen mencapai 7,2 ton gabah kering panen per hektar'
    },
    {
      loc: 'Kabupaten Alor Nusa Tenggara Timur',
      units: 'Satuan Tugas TNI Manunggal Membangun Desa TMMD ke-122',
      act: 'merampungkan pembangunan jembatan gantung penghubung antardesa dan pipanisasi sarana air bersih bagi 450 kepala keluarga di wilayah terisolir'
    },
    {
      loc: 'Perbatasan Darat RI-PNG sektor utara Kabupaten Keerom Papua',
      units: 'Satgas Pengamanan Perbatasan Yonif 122/Tombak Sakti',
      act: 'menggelar pelayanan pengobatan gratis keliling ke rumah-rumah warga perbatasan dalam rangka mempererat tali persaudaraan kemanunggalan TNI dan rakyat'
    },
    {
      loc: 'Markas Besar Angkatan Darat Mabesad Jakarta Pusat',
      units: 'Inspektorat Jenderal Angkatan Darat Itjenad bersama tim auditor Badan Pemeriksa Keuangan BPK RI',
      act: 'melakukan uji petik pemeriksaan laporan keuangan dan kepatuhan pengadaan alutsista untuk menjamin transparansi serta akuntabilitas anggaran pertahanan negara'
    }
  ]
  for (let i = 0; i < 180; i++) {
    const item = tniEvents[i % tniEvents.length]
    samples.push({
      text: `SIARAN PERS RESMI DISPENAD: Bertempat di ${item.loc}, ${item.units} ${item.act}. Pimpinan TNI AD menegaskan komitmen seluruh prajurit untuk senantiasa hadir membantu kesulitan rakyat dan menjaga kedaulatan Negara Kesatuan Republik Indonesia secara profesional serta berintegritas tinggi.`,
      category: 'NETRAL'
    })
  }

  // B. Rilis Edukasi & Pemantauan Ilmiah BMKG (160 sampel)
  const bmkgReports = [
    'Hasil monitoring jaringan sensor seismograf BMKG mendeteksi aktivitas gempa tektonik magnitudo 4.2 kedalaman 15 km, tidak berpotensi menimbulkan tsunami.',
    'BMKG mengimbau masyarakat pesisir untuk tetap tenang dan waspada terhadap potensi gelombang pasang air laut akibat fenomena fase bulan purnama (supermoon).',
    'Kepala Pusat Gempa Bumi dan Tsunami BMKG menegaskan bahwa hingga saat ini belum ada teknologi di dunia yang mampu memprediksi waktu kejadian gempa bumi secara presisi hari dan jamnya.',
    'Prakiraan cuaca maritim mingguan BMKG memproyeksikan kondisi perairan Selat Sunda dan Laut Jawa dalam kategori aman untuk aktivitas pelayaran kapal niaga dan nelayan tradisional.',
    'Edukasi mitigasi bencana: BMKG bersama BPBD rutin menyelenggarakan simulasi evakuasi mandiri gempa bumi bagi para pelajar sekolah dasar di zona rawan gempa tektonik.'
  ]
  for (let i = 0; i < 160; i++) {
    const rep = bmkgReports[i % bmkgReports.length]
    samples.push({
      text: `INFORMASI RESMI BMKG: ${rep} Masyarakat diminta hanya merujuk pada kanal komunikasi resmi aplikasi InfoBMKG dan media sosial terverifikasi BMKG. Hindari mempercayai ramalan bencana yang tidak memiliki dasar kajian ilmiah geofisika.`,
      category: 'NETRAL'
    })
  }

  // C. Rilis Kebijakan Publik Kemhan, BPOM, & Bapanas (160 sampel)
  const bapanasReports = [
    'Badan Pangan Nasional Bapanas bersama Perum Bulog memastikan ketersediaan cadangan beras pemerintah (CBP) di seluruh gudang logistik regional dalam kondisi surplus aman.',
    'Badan Pengawas Obat dan Makanan BPOM RI merilis hasil uji laboratorium forensik terhadap sampel beras di pasar tradisional, menyatakan 100% negatif dari polimer plastik.',
    'Kementerian Pertahanan RI menggelar seminar nasional industri pertahanan mandiri yang melibatkan PT Pindad, PT Dirgantara Indonesia, dan PT PAL untuk memperkuat alutsista karya anak bangsa.',
    'Kementerian Komunikasi dan Digital bersama Gugus Tugas Siber Anti-Hoaks mencatat penurunan tren peredaran disinformasi publik berkat tingginya literasi digital masyarakat binaan Babinsa.',
    'Badan Amil Zakat Nasional dan instansi sosial menyalurkan bantuan beasiswa pendidikan bagi ribuan putra-putri prajurit berprestasi di wilayah perbatasan nusantara.'
  ]
  for (let i = 0; i < 160; i++) {
    const rep = bapanasReports[i % bapanasReports.length]
    samples.push({
      text: `RILIS PERS KEMENTERIAN / LEMBAGA: ${rep} Pemerintah mengajak seluruh elemen masyarakat untuk terus memperkuat sinergi gotong royong dan menjaga stabilitas keamanan nasional demi kelancaran pembangunan kesejahteraan rakyat.`,
      category: 'NETRAL'
    })
  }

  return samples
}

// ─── EKSEKUSI PEMBUATAN FILE KORPUS ───
console.log('Memulai generasi korpus leksikal 2.500+ sampel...')
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
