import { redirect } from "next/navigation";

/** Login admin & anggota memakai satu halaman: /masuk. */
export default function AdminLoginRedirect() {
  redirect("/masuk");
}
