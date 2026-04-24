/** @type {import('next').NextConfig} */
const nextConfig = {
  // Docker 배포를 위한 standalone 출력 (이미지 크기 ~50MB로 경량화)
  output: "standalone"
};

export default nextConfig;
