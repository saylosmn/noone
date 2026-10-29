import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import './VelaraCinematicHero.css';

export function VelaraCinematicHero() {
  const containerRef = useRef(null), canvasRef = useRef(null), videoRef = useRef(null);
  const reduced = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const still = reduced || paused;
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
  const enter = () => { const setup = document.querySelector('.setup-card'); setup?.scrollIntoView({behavior:reduced?'instant':'smooth',block:'center'}); setup?.querySelector('button')?.focus({preventScroll:true}); };
  const fade = delay => ({ initial: reduced ? false : {opacity:0,y:30}, whileInView:{opacity:1,y:0}, viewport:{once:true,amount:.3}, transition:{delay:reduced?0:delay,duration:reduced?0:1,ease:'easeOut'} });
  return <section className="velara-cinematic" aria-label="Velara AI — Create better content with AI in minutes">
    <div className="velara-scene" ref={containerRef}>
      {!videoFailed && <video ref={videoRef} className="velara-video" autoPlay={!still} muted loop playsInline preload="none" onError={() => setVideoFailed(true)} aria-hidden="true" src="https://cdn.jiro.build/Velara/rounded%20video.mp4" />}
      <canvas ref={canvasRef} className="velara-canvas" aria-hidden="true" />
      <nav className="velara-nav" aria-label="Velara navigation">
        <a className="velara-pill velara-logo" href="#velara-headline"><span className="velara-mark" aria-hidden="true">✦</span> VELARA AI</a>
        <div className="velara-pill velara-links"><a href="#velara-headline">Features</a><a href="#velara-description">Solutions</a><a href="#velara-cta">Pricing</a><a href="#velara-headline">Company</a></div>
        <div className="velara-pill velara-account"><button className="velara-login" onClick={enter}>Log In</button><button className="velara-start" onClick={enter}>Get Started</button></div>
      </nav>
      <div className="velara-orbit" aria-hidden="true" />
      <div className="velara-content"><div className="velara-copy">
        <motion.h2 id="velara-headline" {...fade(.2)}>Create better content<br />with AI in minutes</motion.h2>
        <motion.p id="velara-description" {...fade(.4)}>Take control of your money with smarter insights. Track spending, manage subscriptions, and reach your financial goals effortlessly.</motion.p>
        <motion.div className="velara-cta-row" {...fade(.6)}><button id="velara-cta" className="velara-cta" onClick={enter}>Try It Free <ArrowRight size={20} aria-hidden="true" /></button></motion.div>
      </div></div>
      <div className="velara-horizon" aria-hidden="true" />
      <button className="velara-motion" aria-pressed={paused} onClick={() => setPaused(v => !v)}>{paused ? 'Resume motion' : 'Pause motion'}</button>
    </div>
  </section>;
}
