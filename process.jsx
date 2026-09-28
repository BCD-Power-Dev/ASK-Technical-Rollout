/**
 * Process Manager - ToolJet Custom Component
 * Version: 1.0  (adapted from Form-of-Payment Manager v7.6)
 *
 * Topic + Detail records. Each record links to EITHER a technology
 * (ref_technology) OR an OBT (obt) — never both. Category (ref_travel_categories)
 * is the single-select filter dimension, nested into the data binding per tab.
 *
 * REQUIRED PAGE VARIABLES:
 *   process_current_payload  (default: {})
 *   last_process_ts          (default: 0)
 *
 * Data binding contract (per instance):
 *   {{({
 *     processRecords:      queries.postgresql_get_all_processes.data,
 *     smidOptions:         queries.postgresql_get_filtered_SMID_menu.data,
 *     lcnOptions:          queries.postgresql_get_filtered_lcn_menu.data,
 *     categoryOptions:     queries.postgresql_get_categories.data,        // [{id,title}]
 *     travelerTypeOptions: queries.postgresql_get_traveler_types.data,    // [{id/..,traveler_type/..}]
 *     technologyOptions:   queries.postgresql_get_technologies.data,      // [{id,title,ref_website}]
 *     obtOptions:          queries.postgresql_get_obts.data,              // [{id,obt_name}]
 *     filterCategory:      "Rail",                                        // or null
 *     filterTravelerType:  components.listview_x.selectedRecord.text.text // or null
 *     instanceId:          "proc_rail_tab",
 *     currentUser:         globals.currentUser.firstName,
 *     userGroups:          globals.currentUser.groups,
 *     _refresh:            page.variables.var_policy_refresh_key || 0
 *   })}}
 */

import React, { useState, useMemo, useRef, useEffect } from 'https://esm.sh/react@18';
import ReactDOM from 'https://esm.sh/react-dom@18';

// =============================================================================
// CATEGORY COLORS
// =============================================================================
var CATEGORY_COLORS = {
  "Air":       { bg: "#dbeafe", fg: "#1e40af" },
  "Rail":      { bg: "#fce7f3", fg: "#9d174d" },
  "Car":       { bg: "#d1fae5", fg: "#065f46" },
  "Hotel":     { bg: "#fef3c7", fg: "#92400e" },
  "Ground":    { bg: "#e0e7ff", fg: "#3730a3" },
  "Ferry":     { bg: "#cffafe", fg: "#155e75" },
  "Taxi/Limo": { bg: "#f3e8ff", fg: "#6b21a8" },
};
var FALLBACK_PALETTE = [
  { bg: "#dbeafe", fg: "#1e40af" }, { bg: "#fce7f3", fg: "#9d174d" },
  { bg: "#d1fae5", fg: "#065f46" }, { bg: "#fef3c7", fg: "#92400e" },
  { bg: "#e0e7ff", fg: "#3730a3" }, { bg: "#cffafe", fg: "#155e75" },
  { bg: "#f3e8ff", fg: "#6b21a8" }, { bg: "#fed7aa", fg: "#9a3412" },
  { bg: "#bbf7d0", fg: "#166534" }, { bg: "#bae6fd", fg: "#0c4a6e" },
  { bg: "#fbcfe8", fg: "#831843" }, { bg: "#ddd6fe", fg: "#5b21b6" },
];
function hashString(str) {
  var hash = 0; if (!str) return 0;
  for (var i = 0; i < str.length; i++) { hash = ((hash << 5) - hash) + str.charCodeAt(i); hash |= 0; }
  return Math.abs(hash);
}
var getCatColor = function(cat) {
  if (!cat) return { bg: "#f1f5f9", fg: "#475569" };
  if (CATEGORY_COLORS[cat]) return CATEGORY_COLORS[cat];
  return FALLBACK_PALETTE[hashString(cat) % FALLBACK_PALETTE.length];
};

