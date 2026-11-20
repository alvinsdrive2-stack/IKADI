/**
 * Satu-satunya penentu halaman mana yang wajib dibuka peserta.
 *
 * Dua kewajiban bisa aktif bersamaan: profil belum lengkap (peserta impor) dan
 * sandi masih sandi sementara. Kalau masing-masing diperiksa terpisah, keduanya
 * saling lempar dan kedua halaman ikut tampil — itu bug tumpang tindih modal.
 * Karena itu prioritasnya ditetapkan di satu tempat.
 *
 * Pelengkapan profil didahulukan: formnya sekalian membuat sandi baru, jadi
 * kewajiban ganti sandi selesai di jalur yang sama.
 */
export type AnggotaGate = "/anggota/lengkapi" | "/anggota/ganti-sandi" | null;

export function resolveAnggotaGate(input: {
  needsProfileCompletion: boolean;
  mustChangePassword: boolean;
  pathname: string;
}): AnggotaGate {
  const onProfilePage = input.pathname.startsWith("/anggota/lengkapi");
  const onPasswordPage = input.pathname.startsWith("/anggota/ganti-sandi");

  if (input.needsProfileCompletion) {
    return onProfilePage ? null : "/anggota/lengkapi";
  }
  if (input.mustChangePassword) {
    return onPasswordPage ? null : "/anggota/ganti-sandi";
  }
  return null;
}
