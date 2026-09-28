/**
 * OBT Topics Manager - ToolJet Custom Component
 * Architecture matched to Passport & Visa Manager / General Topics Manager
 *
 * Actual DB schema (public.obt_topics):
 *   id, obt_topic_idx, topic, detail, gcn, smid, lcn,
 *   category (FK → edit_obt_ref.id), last_updated, updated_by
 *
 * edit_obt_ref schema:
 *   id, obt_name
 *
 * Data binding (triple curly braces):
 * {{{
 *   topics: queries.postgresql_get_filtered_obt_topics,
 *   obtRefs: queries.edit_obt_ref.data,
 *   smidOptions: queries.postgresql_get_filtered_SMID_menu.data,
 *   lcnOptions: queries.postgresql_get_filtered_lcn_menu.data,
 *   selectedSmid: page.variables.var_selected_SMID,
 *   selectedLcn: page.variables.var_selected_lcn,
 *   canEdit: true,
 *   currentUser: globals.currentUser.firstName,
 *   listenerQuery: 'obt_topics_manager',
 *   _refresh: page.variables.var_policy_refresh_key || 0
 *}}}
 */

import React, { useState, useMemo, useRef, useCallback } from 'https://esm.sh/react@18';
import ReactDOM from 'https://esm.sh/react-dom@18';

// =============================================================================
// UTILITIES
// =============================================================================

function extractQueryData(q) {
  if (!q) return [];
  if (Array.isArray(q)) return q;
  if (q.rawData && Array.isArray(q.rawData) && q.data && Array.isArray(q.data)) {
    if (Object.keys(q.rawData[0] || {}).length > Object.keys(q.data[0] || {}).length) return q.rawData;
  }
  if (q.data && Array.isArray(q.data)) return q.data;
  if (q.rawData && Array.isArray(q.rawData)) return q.rawData;
  return [];
}

function parsePgArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(function(v) { return String(v).trim(); }).filter(Boolean);
  var str = String(val).trim();
  if (str.charAt(0) === '{') str = str.slice(1);
  if (str.charAt(str.length - 1) === '}') str = str.slice(0, -1);
  if (!str) return [];
  var result = [];
  var current = '';
  var inQuote = false;
  for (var i = 0; i < str.length; i++) {
    var ch = str.charAt(i);
    if (ch === '"') { inQuote = !inQuote; continue; }
    if (ch === ',' && !inQuote) { result.push(current.trim()); current = ''; continue; }
    current += ch;
  }
  if (current.trim()) result.push(current.trim());
  return result.filter(Boolean);
}

/**
 * Normalize a SMID or LCN value for comparison.
 * Handles both single scalar values ("216026") and pg-array strings ("{216026,216027}").
 * Returns an array of normalized string tokens.
 */
function normArray(val) {
  if (!val) return [];
  var arr = parsePgArray(val);
  if (arr.length > 0) return arr.map(function(v) { return String(v).trim(); });
  // fallback: treat as single scalar
  var s = String(val).trim();
  return s ? [s] : [];
}

