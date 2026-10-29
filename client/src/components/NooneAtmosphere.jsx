import { useEffect, useRef, useState } from 'react';
import { animate, stagger } from 'animejs';
import './NooneAtmosphere.css';
export function NooneAtmosphere() {
  const containerRef = useRef(null), canvasRef = useRef(null), videoRef = useRef(null);
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [paused, setPaused] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const still = reduced || paused;
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (reduced) return;
    const landing = containerRef.current?.parentElement;
    const animation = animate(landing.querySelectorAll('.hero > *, .setup-card'), {
      opacity: [0, 1], translateY: [22, 0], duration: 950, delay: stagger(110), ease: 'out(3)',
    });
    return () => animation.revert();
  }, [reduced]);
  useEffect(() => {
    const container = containerRef.current, canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let width = 0, height = 0, stars = [], frame = 0, time = 0, previous = 0, visible = false;
    const target = { x: .5, y: .5 }, mouse = { x: .5, y: .5 };
    const colors = ['rgba(0, 163, 255, 0.4)', 'rgba(0, 102, 255, 0.2)', 'rgba(0, 255, 255, 0.15)', 'rgba(94, 234, 212, 0.1)'];
    function draw(ts = 0) {
      const delta = previous ? Math.min((ts - previous) / 16.667, 3) : 1;
      previous = ts;
      if (!still) time += .005 * delta;
      mouse.x += (target.x - mouse.x) * .05; mouse.y += (target.y - mouse.y) * .05;
      ctx.clearRect(0, 0, width, height);
      ctx.save(); ctx.translate((mouse.x-.5)*20, (mouse.y-.5)*20);
      for (const star of stars) {
        if (!still) star.y -= star.speed * delta;
        if (star.y < 0) star.y = height;
        ctx.fillStyle = `rgba(255,255,255,${star.opacity * (Math.sin(time*2+star.x)*.3+.7)})`;
        ctx.beginPath(); ctx.arc(star.x, star.y, star.size, 0, Math.PI*2); ctx.fill();
      }
      ctx.restore();
      colors.forEach((color,i) => {
        ctx.save(); ctx.translate((mouse.x-.5)*8*(i+1),(mouse.y-.5)*15*(i+1));
        ctx.shadowBlur = 10+i*4; ctx.shadowColor = color; ctx.strokeStyle = color; ctx.lineWidth = 1.8-i*.25; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        const points = Array.from({length:17},(_,n) => { const x = width*n/16; return [x,height*.88+i*12+((x-width/2)/(width/2))**2*-35+Math.sin(time*2+x*.004+i*.5)*12]; });
        ctx.beginPath(); ctx.moveTo(...points[0]);
        for(let n=1;n<points.length;n++) { const a=points[n-1],b=points[n]; ctx.quadraticCurveTo(a[0],a[1],(a[0]+b[0])/2,(a[1]+b[1])/2); }
        ctx.lineTo(...points.at(-1)); ctx.stroke(); ctx.restore();
      });
      if (!still && visible && !document.hidden) frame = requestAnimationFrame(draw);
    }
    function sync() {
      cancelAnimationFrame(frame); previous = 0;
      if (visible && !document.hidden) { draw(); if (!still) videoRef.current?.play().catch(() => {}); }
      if (still || !visible || document.hidden) videoRef.current?.pause();
    }
    const resize = new ResizeObserver(() => {
      width = container.clientWidth; height = container.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width*dpr; canvas.height = height*dpr; ctx.setTransform(dpr,0,0,dpr,0,0);
      stars = Array.from({length:150},() => ({x:Math.random()*width,y:Math.random()*height,size:Math.random()*1.2,speed:Math.random()*.15+.05,opacity:Math.random()*.5+.2}));
      sync();
    });
    const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); });
    const move = e => { if (!still) { target.x=e.clientX/window.innerWidth; target.y=e.clientY/window.innerHeight; } };
    resize.observe(container); observer.observe(container);
    window.addEventListener('mousemove',move,{passive:true}); document.addEventListener('visibilitychange',sync);
    return () => { cancelAnimationFrame(frame); resize.disconnect(); observer.disconnect(); window.removeEventListener('mousemove',move); document.removeEventListener('visibilitychange',sync); videoRef.current?.pause(); };
  }, [still]);
  return <div className="noone-atmosphere" ref={containerRef}>
    {!videoFailed && <video ref={videoRef} autoPlay={!still} muted loop playsInline preload="none" onError={() => setVideoFailed(true)} aria-hidden="true" src="https://cdn.jiro.build/Velara/rounded%20video.mp4" />}
    <canvas ref={canvasRef} aria-hidden="true" />
    <div className="noone-atmosphere-shade" aria-hidden="true" />
    <button type="button" className="noone-motion-toggle" aria-pressed={paused} onClick={() => setPaused(v => !v)}>{paused ? 'Эффект асаах' : 'Эффект түр зогсоох'}</button>
  </div>;
}
