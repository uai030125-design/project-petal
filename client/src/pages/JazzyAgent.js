import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../utils/api';
import PageHeader from '../components/shared/PageHeader';

const MARKETS = ['All', 'Missy', 'Girls', 'Juniors'];
const CATEGORIES = ['All', 'Dresses', 'Tops', 'Pants', 'Skirts', 'Outerwear'];
const BRANDS = ['All', 'Free People', 'Anthropologie', "Altar'd State", 'Urban Outfitters', 'Princess Polly', 'Abercrombie', 'Zara', 'ASOS', 'Mango', 'Revolve', 'H&M', 'Nordstrom', 'Target', 'PacSun', 'Pinterest', 'Other'];

const ACCENT = '#3C1A00';

function proxyImg(url) {
  if (!url) return url;
  if (url.startsWith('/')) return url;
  // CDNs that allow direct cross-origin loading — skip proxy
  const directHosts = ['images.asos-media.com', 'revolveassets.com', 'is4.revolveassets.com'];
  if (url.startsWith('http')) {
    try {
      const host = new URL(url).hostname;
      if (directHosts.some(h => host === h || host.endsWith('.' + h))) return url;
    } catch {}
    return '/api/image-proxy?url=' + encodeURIComponent(url);
  }
  return url;
}

/* ── Detail Modal ── */
function TrendDetail({ trend, onClose, onSave }) {
  const isSaved = (trend.tags || []).includes('saved');

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface)', borderRadius: 16,
          width: '100%', maxWidth: 540,
          border: '1px solid var(--border)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
          overflow: 'hidden',
        }}
      >
        {/* Header bar */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 20px', borderBottom: '1px solid var(--border)',
          background: 'var(--surface2)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {trend.market && (
              <span style={{
                background: 'rgba(0,0,0,0.06)', padding: '3px 10px', borderRadius: 20,
                fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5,
                color: 'var(--text-muted)',
              }}>{trend.market}</span>
            )}
            {trend.category && (
              <span style={{
                background: 'rgba(0,0,0,0.06)', padding: '3px 10px', borderRadius: 20,
                fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5,
                color: 'var(--text-muted)',
              }}>{trend.category}</span>
            )}
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 18, color: 'var(--text-muted)', lineHeight: 1,
          }}>&times;</button>
        </div>

        {/* Image */}
        {trend.image_url && (
          <div style={{ width: '100%', maxHeight: 320, overflow: 'hidden', background: 'var(--surface2)' }}>
            <img
              src={proxyImg(trend.image_url)}
              alt={trend.title}
              style={{ width: '100%', height: 320, objectFit: 'cover', display: 'block' }}
              onError={e => { e.target.parentNode.style.display = 'none'; }}
            />
          </div>
        )}

        {/* Body */}
        <div style={{ padding: '24px 24px 20px' }}>
          {/* Brand */}
          <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
            {trend.brand}
          </div>

          {/* Title */}
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3, marginBottom: 12 }}>
            {trend.title}
          </div>

          {/* Price */}
          {trend.price_range && (
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>
              {trend.price_range}
            </div>
          )}

          {/* Description */}
          {trend.description && (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 20 }}>
              {trend.description}
            </div>
          )}

          {/* Tags */}
          {trend.tags && trend.tags.filter(t => t !== 'saved').length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
              {trend.tags.filter(t => t !== 'saved').map(tag => (
                <span key={tag} style={{
                  background: 'var(--surface2)', padding: '3px 10px', borderRadius: 4,
                  fontSize: 10, fontWeight: 600, color: 'var(--text-muted)',
                }}>{tag}</span>
              ))}
            </div>
          )}

          {/* Source link — the main CTA */}
          {trend.source_url && (
            <a
              href={trend.source_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                width: '100%', padding: '12px 20px',
                background: ACCENT, color: '#fff',
                borderRadius: 10, fontSize: 13, fontWeight: 700,
                textDecoration: 'none', transition: 'all 0.15s',
                letterSpacing: 0.3, marginBottom: 10,
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              View on {trend.brand} →
            </a>
          )}

          {/* URL preview */}
          {trend.source_url && (
            <div style={{
              fontSize: 10, color: 'var(--text-muted)', textAlign: 'center',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              marginBottom: 12,
            }}>
              {trend.source_url}
            </div>
          )}

          {/* Save + found date row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <button
              onClick={() => onSave(trend.id)}
              style={{
                background: 'none', border: '1px solid var(--border)', borderRadius: 8,
                padding: '6px 14px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                color: isSaved ? '#e06080' : 'var(--text-muted)', transition: 'all 0.15s',
              }}
            >
              {isSaved ? '♥ Saved' : '♡ Save'}
            </button>
            {trend.found_date && (
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                Found {new Date(trend.found_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Trend Card ── */
const CARD_GRADIENTS = [
  'linear-gradient(135deg, #a47864 0%, #d4a985 100%)',
  'linear-gradient(135deg, #6B7F5E 0%, #9db88d 100%)',
  'linear-gradient(135deg, #5C3D2E 0%, #a47864 100%)',
  'linear-gradient(135deg, #7c6e8a 0%, #b8a9c9 100%)',
  'linear-gradient(135deg, #8b6f5c 0%, #c9a88a 100%)',
  'linear-gradient(135deg, #5a7d7c 0%, #8bb5b3 100%)',
];

function TrendCard({ trend, onSave, onRemove, onOpen, vote, onVote }) {
  const isSaved = (trend.tags || []).includes('saved');
  const [hovered, setHovered] = useState(false);
  const [imgError, setImgError] = useState(false);
  const gradient = CARD_GRADIENTS[(trend.id || 0) % CARD_GRADIENTS.length];
  const imgSrc = proxyImg(trend.image_url);
  const hasImage = imgSrc && !imgError;

  return (
    <div
      onClick={() => onOpen(trend)}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        transition: 'all 0.2s ease',
        transform: hovered ? 'translateY(-2px)' : 'none',
        boxShadow: hovered ? '0 8px 24px rgba(0,0,0,0.10)' : '0 1px 4px rgba(0,0,0,0.04)',
        display: 'flex', flexDirection: 'column',
        height: '100%', minHeight: 190,
        cursor: 'pointer',
        overflow: 'hidden',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* ── Image Area — large, prominent ── */}
      <div style={{
        width: '100%', height: 260, overflow: 'hidden',
        background: hasImage ? '#f5f0eb' : gradient,
        position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {imgSrc && (
          <img
            src={imgSrc}
            alt={trend.title}
            style={{
              width: '100%', height: '100%',
              objectFit: 'cover',
              objectPosition: 'top center',
              position: 'absolute', top: 0, left: 0, zIndex: 1,
              background: '#f5f0eb',
            }}
            onError={() => setImgError(true)}
          />
        )}
        {/* Fallback when no image */}
        {!hasImage && (
          <div style={{ textAlign: 'center', zIndex: 0 }}>
            <div style={{
              fontSize: 40, fontWeight: 800, color: 'rgba(255,255,255,0.45)',
              userSelect: 'none', letterSpacing: 2, lineHeight: 1,
            }}>
              {(trend.brand || trend.title || '?')[0].toUpperCase()}
            </div>
            <div style={{
              fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.55)',
              textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 6,
            }}>
              {trend.category || 'trend'}
            </div>
          </div>
        )}
        {/* Save heart overlay */}
        <button
          onClick={e => { e.stopPropagation(); onSave(trend.id); }}
          style={{
            position: 'absolute', top: 8, right: 8, zIndex: 2,
            background: 'rgba(255,255,255,0.85)', border: 'none', borderRadius: '50%',
            width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: 15,
            color: isSaved ? '#e06080' : '#999', transition: 'all 0.2s',
            backdropFilter: 'blur(4px)',
          }}
          title={isSaved ? 'Unsave' : 'Save'}
        >
          {isSaved ? '♥' : '♡'}
        </button>
        {/* Market pill overlay */}
        {trend.market && (
          <span style={{
            position: 'absolute', top: 8, left: 8, zIndex: 2,
            background: 'rgba(255,255,255,0.85)', padding: '3px 10px', borderRadius: 20,
            fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5,
            color: 'var(--text-muted)', backdropFilter: 'blur(4px)',
          }}>
            {trend.market}
          </span>
        )}
      </div>

      {/* ── Store + Description + Link ── */}
      <div style={{ padding: '12px 16px 10px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          {/* Store / Brand */}
          <div style={{ fontSize: 11, color: ACCENT, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
            {trend.brand}
          </div>

          {/* Title */}
          <div style={{
            fontSize: 13, fontWeight: 700, color: 'var(--text)', lineHeight: 1.35, marginBottom: 6,
            overflow: 'hidden', textOverflow: 'ellipsis',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}>
            {trend.title}
          </div>

          {/* Description */}
          {trend.description && (
            <div style={{
              fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 8,
              overflow: 'hidden', textOverflow: 'ellipsis',
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            }}>
              {trend.description}
            </div>
          )}

          {/* Price */}
          {trend.price_range && (
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
              {trend.price_range}
            </div>
          )}
        </div>

        {/* Bottom: link + vote buttons */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)',
        }}>
          {trend.source_url ? (
            <a
              href={trend.source_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              style={{ fontSize: 10, fontWeight: 600, color: ACCENT, textDecoration: 'none', opacity: hovered ? 1 : 0.7, transition: 'opacity 0.15s' }}
            >
              View on {trend.brand} →
            </a>
          ) : (
            <span style={{ fontSize: 10, fontWeight: 600, color: ACCENT, opacity: hovered ? 1 : 0.6, transition: 'opacity 0.15s' }}>
              View Details →
            </span>
          )}
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <button
              onClick={e => { e.stopPropagation(); onVote(trend.id, 'like'); }}
              style={{
                padding: '4px 8px', background: vote === 'like' ? 'rgba(76,175,80,0.12)' : 'none',
                border: vote === 'like' ? '1px solid rgba(76,175,80,0.4)' : '1px solid transparent',
                borderRadius: 6, fontSize: 13, cursor: 'pointer',
                color: vote === 'like' ? '#4CAF50' : 'var(--text-muted)',
                opacity: vote === 'like' ? 1 : 0.5, transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (vote !== 'like') e.currentTarget.style.opacity = '0.9'; }}
              onMouseLeave={e => { if (vote !== 'like') e.currentTarget.style.opacity = '0.5'; }}
              title="Like — more like this"
            >
              {vote === 'like' ? '▲' : '△'}
            </button>
            <button
              onClick={e => { e.stopPropagation(); onVote(trend.id, 'dislike'); }}
              style={{
                padding: '4px 8px', background: vote === 'dislike' ? 'rgba(244,67,54,0.10)' : 'none',
                border: vote === 'dislike' ? '1px solid rgba(244,67,54,0.3)' : '1px solid transparent',
                borderRadius: 6, fontSize: 13, cursor: 'pointer',
                color: vote === 'dislike' ? '#F44336' : 'var(--text-muted)',
                opacity: vote === 'dislike' ? 1 : 0.5, transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (vote !== 'dislike') e.currentTarget.style.opacity = '0.9'; }}
              onMouseLeave={e => { if (vote !== 'dislike') e.currentTarget.style.opacity = '0.5'; }}
              title="Dislike — less like this"
            >
              {vote === 'dislike' ? '▼' : '▽'}
            </button>
            <button
              onClick={e => { e.stopPropagation(); onRemove(trend.id); }}
              style={{
                padding: '4px 6px', background: 'none', border: 'none',
                fontSize: 12, cursor: 'pointer',
                color: 'var(--text-muted)', opacity: 0.4, transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '1'}
              onMouseLeave={e => e.currentTarget.style.opacity = '0.4'}
              title="Remove"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   MAIN COMPONENT — WOODCOCK
   ══════════════════════════════════════ */
export default function JazzyAgent() {
  const [trends, setTrends] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterMarket, setFilterMarket] = useState('All');
  const [filterBrand, setFilterBrand] = useState('All');
  const [filterCategory, setFilterCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [showSaved, setShowSaved] = useState(false);
  const [days, setDays] = useState(30);
  const [selectedTrend, setSelectedTrend] = useState(null);
  const [votes, setVotes] = useState({}); // { trendId: 'like'|'dislike' }

  // ── Lookbook archive state ──
  const [lookbooks, setLookbooks] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Fetch existing votes
  const fetchVotes = useCallback(async () => {
    try {
      const res = await api.get('/agents/jazzy/preferences');
      setVotes(res.data.votes || {});
    } catch { /* noop - endpoint might not exist yet */ }
  }, []);

  const fetchTrends = useCallback(async () => {
    setLoading(true);
    try {
      const params = { days };
      if (filterMarket !== 'All') params.market = filterMarket;
      if (filterBrand !== 'All') params.brand = filterBrand;
      if (filterCategory !== 'All') params.category = filterCategory;
      if (search) params.search = search;
      const res = await api.get('/agents/jazzy/trends', { params });
      setTrends(res.data.trends || []);
    } catch (err) {
      console.error('Failed to fetch trends:', err);
    }
    setLoading(false);
  }, [days, filterMarket, filterBrand, filterCategory, search]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/agents/jazzy/stats');
      setStats(res.data);
    } catch { /* noop */ }
  }, []);

  const [fetchingImages, setFetchingImages] = useState(false);
  const [fetchProgress, setFetchProgress] = useState('');
  const fetchImages = useCallback(async () => {
    setFetchingImages(true);
    setFetchProgress('Starting...');
    try {
      // First try the batch server-side approach
      const res = await api.post('/agents/jazzy/trends/fetch-images');
      if (res.data.updated > 0) {
        setFetchProgress(`Server found ${res.data.updated} images`);
        fetchTrends();
      }

      // Then try individual scraping for any still-bad images
      const trendsRes = await api.get('/agents/jazzy/trends', { params: { days: 30 } });
      const allTrends = trendsRes.data.trends || trendsRes.data || [];
      const badTrends = allTrends.filter(t =>
        t.source_url && t.source_url.includes('/shop/') &&
        (!t.image_url || t.image_url.includes('unsplash.com') || t.image_url.includes('placeholder'))
      );

      if (badTrends.length > 0) {
        setFetchProgress(`Scraping ${badTrends.length} product pages...`);
        let fixed = 0;
        for (let i = 0; i < badTrends.length; i++) {
          const t = badTrends[i];
          setFetchProgress(`Scraping ${i + 1}/${badTrends.length}: ${t.title?.slice(0, 30)}...`);
          try {
            const scrapeRes = await fetch(`/api/scrape-og-image?url=${encodeURIComponent(t.source_url)}`);
            const data = await scrapeRes.json();
            if (data.image && !data.image.includes('unsplash') && !data.image.includes('placeholder')) {
              await api.put(`/agents/jazzy/trends/${t.id}`, { image_url: data.image });
              fixed++;
            }
          } catch { /* skip */ }
        }
        if (fixed > 0) {
          setFetchProgress(`Fixed ${fixed} images!`);
          fetchTrends();
        } else {
          setFetchProgress('No new images found');
        }
      } else {
        setFetchProgress(res.data.updated > 0 ? 'Done!' : 'All images OK');
      }
    } catch (e) {
      setFetchProgress('Error: ' + (e.message || 'failed'));
    }
    setTimeout(() => { setFetchingImages(false); setFetchProgress(''); }, 3000);
  }, [fetchTrends]);

  // ── Social Monitor state ──
  const [socialMonitorOpen, setSocialMonitorOpen] = useState(false);
  const [socialData, setSocialData] = useState(null);
  const [socialScanning, setSocialScanning] = useState(false);
  const [socialInsights, setSocialInsights] = useState(null);

  const fetchSocialResults = useCallback(async () => {
    try {
      const res = await api.get('/social-monitor/results');
      setSocialData(res.data.data);
    } catch { /* noop */ }
  }, []);

  const fetchSocialInsights = useCallback(async () => {
    try {
      const res = await api.get('/social-monitor/insights');
      setSocialInsights(res.data);
    } catch { /* noop */ }
  }, []);

  const runSocialScan = useCallback(async () => {
    setSocialScanning(true);
    try {
      await api.post('/social-monitor/scan', { monitors: ['all'] });
      await fetchSocialResults();
      await fetchSocialInsights();
    } catch (e) {
      console.error('Social scan failed:', e);
    }
    setSocialScanning(false);
  }, [fetchSocialResults, fetchSocialInsights]);

  useEffect(() => { if (socialMonitorOpen) { fetchSocialResults(); fetchSocialInsights(); } }, [socialMonitorOpen, fetchSocialResults, fetchSocialInsights]);

  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const runScan = useCallback(async () => {
    setScanning(true);
    setScanResult(null);
    try {
      const res = await api.post('/agents/jazzy/scan');
      setScanResult(res.data);
      if (res.data.imported > 0) {
        fetchTrends();
        fetchStats();
      }
    } catch (err) {
      console.error('Scan failed:', err);
      setScanResult({ error: true });
    }
    setScanning(false);
  }, [fetchTrends, fetchStats]);

  useEffect(() => { fetchTrends(); }, [fetchTrends]);
  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchVotes(); }, [fetchVotes]);

  // ── Lookbook functions ──
  const fetchLookbooks = useCallback(async () => {
    try {
      const res = await api.get('/agents/jazzy/lookbook/archive');
      setLookbooks(res.data.lookbooks || []);
    } catch { /* noop */ }
  }, []);

  useEffect(() => { fetchLookbooks(); }, [fetchLookbooks]);

  const generateLookbook = useCallback(async () => {
    setGenerating(true);
    try {
      await api.post('/agents/jazzy/lookbook/generate');
      await fetchLookbooks();
      setSidebarOpen(true);
    } catch (err) {
      console.error('Lookbook generation failed:', err);
      alert(err.response?.data?.error || 'Failed to generate lookbook');
    }
    setGenerating(false);
  }, [fetchLookbooks]);

  // Auto-fetch missing images on first load (disabled - use Fetch Images button)
  // Images are fetched on demand to avoid slow page loads

  const handleSave = async (id) => {
    try {
      await api.post(`/agents/jazzy/trends/${id}/save`);
      setTrends(prev => prev.map(t =>
        t.id === id ? { ...t, tags: (t.tags || []).includes('saved') ? t.tags.filter(x => x !== 'saved') : [...(t.tags || []), 'saved'] } : t
      ));
      // Also update selectedTrend if open
      setSelectedTrend(prev => {
        if (prev && prev.id === id) {
          const tags = (prev.tags || []);
          return { ...prev, tags: tags.includes('saved') ? tags.filter(x => x !== 'saved') : [...tags, 'saved'] };
        }
        return prev;
      });
    } catch { /* noop */ }
  };

  const handleVote = async (id, vote) => {
    try {
      // Toggle off if same vote
      const currentVote = votes[id];
      const newVote = currentVote === vote ? null : vote;
      if (newVote) {
        await api.post(`/agents/jazzy/trends/${id}/vote`, { vote: newVote });
        setVotes(prev => ({ ...prev, [id]: newVote }));
      } else {
        // Remove vote — re-vote opposite then same to cancel (or just keep UI state)
        setVotes(prev => { const copy = { ...prev }; delete copy[id]; return copy; });
      }
    } catch { /* noop */ }
  };

  const handleRemove = async (id) => {
    try {
      await api.delete(`/agents/jazzy/trends/${id}`);
      setTrends(prev => prev.filter(t => t.id !== id));
      if (selectedTrend?.id === id) setSelectedTrend(null);
    } catch { /* noop */ }
  };

  const displayTrends = useMemo(() => {
    let filtered = trends;
    if (showSaved) filtered = filtered.filter(t => (t.tags || []).includes('saved'));
    return filtered;
  }, [trends, showSaved]);

  const marketCounts = useMemo(() => {
    const c = {};
    trends.forEach(t => { if (t.market) c[t.market] = (c[t.market] || 0) + 1; });
    return c;
  }, [trends]);

  return (
    <div className="fade-in" style={{ display: 'flex', gap: 0 }}>
      {/* ═══ Lookbook Archive Sidebar ═══ */}
      <div style={{
        width: sidebarOpen ? 240 : 0,
        minWidth: sidebarOpen ? 240 : 0,
        transition: 'all 0.25s ease',
        overflow: 'hidden',
        borderRight: sidebarOpen ? '1px solid var(--border)' : 'none',
        background: 'var(--surface)',
        flexShrink: 0,
        height: 'calc(100vh - 70px)',
        position: 'sticky',
        top: 70,
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{ padding: '16px 14px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: ACCENT }}>
              Lookbook Archive
            </span>
            <button onClick={() => setSidebarOpen(false)} style={{
              background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--text-muted)', lineHeight: 1,
            }}>&times;</button>
          </div>
          <button
            onClick={generateLookbook}
            disabled={generating}
            style={{
              width: '100%', padding: '8px 0', borderRadius: 8, border: 'none',
              background: generating ? 'var(--surface2)' : ACCENT,
              color: generating ? 'var(--text-muted)' : '#fff',
              fontSize: 11, fontWeight: 600, cursor: generating ? 'wait' : 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {generating ? 'Generating...' : 'Generate Today\'s Lookbook'}
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {lookbooks.length === 0 ? (
            <div style={{ padding: '20px 14px', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.6 }}>
              No lookbooks yet. Save some trends, then generate your first lookbook!
            </div>
          ) : lookbooks.map(lb => {
            const d = lb.date ? new Date(lb.date + 'T12:00:00') : null;
            const label = d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : lb.filename;
            const sizeKB = (lb.size / 1024).toFixed(0);
            return (
              <div
                key={lb.filename}
                onClick={async () => {
                  try {
                    const res = await api.get(`/agents/jazzy/lookbook/download/${lb.filename}`, { responseType: 'blob' });
                    const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
                    window.open(url, '_blank');
                  } catch { alert('Failed to open lookbook'); }
                }}
                style={{
                  display: 'block', padding: '10px 14px', textDecoration: 'none',
                  borderBottom: '1px solid var(--border)', transition: 'background 0.1s',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16, opacity: 0.5 }}>📄</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', lineHeight: 1.4 }}>{label}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{sizeKB} KB</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══ Main Content ═══ */}
      <div style={{ flex: 1, minWidth: 0 }}>
      <PageHeader title="Woodcock" subtitle="SHOWROOM AGENT" />

      {/* Subheader */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 600 }}>
          Trend Scout — scouting the newest bohemian, free-spirited styles across Free People, Anthropologie, Altar'd State and more.
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => setSocialMonitorOpen(!socialMonitorOpen)}
            style={{
              padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)',
              background: socialMonitorOpen ? 'rgba(212,160,160,0.15)' : 'transparent',
              color: socialMonitorOpen ? '#d4a0a0' : 'var(--text-muted)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            📡 Social Monitor
          </button>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)',
              background: sidebarOpen ? 'rgba(60,26,0,0.08)' : 'transparent',
              color: sidebarOpen ? ACCENT : 'var(--text-muted)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            📄 Lookbooks {lookbooks.length > 0 ? `(${lookbooks.length})` : ''}
          </button>
          <button
            onClick={() => setShowSaved(!showSaved)}
            style={{
              padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)',
              background: showSaved ? 'rgba(224,96,128,0.1)' : 'transparent',
              color: showSaved ? '#e06080' : 'var(--text-muted)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            ♥ Saved {stats?.saved ? `(${stats.saved})` : ''}
          </button>
          <button
            onClick={runScan}
            disabled={scanning}
            style={{
              padding: '6px 14px', borderRadius: 8, border: 'none',
              background: scanning ? 'var(--surface2)' : ACCENT,
              color: scanning ? 'var(--text-muted)' : '#fff',
              fontSize: 12, fontWeight: 600, cursor: scanning ? 'wait' : 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {scanning ? 'Scanning...' : 'Run Scout'}
          </button>
          {scanResult && !scanResult.error && (
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              {scanResult.imported} new · {scanResult.found} found
            </span>
          )}
          <button
            onClick={fetchImages}
            disabled={fetchingImages}
            style={{
              padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)',
              background: 'transparent',
              color: fetchingImages ? 'var(--text-muted)' : 'var(--text)',
              fontSize: 12, fontWeight: 600, cursor: fetchingImages ? 'wait' : 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {fetchingImages ? (fetchProgress || 'Fetching...') : 'Fetch Images'}
          </button>
          <button
            onClick={() => { fetchTrends(); fetchStats(); }}
            style={{
              padding: '6px 14px', borderRadius: 8, border: 'none',
              background: ACCENT, color: '#fff',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'stretch', flexWrap: 'wrap' }}>
        {[
          { label: 'Total Finds', value: stats?.total || 0 },
          { label: 'New Today', value: stats?.today || 0, color: ACCENT },
          ...['Missy', 'Girls', 'Juniors'].map(m => ({ label: m, value: marketCounts[m] || 0 })),
          { label: 'Saved', value: stats?.saved || 0, color: '#e06080' },
        ].map(s => (
          <div key={s.label} style={{
            flex: 1, minWidth: 100, padding: 16,
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color || 'var(--text)' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* ═══ Social Monitor Panel ═══ */}
      {socialMonitorOpen && (
        <div style={{
          marginBottom: 20, background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '14px 20px', borderBottom: '1px solid var(--border)',
            background: 'linear-gradient(135deg, rgba(212,160,160,0.08), rgba(95,122,94,0.06))',
          }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Social & Trend Monitor</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                Google Trends · Pinterest · Instagram · Retail New Arrivals
                {socialData?.lastScan && ` · Last scan: ${new Date(socialData.lastScan).toLocaleString()}`}
              </div>
            </div>
            <button
              onClick={runSocialScan}
              disabled={socialScanning}
              style={{
                padding: '8px 18px', borderRadius: 8, border: 'none',
                background: socialScanning ? 'var(--surface2)' : '#d4a0a0',
                color: socialScanning ? 'var(--text-muted)' : '#fff',
                fontSize: 12, fontWeight: 600, cursor: socialScanning ? 'wait' : 'pointer',
              }}
            >
              {socialScanning ? 'Scanning all sources...' : 'Run Full Scan'}
            </button>
          </div>

          <div style={{ padding: 20 }}>
            {/* Insights */}
            {socialInsights?.insights?.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: ACCENT, marginBottom: 12 }}>Style Insights</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                  {socialInsights.insights.map((insight, i) => (
                    <div key={i} style={{
                      padding: 14, borderRadius: 10,
                      background: insight.signal === 'very-strong' ? 'rgba(74,222,128,0.08)' :
                        insight.signal === 'strong' ? 'rgba(212,160,160,0.1)' : 'var(--surface2)',
                      border: `1px solid ${insight.signal === 'very-strong' ? 'rgba(74,222,128,0.3)' :
                        insight.signal === 'strong' ? 'rgba(212,160,160,0.3)' : 'var(--border)'}`,
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                        {insight.signal === 'very-strong' ? '🎯 ' : insight.signal === 'strong' ? '🔥 ' : '📊 '}
                        {insight.title}
                      </div>
                      {insight.items.slice(0, 4).map((item, j) => (
                        <div key={j} style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6, paddingLeft: 8 }}>
                          · {item}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4 Monitor Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {[
                { key: 'googleTrends', label: 'Google Trends', icon: '📈', color: '#4285F4' },
                { key: 'pinterest', label: 'Pinterest', icon: '📌', color: '#E60023' },
                { key: 'instagram', label: 'Instagram / Blogs', icon: '📸', color: '#C13584' },
                { key: 'newArrivals', label: 'New Arrivals', icon: '🛍️', color: '#5F7A5E' },
              ].map(monitor => {
                const data = socialData?.[monitor.key] || [];
                return (
                  <div key={monitor.key} style={{
                    padding: 14, borderRadius: 10, background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                      <span style={{ fontSize: 14 }}>{monitor.icon}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)' }}>{monitor.label}</span>
                      <span style={{
                        marginLeft: 'auto', fontSize: 10, fontWeight: 700,
                        color: data.length > 0 ? monitor.color : 'var(--text-muted)',
                      }}>
                        {data.length}
                      </span>
                    </div>
                    {data.length > 0 ? (
                      <div style={{ maxHeight: 160, overflowY: 'auto' }}>
                        {data.slice(0, 8).map((item, i) => (
                          <div key={i} style={{
                            fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.5,
                            borderBottom: i < 7 ? '1px solid var(--border)' : 'none',
                            padding: '4px 0',
                          }}>
                            {item.keyword || item.title || item.hashtag || `${item.retailer}: ${item.category}`}
                            {item.traffic && <span style={{ color: monitor.color, marginLeft: 4 }}>({item.traffic})</span>}
                            {item.count && item.category !== '_summary' && <span style={{ color: monitor.color, marginLeft: 4 }}>×{item.count}</span>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic', padding: '8px 0' }}>
                        No data yet — run a scan
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          style={{
            maxWidth: 240, padding: '8px 12px', fontSize: 12,
            border: '1px solid var(--border)', borderRadius: 8,
            background: 'var(--surface)', color: 'var(--text)',
          }}
          placeholder="Search trends..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div style={{ display: 'flex', gap: 4 }}>
          {MARKETS.map(m => (
            <button
              key={m}
              onClick={() => setFilterMarket(m)}
              style={{
                padding: '6px 14px', fontSize: 11, fontWeight: 600,
                borderRadius: 6, border: 'none', cursor: 'pointer',
                background: filterMarket === m ? ACCENT : 'var(--surface2)',
                color: filterMarket === m ? '#fff' : 'var(--text-muted)',
                transition: 'all 0.15s',
              }}
            >
              {m}
            </button>
          ))}
        </div>
        <select
          style={{
            maxWidth: 170, padding: '7px 10px', fontSize: 11,
            border: '1px solid var(--border)', borderRadius: 6,
            background: 'var(--surface)', color: 'var(--text)',
          }}
          value={filterBrand}
          onChange={e => setFilterBrand(e.target.value)}
        >
          {BRANDS.map(b => <option key={b} value={b}>{b === 'All' ? 'All Brands' : b}</option>)}
        </select>
        <select
          style={{
            maxWidth: 140, padding: '7px 10px', fontSize: 11,
            border: '1px solid var(--border)', borderRadius: 6,
            background: 'var(--surface)', color: 'var(--text)',
          }}
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
        >
          {CATEGORIES.map(c => <option key={c} value={c}>{c === 'All' ? 'All Categories' : c}</option>)}
        </select>
        <select
          style={{
            maxWidth: 120, padding: '7px 10px', fontSize: 11,
            border: '1px solid var(--border)', borderRadius: 6,
            background: 'var(--surface)', color: 'var(--text)',
          }}
          value={days}
          onChange={e => setDays(parseInt(e.target.value))}
        >
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {displayTrends.length} trend{displayTrends.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Masonry Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)', fontSize: 14 }}>
          Woodcock is searching for trends...
        </div>
      ) : displayTrends.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 60, color: 'var(--text-muted)',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', fontSize: 14,
        }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8, color: 'var(--text)' }}>
            {showSaved ? 'No saved trends yet' : 'No trends found'}
          </div>
          <div style={{ maxWidth: 400, margin: '0 auto', lineHeight: 1.6 }}>
            {showSaved
              ? 'Save your favorite finds by clicking the heart icon on any trend card.'
              : 'Woodcock runs nightly to discover fresh bohemian styles. New trends will appear here after the next scan.'}
          </div>
        </div>
      ) : (
        <div className="jazzy-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 16,
        }}>
          {displayTrends.map(t => (
            <TrendCard
              key={t.id}
              trend={t}
              onSave={handleSave}
              onRemove={handleRemove}
              onOpen={setSelectedTrend}
              vote={votes[t.id]}
              onVote={handleVote}
            />
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selectedTrend && (
        <TrendDetail
          trend={selectedTrend}
          onClose={() => setSelectedTrend(null)}
          onSave={handleSave}
        />
      )}

      <style>{`
        @media (max-width: 900px) {
          .jazzy-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 500px) {
          .jazzy-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
      </div>{/* end main content */}
    </div>
  );
}
