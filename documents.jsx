import React, { useState, useMemo, useRef, useEffect, useCallback } from 'https://esm.sh/react@18';
import ReactDOM from 'https://esm.sh/react-dom@18';
import { marked } from 'https://esm.sh/marked@12';

// ── Icons ──
var FOLDER_SVG   = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>';
var FOLDER_OPEN_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 14l1.45-2.9A2 2 0 019.24 10H20a2 2 0 011.94 2.5l-1.55 6a2 2 0 01-1.94 1.5H4a2 2 0 01-2-2V5a2 2 0 012-2h3.93a2 2 0 011.66.9l.82 1.2a2 2 0 001.66.9H18a2 2 0 012 2v2"/></svg>';
var PDF_SVG      = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15h6"/><path d="M9 11h6"/></svg>';
var WORD_SVG     = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 13l1.5 5 1.5-5 1.5 5 1.5-5"/></svg>';
var EXCEL_SVG    = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M8 13h2"/><path d="M14 13h2"/><path d="M8 17h2"/><path d="M14 17h2"/></svg>';
var DOC_SVG      = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>';
var EXTERNAL_SVG = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';
var REFRESH_SVG  = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>';
var SEARCH_SVG   = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
var CHEVRON_UP   = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>';
var CHEVRON_DN   = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
var X_SVG        = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

