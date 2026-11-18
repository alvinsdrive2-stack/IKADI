-- Serial nomor anggota berjalan per wilayah + tahun, bukan per level.
-- Level tetap jadi digit pertama nomor, tapi tidak boleh memecah seri: kalau
-- peserta naik level, nomor berikutnya harus lanjut dari serial wilayah itu.
ALTER TABLE `member_number_sequences`
  DROP INDEX `uq_member_number_sequence`,
  ADD UNIQUE INDEX `uq_member_number_sequence` (`province_code`, `regency_code`, `year`);

-- `level_code` sudah tidak dipakai untuk penerbitan; dibiarkan ada supaya
-- riwayat baris lama tidak hilang, tapi tidak lagi wajib diisi.
ALTER TABLE `member_number_sequences`
  MODIFY `level_code` TINYINT NULL;
