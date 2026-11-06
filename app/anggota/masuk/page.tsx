import { redirect } from "next/navigation";

/** Login admin & anggota memakai satu halaman: /masuk. */
export default function AnggotaMasukRedirect() {
  redirect("/masuk");
}
