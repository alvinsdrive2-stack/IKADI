/**
 * Ekspor massal KTA: PDF satu peserta per file, atau JPG per sisi kartu.
 * Semua hasil dibungkus satu ZIP.
 *
 * Pekerjaan berjalan di latar belakang proses (peta di memori) supaya UI bisa
 * menampilkan progres; hasil akhir diambil lewat job id. Proses PM2 tunggal,
 * jadi peta ini cukup, tidak perlu tabel job.
 */
import { zip } from "fflate";
import { prisma } from "@/lib/prisma";
import { LEVEL_LABELS } from "@/lib/member-number";
import { renderCardJpeg, type CardInput } from "@/lib/kta-render";
import { buildParticipantPdf } from "@/lib/kta-pdf";

export type BulkKind = "pdf" | "jpg";

/**
 * Batas jumlah peserta per pekerjaan. Render kartu memakai memori sebanding
 * jumlah gambar di ZIP, jadi ribuan kartu sekaligus bisa mematikan proses.
 */
export const BULK_MAX = 500;

type FileItem = { name: string; data: Buffer };

export type BulkJob = {
  id: string;
  kind: BulkKind;
  status: "running" | "done" | "failed";
  total: number;
  done: number;
  /** Nomor/nama peserta yang dilewati, dengan alasan. */
  skipped: { label: string; reason: string }[];
  /** true = peserta melebihi BULK_MAX, sisa dilewati. */
  truncated: boolean;
  message?: string;
  file?: { name: string; data: Buffer };
  createdAt: number;
};

/**
 * Peta job disimpan di `globalThis`, bukan variabel modul: Turbopack memuat
 * modul yang sama sebagai instance terpisah untuk tiap route, sehingga peta
 * per-modul membuat route status/unduhan tidak menemukan job yang dibuat
 * route lain. Pola ini sama dengan singleton Prisma.
 */
const globalForBulk = globalThis as unknown as { __ktaBulkJobs?: Map<string, BulkJob> };
const jobs: Map<string, BulkJob> = (globalForBulk.__ktaBulkJobs ??= new Map());
const JOB_TTL_MS = 30 * 60_000;

function sweep() {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (now - job.createdAt > JOB_TTL_MS) jobs.delete(id);
  }
}

export function getBulkJob(id: string): BulkJob | undefined {
  sweep();
  return jobs.get(id);
}

/** Nama file aman: buang karakter yang tidak boleh ada di filesystem/ZIP. */
function safe(value: string): string {
  return value
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

async function loadCard(participantId: bigint, request: Request): Promise<CardInput | string> {
  const p = await prisma.participant.findUnique({
    where: { id: participantId },
    select: {
      fullName: true,
      levelCode: true,
      provinceCode: true,
      regencyCode: true,
      memberNumber: true,
      photoPath: true,
    },
  });
  if (!p) return "Peserta tidak ditemukan";
  if (!p.memberNumber) return "Nomor anggota belum terbit";
  if (!p.provinceCode || !p.regencyCode) return "Wilayah belum lengkap";

  const [prov, reg] = await Promise.all([
    prisma.province.findUnique({ where: { code: p.provinceCode }, select: { name: true } }),
    prisma.regency.findUnique({
      where: { provinceCode_code: { provinceCode: p.provinceCode, code: p.regencyCode } },
      select: { name: true },
    }),
  ]);

  return {
    memberNumber: p.memberNumber,
    fullName: p.fullName,
    levelLabel: LEVEL_LABELS[p.levelCode] ?? "Anggota",
    provinceName: prov?.name ?? null,
    regencyName: reg?.name ?? null,
    photoPath: p.photoPath,
    request,
  };
}

function zipFiles(files: FileItem[]): Promise<Buffer> {
  const input: Record<string, Uint8Array> = {};
  for (const f of files) input[f.name] = new Uint8Array(f.data);
  return new Promise((resolve, reject) => {
    zip(input, { level: 0 }, (err, data) => {
      if (err) reject(err);
      else resolve(Buffer.from(data));
    });
  });
}

async function run(job: BulkJob, ids: string[], request: Request) {
  const files: FileItem[] = [];
  const limited = ids.slice(0, BULK_MAX);
  if (ids.length > BULK_MAX) {
    job.truncated = true;
    job.total = limited.length;
  }
  try {
    for (const raw of limited) {
      const id = BigInt(raw);
      const card = await loadCard(id, request);
      if (typeof card === "string") {
        job.skipped.push({ label: `#${raw}`, reason: card });
        job.done++;
        continue;
      }
      const nomor = card.memberNumber.replace(/\./g, "");
      const nama = safe(card.fullName);

      if (job.kind === "pdf") {
        const front = await renderCardJpeg(card, "depan");
        const back = await renderCardJpeg(card, "belakang");
        files.push({ name: `${nomor}-${nama}.pdf`, data: buildParticipantPdf(front, back) });
      } else {
        files.push({ name: `${nomor}-${nama}-depan.jpg`, data: await renderCardJpeg(card, "depan") });
        files.push({ name: `${nomor}-${nama}-belakang.jpg`, data: await renderCardJpeg(card, "belakang") });
      }
      job.done++;
    }

    if (files.length === 0) {
      job.status = "failed";
      job.message = "Tidak ada kartu yang bisa diekspor. Pastikan nomor anggota sudah terbit.";
      return;
    }

    const stamp = new Date().toISOString().slice(0, 10);
    job.file = {
      name: `kta-${job.kind}-${stamp}.zip`,
      data: await zipFiles(files),
    };
    job.status = "done";
  } catch (err) {
    job.status = "failed";
    job.message = err instanceof Error ? err.message : "Ekspor gagal";
  }
}

/** Mulai pekerjaan ekspor; langsung kembali dengan job untuk polling progres. */
export function startBulkJob(ids: string[], kind: BulkKind, request: Request): BulkJob {
  sweep();
  const job: BulkJob = {
    id: crypto.randomUUID(),
    kind,
    status: "running",
    total: Math.min(ids.length, BULK_MAX),
    done: 0,
    skipped: [],
    truncated: ids.length > BULK_MAX,
    createdAt: Date.now(),
  };
  jobs.set(job.id, job);
  void run(job, ids, request);
  return job;
}

/** Ringkasan aman untuk JSON (tanpa buffer). */
export function publicJob(job: BulkJob) {
  return {
    id: job.id,
    kind: job.kind,
    status: job.status,
    total: job.total,
    done: job.done,
    skipped: job.skipped,
    truncated: job.truncated,
    message: job.message ?? null,
    fileName: job.file?.name ?? null,
  };
}
