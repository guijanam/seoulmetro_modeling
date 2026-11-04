/** @type {import('next').NextConfig} */
const nextConfig = {
  // 같은 Wi-Fi의 다른 기기(휴대폰 등)에서 개발 서버에 접속할 때 HMR 허용. 개발 모드에서만 적용됨.
  allowedDevOrigins: ['192.168.1.161', '192.168.*.*'],
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
