import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FiArrowUpRight, FiFileText, FiBookOpen, FiCheckCircle, FiMessageCircle,
} from 'react-icons/fi';
import { C } from '../../theme/tokens';
import Card from './Card';
import Avatar, { initialsFrom } from './Avatar';

// Static marketing content — the user said they'll update the actual copy
// later. Keep the data here so a single edit retunes the whole row.
const FEATURED_POST = {
  tag: 'Study Tips',
  title: 'How to write a thesis statement that lands an A',
  excerpt: 'A practical, three-step framework that works for any subject — with worked examples from real student papers.',
  date: 'Apr 8',
  read: '4 min read',
};

const OTHER_POSTS = [
  { tag: 'Math',   title: 'Calculus survival kit for finals week',    date: 'Apr 2',  read: '6 min' },
  { tag: 'Habits', title: 'Beat procrastination with 5 simple hacks', date: 'Mar 28', read: '5 min' },
];

const TESTIMONIALS = [
  {
    name: 'Priya R.', school: 'University of Texas · Spring 2025',
    stars: 5, photo: 'https://i.pravatar.cc/120?img=47',
    quote: 'Got an A on my history paper. The tutor was quick, thorough, and explained every revision in plain English.',
  },
  {
    name: 'Marcus L.', school: 'NYU · Fall 2024',
    stars: 5, photo: 'https://i.pravatar.cc/120?img=14',
    quote: 'Saved my finals week. Calculus tutor walked me through every concept until it actually clicked. Felt like 1-on-1 mentoring.',
  },
  {
    name: 'Aisha K.', school: 'UCLA · Spring 2025',
    stars: 5, photo: 'https://i.pravatar.cc/120?img=45',
    quote: 'Used the writing service for my thesis statement. The revisions were detailed and the turnaround was under 24 hours.',
  },
];

const SERVICES = [
  { icon: FiFileText,      label: 'Essay Writing',  hue: C.accent,     bg: C.accentSoft,  service: 'essay' },
  { icon: FiBookOpen,      label: 'Online Classes', hue: C.green,      bg: C.greenSoft,   service: 'online-class' },
  { icon: FiCheckCircle,   label: 'Quiz & Exam',    hue: C.orangeText, bg: C.orangeSoft,  service: 'quiz' },
  { icon: FiMessageCircle, label: 'Tutoring',       hue: C.purple,     bg: C.purpleSoft,  service: 'tutoring' },
];