// =============================================================================
// UTILITIES
// =============================================================================
function parsePgArray(val) {
  if (val === null || val === undefined || val === '') return [];
  if (Array.isArray(val)) return val.map(function(s) { return String(s).trim(); }).filter(Boolean);
  var s = String(val).trim();
  if (s === '{}' || s === '') return [];
  if (s.charAt(0) === '{' && s.charAt(s.length - 1) === '}') { s = s.slice(1, -1); }
  var out = [], cur = '', inQuote = false;
  for (var i = 0; i < s.length; i++) {
    var ch = s.charAt(i);
    if (ch === '"' && s.charAt(i - 1) !== '\\') { inQuote = !inQuote; continue; }
    if (ch === ',' && !inQuote) { if (cur.trim()) out.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
function extractQueryData(q) {
  if (!q) return [];
  if (Array.isArray(q)) return q;
  if (q.data && Array.isArray(q.data)) return q.data;
  if (q.rawData && Array.isArray(q.rawData)) return q.rawData;
  if (typeof q === 'object' && q.id) return [q];
  return [];
}
// Zip parallel id/value brace-arrays into [{id,value,label}] using options for labels.
function zipSelection(idStr, valStr, options, getId, getLabel) {
  var ids = parsePgArray(idStr);
  var vals = parsePgArray(valStr);
  var byId = {};
  (options || []).forEach(function(o) { byId[String(getId(o))] = String(getLabel(o)); });
  if (ids.length === 0 && vals.length > 0) {
    // Legacy rows that only stored values: fall back to value-as-id.
    return vals.map(function(v) { return { id: String(v), value: String(v), label: String(v) }; });
  }
  return ids.map(function(id, i) {
    var v = vals[i] !== undefined ? String(vals[i]) : '';
    return { id: String(id), value: v, label: byId[String(id)] || v || String(id) };
  });
}
function braceIds(sel)  { return sel.length ? '{' + sel.map(function(s) { return s.id; }).join(',') + '}' : '{}'; }
function braceVals(sel) { return sel.length ? '{' + sel.map(function(s) { return s.value; }).join(', ') + '}' : '{}'; }

// =============================================================================
// THEME / ICONS
// =============================================================================
var C = {
  primary: '#4f46e5', primaryLight: '#e0e7ff', bg: '#ffffff', bgAlt: '#f9fafb',
  bgHover: '#f3f4f6', border: '#e2e8f0', text: '#334155', textDark: '#0f172a',
  textMuted: '#94a3b8', danger: '#dc2626', dangerLight: '#fee2e2',
  tech: '#0369a1', techLight: '#e0f2fe', obt: '#7c3aed', obtLight: '#f5f3ff',
};
var Icons = {
  edit: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  plus: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>',
  bold: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>',
  italic: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>',
  underline: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"/><line x1="4" y1="21" x2="20" y2="21"/></svg>',
  list: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3" cy="6" r="1" fill="currentColor"/><circle cx="3" cy="12" r="1" fill="currentColor"/><circle cx="3" cy="18" r="1" fill="currentColor"/></svg>',
  listOrdered: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><text x="1" y="9" font-size="9" fill="currentColor" stroke="none">1</text><text x="1" y="15" font-size="9" fill="currentColor" stroke="none">2</text><text x="1" y="21" font-size="9" fill="currentColor" stroke="none">3</text></svg>',
  indent: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="3" x2="21" y2="3"/><line x1="11" y1="9" x2="21" y2="9"/><line x1="11" y1="15" x2="21" y2="15"/><line x1="3" y1="21" x2="21" y2="21"/><polyline points="3 15 7 12 3 9"/></svg>',
  outdent: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="3" x2="21" y2="3"/><line x1="11" y1="9" x2="21" y2="9"/><line x1="11" y1="15" x2="21" y2="15"/><line x1="3" y1="21" x2="21" y2="21"/><polyline points="7 9 3 12 7 15"/></svg>',
  link: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
};
function Icon(name, color) {
  return <span style={{ display: 'inline-flex', color: color || 'currentColor' }} dangerouslySetInnerHTML={{ __html: Icons[name] || '' }} />;
}

// =============================================================================
// RICH TEXT EDITOR  (process_detail body)
// =============================================================================
class RichTextEditor extends React.Component {
  constructor(props) { super(props); this.editorRef = React.createRef(); }
  componentDidMount() { if (this.editorRef.current && this.props.value) this.editorRef.current.innerHTML = this.props.value; }
  componentDidUpdate(pp) {
    if (pp.value !== this.props.value && this.editorRef.current && this.editorRef.current.innerHTML !== this.props.value) {
      this.editorRef.current.innerHTML = this.props.value || "";
    }
  }
  execCmd = (cmd, val) => { document.execCommand(cmd, false, val || null); if (this.editorRef.current) this.editorRef.current.focus(); this.fireChange(); }
  fireChange = () => { if (this.editorRef.current && this.props.onChange) this.props.onChange(this.editorRef.current.innerHTML); }
  handleLink = () => { var url = prompt("Enter URL:"); if (url) this.execCmd("createLink", url); }
  render() {
    var self = this;
    var tb = { display: "inline-flex", alignItems: "center", justifyContent: "center", width: "28px", height: "28px", border: "1px solid transparent", borderRadius: "4px", background: "transparent", cursor: "pointer", color: "#475569", fontSize: "13px", fontWeight: 600, padding: 0 };
    var prevent = function(e) { e.preventDefault(); };
    var sep = <span style={{ width: "1px", height: "20px", background: C.border, margin: "0 4px" }} />;
    return (
      <div style={{ border: "1px solid " + C.border, borderRadius: "6px", overflow: "hidden", display: "flex", flexDirection: "column", flex: 1 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "2px", padding: "6px 8px", borderBottom: "1px solid " + C.border, background: C.bgAlt, alignItems: "center" }}>
          <button style={tb} title="Bold" onMouseDown={prevent} onClick={() => self.execCmd("bold")}>{Icon('bold')}</button>
          <button style={tb} title="Italic" onMouseDown={prevent} onClick={() => self.execCmd("italic")}>{Icon('italic')}</button>
          <button style={tb} title="Underline" onMouseDown={prevent} onClick={() => self.execCmd("underline")}>{Icon('underline')}</button>
          {sep}
          <button style={tb} title="Bullet List" onMouseDown={prevent} onClick={() => self.execCmd("insertUnorderedList")}>{Icon('list')}</button>
          <button style={tb} title="Numbered List" onMouseDown={prevent} onClick={() => self.execCmd("insertOrderedList")}>{Icon('listOrdered')}</button>
          {sep}
          <button style={tb} title="Indent" onMouseDown={prevent} onClick={() => self.execCmd("indent")}>{Icon('indent')}</button>
          <button style={tb} title="Outdent" onMouseDown={prevent} onClick={() => self.execCmd("outdent")}>{Icon('outdent')}</button>
          {sep}
          <button style={tb} title="Link" onMouseDown={prevent} onClick={() => self.handleLink()}>{Icon('link')}</button>
        </div>
        <div ref={this.editorRef} contentEditable={true}
          style={{ flex: 1, padding: "10px 12px", outline: "none", overflowY: "auto", minHeight: "220px", fontSize: "13px", lineHeight: "1.65", color: C.textDark, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif' }}
          onInput={this.fireChange} />
      </div>
    );
  }
}
function NotesDisplay({ html, style }) {
  if (!html || html.trim() === "" || html.trim() === "<p></p>") {
    return <div style={{ color: C.textMuted, fontStyle: "italic" }}>No detail available.</div>;
  }
  var styled = '<style>.fn ul,.fn ol{padding-left:22px;margin:4px 0}.fn li{margin-bottom:3px}.fn a{color:#4f46e5;text-decoration:none}.fn a:hover{text-decoration:underline}.fn strong,.fn b{font-weight:600;color:#0f172a}.fn p{margin:4px 0}</style><div class="fn">' + html + '</div>';
  return <div style={style || {}} dangerouslySetInnerHTML={{ __html: styled }} />;
}

// =============================================================================
// SHARED GRID STYLES
// =============================================================================
var CS = {
  section: { marginTop: '8px', marginBottom: '8px', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e2e8f0' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' },
  headerActions: { display: 'flex', gap: '4px', alignItems: 'center' },
  sep: { margin: '0 4px', color: '#94a3b8', fontSize: '11px' },
  grid: { display: 'flex', flexWrap: 'wrap', maxHeight: '180px', overflowY: 'auto' },
  tag: { display: 'flex', alignItems: 'center', padding: '6px 10px', fontSize: '12px', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', marginRight: '8px', marginBottom: '8px', cursor: 'pointer' },
  checkbox: (sel, color) => ({ width: '14px', height: '14px', borderRadius: '3px', marginRight: '6px', border: '2px solid ' + (sel ? color : '#e2e8f0'), backgroundColor: sel ? color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }),
  checkmark: { color: '#fff', fontSize: '10px' },
  countryTag: { marginLeft: '4px', fontSize: '10px', color: '#94a3b8' },
};

// =============================================================================
// PAIRED MULTI-SELECT  (tracks id + value; used for SMID / LCN / Traveler Type)
// selected = [{id, value, label}]
// =============================================================================
function PairMultiSelect(p) {
  var options = p.options || [];
  var color = p.color;
  var selected = p.selected || [];
  var onChange = p.onChange;
  var getId = p.getId, getValue = p.getValue, getLabel = p.getLabel, getCountry = p.getCountry;
  var searchable = p.searchable;

  var [q, setQ] = useState('');

  if (options.length === 0) {
    return (
      <div style={CS.section}>
        <div style={CS.header}><span style={{ fontSize: 12, fontWeight: 600, color: color }}>{p.title}</span></div>
        <div style={{ fontSize: 12, color: C.textMuted, fontStyle: 'italic' }}>{p.emptyHint || 'No options available.'}</div>
      </div>
    );
  }

  var selIds = selected.map(function(s) { return String(s.id); });
  var visible = (searchable && q)
    ? options.filter(function(o) {
        var hay = (String(getLabel(o)) + ' ' + String(getValue(o)) + ' ' + String(getCountry ? getCountry(o) : '')).toLowerCase();
        return hay.indexOf(q.toLowerCase()) >= 0;
      })
    : options;

  function toItem(o) { return { id: String(getId(o)), value: String(getValue(o)), label: String(getLabel(o)) }; }
  function toggle(o) {
    var id = String(getId(o));
    if (selIds.indexOf(id) >= 0) onChange(selected.filter(function(s) { return String(s.id) !== id; }));
    else onChange(selected.concat([toItem(o)]));
  }
  function selectAll() { onChange(options.map(toItem)); }
  function selectVisible() {
    var merged = selected.slice();
    visible.forEach(function(o) { if (selIds.indexOf(String(getId(o))) < 0) merged.push(toItem(o)); });
    onChange(merged);
  }
  function clearAll() { onChange([]); }

  var linkBtn = { fontSize: '11px', color: color, cursor: 'pointer', textDecoration: 'underline', background: 'none', border: 'none', padding: 0, fontWeight: 500 };
  var searchStyle = { width: '100%', padding: '5px 8px', fontSize: 12, border: '1px solid ' + C.border, borderRadius: 4, marginBottom: 8, outline: 'none', background: C.bg, color: C.text, boxSizing: 'border-box' };

  return (
    <div style={CS.section}>
      <div style={CS.header}>
        <span style={{ fontSize: 12, fontWeight: 600, color: color }}>{p.title} ({selected.length}/{options.length})</span>
        <div style={CS.headerActions}>
          <button type="button" style={linkBtn} onClick={selectAll}>All</button>
          <span style={CS.sep}>|</span>
          {searchable && q ? (<><button type="button" style={linkBtn} onClick={selectVisible} title="Add visible">Visible</button><span style={CS.sep}>|</span></>) : null}
          <button type="button" style={linkBtn} onClick={clearAll}>Clear</button>
        </div>
      </div>
      {searchable ? (
        <input type="text" placeholder={"Search " + options.length + "..."} value={q} onChange={function(e) { setQ(e.target.value); }} style={searchStyle} />
      ) : null}
      <div style={CS.grid}>
        {visible.length === 0 ? (
          <div style={{ fontSize: 12, color: C.textMuted, fontStyle: 'italic', padding: '4px 0' }}>No matches.</div>
        ) : visible.map(function(o) {
          var id = String(getId(o));
          var isSel = selIds.indexOf(id) >= 0;
          return (
            <div key={id} style={Object.assign({}, CS.tag, isSel ? { backgroundColor: '#fff', borderColor: color } : {})} onClick={function() { toggle(o); }}>
              <span style={CS.checkbox(isSel, color)}>{isSel ? <span style={CS.checkmark}>✓</span> : null}</span>
              {String(getLabel(o))}
              {getCountry && getCountry(o) ? <span style={CS.countryTag}>({getCountry(o)})</span> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// CATEGORY SINGLE-SELECT  (FK -> one category). value = {id, title} | null
// =============================================================================
function CatSingleSelect(p) {
  var options = p.options || [];   // [{id, title}]
  var value = p.value;             // {id, title} | null
  var onChange = p.onChange;
  if (options.length === 0) {
    return (<div><div style={p.fieldLabelStyle}>Category</div>
      <div style={{ marginTop: 4, fontSize: 12, color: C.textMuted, fontStyle: 'italic' }}>No categories loaded.</div></div>);
  }
  return (
    <div>
      <div style={p.fieldLabelStyle}>Category (choose one)</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
        {options.map(function(c) {
          var isOn = value && String(value.id) === String(c.id);
          var cc = getCatColor(c.title);
          return (
            <button key={c.id}
              onClick={function() { onChange(isOn ? null : { id: c.id, title: c.title }); }}
              style={{ display: 'inline-flex', padding: '4px 10px', borderRadius: 4, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                border: isOn ? '2px solid ' + cc.fg : '1px solid ' + C.border, background: isOn ? cc.bg : C.bg, color: isOn ? cc.fg : C.textMuted, opacity: isOn ? 1 : 0.75 }}>
              {c.title}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// TECHNOLOGY / OBT SELECTOR  (mutually exclusive)
// value = { mode: 'technology'|'obt'|null, id, label }
// =============================================================================
function TechObtSelect(p) {
  var techOptions = p.technologyOptions || []; // [{id,title,ref_website}]
  var obtOptions = p.obtOptions || [];         // [{id,obt_name}]
  var value = p.value || { mode: null, id: null, label: '' };
  var onChange = p.onChange;
  var [q, setQ] = useState('');

  function setMode(mode) {
    if (value.mode === mode) return;
    setQ('');
    onChange({ mode: mode, id: null, label: '' }); // switching mode clears the other side
  }
  function pick(id, label) { onChange({ mode: value.mode, id: id, label: label }); }
  function clearPick() { onChange({ mode: value.mode, id: null, label: '' }); }

  var activeOptions = value.mode === 'technology' ? techOptions : value.mode === 'obt' ? obtOptions : [];
  var getId = function(o) { return o.id; };
  var getLabel = value.mode === 'obt' ? function(o) { return o.obt_name; } : function(o) { return o.title; };
  var visible = q ? activeOptions.filter(function(o) { return String(getLabel(o) || '').toLowerCase().indexOf(q.toLowerCase()) >= 0; }) : activeOptions;

  var modeBtn = function(mode, label, accent, accentLight) {
    var on = value.mode === mode;
    return (
      <button type="button" onClick={function() { setMode(mode); }}
        style={{ flex: 1, padding: '7px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', borderRadius: 6,
          border: on ? '2px solid ' + accent : '1px solid ' + C.border, background: on ? accentLight : C.bg, color: on ? accent : C.textMuted }}>
        {label}
      </button>
    );
  };
  var accent = value.mode === 'obt' ? C.obt : C.tech;
  var searchStyle = { width: '100%', padding: '5px 8px', fontSize: 12, border: '1px solid ' + C.border, borderRadius: 4, margin: '8px 0', outline: 'none', background: C.bg, color: C.text, boxSizing: 'border-box' };

  return (
    <div style={CS.section}>
      <div style={CS.header}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>Linked System — Technology or OBT (one only)</span>
        {value.id ? <button type="button" onClick={clearPick} style={{ fontSize: 11, color: C.textMuted, background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}>Clear selection</button> : null}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {modeBtn('technology', 'Technology', C.tech, C.techLight)}
        {modeBtn('obt', 'OBT', C.obt, C.obtLight)}
      </div>
      {value.mode ? (
        <>
          <input type="text" placeholder={'Search ' + (value.mode === 'obt' ? 'OBTs' : 'technologies') + '...'} value={q} onChange={function(e) { setQ(e.target.value); }} style={searchStyle} />
          <div style={{ ...CS.grid, maxHeight: 160 }}>
            {visible.length === 0 ? (
              <div style={{ fontSize: 12, color: C.textMuted, fontStyle: 'italic' }}>No matches.</div>
            ) : visible.map(function(o) {
              var isSel = value.id != null && String(value.id) === String(getId(o));
              return (
                <div key={getId(o)} onClick={function() { pick(getId(o), String(getLabel(o))); }}
                  style={Object.assign({}, CS.tag, isSel ? { borderColor: accent, background: value.mode === 'obt' ? C.obtLight : C.techLight } : {})}>
                  <span style={CS.checkbox(isSel, accent)}>{isSel ? <span style={CS.checkmark}>✓</span> : null}</span>
                  {String(getLabel(o))}
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div style={{ fontSize: 12, color: C.textMuted, fontStyle: 'italic', marginTop: 8 }}>Pick Technology or OBT to choose a value.</div>
      )}
    </div>
  );
}

// =============================================================================
// ERROR BOUNDARY
// =============================================================================
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  componentDidCatch(error) { this.setState({ hasError: true, error: error }); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 16, fontFamily: 'monospace', fontSize: 12, background: '#fef2f2', color: '#991b1b', borderRadius: 8, border: '1px solid #fecaca', height: '100%', overflowY: 'auto' }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Process Manager Error</div>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{String(this.state.error)}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================
function ProcessManager(props) {
  var data = props.data || {};
  var updateData = props.updateData;

  var triggerDispatcher = function(queryName) {
    var fn = props.runQuery || props.runJsQuery || (props.actions && props.actions.runQuery);
    if (typeof fn === 'function') { try { fn(queryName); } catch (e) { console.error('[PROC] triggerDispatcher error:', e); } }
    else { console.warn('[PROC] No runQuery prop found. Props:', Object.keys(props)); }
  };

  // ─── Permissions ───
  var EDITOR_GROUPS = ['admin', 'builder', 'Content_Editor'];
  var userGroups = useMemo(function() {
    var g = data.userGroups;
    if (Array.isArray(g)) return g;
    if (typeof g === 'string') return [g];
    return [];
  }, [data.userGroups]);
  var hasEditPermission = useMemo(function() {
    return userGroups.some(function(g) { return EDITOR_GROUPS.indexOf(g) >= 0; });
  }, [userGroups]);

  // ─── State ───
  var [selected, setSelected] = useState(null);
  var [isEditing, setIsEditing] = useState(false);
  var [isAdding, setIsAdding] = useState(false);
  var [searchTerm, setSearchTerm] = useState('');
  var [systemFilter, setSystemFilter] = useState('');   // '' = all, else 'tech::Label' or 'obt::Label'

  var [editTopic, setEditTopic] = useState('');
  var [editDetail, setEditDetail] = useState('');
  var [editGcn, setEditGcn] = useState('');
  var [editAccountId, setEditAccountId] = useState('');
  var [editCategory, setEditCategory] = useState(null);            // {id,title}|null
  var [editTechObt, setEditTechObt] = useState({ mode: null, id: null, label: '' });
  var [editSmids, setEditSmids] = useState([]);                    // [{id,value,label}]
  var [editLcns, setEditLcns] = useState([]);
  var [editTravelerTypes, setEditTravelerTypes] = useState([]);

  // ─── Option sources ───
  var smidOptions = useMemo(function() { return extractQueryData(data.smidOptions); }, [data.smidOptions]);
  var lcnOptions = useMemo(function() { return extractQueryData(data.lcnOptions); }, [data.lcnOptions]);
  var technologyOptions = useMemo(function() { return extractQueryData(data.technologyOptions); }, [data.technologyOptions]);
  var obtOptions = useMemo(function() { return extractQueryData(data.obtOptions); }, [data.obtOptions]);
  var categoryPairs = useMemo(function() {
    return extractQueryData(data.categoryOptions).map(function(c) {
      if (typeof c === 'string') return { id: c, title: c };
      return { id: c.id != null ? c.id : c.title, title: c.title || c.name || '' };
    }).filter(function(c) { return c.title; });
  }, [data.categoryOptions]);
  var travelerTypeOptions = useMemo(function() { return extractQueryData(data.travelerTypeOptions); }, [data.travelerTypeOptions]);

  // Accessor helpers for the paired selectors (tolerant of unknown column names)
  var smidGetId    = function(o) { return o.smid_id != null ? o.smid_id : (o.id != null ? o.id : o.smid); };
  var smidGetValue = function(o) { return o.smid; };
  var smidGetLabel = function(o) { return o.title || o.smid; };
  var smidGetCty   = function(o) { return o.country_a2; };
  var lcnGetId     = function(o) { return o.lcn_id != null ? o.lcn_id : (o.id != null ? o.id : (o.lcn_number || o.lcn)); };
  var lcnGetValue  = function(o) { return o.lcn_number || o.lcn || o.lcn_name; };
  var lcnGetLabel  = function(o) { return o.lcn_name || o.lcn_number || o.lcn; };
  var lcnGetCty    = function(o) { return o.smid_country_a2; };
  var ttGetId      = function(o) { return o.traveler_type_id != null ? o.traveler_type_id : (o.id != null ? o.id : (o.traveler_type || o.name || o.title)); };
  var ttGetValue   = function(o) { return o.traveler_type || o.name || o.title || o.traveler_type_name; };
  var ttGetLabel   = ttGetValue;

  // ─── Filter context ───
  var filterCategory = useMemo(function() {
    var v = data.filterCategory;
    return (v === undefined || v === null || v === '') ? null : String(v).trim();
  }, [data.filterCategory]);
  var filterTravelerType = useMemo(function() {
    var v = data.filterTravelerType;
    if (v === undefined || v === null) return null;
    var s = String(v).replace(/\*\*/g, '').trim();
    return s === '' ? null : s;
  }, [data.filterTravelerType]);

  // ─── Base filter: binding-driven category + traveler type (atomic read
  //     to avoid mid-refresh flicker). This set feeds the system dropdown. ───
  var baseFiltered = useMemo(function() {
    var records = extractQueryData(data.processRecords);
    var fcRaw = data.filterCategory;
    var fc = (fcRaw === undefined || fcRaw === null || fcRaw === '') ? null : String(fcRaw).trim();
    var ftRaw = data.filterTravelerType;
    var ft = (ftRaw === undefined || ftRaw === null) ? null : (function() { var s = String(ftRaw).replace(/\*\*/g, '').trim(); return s === '' ? null : s; })();

    var rows = records;
    if (fc) {
      rows = rows.filter(function(r) { return String(r.category || '').trim() === fc; });
    }
    if (ft) {
      rows = rows.filter(function(r) {
        var tts = parsePgArray(r.traveler_type);
        if (tts.length > 0) return tts.indexOf(ft) >= 0;
        return String(r.traveler_type || '').replace(/\*\*/g, '').trim() === ft;
      });
    }
    return rows;
  }, [data.processRecords, data.filterCategory, data.filterTravelerType]);

  // Distinct Technology / OBT values present in the current tab, for the menu dropdown.
  var systemOptions = useMemo(function() {
    var techs = {}, obts = {};
    baseFiltered.forEach(function(r) {
      if (r.technology_title) techs[r.technology_title] = true;
      if (r.obt_name) obts[r.obt_name] = true;
    });
    return { techs: Object.keys(techs).sort(), obts: Object.keys(obts).sort() };
  }, [baseFiltered]);

  var hasSystemFilter = systemOptions.techs.length > 0 || systemOptions.obts.length > 0;

  // ─── User-driven filters on top of the base set: system dropdown + search ───
  var filtered = useMemo(function() {
    var rows = baseFiltered;

    if (systemFilter) {
      var idx = systemFilter.indexOf('::');
      var kind = systemFilter.slice(0, idx);
      var label = systemFilter.slice(idx + 2);
      rows = rows.filter(function(r) {
        return kind === 'tech'
          ? String(r.technology_title || '') === label
          : String(r.obt_name || '') === label;
      });
    }

    if (searchTerm) {
      var lower = searchTerm.toLowerCase();
      rows = rows.filter(function(r) {
        return (r.process_topic || '').toLowerCase().indexOf(lower) >= 0 ||
               (r.process_detail || '').toLowerCase().indexOf(lower) >= 0 ||
               (r.technology_title || '').toLowerCase().indexOf(lower) >= 0 ||
               (r.obt_name || '').toLowerCase().indexOf(lower) >= 0;
      });
    }
    return rows;
  }, [baseFiltered, systemFilter, searchTerm]);

  var allRecordsCount = useMemo(function() { return extractQueryData(data.processRecords).length; }, [data.processRecords]);
  var displayedRecords = React.useDeferredValue ? React.useDeferredValue(filtered) : filtered;

  // ─── Keep selection valid ───
  useEffect(function() {
    if (filtered.length > 0 && !selected) setSelected(filtered[0]);
    else if (filtered.length > 0 && selected && !filtered.some(function(r) { return r.id === selected.id; })) setSelected(filtered[0]);
    else if (filtered.length === 0) setSelected(null);
  }, [filtered]);

  // ─── Handlers ───
  function handleSelect(rec) { setSelected(rec); setIsEditing(false); setIsAdding(false); }

  function handleEdit() {
    if (!selected) return;
    setEditTopic(selected.process_topic || '');
    setEditDetail(selected.process_detail || '');
    setEditGcn(selected.gcn != null ? String(selected.gcn) : '');
    setEditAccountId(selected.account_id != null ? String(selected.account_id) : '');
    setEditCategory(selected.category_id != null ? { id: selected.category_id, title: selected.category || '' } : null);
    if (selected.technology_id != null) setEditTechObt({ mode: 'technology', id: selected.technology_id, label: selected.technology_title || '' });
    else if (selected.obt_id != null) setEditTechObt({ mode: 'obt', id: selected.obt_id, label: selected.obt_name || '' });
    else setEditTechObt({ mode: null, id: null, label: '' });
    setEditSmids(zipSelection(selected.smid_id, selected.smid, smidOptions, smidGetId, smidGetLabel));
    setEditLcns(zipSelection(selected.lcn_id, selected.lcn, lcnOptions, lcnGetId, lcnGetLabel));
    setEditTravelerTypes(zipSelection(selected.traveler_type_id, selected.traveler_type, travelerTypeOptions, ttGetId, ttGetLabel));
    setIsEditing(true); setIsAdding(false);
  }

  function handleAdd() {
    setIsAdding(true); setIsEditing(false); setSelected(null);
    setEditTopic(''); setEditDetail(''); setEditGcn(''); setEditAccountId('');
    // Pre-fill category from the tab's filter so a new row lands in this view.
    var pre = filterCategory ? categoryPairs.find(function(c) { return c.title === filterCategory; }) : null;
    setEditCategory(pre ? { id: pre.id, title: pre.title } : null);
    setEditTechObt({ mode: null, id: null, label: '' });
    setEditSmids([]); setEditLcns([]);
    if (filterTravelerType) {
      var ttOpt = travelerTypeOptions.find(function(o) { return String(ttGetValue(o)) === filterTravelerType; });
      setEditTravelerTypes(ttOpt ? [{ id: String(ttGetId(ttOpt)), value: String(ttGetValue(ttOpt)), label: String(ttGetLabel(ttOpt)) }] : []);
    } else setEditTravelerTypes([]);
  }

  function handleSave() {
    var payload = {
      process_topic: editTopic,
      process_detail: editDetail,
      gcn: editGcn === '' ? '' : String(parseInt(editGcn, 10)),
      account_id: editAccountId === '' ? '' : String(parseInt(editAccountId, 10)),
      category_id: editCategory && editCategory.id != null ? String(editCategory.id) : '',
      technology_id: editTechObt.mode === 'technology' && editTechObt.id != null ? String(editTechObt.id) : '',
      obt_id: editTechObt.mode === 'obt' && editTechObt.id != null ? String(editTechObt.id) : '',
      smid: braceVals(editSmids),
      smid_id: braceIds(editSmids),
      lcn: braceVals(editLcns),
      lcn_id: braceIds(editLcns),
      traveler_type: braceVals(editTravelerTypes),
      traveler_type_id: braceIds(editTravelerTypes),
      updated_by: data.currentUser || '',
    };

    var actionData = null;
    if (isAdding) {
      actionData = { action: 'add', payload: payload, instanceId: data.instanceId || null, ts: Date.now() };
    } else if (isEditing && selected) {
      payload.id = selected.id;
      actionData = { action: 'edit', payload: payload, instanceId: data.instanceId || null, ts: Date.now() };
    }
    if (actionData && updateData) {
      updateData(actionData);
      setTimeout(function() { triggerDispatcher('handle_process_action'); }, 50);
    }
    setIsEditing(false); setIsAdding(false);
  }

  function handleCancel() { setIsEditing(false); setIsAdding(false); }

  function handleDelete() {
    if (!selected) return;
    var label = selected.process_topic || ('record #' + selected.id);
    if (!window.confirm('Delete "' + label + '"?\n\nThis cannot be undone.')) return;
    if (updateData) {
      updateData({ action: 'delete', payload: { id: selected.id, process_topic: selected.process_topic }, instanceId: data.instanceId || null, ts: Date.now() });
      setTimeout(function() { triggerDispatcher('handle_process_action'); }, 50);
    }
    setIsEditing(false); setIsAdding(false); setSelected(null);
  }

  // ─── Styles ───
  var S = {
    root: { display: 'flex', flexDirection: 'column', height: '100%', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif', fontSize: 13, color: C.text, background: C.bg, overflow: 'hidden' },
    hdr: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderBottom: '1px solid ' + C.border, background: C.bgAlt, minHeight: 40 },
    body: { display: 'flex', flex: 1, overflow: 'hidden' },
    lp: { width: 240, minWidth: 200, borderRight: '1px solid ' + C.border, display: 'flex', flexDirection: 'column', background: C.bgAlt },
    sb: { padding: '8px 10px', borderBottom: '1px solid ' + C.border },
    si: { width: '100%', padding: '6px 10px', border: '1px solid ' + C.border, borderRadius: 6, fontSize: 12, outline: 'none', background: C.bg, color: C.text, boxSizing: 'border-box' },
    lc: { flex: 1, overflowY: 'auto' },
    rp: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
    dh: { padding: '10px 16px', borderBottom: '1px solid ' + C.border, background: C.bgAlt },
    dt: { fontWeight: 600, fontSize: 14, color: C.textDark },
    dm: { display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4, alignItems: 'center' },
    nw: { flex: 1, overflowY: 'auto', padding: 16 },
    ns: { lineHeight: 1.65, fontSize: 13, color: C.text },
    ew: { flex: 1, display: 'flex', flexDirection: 'column', padding: 16, gap: 10, overflowY: 'auto' },
    fl: { fontWeight: 600, fontSize: 12, color: '#475569', marginBottom: 4 },
    ti: { width: '100%', padding: '7px 10px', border: '1px solid ' + C.border, borderRadius: 6, fontSize: 13, outline: 'none', background: C.bg, color: C.textDark, boxSizing: 'border-box' },
    br: { display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 },
    bp: { padding: '6px 16px', borderRadius: 6, border: 'none', background: C.primary, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
    bs: { padding: '6px 16px', borderRadius: 6, border: '1px solid ' + C.border, background: C.bg, color: '#475569', fontSize: 12, fontWeight: 500, cursor: 'pointer' },
    empty: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: C.textMuted, fontSize: 12, fontStyle: 'italic', padding: 20, textAlign: 'center' },
    fieldRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
    iconBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 6, border: '1px solid ' + C.border, background: C.bg, cursor: 'pointer' },
  };

  var showForm = isEditing || isAdding;
  var canEdit = hasEditPermission && selected && !showForm;
  var canAdd = hasEditPermission && !showForm;
  var canDelete = hasEditPermission && selected && !showForm;

  var headerUpdatedText = useMemo(function() {
    if (!selected || showForm || !selected.last_updated) return '';
    var d; try { d = new Date(selected.last_updated).toLocaleDateString(); } catch (e) { d = String(selected.last_updated); }
    var s = 'Updated ' + d;
    if (selected.updated_by) s += ' by ' + selected.updated_by;
    return s;
  }, [selected, showForm]);

  function badge(bg, fg, text, key) {
    return <span key={key || text} style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 500, background: bg, color: fg, whiteSpace: 'nowrap' }}>{text}</span>;
  }

  // ─── LEFT PANEL ───
  var selStyle = { width: '100%', padding: '6px 8px', border: '1px solid ' + C.border, borderRadius: 6, fontSize: 12, outline: 'none', background: C.bg, color: systemFilter ? C.textDark : C.textMuted, boxSizing: 'border-box', cursor: 'pointer', marginBottom: 8 };

  var leftPanel = (
    <div style={S.lp}>
      <div style={S.sb}>
        {hasSystemFilter ? (
          <select value={systemFilter} onChange={(e) => setSystemFilter(e.target.value)} style={selStyle} title="Filter by linked system">
            <option value="">All systems ({baseFiltered.length})</option>
            {systemOptions.techs.length > 0 ? (
              <optgroup label="Technology">
                {systemOptions.techs.map(function(t) { return <option key={'t' + t} value={'tech::' + t}>{t}</option>; })}
              </optgroup>
            ) : null}
            {systemOptions.obts.length > 0 ? (
              <optgroup label="OBT">
                {systemOptions.obts.map(function(o) { return <option key={'o' + o} value={'obt::' + o}>{o}</option>; })}
              </optgroup>
            ) : null}
          </select>
        ) : null}
        <input style={S.si} type="text" placeholder="Search topics & detail..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      </div>
      <div style={S.lc}>
        {displayedRecords.length === 0 ? (
          <div style={S.empty}>{allRecordsCount === 0 ? 'No records found.' : 'No results match your filters.'}</div>
        ) : displayedRecords.map(function(rec) {
          var isSel = selected && selected.id === rec.id;
          var sysLabel = rec.technology_title ? 'Tech: ' + rec.technology_title : (rec.obt_name ? 'OBT: ' + rec.obt_name : null);
          var sysColor = rec.technology_title ? C.tech : C.obt;
          return (
            <div key={rec.id}
              style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', background: isSel ? C.primaryLight : 'transparent', borderLeft: isSel ? '3px solid ' + C.primary : '3px solid transparent' }}
              onClick={() => handleSelect(rec)}>
              <div style={{ fontWeight: isSel ? 600 : 400, fontSize: 13, color: isSel ? C.primary : C.text }}>{rec.process_topic || 'Untitled'}</div>
              {sysLabel ? <div style={{ fontSize: 11, color: sysColor, marginTop: 2 }}>{sysLabel}</div> : null}
            </div>
          );
        })}
      </div>
    </div>
  );

  // ─── RIGHT PANEL ───
  var rightContent;
  if (showForm) {
    rightContent = (
      <>
        <div style={S.dh}><span style={S.dt}>{isAdding ? 'New Process' : 'Editing: ' + (editTopic || 'Untitled')}</span></div>
        <div style={S.ew}>
          <div>
            <div style={S.fl}>Process Topic</div>
            <input style={S.ti} value={editTopic} onChange={(e) => setEditTopic(e.target.value)} placeholder="Short title for this process..." />
          </div>

          <CatSingleSelect value={editCategory} onChange={setEditCategory} options={categoryPairs} fieldLabelStyle={S.fl} />

          <TechObtSelect technologyOptions={technologyOptions} obtOptions={obtOptions} value={editTechObt} onChange={setEditTechObt} />

          <div style={S.fieldRow}>
            <div>
              <div style={S.fl}>GCN</div>
              <input style={S.ti} type="number" value={editGcn} onChange={(e) => setEditGcn(e.target.value)} placeholder="e.g. 12345" />
            </div>
            <div>
              <div style={S.fl}>Account ID</div>
              <input style={S.ti} type="number" value={editAccountId} onChange={(e) => setEditAccountId(e.target.value)} placeholder="e.g. 67890" />
            </div>
          </div>

          <PairMultiSelect title="Traveler Type" color="#92400e" options={travelerTypeOptions}
            getId={ttGetId} getValue={ttGetValue} getLabel={ttGetLabel}
            selected={editTravelerTypes} onChange={setEditTravelerTypes}
            emptyHint="No traveler types loaded (postgresql_get_traveler_types)." />

          <PairMultiSelect title="SMID" color="#3b82f6" searchable options={smidOptions}
            getId={smidGetId} getValue={smidGetValue} getLabel={smidGetLabel} getCountry={smidGetCty}
            selected={editSmids} onChange={setEditSmids}
            emptyHint="No SMIDs loaded." />

          <PairMultiSelect title="LCN" color="#8b5cf6" options={lcnOptions}
            getId={lcnGetId} getValue={lcnGetValue} getLabel={lcnGetLabel} getCountry={lcnGetCty}
            selected={editLcns} onChange={setEditLcns}
            emptyHint="No LCNs loaded." />

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={S.fl}>Process Detail</div>
            <RichTextEditor value={editDetail} onChange={setEditDetail} />
          </div>

          <div style={S.br}>
            <button style={S.bs} onClick={handleCancel}>Cancel</button>
            <button style={S.bp} onClick={handleSave}>{isAdding ? 'Add' : 'Save Changes'}</button>
          </div>
        </div>
      </>
    );
  } else if (selected) {
    var metaBadges = [];
    if (selected.category) { var cc = getCatColor(selected.category); metaBadges.push(badge(cc.bg, cc.fg, selected.category, 'cat')); }
    if (selected.technology_title) metaBadges.push(badge(C.techLight, C.tech, 'Tech: ' + selected.technology_title, 'tech'));
    if (selected.obt_name) metaBadges.push(badge(C.obtLight, C.obt, 'OBT: ' + selected.obt_name, 'obt'));
    parsePgArray(selected.traveler_type).forEach(function(tt, i) { metaBadges.push(badge('#fef3c7', '#92400e', tt, 'tt' + i)); });

    var scalarRows = [];
    if (selected.gcn != null && selected.gcn !== '') scalarRows.push(['GCN', selected.gcn]);
    if (selected.account_id != null && selected.account_id !== '') scalarRows.push(['Account ID', selected.account_id]);
    var smidVals = parsePgArray(selected.smid);
    var lcnVals = parsePgArray(selected.lcn);
    if (smidVals.length) scalarRows.push(['SMID', smidVals.join(', ')]);
    if (lcnVals.length) scalarRows.push(['LCN', lcnVals.join(', ')]);

    rightContent = (
      <>
        <div style={S.dh}>
          <div style={S.dt}>{selected.process_topic || 'Untitled'}</div>
          {metaBadges.length > 0 && <div style={S.dm}>{metaBadges}</div>}
        </div>
        {scalarRows.length > 0 && (
          <div style={{ padding: '10px 16px', borderBottom: '1px solid ' + C.border, background: C.bgAlt }}>
            {scalarRows.map(function(row, i) {
              return (
                <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, padding: '3px 0' }}>
                  <span style={{ fontWeight: 600, color: '#475569', minWidth: 100 }}>{row[0]}:</span>
                  <span style={{ color: C.textDark }}>{row[1]}</span>
                </div>
              );
            })}
          </div>
        )}
        <div style={S.nw}><NotesDisplay html={selected.process_detail} style={S.ns} /></div>
      </>
    );
  } else {
    rightContent = <div style={S.empty}>Select a record from the list to view details.</div>;
  }

  // ─── RENDER ───
  return (
    <div style={S.root}>
      <div style={S.hdr}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.textDark }}>Processes</span>
          {filterCategory ? (function() { var cc = getCatColor(filterCategory); return badge(cc.bg, cc.fg, filterCategory, 'fc'); })() : null}
          {filterTravelerType ? badge('#fef3c7', '#92400e', filterTravelerType, 'ft') : null}
          <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: 10 }}>
            {filtered.length} {filtered.length === 1 ? 'record' : 'records'}
            {filtered.length !== allRecordsCount ? ' of ' + allRecordsCount : ''}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {headerUpdatedText ? <span style={{ fontSize: 11, color: C.textMuted, whiteSpace: 'nowrap' }}>{headerUpdatedText}</span> : null}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {hasEditPermission && <button style={{ ...S.iconBtn, color: canEdit ? '#64748b' : '#cbd5e1', opacity: canEdit ? 1 : 0.5 }} title="Edit" onClick={canEdit ? handleEdit : undefined}>{Icon('edit')}</button>}
            {hasEditPermission && <button style={{ ...S.iconBtn, color: canAdd ? '#64748b' : '#cbd5e1', opacity: canAdd ? 1 : 0.5 }} title="Add" onClick={canAdd ? handleAdd : undefined}>{Icon('plus')}</button>}
            {hasEditPermission && <button style={{ ...S.iconBtn, color: canDelete ? C.danger : '#cbd5e1', opacity: canDelete ? 1 : 0.5, borderColor: canDelete ? '#fecaca' : C.border }} title="Delete" onClick={canDelete ? handleDelete : undefined}>{Icon('trash')}</button>}
          </div>
        </div>
      </div>
      <div style={S.body}>
        {leftPanel}
        <div style={S.rp}>{rightContent}</div>
      </div>
    </div>
  );
}

// =============================================================================
// CONNECT & RENDER
// =============================================================================
var Wrapped = function(props) { return <ErrorBoundary><ProcessManager {...props} /></ErrorBoundary>; };
var Connected = Tooljet.connectComponent(Wrapped);
ReactDOM.render(<Connected />, document.body);
