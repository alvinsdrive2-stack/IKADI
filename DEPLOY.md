# Deploy ke server (PM2)

Asumsi: Ubuntu/Debian server, Node.js 22, MySQL/MariaDB sudah terpasang.
Ganti `ikadi` di contoh path dengan lokasi yang kamu pakai.

## 1. Prasyarat

Cek versi Node:

```bash
node -v    # harus 22.x
```

Belum ada Node? Pasang lewat nvm (tidak perlu sudo):

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 22
```

Cek database sudah hidup:

```bash
mysql -u root -p -e "SELECT VERSION();"
```

## 2. Ambil kode

```bash
cd /var/www            # atau ~/apps
git clone https://github.com/alvinsdrive2-stack/IKADI.git ikadi
cd ikadi
```

## 3. Install dependency

```bash
npm ci --omit=dev
```

`postinstall` menjalankan `prisma generate`. Butuh `devDependencies` untuk build
Next.js, jadi pakai:

```bash
npm ci
npm run build
npm prune --omit=dev
```

## 4. Isi konfigurasi

Buat `.env.local`:

```bash
nano .env.local
```

Isi:

```
DATABASE_URL="mysql://ikadi_app:PASSWORD_KUAT@127.0.0.1:3306/ikadi"
SESSION_SECRET="hasil-dari-perintah-di-bawah"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="PASSWORD_ADMIN_KUAT"
NODE_ENV="production"
```

Buat `SESSION_SECRET` (minimal 32 karakter):

```bash
openssl rand -base64 48
```

Kunci file-nya:

```bash
chmod 600 .env.local
```

Jangan commit file ini. Sudah masuk `.gitignore`.

## 5. Siapkan database

Buat user MySQL khusus aplikasi (jangan pakai root):

```sql
mysql -u root -p
CREATE USER 'ikadi_app'@'localhost' IDENTIFIED BY 'PASSWORD_KUAT';
CREATE DATABASE ikadi CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON ikadi.* TO 'ikadi_app'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

Jalankan migration:

```bash
npx prisma migrate deploy
```

Buat akun admin:

```bash
npm run db:seed
```

## 6. Build

```bash
npm run build
```

Harus muncul `✓ Compiled successfully`. Kalau gagal, cek `DATABASE_URL` dan `.env.local`.

## 7. Pasang PM2 tanpa sudo

```bash
npm i -g pm2 --prefix ~/.local
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
pm2 -v
```

## 8. Jalankan aplikasi

```bash
pm2 start npm --name ikadi -- start
pm2 save
```

Cek:

```bash
pm2 status
pm2 logs ikadi --lines 50
curl -I http://127.0.0.1:3000
```

Harus balas `200` atau `307`.

Buka port kalau perlu:

```bash
sudo ufw allow 3000/tcp
```

## 9. Autostart saat reboot

Butuh sudo sekali saja:

```bash
sudo env PATH=$PATH:/home/$USER/.local/bin pm2 startup systemd -u $USER --hp $HOME
```

Perintah itu mencetak satu baris `sudo env ...`. Jalankan persis seperti yang dicetak, lalu:

```bash
pm2 save
```

Tanpa autostart: aplikasi tetap jalan sampai server reboot, lalu jalankan `pm2 start ikadi` manual.

## 10. Reverse proxy + HTTPS

Port 80/443 butuh sudo. Caddy paling singkat:

```bash
sudo apt install caddy
sudo nano /etc/caddy/Caddyfile
```

Isi:

```
kta.domainkamu.id {
    reverse_proxy 127.0.0.1:3000
}
```

```bash
sudo systemctl reload caddy
```

Caddy mengurus sertifikat HTTPS otomatis. Karena `NODE_ENV=production`, cookie sesi
otomatis `Secure` dan hanya dikirim lewat HTTPS.

## 11. Update rilis berikutnya

```bash
cd /var/www/ikadi
git pull
npm ci
npm run build
npx prisma migrate deploy
pm2 restart ikadi
```

## 12. Backup

```bash
mysqldump -u ikadi_app -p ikadi > ~/backup-ikadi-$(date +%F).sql
```

Tambahkan ke crontab:

```bash
crontab -e
```

```
0 2 * * * mysqldump -u ikadi_app -pPASSWORD_KUAT ikadi | gzip > ~/backup-ikadi-$(date +\%F).sql.gz
```

## Perintah harian

| Kebutuhan | Perintah |
|---|---|
| Lihat status | `pm2 status` |
| Lihat log | `pm2 logs ikadi` |
| Restart | `pm2 restart ikadi` |
| Stop | `pm2 stop ikadi` |
| Hapus dari PM2 | `pm2 delete ikadi` |
| Info detail | `pm2 show ikadi` |

## Kalau bermasalah

**`DATABASE_URL belum diatur`** — `.env.local` tidak terbaca. Pastikan file ada di root
proyek dan `pm2` dijalankan dari folder yang sama.

**`PrismaClientInitializationError`** — user MySQL salah, password salah, atau database
belum dibuat. Tes manual: `mysql -u ikadi_app -p ikadi -e "SHOW TABLES;"`.

**Login selalu gagal** — admin belum di-seed. Jalankan `npm run db:seed`.

**Cookie tidak tersimpan** — akses lewat HTTPS. Dengan `NODE_ENV=production` cookie
bertanda `Secure`, jadi tidak dikirim lewat HTTP biasa.

**`/admin` balik ke login terus** — `SESSION_SECRET` berubah setelah sesi dibuat.
Login ulang.