export default function MarketingRow() {
  const [slide, setSlide] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSlide(s => (s + 1) % TESTIMONIALS.length), 5000);
    return () => clearInterval(id);
  }, []);
  const t = TESTIMONIALS[slide];

  return (
    <div className="v2-mkt-grid" style={{ marginTop: 28, display: 'grid', gridTemplateColumns: '1.7fr 1fr', gap: 14, alignItems: 'stretch' }}>
      {/* ── LEFT: Blog magazine — flex column so the posts list absorbs any
          leftover height and both columns end on the same line ── */}
      <Card padding={0} style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div className="v2-marketing-hero" style={{
          position: 'relative', minHeight: 180, padding: 22,
          background: 'linear-gradient(135deg, #1e3a8a 0%, #6366f1 55%, #ec4899 100%)',
          color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        }}>
          <div style={{
            position: 'absolute', top: 16, left: 16,
            fontSize: 10, fontWeight: 800, padding: '4px 10px', borderRadius: 999,
            background: 'rgba(255,255,255,0.2)', letterSpacing: 0.6, backdropFilter: 'blur(6px)',
          }}>
            FEATURED · {FEATURED_POST.tag.toUpperCase()}
          </div>
          <div style={{
            position: 'absolute', top: 16, right: 16,
            fontSize: 10, fontWeight: 600, opacity: 0.85, letterSpacing: 0.3,
          }}>
            FROM THE BLOG
          </div>

          <div className="v2-marketing-hero-title" style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.25, marginBottom: 8, maxWidth: '85%' }}>
            {FEATURED_POST.title}
          </div>
          <div className="v2-marketing-hero-excerpt" style={{ fontSize: 13, opacity: 0.92, lineHeight: 1.55, maxWidth: '85%', marginBottom: 14 }}>
            {FEATURED_POST.excerpt}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 11, fontWeight: 600, flexWrap: 'wrap' }}>
            <span style={{ opacity: 0.9 }}>{FEATURED_POST.date} · {FEATURED_POST.read}</span>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '6px 12px', background: 'rgba(255,255,255,0.18)',
              borderRadius: 999, backdropFilter: 'blur(6px)',
            }}>
              Read article <FiArrowUpRight size={12} />
            </span>
          </div>
        </div>

        {/* More posts list — rows flex-grow so extra height distributes
            evenly instead of pooling as a blank strip at the bottom */}
        <div style={{ padding: '6px 18px 12px', flex: 1, display: 'flex', flexDirection: 'column' }}>
          {OTHER_POSTS.map((p, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 0', flex: 1,
              borderBottom: i < OTHER_POSTS.length - 1 ? `1px solid ${C.border}` : 'none',
            }}>
              <span style={{
                fontSize: 9, fontWeight: 800, padding: '3px 8px', borderRadius: 4,
                background: '#eef2f7', color: C.textSecondary, letterSpacing: 0.4, flexShrink: 0,
              }}>
                {p.tag.toUpperCase()}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {p.title}
                </div>
                <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>{p.date} · {p.read}</div>
              </div>
              <FiArrowUpRight size={14} color={C.textMuted} />
            </div>
          ))}
        </div>
      </Card>

      {/* ── RIGHT: Featured testimonial slider + Services strip ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Dark featured testimonial */}
        <div style={{
          position: 'relative', background: C.darkSurface, color: '#fff',
          borderRadius: C.radiusLg, padding: '22px 20px', overflow: 'hidden',
        }}>
          {/* Decorative quote mark */}
          <div aria-hidden style={{
            position: 'absolute', top: -8, right: 14,
            fontSize: 100, lineHeight: 1, color: 'rgba(255,255,255,0.06)',
            fontFamily: 'serif', fontWeight: 800,
          }}>"</div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, color: C.darkAccent }}>STUDENT VOICE</div>
            <div style={{ display: 'flex', gap: 5 }}>
              {TESTIMONIALS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setSlide(i)}
                  aria-label={`Show review ${i + 1}`}
                  style={{
                    width: i === slide ? 18 : 6, height: 6, borderRadius: 999,
                    background: i === slide ? C.darkAccent : 'rgba(255,255,255,0.25)',
                    border: 'none', padding: 0, cursor: 'pointer',
                    transition: 'all 0.3s ease',
                  }}
                />
              ))}
            </div>
          </div>

          <div key={slide} style={{ animation: 'v2FadeSlide 0.4s ease' }}>
            <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.55, marginBottom: 14, position: 'relative', zIndex: 1, minHeight: 70 }}>
              "{t.quote}"
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar
                initials={initialsFrom(t.name)} size={36}
                bg={C.indigo} color="#fff" photo={t.photo} ring="rgba(255,255,255,0.2)"
              />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{t.name}</div>
                <div style={{ fontSize: 10, color: C.darkTextMuted, marginTop: 1 }}>{t.school}</div>
              </div>
              <div style={{ marginLeft: 'auto', fontSize: 14, color: '#fbbf24', letterSpacing: 2 }}>
                {'★'.repeat(t.stars)}
              </div>
            </div>
          </div>
        </div>

        {/* Services strip — flex-grows so the right column matches the left
            column's height; tiles center in any leftover space */}
        <Card style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: 11, fontWeight: 800, color: C.textPrimary, margin: 0, letterSpacing: 1 }}>
              EXPLORE MORE SERVICES
            </h3>
            <Link to="/new-order" style={{ marginLeft: 'auto', fontSize: 10, color: C.textMuted, fontWeight: 600, textDecoration: 'none' }}>
              View all
            </Link>
          </div>
          <div className="v2-services-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, flex: 1, alignContent: 'center' }}>
            {SERVICES.map((s, i) => (
              <Link
                key={i}
                to={`/new-order?service=${encodeURIComponent(s.service)}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  padding: '9px 11px', borderRadius: 9,
                  background: s.bg, cursor: 'pointer', textDecoration: 'none',
                }}
              >
                <s.icon size={14} color={s.hue} />
                <span style={{ fontSize: 11, fontWeight: 700, color: s.hue, letterSpacing: 0.2 }}>
                  {s.label}
                </span>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
