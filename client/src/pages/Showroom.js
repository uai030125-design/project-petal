import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../utils/api';
import { BUYER_CARDS, buildStyleOrderMap, normalizeStyle } from '../data/crmData';
import { useCRM } from '../context/CRMContext';
import PageHeader from '../components/shared/PageHeader';

// Local image map for caftan styles
const localImageMap = {
  'SKO/18740/25': '/images/caftan_SKO-18740-25.png',
  'SKO/18759/25': '/images/caftan_SKO-18759-25.png',
  'SK 69': '/images/caftan_SK-69.png',
  'SKO-040': '/images/caftan_SKO-040.png',
  'SKO-042': '/images/caftan_SKO-042.png',
  'SK 49': '/images/caftan_SK-49.png',
  'SK 89': '/images/caftan_SK-89.png',
  'SKO/18796/25': '/images/caftan_SKO-18796-25.png',
  'SKO/18798/25': '/images/caftan_SKO-18798-25.png',
  'SKO/18709/25': '/images/caftan_SKO-18709-25.png',
};

/* ── Overlay ── */
const Overlay = ({ children, onClose, wide }) => (
  <div onClick={onClose} style={{
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    backdropFilter: 'blur(4px)',
  }}>
    <div onClick={e => e.stopPropagation()} style={{
      background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '28px 32px',
      minWidth: 380, maxWidth: wide ? 780 : 560, width: wide ? '90%' : undefined,
      maxHeight: '85vh', overflowY: 'auto',
      boxShadow: '0 12px 40px rgba(0,0,0,0.18)', border: '1px solid var(--border)',
    }}>
      {children}
    </div>
  </div>
);

const PRESENTATIONS_LS_KEY = 'ua_showroom_presentations';
const CUSTOM_STYLES_LS_KEY  = 'ua_showroom_custom_styles';

