import { redirect } from "next/navigation";

// 레거시 /dev2 루트 — 로그인 페이지로 안내
export default function Dev2LegacyHome() {
  redirect("/dev2/login");
}