function norm(v) { return String(v || '').trim().toLowerCase().replace(/"/g, ''); }

function fmtTimestamp(d) {
  if (!d) return '—';
  var dt = new Date(d);
  if (isNaN(dt)) return '—';
  return dt.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function obtRefName(categoryId, obtRefs) {
  if (!categoryId && categoryId !== 0) return 'No Reference';
  var v = obtRefs.find(function(x) { return x.id === categoryId || String(x.id) === String(categoryId); });
  return v ? v.obt_name : 'No Reference';
}

function nullIfEmpty(v) { return (v && String(v).trim() !== '') ? v : null; }

// =============================================================================
// ICONS
// =============================================================================

var ICO = {
  edit: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21H3v-3.5L16.732 3.732z"/></svg>',
  trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 002 2h8a2 2 0 002-2l1-12M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3"/></svg>',
  plus: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  search: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  clock: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  user: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  file: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
  x: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  bold: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z"/><path d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z"/></svg>',
  italic: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>',
  heading: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 4v16"/><path d="M18 4v16"/><path d="M6 12h12"/></svg>',
  list: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
  link: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>',
  quote: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M10 8H6a2 2 0 00-2 2v2a2 2 0 002 2h2v2a2 2 0 01-2 2H5v2h1a4 4 0 004-4V8zm10 0h-4a2 2 0 00-2 2v2a2 2 0 002 2h2v2a2 2 0 01-2 2h-1v2h1a4 4 0 004-4V8z"/></svg>',
  listOl: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><text x="4" y="7.5" font-size="7" fill="currentColor" stroke="none" font-family="sans-serif">1</text><text x="4" y="13.5" font-size="7" fill="currentColor" stroke="none" font-family="sans-serif">2</text><text x="4" y="19.5" font-size="7" fill="currentColor" stroke="none" font-family="sans-serif">3</text></svg>',
  obt: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
  tag: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',
};

function Ico(props) {
  return React.createElement('span', {
    style: { display: 'inline-flex', flexShrink: 0, color: props.color || 'currentColor' },
    dangerouslySetInnerHTML: { __html: ICO[props.name] || '' }
  });
}

// =============================================================================
// MARKDOWN TOOLBAR
// =============================================================================

function MarkdownToolbar(props) {
  var textareaRef = props.textareaRef;
  var value = props.value;
  var onChange = props.onChange;

  function wrapSelection(before, after) {
    var ta = textareaRef.current;
    if (!ta) return;
    var start = ta.selectionStart;
    var end = ta.selectionEnd;
    var text = value;
    var selected = text.substring(start, end);
    var replacement = before + (selected || 'text') + (after || before);
    var newText = text.substring(0, start) + replacement + text.substring(end);
    onChange(newText);
    setTimeout(function() {
      ta.focus();
      var newStart = start + before.length;
      var newEnd = newStart + (selected || 'text').length;
      ta.setSelectionRange(newStart, newEnd);
    }, 0);
  }

  function prefixLines(prefix) {
    var ta = textareaRef.current;
    if (!ta) return;
    var start = ta.selectionStart;
    var end = ta.selectionEnd;
    var text = value;
    var lineStart = text.lastIndexOf('\n', start - 1) + 1;
    var lineEnd = text.indexOf('\n', end);
    if (lineEnd === -1) lineEnd = text.length;
    var lines = text.substring(lineStart, lineEnd).split('\n');
    var prefixed = lines.map(function(line, i) {
      if (prefix === '1. ') return (i + 1) + '. ' + line;
      return prefix + line;
    }).join('\n');
    var newText = text.substring(0, lineStart) + prefixed + text.substring(lineEnd);
    onChange(newText);
    setTimeout(function() { ta.focus(); }, 0);
  }

  function insertLink() {
    var ta = textareaRef.current;
    if (!ta) return;
    var start = ta.selectionStart;
    var end = ta.selectionEnd;
    var text = value;
    var selected = text.substring(start, end);
    var linkText = selected || 'link text';
    var replacement = '[' + linkText + '](url)';
    var newText = text.substring(0, start) + replacement + text.substring(end);
    onChange(newText);
    setTimeout(function() {
      ta.focus();
      var urlStart = start + linkText.length + 3;
      ta.setSelectionRange(urlStart, urlStart + 3);
    }, 0);
  }

  var btnStyle = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 28, height: 26, border: '1px solid #E5E7EB', borderRadius: 4,
    background: '#fff', cursor: 'pointer', color: '#6B7280', padding: 0,
  };

  var sepStyle = { width: 1, height: 18, background: '#E5E7EB', margin: '0 4px', flexShrink: 0 };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '4px 6px', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB', borderRadius: '5px 5px 0 0', flexWrap: 'wrap' }}>
      <button type="button" style={btnStyle} title="Bold" onClick={function() { wrapSelection('**'); }}><Ico name="bold" /></button>
      <button type="button" style={btnStyle} title="Italic" onClick={function() { wrapSelection('*'); }}><Ico name="italic" /></button>
      <div style={sepStyle} />
      <button type="button" style={btnStyle} title="Heading" onClick={function() { prefixLines('### '); }}><Ico name="heading" /></button>
      <button type="button" style={btnStyle} title="Bullet List" onClick={function() { prefixLines('- '); }}><Ico name="list" /></button>
      <button type="button" style={btnStyle} title="Numbered List" onClick={function() { prefixLines('1. '); }}><Ico name="listOl" /></button>
      <div style={sepStyle} />
      <button type="button" style={btnStyle} title="Link" onClick={insertLink}><Ico name="link" /></button>
      <button type="button" style={btnStyle} title="Quote" onClick={function() { prefixLines('> '); }}><Ico name="quote" /></button>
    </div>
  );
}

// =============================================================================
// SHARED SELECTOR STYLES
// =============================================================================

var CS = {
  section: { marginTop: '8px', marginBottom: '8px', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e2e8f0' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' },
  headerActions: { display: 'flex', gap: '4px', alignItems: 'center' },
  sep: { margin: '0 4px', color: '#94a3b8', fontSize: '11px' },
  grid: { display: 'flex', flexWrap: 'wrap', maxHeight: '180px', overflowY: 'auto' },
  tag: { display: 'flex', alignItems: 'center', padding: '6px 10px', fontSize: '12px', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', marginRight: '8px', marginBottom: '8px', cursor: 'pointer' },
  countryTag: { marginLeft: '4px', fontSize: '10px', color: '#94a3b8' },
};

function selectorBtn(color) {
  return { fontSize: '11px', color: color, cursor: 'pointer', textDecoration: 'underline', background: 'none', border: 'none', padding: 0, fontWeight: 500 };
}

function checkboxDot(sel, color) {
  return { width: 14, height: 14, borderRadius: 3, marginRight: 6, border: '2px solid ' + (sel ? color : '#e2e8f0'), backgroundColor: sel ? color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 };
}

// =============================================================================
// SELECTORS (SMID & LCN)
// =============================================================================

function SmidSelector(props) {
  var smidOptions = props.smidOptions;
  var selSmids = props.selSmids;
  var setSelSmids = props.setSelSmids;
  if (!smidOptions || smidOptions.length === 0) return null;
  var toggle = function(id) {
    var sid = String(id);
    setSelSmids(function(prev) { return prev.indexOf(sid) >= 0 ? prev.filter(function(x) { return x !== sid; }) : [].concat(prev, [sid]); });
  };
  var isSelected = function(optionSmid) {
    var nOpt = norm(optionSmid);
    return selSmids.some(function(sel) { return norm(sel) === nOpt; });
  };
  var selectedCount = smidOptions.filter(function(s) { return isSelected(s.smid); }).length;
  return (
    <div style={CS.section}>
      <div style={CS.header}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#3b82f6' }}>SMID ({selectedCount}/{smidOptions.length})</span>
        <div style={CS.headerActions}>
          <button type="button" style={selectorBtn('#3b82f6')} onClick={function() { setSelSmids(smidOptions.map(function(s) { return String(s.smid); })); }}>Select All</button>
          <span style={CS.sep}>|</span>
          <button type="button" style={selectorBtn('#3b82f6')} onClick={function() { setSelSmids([]); }}>Clear</button>
        </div>
      </div>
      <div style={CS.grid}>
        {smidOptions.map(function(s) {
          var sid = String(s.smid);
          var isSel = isSelected(s.smid);
          return (
            <div key={sid} style={Object.assign({}, CS.tag, isSel ? { backgroundColor: '#eff6ff', borderColor: '#3b82f6' } : {})} onClick={function() { toggle(s.smid); }}>
              <span style={checkboxDot(isSel, '#3b82f6')}>{isSel ? <span style={{ color: '#fff', fontSize: '10px' }}>✓</span> : null}</span>
              {s.title || sid}
              {s.country_a2 ? <span style={CS.countryTag}>({s.country_a2})</span> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LcnSelector(props) {
  var lcnOptions = props.lcnOptions;
  var selLcns = props.selLcns;
  var setSelLcns = props.setSelLcns;
  if (!lcnOptions || lcnOptions.length === 0) return null;
  var getKey = function(l) { return String(l.lcn_number || l.lcn || l.lcn_name || ''); };
  var getLabel = function(l) { return l.lcn_name || l.lcn_number || l.lcn || ''; };
  var toggle = function(id) {
    var lid = String(id);
    setSelLcns(function(prev) { return prev.indexOf(lid) >= 0 ? prev.filter(function(x) { return x !== lid; }) : [].concat(prev, [lid]); });
  };
  var isSelected = function(optKey) {
    var nOpt = norm(optKey);
    return selLcns.some(function(sel) { return norm(sel) === nOpt; });
  };
  var selectedCount = lcnOptions.filter(function(l) { return isSelected(getKey(l)); }).length;
  return (
    <div style={CS.section}>
      <div style={CS.header}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#8b5cf6' }}>LCN ({selectedCount}/{lcnOptions.length})</span>
        <div style={CS.headerActions}>
          <button type="button" style={selectorBtn('#8b5cf6')} onClick={function() { setSelLcns(lcnOptions.map(function(l) { return getKey(l); })); }}>Select All</button>
          <span style={CS.sep}>|</span>
          <button type="button" style={selectorBtn('#8b5cf6')} onClick={function() { setSelLcns([]); }}>Clear</button>
        </div>
      </div>
      <div style={CS.grid}>
        {lcnOptions.map(function(l, i) {
          var lid = getKey(l);
          var isSel = isSelected(lid);
          return (
            <div key={lid || i} style={Object.assign({}, CS.tag, isSel ? { backgroundColor: '#f5f3ff', borderColor: '#8b5cf6' } : {})} onClick={function() { toggle(lid); }}>
              <span style={checkboxDot(isSel, '#8b5cf6')}>{isSel ? <span style={{ color: '#fff', fontSize: '10px' }}>✓</span> : null}</span>
              {getLabel(l)}
              {l.smid_country_a2 ? <span style={CS.countryTag}>({l.smid_country_a2})</span> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// MARKDOWN RENDERER
// =============================================================================

function RenderMarkdown(props) {
  var text = props.text || '';
  if (!text) return React.createElement('span', { style: { color: '#9CA3AF', fontStyle: 'italic' } }, 'No detail provided.');

  var lines = text.split('\n');
  var elements = [];
  var i = 0;

  while (i < lines.length) {
    var line = lines[i];

    if (line.match(/^### /)) {
      elements.push(React.createElement('h4', { key: i, style: { fontSize: '14px', fontWeight: 700, color: '#111827', margin: '12px 0 4px' } }, renderInline(line.slice(4))));
      i++; continue;
    }
    if (line.match(/^## /)) {
      elements.push(React.createElement('h3', { key: i, style: { fontSize: '15px', fontWeight: 700, color: '#111827', margin: '12px 0 4px' } }, renderInline(line.slice(3))));
      i++; continue;
    }
    if (line.match(/^# /)) {
      elements.push(React.createElement('h2', { key: i, style: { fontSize: '16px', fontWeight: 700, color: '#111827', margin: '12px 0 4px' } }, renderInline(line.slice(2))));
      i++; continue;
    }

    if (line.match(/^> /)) {
      elements.push(React.createElement('div', { key: i, style: { borderLeft: '3px solid #3B82F6', paddingLeft: '12px', margin: '6px 0', color: '#4B5563', fontStyle: 'italic' } }, renderInline(line.slice(2))));
      i++; continue;
    }

    if (line.match(/^- /)) {
      var listItems = [];
      while (i < lines.length && lines[i].match(/^- /)) {
        listItems.push(React.createElement('li', { key: i, style: { marginBottom: '2px' } }, renderInline(lines[i].slice(2))));
        i++;
      }
      elements.push(React.createElement('ul', { key: 'ul' + i, style: { margin: '6px 0', paddingLeft: '20px' } }, listItems));
      continue;
    }

    if (line.match(/^\d+\. /)) {
      var olItems = [];
      while (i < lines.length && lines[i].match(/^\d+\. /)) {
        olItems.push(React.createElement('li', { key: i, style: { marginBottom: '2px' } }, renderInline(lines[i].replace(/^\d+\.\s/, ''))));
        i++;
      }
      elements.push(React.createElement('ol', { key: 'ol' + i, style: { margin: '6px 0', paddingLeft: '20px' } }, olItems));
      continue;
    }

    if (line.trim() === '') {
      elements.push(React.createElement('div', { key: i, style: { height: '8px' } }));
      i++; continue;
    }

    elements.push(React.createElement('p', { key: i, style: { margin: '4px 0', lineHeight: '1.7' } }, renderInline(line)));
    i++;
  }

  return React.createElement('div', null, elements);
}

function renderInline(text) {
  if (!text) return null;
  var parts = [];
  var regex = /\[([^\]]+)\]\(([^)]+)\)/g;
  var lastIndex = 0;
  var match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(renderBoldItalic(text.substring(lastIndex, match.index), lastIndex));
    }
    parts.push(React.createElement('a', { key: 'link' + match.index, href: match[2], target: '_blank', rel: 'noopener noreferrer', style: { color: '#3B82F6', textDecoration: 'underline' } }, match[1]));
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(renderBoldItalic(text.substring(lastIndex), lastIndex));
  }
  return parts.length === 1 ? parts[0] : parts;
}

function renderBoldItalic(text, keyBase) {
  if (!text) return null;
  var parts = text.split(/\*\*(.*?)\*\*/g);
  if (parts.length === 1) {
    var italicParts = text.split(/\*(.*?)\*/g);
    if (italicParts.length === 1) return text;
    return italicParts.map(function(p, i) {
      return i % 2 === 1 ? React.createElement('em', { key: (keyBase || 0) + 'i' + i }, p) : p;
    });
  }
  return parts.map(function(p, i) {
    return i % 2 === 1 ? React.createElement('strong', { key: (keyBase || 0) + 'b' + i }, p) : p;
  });
}

// =============================================================================
// STYLES
// =============================================================================

var border = '#E5E7EB';
var bgAlt = '#F9FAFB';
var blue = '#3B82F6';
var muted = '#9CA3AF';
var green = '#059669';
var orange = '#EA580C';

var labelSt = { fontSize: '11px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', display: 'block' };
var inputSt = { padding: '7px 10px', fontSize: '13px', border: '1px solid #D1D5DB', borderRadius: '5px', color: '#1F2937', background: '#fff', outline: 'none', boxSizing: 'border-box', width: '100%' };
var selectSt = { padding: '7px 10px', fontSize: '13px', border: '1px solid #D1D5DB', borderRadius: '5px', color: '#1F2937', background: '#fff', outline: 'none', boxSizing: 'border-box', width: '100%', cursor: 'pointer' };

// =============================================================================
// BLANK FORM
// =============================================================================

var BLANK = {
  topic: '',
  detail: '',
  category: '',
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

function ObtTopicsManager(props) {
  var data = props.data || {};
  var updateData = props.updateData;
  var runQuery = props.runQuery;

  // ── State ──
  var [selectedId, setSelectedId] = useState(null);
  var [searchTerm, setSearchTerm] = useState('');
  var [filterRef, setFilterRef] = useState('ALL');
  var [editId, setEditId] = useState(null);
  var [adding, setAdding] = useState(false);
  var [delId, setDelId] = useState(null);
  var [form, setForm] = useState(Object.assign({}, BLANK));
  var [editSmids, setEditSmids] = useState([]);
  var [editLcns, setEditLcns] = useState([]);
  var [saving, setSaving] = useState(false);
  var detailRef = useRef(null);

  // ── Data from ToolJet ──
  var rawTopics = useMemo(function() { return extractQueryData(data.topics); }, [data.topics, data._refresh]);
  var obtRefs = useMemo(function() { return Array.isArray(data.obtRefs) ? data.obtRefs : []; }, [data.obtRefs, data._refresh]);
  var smidOptions = useMemo(function() { return Array.isArray(data.smidOptions) ? data.smidOptions : []; }, [data.smidOptions, data._refresh]);
  var lcnOptions = useMemo(function() { return Array.isArray(data.lcnOptions) ? data.lcnOptions : []; }, [data.lcnOptions, data._refresh]);
   // ── Permission check ──
   var EDITOR_GROUPS = ['admin', 'builder', 'Content_Editor'];
   var userGroups = useMemo(function() {
     var groups = data.userGroups;
     if (Array.isArray(groups)) return groups;
     if (typeof groups === 'string') return [groups];
     return [];
   }, [data.userGroups]);
   var canEdit = useMemo(function() {
     return userGroups.some(function(g) {
       return EDITOR_GROUPS.indexOf(g) >= 0;
     });
   }, [userGroups]);
  var listenerQuery = data.listenerQuery || 'obt_topics_manager';

  // ── Filtered + sorted topics ──
  var topics = useMemo(function() {
    var list = rawTopics.slice();
    if (searchTerm) {
      var q = searchTerm.toLowerCase();
      list = list.filter(function(t) {
        var catName = obtRefName(t.category, obtRefs).toLowerCase();
        return (t.topic || '').toLowerCase().indexOf(q) >= 0 ||
               (t.detail || '').toLowerCase().indexOf(q) >= 0 ||
               catName.indexOf(q) >= 0;
      });
    }
    if (filterRef !== 'ALL') {
      list = list.filter(function(t) { return String(t.category) === filterRef; });
    }
    list.sort(function(a, b) { return (a.topic || '').localeCompare(b.topic || ''); });
    return list;
  }, [rawTopics, searchTerm, filterRef, obtRefs]);

  var selectedTopic = useMemo(function() {
    return topics.find(function(t) { return t.id === selectedId; }) || null;
  }, [topics, selectedId]);

  // Auto-select first topic
  React.useEffect(function() {
    if (!selectedTopic && topics.length > 0) setSelectedId(topics[0].id);
  }, [topics, selectedTopic]);

  // Reset on refresh
  React.useEffect(function() {
    setSelectedId(null);
  }, [data._refresh]);

  // ── Category counts ──
  var refCounts = useMemo(function() {
    var counts = { ALL: rawTopics.length };
    rawTopics.forEach(function(t) {
      var key = t.category != null ? String(t.category) : 'none';
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [rawTopics]);

  // ── Handlers ──
  function onField(k, v) { setForm(function(p) { var n = Object.assign({}, p); n[k] = v; return n; }); }

  function startAdd() {
    setAdding(true); setEditId(null); setDelId(null);
    setForm(Object.assign({}, BLANK));

    // Pre-select SMID and LCN from page variables
    var preSmids = normArray(data.selectedSmid);
    var preLcns = normArray(data.selectedLcn);

    console.log('[OBT] startAdd preSmids from page var:', JSON.stringify(preSmids), 'raw:', data.selectedSmid);
    console.log('[OBT] startAdd preLcns from page var:', JSON.stringify(preLcns), 'raw:', data.selectedLcn);

    setEditSmids(preSmids);
    setEditLcns(preLcns);
  }

  function startEdit(r) {
    setEditId(r.id); setAdding(false); setDelId(null);

    // Resolve category
    var resolvedCategory = '';
    if (r.category != null && String(r.category) !== '') {
      resolvedCategory = String(r.category);
    }

    setForm({
      topic: r.topic || '',
      detail: r.detail || '',
      category: resolvedCategory,
    });

    // Parse SMID/LCN from the row — handle both scalar ("216026") and pg-array ("{216026,216027}")
    var rSmids = normArray(r.smid);
    var rLcns = normArray(r.lcn);

    // Fallback to page variables if row has no SMID/LCN
    var pageSmids = normArray(data.selectedSmid);
    var pageLcns = normArray(data.selectedLcn);

    var finalSmids = rSmids.length > 0 ? rSmids : pageSmids;
    var finalLcns = rLcns.length > 0 ? rLcns : pageLcns;

    console.log('[OBT] startEdit row.smid raw:', r.smid, '→ parsed:', JSON.stringify(rSmids));
    console.log('[OBT] startEdit row.lcn raw:', r.lcn, '→ parsed:', JSON.stringify(rLcns));
    console.log('[OBT] startEdit page smids:', JSON.stringify(pageSmids), 'page lcns:', JSON.stringify(pageLcns));
    console.log('[OBT] startEdit finalSmids:', JSON.stringify(finalSmids), 'finalLcns:', JSON.stringify(finalLcns));
    console.log('[OBT] smidOptions sample:', smidOptions.length > 0 ? smidOptions[0].smid : 'none');
    console.log('[OBT] lcnOptions sample:', lcnOptions.length > 0 ? (lcnOptions[0].lcn_number || lcnOptions[0].lcn || lcnOptions[0].lcn_name) : 'none');

    setEditSmids(finalSmids);
    setEditLcns(finalLcns);
  }

  function doSave() {
    if (saving) return;
    setSaving(true);

    function escapeSql(v) {
      if (!v) return null;
      return String(v).replace(/'/g, "''");
    }

    function sanitizeToMarkdown(text) {
      if (!text) return null;
      var s = String(text);

      s = s.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n');
      s = s.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n');
      s = s.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n');
      s = s.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n');
      s = s.replace(/<(strong|b)[^>]*>(.*?)<\/(strong|b)>/gi, '**$2**');
      s = s.replace(/<(em|i)[^>]*>(.*?)<\/(em|i)>/gi, '*$2*');
      s = s.replace(/<a[^>]*href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi, '[$2]($1)');
      s = s.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n');
      s = s.replace(/<\/?(ul|ol)[^>]*>/gi, '\n');
      s = s.replace(/<br\s*\/?>/gi, '\n');
      s = s.replace(/<\/p>/gi, '\n\n');
      s = s.replace(/<p[^>]*>/gi, '');
      s = s.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, '> $1\n');
      s = s.replace(/<[^>]+>/g, '');
      s = s.replace(/&amp;/g, '&');
      s = s.replace(/&lt;/g, '<');
      s = s.replace(/&gt;/g, '>');
      s = s.replace(/&quot;/g, '"');
      s = s.replace(/&#39;/g, "'");
      s = s.replace(/&nbsp;/g, ' ');
      s = s.replace(/&ndash;/g, '–');
      s = s.replace(/&mdash;/g, '—');
      s = s.replace(/&hellip;/g, '…');
      s = s.replace(/&rsquo;/g, "'");
      s = s.replace(/&lsquo;/g, "'");
      s = s.replace(/&rdquo;/g, '"');
      s = s.replace(/&ldquo;/g, '"');
      s = s.replace(/&#\d+;/g, '');
      s = s.replace(/\uFFFD/g, '');
      s = s.replace(/\u00A0/g, ' ');
      s = s.replace(/\u200B/g, '');
      s = s.replace(/\u200C/g, '');
      s = s.replace(/\u200D/g, '');
      s = s.replace(/\uFEFF/g, '');
      s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
      s = s.replace(/\n{3,}/g, '\n\n');
      s = s.replace(/[ \t]+$/gm, '');

      return s.trim();
    }

    var payload = {
      topic: escapeSql(form.topic),
      detail: escapeSql(sanitizeToMarkdown(form.detail)),
      category: form.category ? parseInt(form.category, 10) : null,
      smid: editSmids.length > 0 ? '{' + editSmids.join(',') + '}' : null,
      lcn: editLcns.length > 0 ? '{' + editLcns.join(',') + '}' : null,
      updated_by: data.currentUser || '',
    };

    var isNew = !editId;
    var actionData = {
      action: isNew ? 'add' : 'edit',
      selectedTopicId: editId,
      formData: payload,
    };

    console.log('[OBT] doSave:', actionData.action, 'editId:', editId);
    console.log('[OBT] payload:', JSON.stringify(payload));

    updateData(actionData);

    // Close form immediately (matches General Topics pattern)
    setEditId(null); setAdding(false); setForm(Object.assign({}, BLANK));
    setEditSmids([]); setEditLcns([]);

    // Give updateData time to propagate, then trigger the listener JS query
    setTimeout(function() {
      console.log('[OBT] Firing listener:', listenerQuery, 'runQuery available:', !!runQuery);
      if (runQuery) {
        try {
          runQuery(listenerQuery);
          console.log('[OBT] runQuery dispatched OK');
        } catch (err) {
          console.error('[OBT] runQuery error:', err);
        }
      }
      setSaving(false);
    }, 500);
  }

  function doDelete(id, e) {
    e.stopPropagation();
    var actionData = { action: 'delete', selectedTopicId: id, formData: {} };
    updateData(actionData);
    setDelId(null);
    setTimeout(function() {
      console.log('[OBT] Firing listener for delete:', listenerQuery, 'runQuery available:', !!runQuery);
      if (runQuery) {
        try {
          runQuery(listenerQuery);
          console.log('[OBT] delete runQuery dispatched OK');
        } catch (err) {
          console.error('[OBT] runQuery error:', err);
        }
      }
    }, 500);
  }

  function doCancel() {
    setEditId(null); setAdding(false); setDelId(null);
    setForm(Object.assign({}, BLANK));
    setEditSmids([]); setEditLcns([]);
  }

  // ── Render Form (Add/Edit) ──
  function mkForm(isNew) {
    return (
      <div style={{ margin: '0 12px 8px', border: '1px solid ' + blue, borderRadius: '8px', background: '#fff', overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', background: '#EFF6FF', borderBottom: '1px solid #DBEAFE', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#1D4ED8' }}>{isNew ? '+ New OBT Topic' : 'Edit OBT Topic'}</span>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: muted, display: 'inline-flex' }} onClick={doCancel}><Ico name="x" /></button>
        </div>
        <div style={{ padding: '14px' }}>
          {/* Topic (title) */}
          <div style={{ marginBottom: '10px' }}>
            <label style={labelSt}>Topic *</label>
            <input style={inputSt} value={form.topic} placeholder="Enter topic name" onChange={function(e) { onField('topic', e.target.value); }} />
          </div>

          {/* Detail with Markdown Toolbar */}
          <div style={{ marginBottom: '10px' }}>
            <label style={labelSt}>Detail</label>
            <div style={{ border: '1px solid #D1D5DB', borderRadius: '5px', overflow: 'hidden' }}>
              <MarkdownToolbar textareaRef={detailRef} value={form.detail} onChange={function(v) { onField('detail', v); }} />
              <textarea
                ref={detailRef}
                style={Object.assign({}, inputSt, { minHeight: '160px', resize: 'vertical', border: 'none', borderRadius: '0 0 5px 5px' })}
                value={form.detail}
                placeholder="Enter detail / description (supports markdown)"
                onChange={function(e) { onField('detail', e.target.value); }}
              />
            </div>
          </div>

          {/* OBT Reference (category) */}
          <div style={{ marginBottom: '10px' }}>
            <label style={labelSt}>OBT Reference</label>
            <select style={selectSt} value={form.category} onChange={function(e) { onField('category', e.target.value); }}>
              <option value="">— Select OBT Reference —</option>
              {obtRefs.map(function(v) {
                return <option key={v.id} value={String(v.id)}>{v.obt_name}</option>;
              })}
            </select>
          </div>

          {/* SMID Selector */}
          <SmidSelector smidOptions={smidOptions} selSmids={editSmids} setSelSmids={setEditSmids} />

          {/* LCN Selector */}
          <LcnSelector lcnOptions={lcnOptions} selLcns={editLcns} setSelLcns={setEditLcns} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '10px 14px', borderTop: '1px solid ' + border, background: bgAlt }}>
          <button style={{ padding: '6px 16px', fontSize: '12px', fontWeight: 500, color: '#374151', background: '#fff', border: '1px solid #D1D5DB', borderRadius: '6px', cursor: 'pointer' }} onClick={doCancel}>Cancel</button>
          <button
            style={{ padding: '6px 16px', fontSize: '12px', fontWeight: 500, color: '#fff', background: saving ? '#93C5FD' : blue, border: 'none', borderRadius: '6px', cursor: saving ? 'not-allowed' : 'pointer' }}
            onClick={doSave}
            disabled={saving || !form.topic.trim()}
          >
            {saving ? 'Saving...' : (isNew ? 'Add Topic' : 'Save')}
          </button>
        </div>
      </div>
    );
  }

  // ── Render Detail View (right side) ──
  function mkDetailView() {
    if (!selectedTopic) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: muted }}>
          <Ico name="obt" color={muted} />
          <div style={{ fontSize: '14px', fontWeight: 500, marginTop: '8px' }}>Select a topic</div>
          <div style={{ fontSize: '12px', marginTop: '4px' }}>Choose an OBT topic from the list to view details.</div>
        </div>
      );
    }

    var r = selectedTopic;

    if (editId === r.id) return mkForm(false);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header bar */}
        <div style={{ padding: '12px 16px', background: bgAlt, borderBottom: '1px solid ' + border }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#111827', lineHeight: '1.3' }}>{r.topic}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                {/* Category badge */}
                <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, background: '#FFF7ED', color: orange }}>
                  <span style={{ marginRight: '4px', display: 'inline-flex' }}><Ico name="tag" color={orange} /></span>
                  {obtRefName(r.category, obtRefs)}
                </span>
                {r.smid ? <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 500, background: '#FEF3C7', color: '#D97706' }}>SMID: {r.smid}</span> : null}
                {r.lcn ? <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 500, background: '#ECFDF5', color: green }}>LCN: {r.lcn}</span> : null}
                {r.gcn ? <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 500, background: '#F3F4F6', color: '#6B7280' }}>GCN: {r.gcn}</span> : null}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', color: muted, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Ico name="clock" color={muted} /> {fmtTimestamp(r.last_updated)}
                </span>
                {r.updated_by ? (
                  <span style={{ fontSize: '11px', color: muted, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Ico name="user" color={muted} /> {r.updated_by}
                  </span>
                ) : null}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '2px', flexShrink: 0, alignItems: 'center' }}>
              {canEdit ? (
                <div style={{ display: 'flex', gap: '2px' }}>
                  <button style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, border: 'none', borderRadius: 4, background: 'transparent', color: blue, cursor: 'pointer' }} title="Edit" onClick={function() { startEdit(r); }}><Ico name="edit" color={blue} /></button>
                  <button style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, border: 'none', borderRadius: 4, background: 'transparent', color: '#EF4444', cursor: 'pointer' }} title="Delete" onClick={function() { setDelId(r.id); }}><Ico name="trash" color="#EF4444" /></button>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Detail body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          <div style={{ background: '#fff', border: '1px solid ' + border, borderRadius: '8px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
              <Ico name="file" color={blue} />
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Detail</span>
            </div>
            <div style={{ fontSize: '13px', lineHeight: '1.7', color: '#374151' }}>
              <RenderMarkdown text={r.detail} />
            </div>
          </div>

          {/* Category info card */}
          {r.category ? (
            <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: '8px', padding: '12px 16px', marginTop: '12px' }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>OBT Reference</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#9A3412' }}>{obtRefName(r.category, obtRefs)}</div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Delete confirmation */}
        {delId === r.id ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', background: '#FEF2F2', borderTop: '1px solid #FECACA' }}>
            <span style={{ fontSize: '12px', color: '#991B1B', fontWeight: 500 }}>Delete "{r.topic}"?</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button style={{ padding: '4px 12px', fontSize: '12px', fontWeight: 500, color: '#374151', background: '#fff', border: '1px solid #D1D5DB', borderRadius: '5px', cursor: 'pointer' }} onClick={function() { setDelId(null); }}>Cancel</button>
              <button style={{ padding: '4px 12px', fontSize: '12px', fontWeight: 500, color: '#fff', background: '#EF4444', border: 'none', borderRadius: '5px', cursor: 'pointer' }} onClick={function(e) { doDelete(r.id, e); }}>Delete</button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  // ── Main Render ──
  var cnt = topics.length;
  var sub = cnt > 0 ? cnt + ' topic' + (cnt !== 1 ? 's' : '') : 'No topics found';

  return (
    <div style={{ display: 'flex', height: '100%', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif', fontSize: '13px', color: '#1F2937', background: '#fff', overflow: 'hidden' }}>

      {/* ═══════════ LEFT SIDEBAR ═══════════ */}
      <div style={{ width: '280px', minWidth: '260px', display: 'flex', flexDirection: 'column', borderRight: '1px solid ' + border, background: '#fff' }}>

        {/* Sidebar header */}
        <div style={{ padding: '10px 12px', borderBottom: '1px solid ' + border, background: bgAlt }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Ico name="obt" color={orange} />
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>OBT Topics</span>
              </div>
              <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '2px' }}>{sub}</div>
            </div>
            {canEdit && !adding ? (
              <button style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '5px 12px', fontSize: '12px', fontWeight: 500, color: '#fff', background: blue, border: 'none', borderRadius: '6px', cursor: 'pointer' }} onClick={startAdd}>
                <Ico name="plus" /> Add
              </button>
            ) : null}
          </div>

          {/* Search */}
          <div style={{ position: 'relative', marginBottom: '6px' }}>
            <span style={{ position: 'absolute', left: '8px', top: '7px', color: muted, display: 'flex' }}><Ico name="search" color={muted} /></span>
            <input
              value={searchTerm}
              onChange={function(e) { setSearchTerm(e.target.value); }}
              placeholder="Search topics…"
              style={Object.assign({}, inputSt, { paddingLeft: '28px', fontSize: '12px' })}
            />
          </div>

          {/* Category filter */}
          <select
            value={filterRef}
            onChange={function(e) { setFilterRef(e.target.value); }}
            style={Object.assign({}, selectSt, { fontSize: '12px' })}
          >
            <option value="ALL">All References ({refCounts.ALL || 0})</option>
            {obtRefs.map(function(v) {
              return <option key={v.id} value={String(v.id)}>{v.obt_name} ({refCounts[String(v.id)] || 0})</option>;
            })}
          </select>
        </div>

        {/* Topic list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {topics.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 12px', color: muted, fontSize: '12px' }}>No topics match your filters</div>
          ) : null}
          {topics.map(function(t) {
            var active = t.id === selectedId;
            return (
              <div
                key={t.id}
                onClick={function() { setSelectedId(t.id); }}
                style={{
                  padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #F3F4F6',
                  background: active ? '#EFF6FF' : '#fff',
                  borderLeft: active ? '3px solid ' + blue : '3px solid transparent',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: active ? 600 : 500, color: active ? '#1D4ED8' : '#1F2937', lineHeight: '1.3', marginBottom: '4px' }}>
                  {t.topic || '(untitled)'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                  <span style={{ display: 'inline-flex', padding: '1px 6px', borderRadius: '3px', fontSize: '10px', fontWeight: 600, background: '#FFF7ED', color: orange }}>{obtRefName(t.category, obtRefs)}</span>
                  {t.smid ? <span style={{ display: 'inline-flex', padding: '1px 6px', borderRadius: '3px', fontSize: '10px', fontWeight: 500, background: '#FEF3C7', color: '#D97706' }}>SMID</span> : null}
                  {t.lcn ? <span style={{ display: 'inline-flex', padding: '1px 6px', borderRadius: '3px', fontSize: '10px', fontWeight: 500, background: '#ECFDF5', color: green }}>LCN</span> : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══════════ RIGHT CONTENT ═══════════ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#fff' }}>
        {adding ? (
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
            {mkForm(true)}
          </div>
        ) : mkDetailView()}
      </div>
    </div>
  );
}

// =============================================================================
// CONNECT & RENDER
// =============================================================================

var Connected = Tooljet.connectComponent(ObtTopicsManager);
ReactDOM.render(<Connected />, document.body);
