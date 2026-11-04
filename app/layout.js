import './globals.css';

export const metadata = {
  title: '2호선 3D 모델러',
  description: '서울 지하철 2호선 전동차를 브라우저에서 돌려보고, 문을 열고, 달려볼 수 있는 절차적 3D 모델',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0d1114',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