function getFileIcon(filename) {
  if (!filename) return DOC_SVG;
  var ext = filename.split('.').pop().toLowerCase();
  if (ext === 'pdf') return PDF_SVG;
  if (ext === 'doc' || ext === 'docx') return WORD_SVG;
  if (ext === 'xls' || ext === 'xlsx') return EXCEL_SVG;
  return DOC_SVG;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  var d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

marked.setOptions({ gfm: true, breaks: false, headerIds: false, mangle: false });

// Encode each path segment so spaces, parens, and non-ASCII chars survive the trip to R2.
// We decode first (to avoid double-encoding already-encoded URLs), then re-encode.
function safeUrl(url) {
  if (!url) return url;
  try {
    var u = new URL(url);
    u.pathname = u.pathname.split('/').map(function (seg) {
      if (!seg) return seg;
      var decoded;
      try { decoded = decodeURIComponent(seg); } catch (e) { decoded = seg; }
      return encodeURIComponent(decoded);
    }).join('/');
    return u.toString();
  } catch (e) {
    return url;
  }
}

// ── Tree building ──
// Build a nested tree from a flat doc list:
//   root.folders[categoryName] = { type:'category', name, folders:{...}, files:[...] }
//   inside which folders[folderName] = { type:'folder', name, folders:{...}, files:[...] }
// Documents with no folder value go directly into their category's files array.
function buildTree(docs) {
  var root = { type: 'root', folders: {}, files: [] };
  for (var i = 0; i < docs.length; i++) {
    var doc = docs[i];
    var cat = (doc.category || 'Uncategorized').trim();
    if (!root.folders[cat]) {
      root.folders[cat] = { type: 'category', name: cat, folders: {}, files: [] };
    }
    var cur = root.folders[cat];
    var folderPath = doc.folder ? String(doc.folder).trim() : '';
    if (folderPath) {
      // Split on either path separator; trim whitespace; drop empties from leading/trailing slashes
      var parts = folderPath.split(/[\/\\]+/).map(function (p) { return p.trim(); }).filter(Boolean);
      for (var j = 0; j < parts.length; j++) {
        var part = parts[j];
        if (!cur.folders[part]) {
          cur.folders[part] = { type: 'folder', name: part, folders: {}, files: [] };
        }
        cur = cur.folders[part];
      }
    }
    cur.files.push(doc);
  }
  return root;
}

// Recursive file count (used for badge on folders/categories).
function countDescendants(node) {
  var n = node.files.length;
  var keys = Object.keys(node.folders);
  for (var i = 0; i < keys.length; i++) n += countDescendants(node.folders[keys[i]]);
  return n;
}

// ── Main Component ──
const DocumentViewer = ({ data, updateData, runQuery }) => {
  const [documents, setDocuments] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [search, setSearch] = useState('');
  const [collapsedPaths, setCollapsedPaths] = useState({}); // keyed by full tree path
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Tabs + markdown state
  const [activeTab, setActiveTab] = useState('pdf');
  const [mdRaw, setMdRaw] = useState('');
  const [mdLoading, setMdLoading] = useState(false);
  const [mdError, setMdError] = useState('');
  const [mdSearch, setMdSearch] = useState('');
  const [currentMatch, setCurrentMatch] = useState(0);
  const mdContentRef = useRef(null);

  // ── Load documents from `data` prop ──
  useEffect(() => {
    var docs = null;
    if (!data) {
      setDocuments([]); setSelectedDoc(null); setLoading(false);
      return;
    }
    if (Array.isArray(data)) {
      docs = data;
    } else if (typeof data === 'object') {
      if (Array.isArray(data.documents)) docs = data.documents;
      else if (Array.isArray(data.data)) docs = data.data;
      else {
        var keys = Object.keys(data);
        if (keys.length > 0 && data[keys[0]] && typeof data[keys[0]] === 'object' && data[keys[0]].id) {
          docs = keys.map(function (k) { return data[k]; });
        }
      }
    }
    if (docs && docs.length > 0) {
      setDocuments(docs); setSelectedDoc(docs[0]); setLoading(false); setError('');
    } else if (data && data.queryName) {
      loadDocuments();
    } else {
      setDocuments([]); setSelectedDoc(null); setLoading(false);
    }
  }, [data]);

  function loadDocuments() {
    if (!data || !data.queryName) {
      setError('No query name provided. Pass { queryName: "your_query" } in the Data field.');
      setLoading(false);
      return;
    }
    setLoading(true); setError('');
    runQuery(data.queryName)
      .then(function (result) {
        var docs = result.data || [];
        setDocuments(docs); setLoading(false); setRefreshing(false);
        if (docs.length > 0 && !selectedDoc) setSelectedDoc(docs[0]);
      })
      .catch(function (err) {
        setError('Failed to load documents: ' + (err.message || 'Unknown error'));
        setLoading(false); setRefreshing(false);
      });
  }

  function handleRefresh() {
    setRefreshing(true);
    setSelectedDoc(null);
    loadDocuments();
  }

  // ── On doc change: reset tab + markdown state ──
  useEffect(() => {
    if (!selectedDoc) return;
    if (selectedDoc.pdf_url) setActiveTab('pdf');
    else if (selectedDoc.md_url) setActiveTab('markdown');
    else setActiveTab('pdf');
    setMdRaw('');
    setMdError('');
    setMdSearch('');
    setCurrentMatch(0);
  }, [selectedDoc && selectedDoc.id]);

  // ── Prefetch markdown the moment a document is selected (regardless of active tab) ──
  // Switching tabs is now instant; R2 egress is free so cost is negligible.
  useEffect(() => {
    if (!selectedDoc || !selectedDoc.md_url) return;
    if (mdRaw || mdLoading) return;

    var cancelled = false;
    setMdLoading(true);
    setMdError('');
    fetch(safeUrl(selectedDoc.md_url))
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .then(function (text) {
        if (cancelled) return;
        setMdRaw(text); setMdLoading(false);
      })
      .catch(function (err) {
        if (cancelled) return;
        var hint = (err && err.message && err.message.indexOf('Failed to fetch') > -1)
          ? ' (often a CORS issue — if you\'re on a custom R2 domain, add a CORS policy in R2 Settings)'
          : '';
        setMdError('Could not load markdown: ' + (err.message || 'unknown') + hint);
        setMdLoading(false);
      });

    return function () { cancelled = true; };
  }, [selectedDoc && selectedDoc.id]);

  // ── Markdown render + search highlighting ──
  const renderedHtml = useMemo(() => {
    if (!mdRaw) return '';
    var html;
    try { html = marked.parse(mdRaw); }
    catch (e) { return '<p style="color:#991b1b">Failed to parse markdown: ' + (e.message || '') + '</p>'; }
    if (!mdSearch) return html;
    var re = new RegExp('(' + escapeRegExp(mdSearch) + ')(?![^<]*>)', 'gi');
    var idx = 0;
    return html.replace(re, function (m) {
      idx += 1;
      return '<mark class="dv-hl" data-idx="' + idx + '">' + m + '</mark>';
    });
  }, [mdRaw, mdSearch]);

  const matchCount = useMemo(() => {
    if (!mdRaw || !mdSearch) return 0;
    var html;
    try { html = marked.parse(mdRaw); } catch (e) { return 0; }
    var re = new RegExp('(' + escapeRegExp(mdSearch) + ')(?![^<]*>)', 'gi');
    var m = html.match(re);
    return m ? m.length : 0;
  }, [mdRaw, mdSearch]);

  useEffect(() => { setCurrentMatch(matchCount > 0 ? 1 : 0); }, [matchCount]);

  useEffect(() => {
    if (!mdContentRef.current) return;
    var marks = mdContentRef.current.querySelectorAll('mark.dv-hl');
    marks.forEach(function (el, i) {
      var isCurrent = (i + 1) === currentMatch;
      el.style.background = isCurrent ? '#f59e0b' : '#fef08a';
      el.style.color = isCurrent ? '#fff' : 'inherit';
      el.style.boxShadow = isCurrent ? '0 0 0 2px rgba(245,158,11,.35)' : 'none';
    });
    if (currentMatch > 0 && marks[currentMatch - 1]) {
      marks[currentMatch - 1].scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [currentMatch, renderedHtml]);

  const gotoNext = useCallback(function () {
    if (matchCount === 0) return;
    setCurrentMatch(function (c) { return c >= matchCount ? 1 : c + 1; });
  }, [matchCount]);
  const gotoPrev = useCallback(function () {
    if (matchCount === 0) return;
    setCurrentMatch(function (c) { return c <= 1 ? matchCount : c - 1; });
  }, [matchCount]);
  const onMdSearchKeyDown = useCallback(function (e) {
    if (e.key === 'Enter') { e.preventDefault(); e.shiftKey ? gotoPrev() : gotoNext(); }
    else if (e.key === 'Escape') { setMdSearch(''); }
  }, [gotoNext, gotoPrev]);

  // ── Sidebar filter + tree ──
  function toggleCollapse(path) {
    setCollapsedPaths(function (prev) {
      var next = {};
      for (var k in prev) next[k] = prev[k];
      next[path] = !prev[path];
      return next;
    });
  }

  var filtered = documents;
  if (search) {
    var s = search.toLowerCase();
    filtered = documents.filter(function (d) {
      return (d.name && d.name.toLowerCase().indexOf(s) > -1) ||
        (d.category && d.category.toLowerCase().indexOf(s) > -1) ||
        (d.travel_type && d.travel_type.toLowerCase().indexOf(s) > -1) ||
        (d.audience && d.audience.toLowerCase().indexOf(s) > -1) ||
        (d.folder && d.folder.toLowerCase().indexOf(s) > -1);
    });
  }

  const tree = useMemo(function () { return buildTree(filtered); }, [filtered]);
  // When searching, force-expand everything so matches aren't hidden inside collapsed folders.
  const effectiveCollapsed = search ? {} : collapsedPaths;

  // Recursive renderer for the tree. depth=0 means we're rendering the root's children (categories).
  function renderChildren(node, depth, pathPrefix) {
    var folderNames = Object.keys(node.folders).sort(function (a, b) { return a.localeCompare(b); });
    var sortedFiles = node.files.slice().sort(function (a, b) {
      return (a.name || '').localeCompare(b.name || '');
    });

    var out = [];

    for (var i = 0; i < folderNames.length; i++) {
      var name = folderNames[i];
      var child = node.folders[name];
      var childPath = pathPrefix + '/' + name;
      var isCollapsed = !!effectiveCollapsed[childPath];
      var count = countDescendants(child);
      var isCategory = child.type === 'category';

      out.push(
        <React.Fragment key={childPath}>
          {isCategory ? (
            // Category header — existing styling preserved
            <div
              onClick={toggleCollapse.bind(null, childPath)}
              style={{
                padding: '8px 14px', fontSize: '.75rem', fontWeight: 600, color: '#64748b', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6, background: '#f8f9fb',
                borderTop: '1px solid #eef0f4', borderBottom: '1px solid #eef0f4',
                userSelect: 'none', textTransform: 'uppercase', letterSpacing: '.03em'
              }}
            >
              <span style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform .15s', fontSize: '10px' }}>▼</span>
              <span style={{ display: 'flex', alignItems: 'center', color: '#94a3b8' }}
                    dangerouslySetInnerHTML={{ __html: FOLDER_SVG }} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{child.name}</span>
              <span style={{ fontSize: '.7rem', color: '#94a3b8', fontWeight: 400 }}>{count}</span>
            </div>
          ) : (
            // Sub-folder row — indented by depth
            <FolderRow
              name={child.name}
              count={count}
              depth={depth}
              isCollapsed={isCollapsed}
              onToggle={toggleCollapse.bind(null, childPath)}
            />
          )}
          {!isCollapsed && renderChildren(child, depth + 1, childPath)}
        </React.Fragment>
      );
    }

    for (var k = 0; k < sortedFiles.length; k++) {
      var doc = sortedFiles[k];
      out.push(
        <FileRow
          key={doc.id}
          doc={doc}
          depth={depth}
          isSelected={selectedDoc && selectedDoc.id === doc.id}
          onClick={function (d) { return function () { setSelectedDoc(d); }; }(doc)}
        />
      );
    }

    return out;
  }

  // ── Tab availability ──
  var hasPdf = !!(selectedDoc && selectedDoc.pdf_url);
  var hasMd  = !!(selectedDoc && selectedDoc.md_url);
  var hasSp  = !!(selectedDoc && selectedDoc.link);

  return (
    <div style={{display:'flex',height:'100vh',fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif",background:'#f8f9fb',overflow:'hidden'}}>

      {/* ── Sidebar ── */}
      <div style={{width:280,minWidth:280,background:'#fff',borderRight:'1px solid #e2e6ed',display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <div style={{padding:'16px 14px 10px',borderBottom:'1px solid #eef0f4'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
            <div style={{fontSize:'.82rem',fontWeight:700,color:'#0c1425',letterSpacing:'.02em',textTransform:'uppercase'}}>
              Documents
            </div>
            <div
              onClick={handleRefresh}
              title="Refresh documents"
              style={{
                cursor:'pointer',color: refreshing ? '#6366f1' : '#8796ab',
                transition:'all .2s',display:'flex',alignItems:'center',
                animation: refreshing ? 'spin .6s linear infinite' : 'none'
              }}
              dangerouslySetInnerHTML={{__html: REFRESH_SVG}}
            />
          </div>
          <input
            type="text"
            placeholder="Search documents..."
            value={search}
            onChange={function (e) { setSearch(e.target.value); }}
            style={{width:'100%',padding:'8px 10px',border:'1px solid #dde1e9',borderRadius:6,fontSize:'.8rem',color:'#2d3d52',background:'#f8f9fb',outline:'none',boxSizing:'border-box'}}
          />
        </div>

        <div style={{flex:1,overflowY:'auto',padding:'6px 0'}}>
          {loading ? (
            <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,color:'#8796ab',fontSize:'.82rem',padding:'40px 20px'}}>
              <div style={{width:16,height:16,border:'2px solid #e2e6ed',borderTopColor:'#6366f1',borderRadius:'50%',animation:'spin .6s linear infinite'}} />
              Loading...
            </div>
          ) : error ? (
            <div style={{padding:'20px 14px',color:'#991b1b',fontSize:'.8rem'}}>{error}</div>
          ) : Object.keys(tree.folders).length === 0 ? (
            <div style={{padding:'40px 20px',textAlign:'center',color:'#8796ab',fontSize:'.82rem'}}>
              No documents found
            </div>
          ) : (
            renderChildren(tree, 0, '')
          )}
        </div>

        <div style={{fontSize:'.7rem',color:'#8796ab',padding:'8px 14px',borderTop:'1px solid #eef0f4'}}>
          {filtered.length} document{filtered.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* ── Viewer ── */}
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:'#fff'}}>
        {selectedDoc ? (
          <>
            {/* Header */}
            <div style={{padding:'16px 24px',borderBottom:'1px solid #e2e6ed',background:'#fff'}}>
              <div style={{display:'flex',alignItems:'flex-start',gap:12}}>
                <span style={{flexShrink:0,display:'flex',alignItems:'center',marginTop:2}} dangerouslySetInnerHTML={{__html: getFileIcon(selectedDoc.name)}} />
                <div style={{flex:1,minWidth:0}}>
                  <h1 style={{fontSize:'1.1rem',fontWeight:600,color:'#0c1425',margin:'0 0 6px',lineHeight:'1.3'}}>
                    {selectedDoc.name}
                  </h1>
                  <div style={{display:'flex',flexWrap:'wrap',gap:'6px 16px',fontSize:'.75rem',color:'#64748b'}}>
                    {selectedDoc.category && <span><span style={{fontWeight:500}}>Category:</span> {selectedDoc.category.trim()}</span>}
                    {selectedDoc.folder && <span><span style={{fontWeight:500}}>Folder:</span> {selectedDoc.folder}</span>}
                    {selectedDoc.travel_type && <span><span style={{fontWeight:500}}>Type:</span> {selectedDoc.travel_type}</span>}
                    {selectedDoc.audience && <span><span style={{fontWeight:500}}>Audience:</span> {selectedDoc.audience}</span>}
                    {selectedDoc.gds && <span><span style={{fontWeight:500}}>GDS:</span> {selectedDoc.gds}</span>}
                  </div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:'6px 16px',fontSize:'.72rem',color:'#94a3b8',marginTop:6}}>
                    {selectedDoc.modified_by && (
                      <span>Modified by {selectedDoc.modified_by} on {formatDate(selectedDoc.modified)}</span>
                    )}
                    {!selectedDoc.modified_by && selectedDoc.created_by && (
                      <span>Created by {selectedDoc.created_by} on {formatDate(selectedDoc.created)}</span>
                    )}
                  </div>
                </div>

                {hasSp && (
                  <a
                    href={selectedDoc.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display:'flex',alignItems:'center',gap:6,
                      padding:'8px 14px',background:'#4f46e5',color:'#fff',
                      borderRadius:6,fontSize:'.78rem',fontWeight:500,
                      textDecoration:'none',whiteSpace:'nowrap',transition:'background .15s'
                    }}
                    onMouseEnter={function (e) { e.currentTarget.style.background = '#4338ca'; }}
                    onMouseLeave={function (e) { e.currentTarget.style.background = '#4f46e5'; }}
                    title="Opens the SharePoint document in a new tab"
                  >
                    View SharePoint Document
                    <span dangerouslySetInnerHTML={{__html: EXTERNAL_SVG}} />
                  </a>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div style={{display:'flex',alignItems:'stretch',borderBottom:'1px solid #e2e6ed',background:'#fff',padding:'0 24px',gap:4}}>
              <TabButton
                active={activeTab === 'pdf'}
                disabled={!hasPdf}
                onClick={function () { if (hasPdf) setActiveTab('pdf'); }}
                label="PDF"
              />
              <TabButton
                active={activeTab === 'markdown'}
                disabled={!hasMd}
                onClick={function () { if (hasMd) setActiveTab('markdown'); }}
                label={mdLoading && hasMd ? 'Markdown (loading…)' : 'Markdown'}
              />
            </div>

            {/* Body */}
            <div style={{flex:1,overflow:'hidden',background:'#f1f3f8',position:'relative',display:'flex',flexDirection:'column'}}>
              {activeTab === 'pdf' && (
                hasPdf ? (
                  <iframe
                    key={selectedDoc.pdf_url}
                    src={safeUrl(selectedDoc.pdf_url)}
                    style={{width:'100%',height:'100%',border:'none',flex:1}}
                    title={selectedDoc.name + ' (PDF)'}
                  />
                ) : (
                  <EmptyPane message="No PDF available for this document." />
                )
              )}

              {activeTab === 'markdown' && (
                hasMd ? (
                  <>
                    {/* Search bar */}
                    <div style={{display:'flex',alignItems:'center',gap:8,padding:'10px 16px',background:'#fff',borderBottom:'1px solid #e2e6ed'}}>
                      <span style={{display:'flex',alignItems:'center',color:'#8796ab'}} dangerouslySetInnerHTML={{__html: SEARCH_SVG}} />
                      <input
                        type="text"
                        placeholder="Find in document..."
                        value={mdSearch}
                        onChange={function (e) { setMdSearch(e.target.value); }}
                        onKeyDown={onMdSearchKeyDown}
                        style={{flex:1,padding:'6px 8px',border:'1px solid #dde1e9',borderRadius:6,fontSize:'.82rem',color:'#2d3d52',background:'#f8f9fb',outline:'none'}}
                      />
                      <span style={{fontSize:'.75rem',color:'#64748b',minWidth:72,textAlign:'right'}}>
                        {mdSearch ? (matchCount > 0 ? (currentMatch + ' of ' + matchCount) : '0 matches') : ''}
                      </span>
                      <IconButton title="Previous match (Shift+Enter)" onClick={gotoPrev} disabled={matchCount === 0} svg={CHEVRON_UP} />
                      <IconButton title="Next match (Enter)" onClick={gotoNext} disabled={matchCount === 0} svg={CHEVRON_DN} />
                      {mdSearch && (
                        <IconButton title="Clear search (Esc)" onClick={function () { setMdSearch(''); }} svg={X_SVG} />
                      )}
                    </div>

                    {/* Rendered markdown */}
                    <div style={{flex:1,overflowY:'auto',background:'#fff'}}>
                      {mdLoading ? (
                        <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,color:'#8796ab',fontSize:'.85rem',padding:'60px 20px'}}>
                          <div style={{width:16,height:16,border:'2px solid #e2e6ed',borderTopColor:'#6366f1',borderRadius:'50%',animation:'spin .6s linear infinite'}} />
                          Loading markdown...
                        </div>
                      ) : mdError ? (
                        <div style={{padding:'24px',color:'#991b1b',fontSize:'.85rem',lineHeight:1.5}}>{mdError}</div>
                      ) : (
                        <div
                          ref={mdContentRef}
                          className="dv-md"
                          style={{padding:'24px 32px',maxWidth:900,margin:'0 auto',color:'#1f2937',fontSize:'.9rem',lineHeight:1.65}}
                          dangerouslySetInnerHTML={{__html: renderedHtml}}
                        />
                      )}
                    </div>
                  </>
                ) : (
                  <EmptyPane message="No markdown version available for this document." />
                )
              )}
            </div>
          </>
        ) : (
          <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',color:'#8796ab',fontSize:'.88rem',padding:40}}>
            <div style={{marginBottom:12,opacity:.5}} dangerouslySetInnerHTML={{__html: DOC_SVG.replace('width="14" height="14"', 'width="48" height="48"')}} />
            <div style={{fontWeight:500,color:'#64748b',marginBottom:4}}>No document selected</div>
            <div style={{fontSize:'.8rem'}}>Select a document from the sidebar to preview</div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #9ca3af; }

        .dv-md h1 { font-size: 1.55rem; font-weight: 700; margin: 1.4em 0 .6em; color: #0c1425; border-bottom: 1px solid #e2e6ed; padding-bottom: .3em; }
        .dv-md h2 { font-size: 1.25rem; font-weight: 700; margin: 1.3em 0 .5em; color: #0c1425; }
        .dv-md h3 { font-size: 1.05rem; font-weight: 600; margin: 1.2em 0 .4em; color: #1f2937; }
        .dv-md h4 { font-size: .95rem; font-weight: 600; margin: 1.1em 0 .3em; color: #1f2937; }
        .dv-md p { margin: .6em 0; }
        .dv-md ul, .dv-md ol { margin: .5em 0 .8em 1.4em; padding: 0; }
        .dv-md li { margin: .25em 0; }
        .dv-md a { color: #4f46e5; text-decoration: underline; }
        .dv-md a:hover { color: #4338ca; }
        .dv-md code { background: #f1f3f8; padding: .12em .35em; border-radius: 4px; font-family: 'SF Mono', Menlo, Consolas, monospace; font-size: .85em; color: #b91c1c; }
        .dv-md pre { background: #0f172a; color: #e2e8f0; padding: 14px 16px; border-radius: 8px; overflow-x: auto; margin: .8em 0; font-size: .82rem; }
        .dv-md pre code { background: transparent; color: inherit; padding: 0; font-size: inherit; }
        .dv-md blockquote { border-left: 3px solid #cbd5e1; padding: .2em 0 .2em .9em; color: #475569; margin: .8em 0; font-style: italic; }
        .dv-md table { border-collapse: collapse; width: 100%; margin: .9em 0; font-size: .85rem; }
        .dv-md th, .dv-md td { border: 1px solid #e2e6ed; padding: 6px 10px; text-align: left; }
        .dv-md th { background: #f8f9fb; font-weight: 600; }
        .dv-md img { max-width: 100%; height: auto; border-radius: 4px; }
        .dv-md hr { border: none; border-top: 1px solid #e2e6ed; margin: 1.4em 0; }

        .dv-md mark.dv-hl { background: #fef08a; padding: 0 2px; border-radius: 2px; transition: background .15s, box-shadow .15s; }

        .dv-folder-row:hover { background: #f1f3f8 !important; }
        .dv-file-row:hover:not(.dv-file-row-selected) { background: #f8f9fb; }
      `}</style>
    </div>
  );
};

// ── Tree row subcomponents ──
// Sub-folder row (depth ≥ 1). Indentation grows with depth.
// At depth 1 we sit just inside the category; depth 2+ adds 16px per level.
function FolderRow({ name, count, depth, isCollapsed, onToggle }) {
  var leftPad = 22 + (depth - 1) * 16;
  return (
    <div
      className="dv-folder-row"
      onClick={onToggle}
      style={{
        padding: '7px 14px 7px ' + leftPad + 'px',
        fontSize: '.78rem', fontWeight: 500, color: '#475569', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 6,
        userSelect: 'none', transition: 'background .12s'
      }}
    >
      <span style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform .15s', fontSize: '10px', color: '#94a3b8', width: 10, display: 'inline-block' }}>▼</span>
      <span style={{ display: 'flex', alignItems: 'center', color: '#94a3b8' }}
            dangerouslySetInnerHTML={{ __html: isCollapsed ? FOLDER_SVG : FOLDER_OPEN_SVG }} />
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
      <span style={{ fontSize: '.7rem', color: '#94a3b8', fontWeight: 400 }}>{count}</span>
    </div>
  );
}

// Document row. Depth = depth of the container it sits in.
// Files directly under a category use depth=0 and 36px left padding (matches the original layout).
function FileRow({ doc, depth, isSelected, onClick }) {
  var leftPad = 36 + depth * 16;
  return (
    <div
      className={'dv-file-row' + (isSelected ? ' dv-file-row-selected' : '')}
      onClick={onClick}
      style={{
        padding: '8px 14px 8px ' + leftPad + 'px',
        fontSize: '.8rem',
        color: isSelected ? '#4f46e5' : '#3b4c63',
        cursor: 'pointer',
        borderLeft: isSelected ? '3px solid #6366f1' : '3px solid transparent',
        background: isSelected ? '#eef0ff' : 'transparent',
        fontWeight: isSelected ? 500 : 400,
        display: 'flex', alignItems: 'center', gap: 8, transition: 'all .12s', lineHeight: '1.3'
      }}
    >
      <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}
            dangerouslySetInnerHTML={{ __html: getFileIcon(doc.name) }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</span>
    </div>
  );
}

function TabButton({ active, disabled, onClick, label }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding:'10px 18px',fontSize:'.82rem',fontWeight: active ? 600 : 500,
        color: disabled ? '#cbd5e1' : (active ? '#4f46e5' : '#64748b'),
        cursor: disabled ? 'not-allowed' : 'pointer',
        borderBottom: active ? '2px solid #4f46e5' : '2px solid transparent',
        marginBottom:-1,userSelect:'none',transition:'color .12s, border-color .12s'
      }}
    >{label}</div>
  );
}

function IconButton({ title, onClick, disabled, svg }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        display:'flex',alignItems:'center',justifyContent:'center',
        width:28,height:28,padding:0,
        background: disabled ? '#f8f9fb' : '#fff',
        border:'1px solid #dde1e9',borderRadius:6,
        color: disabled ? '#cbd5e1' : '#475569',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition:'background .12s, color .12s'
      }}
      onMouseEnter={function (e) { if (!disabled) e.currentTarget.style.background = '#eef0ff'; }}
      onMouseLeave={function (e) { if (!disabled) e.currentTarget.style.background = '#fff'; }}
      dangerouslySetInnerHTML={{__html: svg}}
    />
  );
}

function EmptyPane({ message }) {
  return (
    <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:'#8796ab',fontSize:'.85rem',padding:40,textAlign:'center'}}>
      {message}
    </div>
  );
}

const ConnectedComponent = Tooljet.connectComponent(DocumentViewer);
ReactDOM.render(<ConnectedComponent />, document.body);
