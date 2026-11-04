'use client';

import { useEffect, useRef, useState } from 'react';

const VIEWS = [
  { id: 'overview', label: '전체' },
  { id: 'front', label: '정면' },
  { id: 'side', label: '측면' },
  { id: 'bogie', label: '대차' },
  { id: 'roof', label: '지붕' },
  { id: 'interior', label: '실내' },
];

export default function TrainApp() {
  const mountRef = useRef(null);
  const viewerRef = useRef(null);
  const speedRef = useRef(null);
  const odoRef = useRef(null);
  const tipRef = useRef(null);
  const toastTimer = useRef(0);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [state, setState] = useState({ running: false, doorsOpen: false, pantoUp: true, night: false, cars: 10, length: 0 });
  const [view, setView] = useState('overview');
  const [kmh, setKmh] = useState(60);
  const [carsInput, setCarsInput] = useState(10);
  const [toast, setToast] = useState('');
  const [panelOpen, setPanelOpen] = useState(true);

  useEffect(() => {
    let disposed = false;
    let viewer;
    import('@/lib/viewer')
      .then(({ createViewer }) => {
        if (disposed) return;
        viewer = createViewer({
          container: mountRef.current,
          onState: (s) => {
            if (s.view) setView(s.view);
            else { setState(s); setCarsInput(s.cars); }
          },
          onToast: (msg) => {
            setToast(msg);
            clearTimeout(toastTimer.current);
            toastTimer.current = setTimeout(() => setToast(''), 2200);
          },
          onHud: ({ kmh: v, km }) => {
            if (speedRef.current) speedRef.current.textContent = v.toFixed(0);
            if (odoRef.current) odoRef.current.textContent = km.toFixed(2);
          },
          onTip: (tip) => {
            const el = tipRef.current;
            if (!el) return;
            if (!tip) { el.classList.remove('show'); return; }
            el.firstChild.textContent = tip.label;
            el.lastChild.textContent = tip.car;
            el.style.transform = `translate(${tip.x + 14}px, ${tip.y + 14}px)`;
            el.classList.add('show');
          },
        });
        viewerRef.current = viewer;
        requestAnimationFrame(() => !disposed && setReady(true));
      })
      .catch((e) => setError(e?.message || String(e)));
    return () => {
      disposed = true;
      clearTimeout(toastTimer.current);
      viewer?.dispose();
      viewerRef.current = null;
    };
  }, []);

  const v = () => viewerRef.current;
  const pickView = (id) => { setView(id); v()?.view(id); };

  return (
    <>
      <div ref={mountRef} className="viewport" />

      <header className="card title">
        <div className="badge">2</div>
        <div>
          <h1>서울 지하철 2호선 전동차</h1>
          <p>절차적 3D 모델 · 드래그로 회전, 휠로 확대, 부품에 마우스를 올려보세요</p>
        </div>
      </header>

      <aside className={`card panel${panelOpen ? '' : ' collapsed'}`}>
        <button className="panel-toggle" onClick={() => setPanelOpen((o) => !o)}>
          {panelOpen ? '조작 패널 접기' : '조작 패널 열기'}
        </button>
        <div className="panel-body">
          <div className="gauge">
            <div><span ref={speedRef}>0</span><small>km/h</small></div>
            <div className="odo">주행 거리 <b ref={odoRef}>0.00</b> km</div>
          </div>

          <section>
            <h2>운행</h2>
            <div className="row">
              <button className={`primary${state.running ? ' on' : ''}`} onClick={() => v()?.toggleRun()}>
                {state.running ? '정지' : '출발'}
              </button>
              <button className={state.doorsOpen ? 'on' : ''} onClick={() => v()?.toggleDoors()}>
                {state.doorsOpen ? '출입문 닫기' : '출입문 열기'}
              </button>
            </div>
            <label htmlFor="speed">목표 속도 <output>{kmh} km/h</output></label>
            <input id="speed" type="range" min="10" max="100" step="5" value={kmh}
              onChange={(e) => { const n = +e.target.value; setKmh(n); v()?.setSpeed(n); }} />
            <button className="wide" onClick={() => v()?.togglePanto()}>
              {state.pantoUp ? '팬터그래프 내리기' : '팬터그래프 올리기'}
            </button>
          </section>

          <section>
            <h2>편성</h2>
            <label htmlFor="cars">차량 수 <output>{carsInput}량</output></label>
            <input id="cars" type="range" min="2" max="10" step="1" value={carsInput}
              onChange={(e) => {
                const n = +e.target.value;
                if (v()?.setCars(n)) setCarsInput(n);
              }} />
            <div className="meta">편성 길이 <b>{state.length ? `${state.length.toFixed(1)} m` : '–'}</b></div>
          </section>

          <section>
            <h2>환경 · 내보내기</h2>
            <div className="row">
              <button className={state.night ? 'on' : ''} onClick={() => v()?.toggleNight()}>
                {state.night ? '주간 모드' : '야간 모드'}
              </button>
              <button onClick={() => v()?.exportGLB()}>GLB 내보내기</button>
            </div>
          </section>

          <details className="specs">
            <summary>제원 (모델 기준)</summary>
            <dl>
              <dt>차체</dt><dd>스테인리스, 길이 19.5 m · 폭 3.12 m</dd>
              <dt>출입문</dt><dd>편측 4개, 양개식 (폭 1.3 m)</dd>
              <dt>궤간</dt><dd>1,435 mm (표준궤)</dd>
              <dt>전기 방식</dt><dd>DC 1,500 V 가공 전차선</dd>
              <dt>편성</dt><dd>10량 (2~10량 조절 가능)</dd>
            </dl>
          </details>

          <p className="keys">
            <kbd>Space</kbd> 출발/정지 <kbd>D</kbd> 출입문 <kbd>P</kbd> 팬터그래프 <kbd>N</kbd> 야간 <kbd>1–6</kbd> 시점
          </p>
        </div>
      </aside>

      <nav className="card views">
        {VIEWS.map((x) => (
          <button key={x.id} className={view === x.id ? 'active' : ''} onClick={() => pickView(x.id)}>{x.label}</button>
        ))}
      </nav>

      <div ref={tipRef} className="tip"><b /><span /></div>
      <div className={`toast${toast ? ' show' : ''}`}>{toast}</div>
      <div className={`loading${ready ? ' hide' : ''}`}>
        {error ? <>3D 화면을 불러오지 못했어요<small>{error}</small></> : <><div className="spinner" />모델 생성 중…</>}
      </div>
    </>
  );
}