export default function Showroom() {
  const [styles, setStyles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedStyle, setExpandedStyle] = useState(null);

  // Line sheet builder state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showBuilder, setShowBuilder] = useState(false);
  const [lsAccount, setLsAccount] = useState('');
  const [lsAccountCustom, setLsAccountCustom] = useState('');
  const [lsPrices, setLsPrices] = useState({}); // { styleId: price }
  const [aiImages, setAiImages] = useState({}); // { styleId: { url, approved } }
  const [aiLoading, setAiLoading] = useState({}); // { styleId: true }
  const [exporting, setExporting] = useState(false);

  // Presentations state
  const [presentations, setPresentations] = useState([]);
  const [presentationUploading, setPresentationUploading] = useState(false);
  const [presentationFileRef, setPresentationFileRef] = useState(null);
  const [parsingPptx, setParsingPptx] = useState(null); // id of presentation being parsed
  const [parseResults, setParseResults] = useState(null); // { images: [...], slides: [...] }

  // Custom styles added from presentations (stored in localStorage)
  const [customStyles, setCustomStyles] = useState([]);

  // Add / delete style state
  const [showAddStyle, setShowAddStyle] = useState(false);
  const [addStyleForm, setAddStyleForm] = useState({ style_number: '', category: '', colors: '', color_count: 1 });
  const [addStyleSaving, setAddStyleSaving] = useState(false);

  const { readsData, updateReads } = useCRM();
  const orderMap = useMemo(() => buildStyleOrderMap(), []);

  // Get account names from CRM data
  const crmAccounts = useMemo(() => {
    const set = new Set(BUYER_CARDS.map(b => b.company));
    return [...set].sort();
  }, []);

  useEffect(() => {
    // Load presentations from localStorage
    try {
      const stored = localStorage.getItem(PRESENTATIONS_LS_KEY);
      if (stored) setPresentations(JSON.parse(stored));
    } catch { /* ignore */ }

    // Load custom styles (from presentations) from localStorage
    try {
      const stored = localStorage.getItem(CUSTOM_STYLES_LS_KEY);
      if (stored) setCustomStyles(JSON.parse(stored));
    } catch { /* ignore */ }

    Promise.all([
      api.get('/styles', { params: { limit: 200 } }),
      api.get('/styles/categories')
    ]).then(([stylesRes, catRes]) => {
      setStyles(stylesRes.data.data || []);
      setCategories(catRes.data || []);
    }).catch(() => {
      // API unavailable — showroom still works with custom styles from localStorage
    }).finally(() => setLoading(false));

  }, []);

  const getImage = (style) => {
    if (style.image_url) return style.image_url; // includes dataUrl for custom styles
    return localImageMap[style.style_number] || null;
  };

  const getOrders = (styleNumber) => {
    const norm = normalizeStyle(styleNumber);
    return orderMap[norm] || [];
  };

  // Presentations handling
  const handlePresentationUpload = useCallback((file) => {
    if (!file) return;
    setPresentationUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target.result;
        const id = Date.now().toString();
        const newPresentation = {
          id,
          name: file.name,
          uploadedAt: new Date().toISOString(),
          base64: base64, // Store as base64
        };
        const updated = [...presentations, newPresentation];
        setPresentations(updated);
        try {
          localStorage.setItem(PRESENTATIONS_LS_KEY, JSON.stringify(updated));
        } catch {
          // localStorage full, continue without saving
        }
        setPresentationUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Failed to upload presentation:', err);
      setPresentationUploading(false);
    }
  }, [presentations]);

  const removePresentationById = useCallback((id) => {
    const updated = presentations.filter(p => p.id !== id);
    setPresentations(updated);
    try {
      localStorage.setItem(PRESENTATIONS_LS_KEY, JSON.stringify(updated));
    } catch {
      // localStorage full, continue
    }
  }, [presentations]);

  // Merge server styles + localStorage custom styles (dedup by style_number)
  const allStyles = useMemo(() => {
    const serverNums = new Set(styles.map(s => s.style_number));
    const unique = customStyles.filter(cs => !serverNums.has(cs.style_number));
    return [...styles, ...unique];
  }, [styles, customStyles]);

  const filtered = allStyles.filter(s => {
    if (activeCategory && s.category !== activeCategory) return false;
    if (search) {
      const q = search.toLowerCase();
      return (s.style_number || '').toLowerCase().includes(q) || (s.colors || '').toLowerCase().includes(q);
    }
    return true;
  });

  const expandedObj = expandedStyle ? allStyles.find(s => s.id === expandedStyle) : null;
  const expandedOrders = expandedObj ? getOrders(expandedObj.style_number) : [];

  // Toggle style selection
  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Open builder modal
  const openBuilder = () => {
    if (selectedIds.size === 0) return;
    setShowBuilder(true);
  };

  // Get selected style objects
  const selectedStyles = useMemo(
    () => allStyles.filter(s => selectedIds.has(s.id)),
    [allStyles, selectedIds]
  );

  const resolvedAccount = lsAccount === '__custom__' ? lsAccountCustom : lsAccount;

  // AI image generation
  const generateAiImage = useCallback(async (style) => {
    setAiLoading(prev => ({ ...prev, [style.id]: true }));
    try {
      // Call backend AI endpoint
      const res = await api.post('/styles/ai-model', {
        style_number: style.style_number,
        category: style.category,
        colors: style.colors,
        description: `${style.category} - ${style.colors}`,
      });
      setAiImages(prev => ({
        ...prev,
        [style.id]: { url: res.data.image_url, approved: false },
      }));
    } catch (err) {
      console.error('AI generation error:', err);
      // Show a placeholder on error
      setAiImages(prev => ({
        ...prev,
        [style.id]: { url: null, error: 'Generation failed. Add an OpenAI API key to .env to enable.', approved: false },
      }));
    }
    setAiLoading(prev => ({ ...prev, [style.id]: false }));
  }, []);

  const approveAiImage = (styleId) => {
    setAiImages(prev => ({
      ...prev,
      [styleId]: { ...prev[styleId], approved: true },
    }));
  };

  const rejectAiImage = (styleId) => {
    setAiImages(prev => {
      const next = { ...prev };
      delete next[styleId];
      return next;
    });
  };

  // Load SheetJS from CDN
  const loadXLSX = useCallback(() => {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
      s.onload = () => resolve(window.XLSX);
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }, []);

  // Load JSZip from CDN
  const loadJSZip = useCallback(() => {
    if (window.JSZip) return Promise.resolve(window.JSZip);
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      s.onload = () => resolve(window.JSZip);
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }, []);

  // Extract text paragraphs from a slide XML — join runs within each <a:p>
  const extractSlideText = (xml) => {
    const paragraphs = [];
    const paraMatches = xml.match(/<a:p[ >][\s\S]*?<\/a:p>/g) || [];
    for (const para of paraMatches) {
      const runMatches = para.match(/<a:t[^>]*>([^<]*)<\/a:t>/g) || [];
      const text = runMatches.map(r => r.replace(/<[^>]+>/g, '')).join('').trim();
      if (text) paragraphs.push(text);
    }
    return paragraphs;
  };

  // Detect a style number from a list of text paragraphs
  const detectStyleNumber = (texts) => {
    if (!texts || texts.length === 0) return null;
    // Patterns: SKO/18740/25, SK 69, SKO-040, Style #123, Item 456, #789, plain alphanumeric codes
    const patterns = [
      /\bSKO?[\s\-/]\d[\d\s\-/A-Z]*/i,   // SKO-xxx, SK 69, SKO/18740/25
      /\bStyle\s*#?\s*[\w\-/]+/i,           // Style #123
      /\bItem\s*#?\s*[\w\-/]+/i,            // Item 456
      /\b#\s*[\w\-]+/,                       // #ABC
      /\b[A-Z]{1,5}[\-\/]\d{3,}/,           // XX-123, XX/123
      /\b\d{4,}\b/,                          // 4+ digit number
    ];
    for (const text of texts) {
      for (const p of patterns) {
        const m = text.match(p);
        if (m) return m[0].trim();
      }
    }
    return null;
  };

  // Parse a PPTX presentation — extract images and slide text
  const parsePptxIntoShowroom = useCallback(async (presentation) => {
    setParsingPptx(presentation.id);
    setParseResults(null);
    try {
      const JSZip = await loadJSZip();

      // Decode base64 data URL to ArrayBuffer
      const base64Data = presentation.base64.split(',')[1];
      const binaryStr = atob(base64Data);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

      const zip = await JSZip.loadAsync(bytes.buffer);

      // 1) Build a map: media filename → dataUrl
      const mediaMap = {};
      const mediaFiles = Object.keys(zip.files).filter(f =>
        f.startsWith('ppt/media/') && /\.(png|jpg|jpeg|gif|bmp|webp)$/i.test(f)
      );
      for (const mf of mediaFiles) {
        const blob = await zip.files[mf].async('blob');
        const ext = mf.split('.').pop().toLowerCase();
        const mimeType = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
        const dataUrl = await new Promise(resolve => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(new Blob([blob], { type: mimeType }));
        });
        mediaMap[mf.split('/').pop()] = { filename: mf.split('/').pop(), dataUrl, mimeType };
      }

      // 2) Parse slides — read rels to know which images are on each slide
      const slideFiles = Object.keys(zip.files)
        .filter(f => /^ppt\/slides\/slide\d+\.xml$/.test(f))
        .sort((a, b) => parseInt(a.match(/slide(\d+)/)[1]) - parseInt(b.match(/slide(\d+)/)[1]));

      const slides = [];
      const usedMedia = new Set();

      for (const sf of slideFiles) {
        const slideNum = parseInt(sf.match(/slide(\d+)/)[1]);
        const xml = await zip.files[sf].async('text');
        const texts = extractSlideText(xml);
        const detectedStyle = detectStyleNumber(texts);

        // Read the slide's rels to find embedded images
        const relsPath = sf.replace('ppt/slides/', 'ppt/slides/_rels/') + '.rels';
        const slideImages = [];
        if (zip.files[relsPath]) {
          const relsXml = await zip.files[relsPath].async('text');
          const relMatches = relsXml.match(/Target="\.\.\/media\/([^"]+)"/g) || [];
          for (const rel of relMatches) {
            const fname = rel.match(/Target="\.\.\/media\/([^"]+)"/)[1];
            if (mediaMap[fname] && /\.(png|jpg|jpeg|gif|bmp|webp)$/i.test(fname)) {
              slideImages.push(mediaMap[fname]);
              usedMedia.add(fname);
            }
          }
        }

        slides.push({ slideNum, texts, fullText: texts.join(' | '), detectedStyle, images: slideImages });
      }

      // 3) Any media not linked to a specific slide goes into an "orphan" group
      const orphanImages = Object.values(mediaMap).filter(m => !usedMedia.has(m.filename));

      // 4) Build the flat images list (all media) and pass slides with their per-slide images
      const images = Object.values(mediaMap);

      setParseResults({ images, slides, orphanImages, presName: presentation.name });
    } catch (err) {
      console.error('PPTX parse error:', err);
      setParseResults({ error: 'Failed to parse presentation. Make sure it is a valid .pptx file.', images: [], slides: [] });
    }
    setParsingPptx(null);
  }, [loadJSZip]);

  // Save parsed images + styles into Showroom
  const saveParseResults = useCallback(async (category) => {
    if (!parseResults) return;

    // Build a list of (image, detectedStyle, texts) entries from slide-linked images
    const entries = [];
    for (const slide of (parseResults.slides || [])) {
      if (slide.images && slide.images.length > 0) {
        for (const img of slide.images) {
          entries.push({ img, detectedStyle: slide.detectedStyle, texts: slide.texts, slideNum: slide.slideNum });
        }
      }
    }
    // Fallback: if no slide-linked images, use the flat images list
    if (entries.length === 0) {
      for (let i = 0; i < (parseResults.images || []).length; i++) {
        const img = parseResults.images[i];
        const slide = parseResults.slides[i] || parseResults.slides[0] || {};
        entries.push({ img, detectedStyle: slide.detectedStyle || null, texts: slide.texts || [], slideNum: slide.slideNum || i + 1 });
      }
    }

    if (entries.length === 0) { setParseResults(null); return; }

    let added = 0;
    const newCustomStyles = [];

    for (let i = 0; i < entries.length; i++) {
      const { img, detectedStyle, texts } = entries[i];
      const styleNum = detectedStyle
        || img.filename.replace(/\.[^.]+$/, '').replace(/^image\d*$/i, '').trim()
        || (texts && texts[0]) || `Slide-${i + 1}`;
      const colors = texts && texts.length > 1 ? texts.slice(1, 3).filter(t => t !== styleNum).join(', ') : '';

      // Try API first
      let saved = false;
      try {
        const createRes = await api.post('/styles', {
          style_number: styleNum,
          category,
          colors,
          color_count: 1,
          total_ats: 0,
          origin: parseResults.presName || 'Presentation',
        });
        const newStyle = createRes.data;
        // Upload image
        const resp = await fetch(img.dataUrl);
        const blob = await resp.blob();
        const formData = new FormData();
        formData.append('image', blob, img.filename);
        await api.post(`/styles/${newStyle.id}/image`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        saved = true;
        added++;
      } catch (_apiErr) {
        // API unavailable — save to localStorage instead
      }

      if (!saved) {
        // localStorage fallback — store dataUrl directly as image_url
        newCustomStyles.push({
          id: `custom_${Date.now()}_${i}`,
          style_number: styleNum,
          category,
          colors,
          color_count: 1,
          total_ats: 0,
          image_url: img.dataUrl,
          origin: parseResults.presName || 'Presentation',
          _local: true,
        });
        added++;
      }
    }

    // Persist new custom styles to localStorage and state
    if (newCustomStyles.length > 0) {
      const existing = (() => {
        try { return JSON.parse(localStorage.getItem(CUSTOM_STYLES_LS_KEY) || '[]'); } catch { return []; }
      })();
      // Deduplicate by style_number
      const existingNums = new Set(existing.map(s => s.style_number));
      const deduped = newCustomStyles.filter(s => !existingNums.has(s.style_number));
      const updated = [...existing, ...deduped];
      try { localStorage.setItem(CUSTOM_STYLES_LS_KEY, JSON.stringify(updated)); } catch { /* quota */ }
      setCustomStyles(updated);
      // Also refresh categories
      const newCats = [...new Set([...categories, category])].sort();
      setCategories(newCats);
    }

    // Try to refresh from API too
    try {
      const [stylesRes, catRes] = await Promise.all([
        api.get('/styles', { params: { limit: 200 } }),
        api.get('/styles/categories'),
      ]);
      setStyles(stylesRes.data.data || []);
      setCategories(catRes.data || []);
    } catch { /* API down — use local data */ }

    setParseResults(null);
    alert(`Added ${added} style${added !== 1 ? 's' : ''} from presentation into the Showroom.`);
  }, [parseResults, categories]);

  // ── Add / Delete style handlers ───────────────────────────────────────────
  const addStyle = async () => {
    if (!addStyleForm.style_number.trim()) return;
    setAddStyleSaving(true);
    try {
      const res = await api.post('/styles', {
        style_number: addStyleForm.style_number.trim(),
        category: addStyleForm.category || 'Apparel',
        colors: addStyleForm.colors,
        color_count: parseInt(addStyleForm.color_count) || 1,
        total_ats: 0,
      });
      setStyles(prev => [...prev, res.data]);
      if (!categories.includes(res.data.category)) setCategories(prev => [...prev, res.data.category].sort());
      setAddStyleForm({ style_number: '', category: '', colors: '', color_count: 1 });
      setShowAddStyle(false);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add style.');
    }
    setAddStyleSaving(false);
  };

  const deleteStyle = async (style) => {
    if (!window.confirm(`Delete style "${style.style_number}"? This cannot be undone.`)) return;
    try {
      if (style._local) {
        // Remove from localStorage custom styles
        const updated = customStyles.filter(s => s.id !== style.id);
        setCustomStyles(updated);
        try { localStorage.setItem(CUSTOM_STYLES_LS_KEY, JSON.stringify(updated)); } catch { /* quota */ }
      } else {
        await api.delete(`/styles/${style.id}`);
        setStyles(prev => prev.filter(s => s.id !== style.id));
      }
    } catch (err) {
      console.error('Delete style error:', err);
    }
  };

  // Convert image URL to base64
  const toBase64 = async (url) => {
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      return new Promise(resolve => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
        reader.onerror = () => resolve(null);
      });
    } catch { return null; }
  };

  // Export custom line sheet
  const exportLineSheet = useCallback(async () => {
    if (selectedStyles.length === 0) return;
    setExporting(true);
    try {
      const account = resolvedAccount || 'Custom';
      const hasImages = selectedStyles.some(s => getImage(s) || aiImages[s.id]?.url);

      if (hasImages) {
        // HTML-based Excel with images
        const imagePromises = selectedStyles.map(async (s) => {
          if (aiImages[s.id]?.approved && aiImages[s.id]?.url) {
            return toBase64(aiImages[s.id].url);
          }
          const imgUrl = getImage(s);
          if (!imgUrl) return null;
          return toBase64(imgUrl);
        });
        const images = await Promise.all(imagePromises);
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

        const rows = selectedStyles.map((s, i) => {
          const imgTag = images[i] ? `<img src="${images[i]}" width="80" height="100" />` : '';
          const price = lsPrices[s.id] || '';
          return `<tr>
            <td style="vertical-align:middle">${imgTag}</td>
            <td style="font-weight:bold">${s.style_number || ''}</td>
            <td>${s.category || ''}</td>
            <td>${s.colors || ''}</td>
            <td style="text-align:center">${s.color_count || 0}</td>
            <td style="text-align:right">${(s.total_ats || 0).toLocaleString()}</td>
            <td style="text-align:right">${price ? '$' + parseFloat(price).toFixed(2) : ''}</td>
            <td>${s.origin || ''}</td>
          </tr>`;
        }).join('');

        const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta charset="utf-8"/>
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
<x:Name>${account} Line Sheet</x:Name><x:WorksheetOptions><x:Pane><x:Number>3</x:Number></x:Pane></x:WorksheetOptions>
</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
<style>
  table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 11px; }
  th { background: #2A1F1A; color: #fff; padding: 8px 10px; text-align: left; font-size: 10px; text-transform: uppercase; }
  td { padding: 6px 10px; border-bottom: 1px solid #e0e0e0; vertical-align: middle; }
  tr:nth-child(even) { background: #f9f9f9; }
  .header { font-size: 16px; font-weight: bold; color: #2A1F1A; margin-bottom: 4px; }
  .sub { font-size: 11px; color: #888; }
</style></head><body>
<div class="header">Unlimited Avenues — ${account} Line Sheet</div>
<div class="sub">Generated ${dateStr} &middot; ${selectedStyles.length} styles</div><br/>
<table>
  <thead><tr><th>Image</th><th>Style #</th><th>Category</th><th>Colors</th><th>Color Count</th><th>ATS Units</th><th>Price</th><th>Origin</th></tr></thead>
  <tbody>${rows}</tbody>
</table></body></html>`;

        const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${account.replace(/\s+/g, '_')}_Line_Sheet.xls`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        // Pure xlsx via SheetJS
        const XLSX = await loadXLSX();
        const rows = selectedStyles.map(s => ({
          'Style #': s.style_number || '',
          'Category': s.category || '',
          'Colors': s.colors || '',
          'Color Count': s.color_count || 0,
          'ATS Units': s.total_ats || 0,
          'Price': lsPrices[s.id] ? parseFloat(lsPrices[s.id]) : '',
          'Origin': s.origin || '',
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = [
          { wch: 14 }, { wch: 16 }, { wch: 28 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 14 },
        ];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `${account} Line Sheet`);
        XLSX.writeFile(wb, `${account.replace(/\s+/g, '_')}_Line_Sheet.xlsx`);
      }
    } catch (err) {
      console.error('Export error:', err);
    }
    setExporting(false);
  }, [selectedStyles, lsPrices, aiImages, resolvedAccount, loadXLSX]);

  return (
    <div className="fade-in">
      <PageHeader title="Showroom" />

      {/* Presentations Section */}
      <div style={{ marginBottom: 28, padding: '20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Presentations</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Manage presentation files like Scrubs</div>
          </div>
          <input
            ref={setPresentationFileRef}
            type="file"
            accept=".pptx,.ppt,.odp"
            style={{ display: 'none' }}
            onChange={(e) => {
              if (e.target.files[0]) {
                handlePresentationUpload(e.target.files[0]);
                e.target.value = '';
              }
            }}
          />
          <button
            onClick={() => presentationFileRef?.click()}
            disabled={presentationUploading}
            className="btn btn-primary btn-sm"
          >
            {presentationUploading ? 'Uploading...' : 'Upload Presentation'}
          </button>
        </div>

        {/* Drag & Drop Zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.background = 'var(--accent-dim)'; }}
          onDragLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.style.background = 'transparent';
            if (e.dataTransfer.files[0]) handlePresentationUpload(e.dataTransfer.files[0]);
          }}
          style={{
            padding: '20px',
            border: '2px dashed var(--border)',
            borderRadius: 8,
            textAlign: 'center',
            marginBottom: presentations.length > 0 ? 16 : 0,
            cursor: 'pointer',
            transition: 'all 0.2s',
            background: 'var(--surface2)',
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 8 }}>📎</div>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>Drag & drop or click to upload</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Supports .pptx, .ppt, .odp files</div>
        </div>

        {/* Presentations List */}
        {presentations.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {presentations.map(p => (
              <div
                key={p.id}
                style={{
                  padding: '14px',
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 4, wordBreak: 'break-word' }}>
                    {p.name}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    {new Date(p.uploadedAt).toLocaleDateString()}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                  <button
                    onClick={() => parsePptxIntoShowroom(p)}
                    disabled={parsingPptx === p.id}
                    style={{
                      width: '100%',
                      padding: '7px',
                      background: 'var(--accent-dark)',
                      color: '#fff',
                      textAlign: 'center',
                      borderRadius: 4,
                      fontSize: 10,
                      fontWeight: 600,
                      border: 'none',
                      cursor: parsingPptx === p.id ? 'wait' : 'pointer',
                      opacity: parsingPptx === p.id ? 0.6 : 1,
                    }}
                  >
                    {parsingPptx === p.id ? 'Parsing...' : 'Parse into Showroom'}
                  </button>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <a
                      href={p.base64}
                      download={p.name}
                      style={{
                        flex: 1,
                        padding: '6px',
                        background: 'var(--accent)',
                        color: '#fff',
                        textAlign: 'center',
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 600,
                        textDecoration: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      Download
                    </a>
                    <button
                      onClick={() => removePresentationById(p.id)}
                      style={{
                        padding: '6px 8px',
                        background: 'none',
                        border: '1px solid var(--border)',
                        borderRadius: 4,
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                        fontSize: 10,
                        fontWeight: 600,
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Parse Results Modal */}
      {parseResults && (
        <Overlay onClose={() => setParseResults(null)} wide>
          <h3 style={{ margin: '0 0 8px', color: 'var(--accent-dark)' }}>
            Parsed: {parseResults.presName || 'Presentation'}
          </h3>
          {parseResults.error ? (
            <p style={{ color: '#c00' }}>{parseResults.error}</p>
          ) : (
            <>
              {(() => {
                // Count how many items will be added (slide-linked images, or flat images)
                const slideImgCount = (parseResults.slides || []).reduce((n, s) => n + (s.images || []).length, 0);
                const totalItems = slideImgCount > 0 ? slideImgCount : (parseResults.images || []).length;
                return (
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                    Found {totalItems} image{totalItems !== 1 ? 's' : ''} across {parseResults.slides.length} slide{parseResults.slides.length !== 1 ? 's' : ''}.
                    Review below, choose a category, then add to the Showroom.
                  </p>
                );
              })()}

              {/* Per-slide preview: image + detected style # */}
              {parseResults.slides && parseResults.slides.some(s => s.images && s.images.length > 0) ? (
                <div style={{ marginBottom: 16, maxHeight: 300, overflowY: 'auto' }}>
                  {parseResults.slides.filter(s => s.images && s.images.length > 0).map((slide, si) => (
                    <div key={si} style={{ marginBottom: 12, padding: '10px 12px', background: 'var(--surface2)', borderRadius: 8, border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
                        Slide {slide.slideNum}
                        {slide.detectedStyle && (
                          <span style={{ marginLeft: 8, background: 'var(--accent-dim)', color: 'var(--accent-dark)', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>
                            Style #: {slide.detectedStyle}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {slide.images.map((img, ii) => (
                          <div key={ii} style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', background: '#fff', width: 90 }}>
                            <img src={img.dataUrl} alt={img.filename}
                              style={{ width: '100%', height: 90, objectFit: 'contain', display: 'block' }} />
                          </div>
                        ))}
                      </div>
                      {slide.texts && slide.texts.length > 0 && (
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                          {slide.texts.slice(0, 4).join(' · ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                // Fallback: flat image grid (no rels data)
                parseResults.images && parseResults.images.length > 0 && (
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                    gap: 8, marginBottom: 16, maxHeight: 260, overflowY: 'auto',
                  }}>
                    {parseResults.images.map((img, i) => (
                      <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', background: '#fff' }}>
                        <img src={img.dataUrl} alt={img.filename}
                          style={{ width: '100%', height: 100, objectFit: 'contain', display: 'block' }} />
                        <div style={{ fontSize: 9, color: 'var(--text-muted)', padding: '4px', textAlign: 'center', wordBreak: 'break-all' }}>
                          {img.filename}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}

              {/* Category selector */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={{ fontSize: 13, fontWeight: 600 }}>Category:</label>
                <select
                  id="parse-category"
                  defaultValue={categories[0] || 'Scrubs'}
                  style={{
                    flex: 1, minWidth: 120, padding: '8px 12px', borderRadius: 6,
                    border: '1px solid var(--border)', fontSize: 13,
                    background: 'var(--surface)', color: 'var(--text)',
                  }}
                >
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  {!categories.includes('Scrubs') && <option value="Scrubs">Scrubs</option>}
                  <option value="New Category">New Category</option>
                </select>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    const cat = document.getElementById('parse-category').value;
                    saveParseResults(cat);
                  }}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  Add to Showroom
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => setParseResults(null)}
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </Overlay>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAddStyle(true)}>+ Add Style</button>
        <div style={{ display: 'flex', gap: 8 }}>
          {selectMode && selectedIds.size > 0 && (
            <button className="btn btn-primary btn-sm" onClick={openBuilder}>
              Build Line Sheet ({selectedIds.size})
            </button>
          )}
          <button
            className={`btn ${selectMode ? 'btn-secondary' : 'btn-primary'} btn-sm`}
            onClick={() => {
              setSelectMode(!selectMode);
              if (selectMode) { setSelectedIds(new Set()); setExpandedStyle(null); }
            }}
          >
            {selectMode ? 'Cancel Selection' : 'Custom Line Sheet'}
          </button>
        </div>
      </div>

      {selectMode && (
        <div style={{
          padding: '10px 16px', marginBottom: 16, borderRadius: 8,
          background: 'var(--accent-dim)', border: '1px solid var(--accent)',
          fontSize: 13, color: 'var(--accent-dark)', fontWeight: 500,
        }}>
          Click styles to select them for your custom line sheet. {selectedIds.size} selected.
        </div>
      )}

      {/* Category filters */}
      <div className="filter-pills">
        <button className={`filter-pill ${!activeCategory ? 'active' : ''}`} onClick={() => setActiveCategory('')}>All</button>
        {categories.map(c => (
          <button key={c} className={`filter-pill ${activeCategory === c ? 'active' : ''}`} onClick={() => setActiveCategory(c)}>{c}</button>
        ))}
      </div>

      <div style={{ marginBottom: 20 }}>
        <input className="search-input" style={{ maxWidth: 300 }} placeholder="Search styles..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading...</div>
      ) : (
        <>
          {/* Style grid */}
          <div className="showroom-grid stagger-in">
            {filtered.map(s => {
              const imgUrl = getImage(s);
              const orders = getOrders(s.style_number);
              const hasOrders = orders.length > 0;
              const isExpanded = expandedStyle === s.id;
              const isSelected = selectedIds.has(s.id);

              return (
                <div
                  key={s.id}
                  className="showroom-card"
                  onClick={() => {
                    if (selectMode) {
                      toggleSelect(s.id);
                    } else {
                      setExpandedStyle(isExpanded ? null : s.id);
                    }
                  }}
                  style={{
                    cursor: 'pointer',
                    border: isSelected ? '2px solid var(--accent)' : isExpanded ? '2px solid var(--accent)' : undefined,
                    boxShadow: isSelected ? '0 0 0 3px var(--accent-dim)' : isExpanded ? '0 0 0 3px var(--accent-dim)' : undefined,
                    position: 'relative',
                  }}
                >
                  {/* Selection checkmark */}
                  {selectMode && (
                    <div style={{
                      position: 'absolute', top: 8, right: 8, zIndex: 2,
                      width: 24, height: 24, borderRadius: '50%',
                      background: isSelected ? 'var(--accent)' : 'rgba(255,255,255,0.9)',
                      border: isSelected ? 'none' : '2px solid var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontSize: 14, fontWeight: 700,
                      boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
                    }}>
                      {isSelected ? '✓' : ''}
                    </div>
                  )}
                  <div className="showroom-card-img" style={imgUrl ? {
                    backgroundImage: `url(${imgUrl})`,
                    backgroundSize: 'cover', backgroundPosition: 'center'
                  } : {}}>
                    {!imgUrl && <span style={{ fontSize: 32 }}>&#128087;</span>}
                  </div>
                  <div className="showroom-card-info">
                    <div className="showroom-card-style">{s.style_number}</div>
                    <div className="showroom-card-colors">{s.colors}</div>
                    <div className="showroom-card-ats">{s.color_count} color{s.color_count !== 1 ? 's' : ''} &middot; {s.category}</div>
                    {hasOrders && (
                      <div style={{
                        marginTop: 6, fontSize: 11, fontWeight: 600,
                        color: 'var(--accent-dark)', display: 'flex', alignItems: 'center', gap: 4,
                      }}>
                        <span style={{
                          width: 6, height: 6, borderRadius: '50%',
                          background: 'var(--accent)', display: 'inline-block',
                        }} />
                        {orders.length} active order{orders.length !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                  {/* Delete button — visible on hover via CSS, always shown if not in select mode */}
                  {!selectMode && (
                    <button
                      onClick={e => { e.stopPropagation(); deleteStyle(s); }}
                      title="Delete style"
                      style={{
                        position: 'absolute', top: 6, right: 6, zIndex: 3,
                        width: 22, height: 22, borderRadius: '50%',
                        background: 'rgba(229,62,62,0.85)', border: 'none',
                        color: '#fff', fontSize: 13, lineHeight: 1,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        opacity: 0, transition: 'opacity 0.15s',
                      }}
                      className="card-delete-btn"
                    >×</button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Expanded detail panel */}
          {!selectMode && expandedObj && (
            <div style={{
              marginTop: 20, marginBottom: 20,
              background: 'var(--surface)', border: '1px solid var(--accent)',
              borderRadius: 'var(--radius)', padding: '20px 24px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{expandedObj.style_number}</div>
                  <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{expandedObj.colors} &middot; {expandedObj.category}</span>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => setExpandedStyle(null)} style={{ fontSize: 11 }}>Close</button>
              </div>

              {expandedOrders.length > 0 ? (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 12 }}>
                    Active Orders &amp; Current Reads
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
                    {expandedOrders.map((o, i) => {
                      const reads = readsData[o.readsKey] || '';
                      return (
                        <div key={i} style={{
                          background: 'var(--surface2)', border: '1px solid var(--border)',
                          borderRadius: 6, padding: '14px 16px',
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{o.company}</span>
                            <span style={{ fontSize: 11, color: 'var(--accent-dark)', fontWeight: 600, background: 'var(--accent-dim)', padding: '2px 8px', borderRadius: 4 }}>PO #{o.po}</span>
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>
                            {o.buyer !== 'TBD' ? `Buyer: ${o.buyer}` : ''}
                            {o.buyer !== 'TBD' && o.shipDate ? ' \u00B7 ' : ''}
                            {o.shipDate ? `Shipped: ${o.shipDate}` : ''}
                            {o.qty ? ` \u00B7 Qty: ${o.qty.toLocaleString()}` : ''}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>Current Reads:</span>
                            <input
                              value={reads}
                              onChange={e => updateReads(o.readsKey, e.target.value)}
                              placeholder="Add buyer feedback..."
                              style={{
                                flex: 1, border: '1px solid var(--border)',
                                borderRadius: 4, padding: '5px 8px', fontSize: 12,
                                fontFamily: 'inherit', background: 'var(--surface)',
                                color: reads ? 'var(--text)' : 'var(--text-muted)', outline: 'none',
                              }}
                              onFocus={e => { e.target.style.borderColor = 'var(--accent)'; }}
                              onBlur={e => { e.target.style.borderColor = 'var(--border)'; }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>
                  No active orders for this style.
                </div>
              )}
            </div>
          )}
        </>
      )}

      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>No styles found</div>
      )}

      {/* ── Line Sheet Builder Modal ── */}
      {showBuilder && (
        <Overlay onClose={() => setShowBuilder(false)} wide>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>Custom Line Sheet</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{selectedStyles.length} styles selected</div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowBuilder(false)}>Close</button>
          </div>

          {/* Account selector */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Account</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <select
                className="input"
                style={{ flex: 1 }}
                value={lsAccount}
                onChange={e => setLsAccount(e.target.value)}
              >
                <option value="">Select account...</option>
                {crmAccounts.map(a => <option key={a} value={a}>{a}</option>)}
                <option value="__custom__">+ New account</option>
              </select>
              {lsAccount === '__custom__' && (
                <input
                  className="input"
                  style={{ flex: 1 }}
                  value={lsAccountCustom}
                  onChange={e => setLsAccountCustom(e.target.value)}
                  placeholder="Enter account name..."
                  autoFocus
                />
              )}
            </div>
          </div>

          {/* Style rows with pricing + AI */}
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
            Styles &amp; Pricing
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
            {selectedStyles.map(s => {
              const imgUrl = getImage(s);
              const ai = aiImages[s.id];
              const isAiLoading = aiLoading[s.id];
              return (
                <div key={s.id} style={{
                  display: 'flex', gap: 14, alignItems: 'center',
                  padding: '12px 16px', background: 'var(--surface2)',
                  border: '1px solid var(--border)', borderRadius: 8,
                }}>
                  {/* Thumbnail */}
                  <div style={{
                    width: 56, height: 70, borderRadius: 6, overflow: 'hidden',
                    background: 'var(--surface3)', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {(ai?.approved && ai?.url) ? (
                      <img src={ai.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : imgUrl ? (
                      <img src={imgUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: 20, color: 'var(--text-muted)' }}>&#128087;</span>
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{s.style_number}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{s.colors} &middot; {s.category}</div>
                  </div>

                  {/* Price input */}
                  <div style={{ flexShrink: 0 }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3, fontWeight: 600 }}>Price</div>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, color: 'var(--text-muted)', marginRight: 2 }}>$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={lsPrices[s.id] || ''}
                        onChange={e => setLsPrices(prev => ({ ...prev, [s.id]: e.target.value }))}
                        placeholder="0.00"
                        style={{
                          width: 80, padding: '6px 8px', border: '1px solid var(--border)',
                          borderRadius: 4, fontSize: 13, fontFamily: 'inherit',
                          background: 'var(--surface)', color: 'var(--text)', outline: 'none',
                        }}
                      />
                    </div>
                  </div>

                  {/* AI Model button */}
                  <div style={{ flexShrink: 0, textAlign: 'center' }}>
                    {ai?.approved ? (
                      <div style={{ fontSize: 10, color: 'var(--success)', fontWeight: 700 }}>AI Approved</div>
                    ) : ai?.url ? (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => approveAiImage(s.id)}
                          style={{ fontSize: 10, padding: '4px 8px' }}
                        >Approve</button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => rejectAiImage(s.id)}
                          style={{ fontSize: 10, padding: '4px 8px' }}
                        >Reject</button>
                      </div>
                    ) : ai?.error ? (
                      <div style={{ fontSize: 10, color: 'var(--danger)', maxWidth: 120 }}>{ai.error}</div>
                    ) : (
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => generateAiImage(s)}
                        disabled={isAiLoading}
                        style={{ fontSize: 10, padding: '4px 10px', whiteSpace: 'nowrap' }}
                      >
                        {isAiLoading ? 'Generating...' : 'AI Model'}
                      </button>
                    )}
                  </div>

                  {/* Remove */}
                  <button
                    onClick={() => toggleSelect(s.id)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text-muted)', fontSize: 16, padding: 4, flexShrink: 0,
                    }}
                    title="Remove from line sheet"
                  >&times;</button>
                </div>
              );
            })}
          </div>

          {/* Export button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowBuilder(false)}>Cancel</button>
            <button
              className="btn btn-primary btn-sm"
              onClick={exportLineSheet}
              disabled={exporting || selectedStyles.length === 0}
              style={{ minWidth: 160 }}
            >
              {exporting ? 'Exporting...' : `Export to Excel (${selectedStyles.length})`}
            </button>
          </div>
        </Overlay>
      )}

      {/* Add Style Modal */}
      {showAddStyle && (
        <Overlay onClose={() => setShowAddStyle(false)}>
          <h3 style={{ margin: '0 0 20px', color: 'var(--accent-dark)', fontSize: 17 }}>Add Style</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Style # <span style={{ color: '#e53e3e' }}>*</span></label>
              <input
                autoFocus
                value={addStyleForm.style_number}
                onChange={e => setAddStyleForm(p => ({ ...p, style_number: e.target.value }))}
                placeholder="e.g. SKO-042"
                style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Category</label>
              <input
                value={addStyleForm.category}
                onChange={e => setAddStyleForm(p => ({ ...p, category: e.target.value }))}
                placeholder="e.g. Caftan, Scrubs"
                list="category-list"
                style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }}
              />
              <datalist id="category-list">
                {categories.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Colors</label>
              <input
                value={addStyleForm.colors}
                onChange={e => setAddStyleForm(p => ({ ...p, colors: e.target.value }))}
                placeholder="e.g. Blue/White"
                style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Color Count</label>
              <input
                type="number" min="1"
                value={addStyleForm.color_count}
                onChange={e => setAddStyleForm(p => ({ ...p, color_count: e.target.value }))}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowAddStyle(false)} disabled={addStyleSaving}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={addStyle} disabled={addStyleSaving || !addStyleForm.style_number.trim()} style={{ minWidth: 110 }}>
              {addStyleSaving ? 'Adding…' : 'Add Style'}
            </button>
          </div>
        </Overlay>
      )}

      {/* Hover-reveal delete button CSS */}
      <style>{`.showroom-card:hover .card-delete-btn { opacity: 1 !important; }`}</style>
    </div>
  );
}
