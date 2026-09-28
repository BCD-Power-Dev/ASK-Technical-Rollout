/**
 * Supplier & Contact Manager — ToolJet Custom Component
 * Version: 1.1  (Category-scoped, server-side contacts)
 *
 * THREE TABS, ONE INSTANCE PER CATEGORY, ONE DISPATCHER:
 *   Tab 1  Preferred Suppliers — account_suppliers ⋈ supplier, filtered to `category`
 *   Tab 2  Account Contacts    — server query: account_specific + category + selected
 *                                GCN/SMID or GCN/LCN or Country
 *   Tab 3  All Contacts        — server query: NOT account_specific, no GCN/SMID/LCN,
 *                                in `category`
 *
 * SCOPING
 *   `category` (binding) drives client-side display + the supplier picker + new-row
 *   defaults. The server contact queries read page variable var_active_category plus
 *   var_country / var_selected_gcn / var_selected_SMID / var_selected_lcn. Bind
 *   `category` to var_active_category so the two always agree. This component RE-RUNS
 *   the two contact queries whenever the category/selection context changes.
 *
 * SUPPLIER TYPE inherits from the chosen public.supplier row — never entered by hand.
 * Users select existing suppliers only; they do not create supplier masters here.
 *
 * REQUIRED PAGE VARIABLES:
 *   supplier_contact_payload {}   last_sc_ts 0   var_active_category ""
 *   (existing) var_country, var_selected_gcn, var_selected_SMID, var_selected_lcn
 *
 * DATA BINDING CONTRACT: see data_binding_contract.txt
 */

import React, { useState, useMemo, useEffect } from 'https://esm.sh/react@18';
import ReactDOM from 'https://esm.sh/react-dom@18';

// =============================================================================
// THEME
// =============================================================================
var C = {
  primary: '#4f46e5', primaryLight: '#e0e7ff', bg: '#ffffff', bgAlt: '#f9fafb',
  bgHover: '#f3f4f6', border: '#e2e8f0', text: '#334155', textDark: '#0f172a',
  textMuted: '#94a3b8', danger: '#dc2626', dangerLight: '#fee2e2', star: '#f59e0b',
  starLight: '#fef3c7',
};

// =============================================================================
// ICONS
// =============================================================================
var Icons = {
  edit:   '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  plus:   '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  trash:  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>',
  star:   '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  starOutline:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  phone:  '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.81.36 1.6.7 2.34a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.74-1.27a2 2 0 0 1 2.11-.45c.74.34 1.53.57 2.34.7A2 2 0 0 1 22 16.92z"/></svg>',
  mail:   '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
  globe:  '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
  pin:    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  building:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01M8 14h.01M16 14h.01M12 14h.01"/></svg>',
  lock:   '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
};
function Icon(name, color) {
  return <span style={{ display: 'inline-flex', color: color || 'currentColor' }} dangerouslySetInnerHTML={{ __html: Icons[name] || '' }} />;
}

// =============================================================================
// UTILITIES
// =============================================================================
function extractQueryData(q) {
  if (!q) return [];
  if (Array.isArray(q)) return q;
  if (q.data && Array.isArray(q.data)) return q.data;
  if (q.rawData && Array.isArray(q.rawData)) return q.rawData;
  if (typeof q === 'object' && q.id) return [q];
  return [];
}
function parsePgArray(val) {
  if (val === null || val === undefined || val === '') return [];
  if (Array.isArray(val)) return val.map(function (s) { return String(s).trim(); }).filter(Boolean);
  var s = String(val).trim();
  if (s === '{}' || s === '') return [];
  if (s.charAt(0) === '{' && s.charAt(s.length - 1) === '}') s = s.slice(1, -1);
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
function isTruthyBool(v) {
  if (v === true) return true;
  if (typeof v === 'string') return v.toLowerCase() === 'true' || v === 't';
  return false;
}
function hasValue(v) {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim() !== '' && v.trim() !== '{}';
  if (Array.isArray(v)) return v.length > 0;
  return true;
}
function normalizeUrl(u) {
  if (!u) return '';
  var s = String(u).trim();
  if (!s) return '';
  return /^https?:\/\//i.test(s) ? s : 'https://' + s;
}
// "{United States}" -> "United States" for display; arrays joined with comma.
function displayCountry(v) {
  var arr = parsePgArray(v);
  if (arr.length) return arr.join(', ');
  return String(v || '').replace(/^\{|\}$/g, '');
}

// =============================================================================
// RICH TEXT EDITOR
// =============================================================================
class RichTextEditor extends React.Component {
  constructor(props) { super(props); this.editorRef = React.createRef(); }
  componentDidMount() { if (this.editorRef.current && this.props.value) this.editorRef.current.innerHTML = this.props.value; }
  componentDidUpdate(pp) {
    if (pp.value !== this.props.value && this.editorRef.current && this.editorRef.current.innerHTML !== this.props.value) {
      this.editorRef.current.innerHTML = this.props.value || '';
    }
  }
  execCmd = (cmd, val) => { document.execCommand(cmd, false, val || null); if (this.editorRef.current) this.editorRef.current.focus(); this.fireChange(); };
  fireChange = () => { if (this.editorRef.current && this.props.onChange) this.props.onChange(this.editorRef.current.innerHTML); };
  handleLink = () => { var url = prompt('Enter URL:'); if (url) this.execCmd('createLink', url); };
  render() {
    var self = this;
    var tb = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', border: '1px solid transparent', borderRadius: '4px', background: 'transparent', cursor: 'pointer', color: '#475569', fontSize: '13px', fontWeight: 600, padding: 0 };
    var prevent = function (e) { e.preventDefault(); };
    var sep = <span style={{ width: '1px', height: '20px', background: C.border, margin: '0 4px' }} />;
    return (
      <div style={{ border: '1px solid ' + C.border, borderRadius: '6px', overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1, minHeight: '160px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', padding: '6px 8px', borderBottom: '1px solid ' + C.border, background: C.bgAlt, alignItems: 'center' }}>
          <button style={tb} title="Bold" onMouseDown={prevent} onClick={() => self.execCmd('bold')}><b>B</b></button>
          <button style={tb} title="Italic" onMouseDown={prevent} onClick={() => self.execCmd('italic')}><i>I</i></button>
          <button style={tb} title="Underline" onMouseDown={prevent} onClick={() => self.execCmd('underline')}><u>U</u></button>
          {sep}
          <button style={tb} title="Bullet List" onMouseDown={prevent} onClick={() => self.execCmd('insertUnorderedList')}>•</button>
          <button style={tb} title="Numbered List" onMouseDown={prevent} onClick={() => self.execCmd('insertOrderedList')}>1.</button>
          {sep}
          <button style={tb} title="Link" onMouseDown={prevent} onClick={() => self.handleLink()}>{Icon('globe')}</button>
        </div>
        <div ref={this.editorRef} contentEditable={true}
          style={{ flex: 1, padding: '10px 12px', outline: 'none', overflowY: 'auto', minHeight: '120px', fontSize: '13px', lineHeight: '1.65', color: C.textDark, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif' }}
          onInput={this.fireChange} />
      </div>
    );
  }
}
function NotesDisplay({ html, style }) {
  if (!html || html.trim() === '' || html.trim() === '<p></p>') return <div style={{ color: C.textMuted, fontStyle: 'italic' }}>No notes.</div>;
  var styled = '<style>.fn ul,.fn ol{padding-left:22px;margin:4px 0}.fn li{margin-bottom:3px}.fn a{color:#4f46e5;text-decoration:none}.fn a:hover{text-decoration:underline}.fn strong,.fn b{font-weight:600;color:#0f172a}.fn p{margin:4px 0}</style><div class="fn">' + html + '</div>';
  return <div style={style || {}} dangerouslySetInnerHTML={{ __html: styled }} />;
}

// =============================================================================
// SINGLE-SELECT SEARCH DROPDOWN
// =============================================================================
function SingleSelect({ label, value, options, getValue, getLabel, getMeta, onChange, accent, placeholder, disabled }) {
  var [open, setOpen] = useState(false);
  var [q, setQ] = useState('');
  accent = accent || C.primary;
  var opts = Array.isArray(options) ? options : [];

  var filtered = useMemo(function () {
    if (!q) return opts;
    var lower = q.toLowerCase();
    return opts.filter(function (o) {
      return String(getLabel(o) || '').toLowerCase().indexOf(lower) >= 0 ||
             String(getValue(o) || '').toLowerCase().indexOf(lower) >= 0;
    });
  }, [opts, q]);

  var selectedLabel = useMemo(function () {
    if (!value) return '';
    var m = opts.filter(function (o) { return String(getValue(o)) === String(value); })[0];
    return m ? getLabel(m) : value;
  }, [value, opts]);

  var fieldStyle = { fontWeight: 600, fontSize: '12px', color: '#475569', marginBottom: '4px' };
  var triggerStyle = { width: '100%', padding: '7px 10px', border: '1px solid ' + C.border, borderRadius: '6px', fontSize: '13px', background: disabled ? C.bgAlt : C.bg, color: value ? C.textDark : C.textMuted, cursor: disabled ? 'not-allowed' : 'pointer', boxSizing: 'border-box', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
  var menuStyle = { position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: C.bg, border: '1px solid ' + C.border, borderRadius: '6px', marginTop: '4px', boxShadow: '0 6px 18px rgba(0,0,0,0.12)', maxHeight: '220px', overflowY: 'auto' };
  var searchStyle = { width: '100%', padding: '7px 10px', border: 'none', borderBottom: '1px solid ' + C.border, fontSize: '12px', outline: 'none', boxSizing: 'border-box' };
  var rowStyle = function (sel) { return { padding: '7px 10px', fontSize: '12px', cursor: 'pointer', background: sel ? accent + '15' : 'transparent', color: sel ? accent : C.text, display: 'flex', justifyContent: 'space-between' }; };

  return (
    <div>
      {label ? <div style={fieldStyle}>{label}</div> : null}
      <div style={{ position: 'relative' }}>
        <div style={triggerStyle} onClick={function () { if (!disabled) { setOpen(!open); setQ(''); } }}>
          <span>{selectedLabel || (placeholder || 'Select…')}</span>
          <span style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {value && !disabled ? <span onClick={function (e) { e.stopPropagation(); onChange(''); }} style={{ color: C.textMuted, fontWeight: 700 }}>×</span> : null}
            <span style={{ color: C.textMuted }}>▾</span>
          </span>
        </div>
        {open && !disabled ? (
          <div style={menuStyle}>
            <input autoFocus style={searchStyle} placeholder={'Search ' + opts.length + '…'} value={q} onChange={function (e) { setQ(e.target.value); }} />
            {filtered.length === 0 ? <div style={{ padding: '10px', fontSize: '12px', color: C.textMuted, fontStyle: 'italic' }}>No matches.</div> :
              filtered.map(function (o, i) {
                var v = String(getValue(o));
                var sel = String(value) === v;
                return (
                  <div key={v + i} style={rowStyle(sel)} onClick={function () { onChange(v, o); setOpen(false); }}>
                    <span>{getLabel(o)}</span>
                    {getMeta ? <span style={{ color: C.textMuted, fontSize: '11px' }}>{getMeta(o)}</span> : null}
                  </div>
                );
              })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// =============================================================================
// SHARED SMALL UI + STYLES
// =============================================================================
function Badge({ bg, fg, children }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 500, background: bg, color: fg, whiteSpace: 'nowrap' }}>{children}</span>;
}
function FieldRow({ label, children, icon }) {
  return (
    <div style={{ display: 'flex', gap: '8px', fontSize: '12px', padding: '4px 0', alignItems: 'baseline' }}>
      <span style={{ fontWeight: 600, color: '#475569', minWidth: '130px', display: 'inline-flex', gap: '5px', alignItems: 'center' }}>{icon ? Icon(icon, C.textMuted) : null}{label}</span>
      <span style={{ color: C.textDark, wordBreak: 'break-word' }}>{children}</span>
    </div>
  );
}
function Tabs({ active, onChange, tabs }) {
  return (
    <div style={{ display: 'flex', gap: '2px', padding: '0 12px', borderBottom: '1px solid ' + C.border, background: C.bgAlt }}>
      {tabs.map(function (t) {
        var on = active === t.key;
        return (
          <button key={t.key} onClick={function () { onChange(t.key); }}
            style={{ padding: '10px 16px', border: 'none', borderBottom: on ? '2px solid ' + C.primary : '2px solid transparent', background: 'transparent', color: on ? C.primary : C.textMuted, fontSize: '13px', fontWeight: on ? 600 : 500, cursor: 'pointer', display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
            {t.icon ? Icon(t.icon) : null}{t.label}
            {typeof t.count === 'number' ? <span style={{ fontSize: '11px', color: on ? C.primary : C.textMuted, background: on ? C.primaryLight : '#f1f5f9', borderRadius: '10px', padding: '1px 7px' }}>{t.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
var S = {
  body: { display: 'flex', flex: 1, overflow: 'hidden' },
  lp: { width: '260px', minWidth: '200px', borderRight: '1px solid ' + C.border, display: 'flex', flexDirection: 'column', background: C.bgAlt },
  sb: { padding: '8px 10px', borderBottom: '1px solid ' + C.border },
  si: { width: '100%', padding: '6px 10px', border: '1px solid ' + C.border, borderRadius: '6px', fontSize: '12px', outline: 'none', background: C.bg, color: C.text, boxSizing: 'border-box' },
  lc: { flex: 1, overflowY: 'auto' },
  rp: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  dh: { padding: '10px 16px', borderBottom: '1px solid ' + C.border, background: C.bgAlt },
  dt: { fontWeight: 600, fontSize: '14px', color: C.textDark, display: 'inline-flex', gap: '6px', alignItems: 'center' },
  dm: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px', alignItems: 'center' },
  nw: { flex: 1, overflowY: 'auto', padding: '16px' },
  ew: { flex: 1, display: 'flex', flexDirection: 'column', padding: '16px', gap: '12px', overflowY: 'auto' },
  fl: { fontWeight: 600, fontSize: '12px', color: '#475569', marginBottom: '4px' },
  ti: { width: '100%', padding: '7px 10px', border: '1px solid ' + C.border, borderRadius: '6px', fontSize: '13px', outline: 'none', background: C.bg, color: C.textDark, boxSizing: 'border-box' },
  tiReadonly: { width: '100%', padding: '7px 10px', border: '1px solid ' + C.border, borderRadius: '6px', fontSize: '13px', background: C.bgAlt, color: C.textMuted, boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: '6px' },
  br: { display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: '4px' },
  bp: { padding: '7px 16px', borderRadius: '6px', border: 'none', background: C.primary, color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer' },
  bs: { padding: '7px 16px', borderRadius: '6px', border: '1px solid ' + C.border, background: C.bg, color: '#475569', fontSize: '12px', fontWeight: 500, cursor: 'pointer' },
  empty: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: C.textMuted, fontSize: '12px', fontStyle: 'italic', padding: '20px', textAlign: 'center' },
  iconBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', borderRadius: '6px', border: '1px solid ' + C.border, background: C.bg, cursor: 'pointer' },
  fieldRow2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' },
  listItem: { padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' },
};
function ActionBar({ canEdit, canAdd, canDelete, onEdit, onAdd, onDelete, updated }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      {updated ? <span style={{ fontSize: '11px', color: C.textMuted, whiteSpace: 'nowrap' }}>{updated}</span> : null}
      <div style={{ display: 'flex', gap: '4px' }}>
        <button style={{ ...S.iconBtn, color: canEdit ? '#64748b' : '#cbd5e1', opacity: canEdit ? 1 : 0.5 }} title="Edit" onClick={canEdit ? onEdit : undefined}>{Icon('edit')}</button>
        <button style={{ ...S.iconBtn, color: canAdd ? '#64748b' : '#cbd5e1', opacity: canAdd ? 1 : 0.5 }} title="Add" onClick={canAdd ? onAdd : undefined}>{Icon('plus')}</button>
        <button style={{ ...S.iconBtn, color: canDelete ? C.danger : '#cbd5e1', opacity: canDelete ? 1 : 0.5, borderColor: canDelete ? '#fecaca' : C.border }} title="Delete" onClick={canDelete ? onDelete : undefined}>{Icon('trash')}</button>
      </div>
    </div>
  );
}
function CategoryBadge({ category }) {
  if (!category) return null;
  return <Badge bg={C.primaryLight} fg={C.primary}>{category}</Badge>;
}

// =============================================================================
// TAB 1 — PREFERRED SUPPLIERS  (select-from-master, inherited type)
// =============================================================================
var SUPPLIER_DISPLAY_FIELDS = [
  { key: 'supplier_type', label: 'Type' },
  { key: 'supplier_code', label: 'Code' },
  { key: 'supplier_3_digit_code', label: '3-Digit Code' },
  { key: 'country', label: 'Country', icon: 'pin' },
  { key: 'status', label: 'Status' },
  { key: 'subsidiary_parent', label: 'Parent' },
  { key: 'affiliate', label: 'Affiliate' },
  { key: 'supplier_website', label: 'Website', type: 'urlArray', icon: 'globe' },
  { key: 'supplier_website_2', label: 'Website 2', type: 'url', icon: 'globe' },
  { key: 'agency_website', label: 'Agency Website', type: 'url', icon: 'globe' },
  { key: 'loyalty_program_website', label: 'Loyalty Program', type: 'url', icon: 'globe' },
];
function SupplierLink({ url }) { return <a href={normalizeUrl(url)} target="_blank" rel="noreferrer" style={{ color: C.primary, textDecoration: 'none' }}>{url}</a>; }

function SupplierPanel({ data, category, hasEditPermission, supplierOptions, dispatch }) {
  var rows = useMemo(function () { return extractQueryData(data.accountSuppliers); }, [data.accountSuppliers]);
  var [selected, setSelected] = useState(null);
  var [search, setSearch] = useState('');
  var [form, setForm] = useState(null);

  // Master supplier picker options; restricted to the active category if set.
  var supplierChoices = useMemo(function () {
    var opts = supplierOptions || [];
    if (category) opts = opts.filter(function (o) { return String(o.supplier_type || '') === category; });
    return opts;
  }, [supplierOptions, category]);

  var filtered = useMemo(function () {
    var r = rows;
    if (category) r = r.filter(function (x) { return String(x.supplier_type || '') === category; }); // master type
    if (search) {
      var q = search.toLowerCase();
      r = r.filter(function (x) {
        return String(x.supplier || x.supplier_name || '').toLowerCase().indexOf(q) >= 0 ||
               String(x.country || '').toLowerCase().indexOf(q) >= 0;
      });
    }
    return r.slice().sort(function (a, b) {
      var pa = isTruthyBool(a.prefered) ? 0 : 1, pb = isTruthyBool(b.prefered) ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return String(a.supplier || a.supplier_name || '').localeCompare(String(b.supplier || b.supplier_name || ''));
    });
  }, [rows, category, search]);

  useEffect(function () {
    if (filtered.length > 0 && (!selected || !filtered.some(function (r) { return r.account_supplier_idx === selected.account_supplier_idx; }))) setSelected(filtered[0]);
    else if (filtered.length === 0) setSelected(null);
  }, [filtered]);

  function startEdit() {
    if (!selected) return;
    setForm({ mode: 'edit', supplier: selected.supplier || selected.supplier_name || '', prefered: isTruthyBool(selected.prefered), supplier_type: selected.supplier_type || selected.account_supplier_type || '', notes: selected.account_notes || '', account_supplier_idx: selected.account_supplier_idx, id: selected.id });
  }
  function startAdd() {
    setForm({ mode: 'add', supplier: '', prefered: true, supplier_type: category || '', notes: '', account_supplier_idx: null, id: null });
  }
  function selectSupplier(name) {
    var opt = (supplierOptions || []).filter(function (o) { return String(o.supplier_name) === String(name); })[0];
    setForm(Object.assign({}, form, { supplier: name, supplier_type: opt ? (opt.supplier_type || '') : (category || '') }));
  }
  function save() {
    if (!form.supplier) { alert('Select a supplier.'); return; }
    var payload = { supplier: form.supplier, prefered: !!form.prefered, supplier_type: form.supplier_type || '', notes: form.notes || '' };
    if (form.mode === 'edit') { payload.account_supplier_idx = form.account_supplier_idx; payload.id = form.id; dispatch('account_supplier', 'edit', payload); }
    else dispatch('account_supplier', 'add', payload);
    setForm(null);
  }
  function remove() {
    if (!selected) return;
    var label = selected.supplier || selected.supplier_name || ('#' + selected.id);
    if (!window.confirm('Remove "' + label + '" from preferred suppliers?\n\nThis deletes the account_supplier link (not the supplier master).')) return;
    dispatch('account_supplier', 'delete', { account_supplier_idx: selected.account_supplier_idx, id: selected.id, supplier: label });
    setSelected(null);
  }

  var left = (
    <div style={S.lp}>
      <div style={S.sb}><input style={S.si} placeholder="Search suppliers…" value={search} onChange={function (e) { setSearch(e.target.value); }} /></div>
      <div style={S.lc}>
        {filtered.length === 0 ? <div style={S.empty}>{rows.length === 0 ? 'No suppliers linked.' : 'No matches.'}</div> :
          filtered.map(function (rec) {
            var name = rec.supplier || rec.supplier_name || 'Untitled';
            var isSel = selected && selected.account_supplier_idx === rec.account_supplier_idx;
            var pref = isTruthyBool(rec.prefered);
            return (
              <div key={rec.account_supplier_idx} onClick={function () { setSelected(rec); setForm(null); }}
                style={{ ...S.listItem, background: isSel ? C.primaryLight : 'transparent', borderLeft: isSel ? '3px solid ' + C.primary : '3px solid transparent', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: pref ? C.star : '#cbd5e1', display: 'inline-flex', flexShrink: 0 }}>{Icon(pref ? 'star' : 'starOutline')}</span>
                <div>
                  <div style={{ fontWeight: isSel ? 600 : 400, fontSize: '13px', color: isSel ? C.primary : C.text }}>{name}</div>
                  {rec.supplier_type ? <div style={{ fontSize: '11px', color: C.textMuted }}>{rec.supplier_type}</div> : null}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );

  var right;
  if (form) {
    var noOptions = !supplierChoices || supplierChoices.length === 0;
    right = (
      <>
        <div style={S.dh}><span style={S.dt}>{form.mode === 'add' ? 'Add Preferred Supplier' : 'Editing: ' + form.supplier}</span></div>
        <div style={S.ew}>
          <div>
            <div style={S.fl}>Supplier *{category ? <span style={{ fontWeight: 400, color: C.textMuted }}>  (from {category} suppliers)</span> : null}</div>
            {noOptions ? (
              <div style={{ fontSize: 12, color: C.textMuted, fontStyle: 'italic', padding: '8px 0' }}>
                {category ? 'No ' + category + ' suppliers in public.supplier.' : 'Supplier menu not loaded. Bind postgresql_get_supplier_menu.'}
              </div>
            ) : (
              <SingleSelect label="" value={form.supplier} options={supplierChoices}
                getValue={function (o) { return o.supplier_name; }} getLabel={function (o) { return o.supplier_name; }}
                getMeta={function (o) { return o.supplier_type || ''; }}
                onChange={function (v) { selectSupplier(v); }} placeholder="Choose supplier…" />
            )}
          </div>
          <div style={S.fieldRow2}>
            <div>
              <div style={S.fl}>Supplier Type</div>
              <div style={S.tiReadonly}>{Icon('lock')}{form.supplier_type || '—'} <span style={{ fontSize: 11 }}>(inherited)</span></div>
            </div>
            <div>
              <div style={S.fl}>Preferred</div>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '7px 0', cursor: 'pointer' }}>
                <input type="checkbox" checked={!!form.prefered} onChange={function (e) { setForm(Object.assign({}, form, { prefered: e.target.checked })); }} />
                <span style={{ fontSize: '13px', color: C.text }}>Mark as preferred</span>
              </label>
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={S.fl}>Notes</div>
            <RichTextEditor value={form.notes} onChange={function (v) { setForm(Object.assign({}, form, { notes: v })); }} />
          </div>
          <div style={S.br}>
            <button style={S.bs} onClick={function () { setForm(null); }}>Cancel</button>
            <button style={S.bp} onClick={save}>{form.mode === 'add' ? 'Add' : 'Save Changes'}</button>
          </div>
        </div>
      </>
    );
  } else if (selected) {
    var pref = isTruthyBool(selected.prefered);
    var groomed = SUPPLIER_DISPLAY_FIELDS.filter(function (f) { return hasValue(selected[f.key]); });
    right = (
      <>
        <div style={S.dh}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={S.dt}>{Icon('building', C.textMuted)} {selected.supplier || selected.supplier_name || 'Untitled'}</div>
            <ActionBar canEdit={hasEditPermission} canAdd={hasEditPermission} canDelete={hasEditPermission} onEdit={startEdit} onAdd={startAdd} onDelete={remove} />
          </div>
          <div style={S.dm}>
            {pref ? <Badge bg={C.starLight} fg={'#92400e'}>{Icon('star')} Preferred</Badge> : null}
            {isTruthyBool(selected.charter) ? <Badge bg={'#e0e7ff'} fg={'#3730a3'}>Charter</Badge> : null}
            {isTruthyBool(selected.subsidiary) ? <Badge bg={'#d1fae5'} fg={'#065f46'}>Subsidiary</Badge> : null}
          </div>
        </div>
        <div style={S.nw}>
          {groomed.length === 0 ? <div style={{ color: C.textMuted, fontStyle: 'italic', marginBottom: 12 }}>No supplier master fields populated.</div> :
            groomed.map(function (f) {
              var val = selected[f.key], rendered;
              if (f.type === 'urlArray') rendered = parsePgArray(val).map(function (u, i) { return <span key={i}>{i ? ', ' : ''}<SupplierLink url={u} /></span>; });
              else if (f.type === 'url') rendered = <SupplierLink url={val} />;
              else if (f.key === 'country') rendered = displayCountry(val);
              else rendered = String(val);
              return <FieldRow key={f.key} label={f.label} icon={f.icon}>{rendered}</FieldRow>;
            })}
          {hasValue(selected.account_notes) ? (
            <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid ' + C.border }}>
              <div style={{ fontWeight: 600, fontSize: '12px', color: '#475569', marginBottom: '6px' }}>Account Notes</div>
              <NotesDisplay html={selected.account_notes} style={{ fontSize: '13px', lineHeight: '1.65' }} />
            </div>
          ) : null}
        </div>
      </>
    );
  } else {
    right = (
      <>
        <div style={S.dh}><div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={S.dt}>Preferred Suppliers <CategoryBadge category={category} /></span>
          <ActionBar canEdit={false} canAdd={hasEditPermission} canDelete={false} onAdd={startAdd} /></div></div>
        <div style={S.empty}>Select a supplier to view details.</div>
      </>
    );
  }
  return <div style={S.body}>{left}<div style={S.rp}>{right}</div></div>;
}

// =============================================================================
// TABS 2 & 3 — CONTACTS  (consume server-scoped data; defensive client guard)
// =============================================================================
var CONTACT_FORM_FIELDS = [
  { key: 'contact_detail', label: 'Contact Detail' },
  { key: 'phone_1', label: 'Phone 1' }, { key: 'phone_2', label: 'Phone 2' },
  { key: 'email_1', label: 'Email 1' }, { key: 'email_2', label: 'Email 2' },
  { key: 'fax', label: 'Fax' }, { key: 'geo_area_of_support', label: 'Geo Area of Support' },
  { key: 'country', label: 'Country  (array literal, e.g. {United States})' },
  { key: 'support_website', label: 'Support Website' }, { key: 'address', label: 'Address' },
];
function emptyContactForm(mode, opts) {
  opts = opts || {};
  var f = { mode: 'add', title: '', supplier: '', supplier_type: opts.category || '', gcn: '', smid: '', lcn: '', notes: '', country_specific: false, account_specific: mode === 'account', account_supplier_contact_idx: null, id: null };
  CONTACT_FORM_FIELDS.forEach(function (cf) { f[cf.key] = ''; });
  if (mode === 'account' && opts.ctx) {
    f.gcn = opts.ctx.selectedGcn || '';
    f.smid = opts.ctx.selectedSmid || '';
    f.lcn = opts.ctx.selectedLcn || '';
    if (opts.ctx.country) f.country = '{' + opts.ctx.country + '}';
  }
  return f;
}

function ContactsPanel({ panelMode, data, category, context, hasEditPermission, supplierOptions, gcnOptions, smidOptions, lcnOptions, dispatch }) {
  var serverRows = useMemo(function () {
    return extractQueryData(panelMode === 'account' ? data.accountContacts : data.allContacts);
  }, [panelMode, data.accountContacts, data.allContacts]);

  // Defensive client guard so a misconfigured query can't show the wrong pool.
  var base = useMemo(function () {
    var r = serverRows;
    if (panelMode === 'account') {
      r = r.filter(function (c) { return isTruthyBool(c.account_specific); });
    } else {
      r = r.filter(function (c) { return !isTruthyBool(c.account_specific) && !hasValue(c.gcn) && !hasValue(c.smid) && !hasValue(c.lcn); });
    }
    if (category) r = r.filter(function (c) { return String(c.supplier_type || '') === category; });
    return r;
  }, [serverRows, panelMode, category]);

  var [selected, setSelected] = useState(null);
  var [search, setSearch] = useState('');
  var [supplierFilter, setSupplierFilter] = useState('');
  var [form, setForm] = useState(null);

  var suppliers = useMemo(function () {
    var seen = {}; base.forEach(function (c) { if (c.supplier) seen[c.supplier] = true; });
    return Object.keys(seen).sort();
  }, [base]);

  var filtered = useMemo(function () {
    var r = base;
    if (panelMode === 'all' && supplierFilter) r = r.filter(function (c) { return c.supplier === supplierFilter; });
    if (search) {
      var q = search.toLowerCase();
      r = r.filter(function (c) {
        return ['title', 'supplier', 'email_1', 'email_2', 'phone_1', 'country', 'gcn', 'smid', 'lcn', 'geo_area_of_support', 'contact_detail']
          .some(function (k) { return String(c[k] || '').toLowerCase().indexOf(q) >= 0; });
      });
    }
    return r.slice().sort(function (a, b) {
      var s = String(a.supplier || '').localeCompare(String(b.supplier || ''));
      return s !== 0 ? s : String(a.title || '').localeCompare(String(b.title || ''));
    });
  }, [base, panelMode, supplierFilter, search]);

  useEffect(function () {
    if (filtered.length > 0 && (!selected || !filtered.some(function (r) { return r.account_supplier_contact_idx === selected.account_supplier_contact_idx; }))) setSelected(filtered[0]);
    else if (filtered.length === 0) setSelected(null);
  }, [filtered]);

  function startEdit() {
    if (!selected) return;
    var f = { mode: 'edit', account_supplier_contact_idx: selected.account_supplier_contact_idx, id: selected.id };
    ['title', 'supplier', 'supplier_type', 'gcn', 'smid', 'lcn', 'notes'].forEach(function (k) { f[k] = selected[k] || ''; });
    CONTACT_FORM_FIELDS.forEach(function (cf) { f[cf.key] = selected[cf.key] || ''; });
    f.country_specific = isTruthyBool(selected.country_specific);
    f.account_specific = isTruthyBool(selected.account_specific);
    setForm(f);
  }
  function startAdd() { setForm(emptyContactForm(panelMode, { category: category, ctx: context })); }
  function save() {
    if (!form.supplier) { alert('Supplier is required.'); return; }
    if (!form.title) { alert('Title is required.'); return; }
    var payload = {
      supplier: form.supplier, supplier_type: form.supplier_type || '', title: form.title,
      gcn: form.gcn || '', smid: form.smid || '', lcn: form.lcn || '', notes: form.notes || '',
      country_specific: !!form.country_specific, account_specific: !!form.account_specific,
      modified_by: data.currentUser || '',
    };
    CONTACT_FORM_FIELDS.forEach(function (cf) { payload[cf.key] = form[cf.key] || ''; });
    if (form.mode === 'edit') { payload.account_supplier_contact_idx = form.account_supplier_contact_idx; payload.id = form.id; dispatch('contact', 'edit', payload); }
    else dispatch('contact', 'add', payload);
    setForm(null);
  }
  function remove() {
    if (!selected) return;
    var label = selected.title || ('#' + selected.id);
    if (!window.confirm('Delete contact "' + label + '"?\n\nThis cannot be undone.')) return;
    dispatch('contact', 'delete', { account_supplier_contact_idx: selected.account_supplier_contact_idx, id: selected.id, title: label });
    setSelected(null);
  }

  var left = (
    <div style={S.lp}>
      <div style={S.sb}>
        <input style={S.si} placeholder="Search contacts…" value={search} onChange={function (e) { setSearch(e.target.value); }} />
        {panelMode === 'all' && suppliers.length ? (
          <select style={{ ...S.si, marginTop: 8 }} value={supplierFilter} onChange={function (e) { setSupplierFilter(e.target.value); }}>
            <option value="">All suppliers</option>
            {suppliers.map(function (s) { return <option key={s} value={s}>{s}</option>; })}
          </select>
        ) : null}
      </div>
      <div style={S.lc}>
        {filtered.length === 0 ? <div style={S.empty}>{serverRows.length === 0 ? 'No contacts for this context.' : 'No matches.'}</div> :
          filtered.map(function (rec) {
            var isSel = selected && selected.account_supplier_contact_idx === rec.account_supplier_contact_idx;
            return (
              <div key={rec.account_supplier_contact_idx} onClick={function () { setSelected(rec); setForm(null); }}
                style={{ ...S.listItem, background: isSel ? C.primaryLight : 'transparent', borderLeft: isSel ? '3px solid ' + C.primary : '3px solid transparent' }}>
                <div style={{ fontWeight: isSel ? 600 : 500, fontSize: '13px', color: isSel ? C.primary : C.textDark }}>{rec.title || 'Untitled'}</div>
                <div style={{ fontSize: '11px', color: C.textMuted, marginTop: 2 }}>
                  {rec.supplier || '—'}{rec.supplier_type ? ' · ' + rec.supplier_type : ''}{rec.country ? ' · ' + displayCountry(rec.country) : ''}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );

  var right;
  if (form) {
    right = (
      <>
        <div style={S.dh}><span style={S.dt}>{form.mode === 'add' ? 'New Contact' : 'Editing: ' + (form.title || '')} <CategoryBadge category={category} /></span></div>
        <div style={S.ew}>
          <div style={S.fieldRow2}>
            <div>
              <div style={S.fl}>Title *</div>
              <input style={S.ti} value={form.title} onChange={function (e) { setForm(Object.assign({}, form, { title: e.target.value })); }} placeholder="e.g. Account Manager" />
            </div>
            <div>
              <div style={S.fl}>Supplier *</div>
              {supplierOptions && supplierOptions.length ? (
                <SingleSelect label="" value={form.supplier} options={supplierOptions}
                  getValue={function (o) { return o.supplier_name; }} getLabel={function (o) { return o.supplier_name; }} getMeta={function (o) { return o.supplier_type || ''; }}
                  onChange={function (v, o) { setForm(Object.assign({}, form, { supplier: v, supplier_type: (o && o.supplier_type) ? o.supplier_type : form.supplier_type })); }} placeholder="Choose supplier…" />
              ) : (
                <input style={S.ti} value={form.supplier} onChange={function (e) { setForm(Object.assign({}, form, { supplier: e.target.value })); }} placeholder="Supplier name" />
              )}
            </div>
          </div>

          <div>
            <div style={S.fl}>Supplier Type {category ? <span style={{ fontWeight: 400, color: C.textMuted }}>(category: {category})</span> : null}</div>
            <input style={S.ti} value={form.supplier_type} onChange={function (e) { setForm(Object.assign({}, form, { supplier_type: e.target.value })); }} placeholder="Air, Car, Hotel…" />
          </div>

          {/* Account-binding keys only relevant for account-specific contacts */}
          {form.account_specific ? (
            <>
              <div style={S.fieldRow2}>
                <SingleSelect label="GCN" value={form.gcn} accent={'#0c4a6e'} options={gcnOptions || []}
                  getValue={function (o) { return typeof o === 'string' ? o : (o.gcn || o.value || o.name); }} getLabel={function (o) { return typeof o === 'string' ? o : (o.gcn || o.value || o.name); }}
                  onChange={function (v) { setForm(Object.assign({}, form, { gcn: v })); }} placeholder={(gcnOptions && gcnOptions.length) ? 'Select GCN…' : 'No GCN menu bound'} />
                <SingleSelect label="SMID" value={form.smid} accent={'#3b82f6'} options={smidOptions || []}
                  getValue={function (o) { return typeof o === 'string' ? o : (o.smid || o.value); }} getLabel={function (o) { return typeof o === 'string' ? o : (o.title || o.smid || o.value); }} getMeta={function (o) { return (o && o.country_a2) ? o.country_a2 : ''; }}
                  onChange={function (v) { setForm(Object.assign({}, form, { smid: v })); }} placeholder={(smidOptions && smidOptions.length) ? 'Select SMID…' : 'No SMID menu bound'} />
              </div>
              <SingleSelect label="LCN" value={form.lcn} accent={'#8b5cf6'} options={lcnOptions || []}
                getValue={function (o) { return typeof o === 'string' ? o : (o.lcn_number || o.lcn || o.lcn_name || o.value); }} getLabel={function (o) { return typeof o === 'string' ? o : (o.lcn_name || o.lcn_number || o.lcn || o.value); }} getMeta={function (o) { return (o && o.smid_country_a2) ? o.smid_country_a2 : ''; }}
                onChange={function (v) { setForm(Object.assign({}, form, { lcn: v })); }} placeholder={(lcnOptions && lcnOptions.length) ? 'Select LCN…' : 'No LCN menu bound'} />
            </>
          ) : null}

          <div style={{ ...S.fl, marginTop: 4 }}>Contact Details</div>
          <div style={S.fieldRow2}>
            {CONTACT_FORM_FIELDS.map(function (cf) {
              return (
                <div key={cf.key} style={cf.key === 'country' || cf.key === 'address' ? { gridColumn: '1 / -1' } : {}}>
                  <div style={S.fl}>{cf.label}</div>
                  <input style={S.ti} value={form[cf.key] || ''} onChange={function (e) { var n = Object.assign({}, form); n[cf.key] = e.target.value; setForm(n); }} placeholder={cf.label + '…'} />
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: '24px' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: 13 }}>
              <input type="checkbox" checked={!!form.account_specific} onChange={function (e) { setForm(Object.assign({}, form, { account_specific: e.target.checked })); }} /> Account-specific
            </label>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: 13 }}>
              <input type="checkbox" checked={!!form.country_specific} onChange={function (e) { setForm(Object.assign({}, form, { country_specific: e.target.checked })); }} /> Country-specific
            </label>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={S.fl}>Notes</div>
            <RichTextEditor value={form.notes} onChange={function (v) { setForm(Object.assign({}, form, { notes: v })); }} />
          </div>

          <div style={S.br}>
            <button style={S.bs} onClick={function () { setForm(null); }}>Cancel</button>
            <button style={S.bp} onClick={save}>{form.mode === 'add' ? 'Add Contact' : 'Save Changes'}</button>
          </div>
        </div>
      </>
    );
  } else if (selected) {
    var badges = [];
    if (isTruthyBool(selected.account_specific)) badges.push(<Badge key="acc" bg={'#dbeafe'} fg={'#1e40af'}>Account-specific</Badge>);
    if (isTruthyBool(selected.country_specific)) badges.push(<Badge key="ctry" bg={'#d1fae5'} fg={'#065f46'}>Country-specific</Badge>);
    if (selected.supplier_type) badges.push(<Badge key="st" bg={'#e0e7ff'} fg={'#3730a3'}>{selected.supplier_type}</Badge>);
    if (selected.gcn) badges.push(<Badge key="gcn" bg={'#cffafe'} fg={'#0c4a6e'}>GCN {selected.gcn}</Badge>);
    if (selected.smid) badges.push(<Badge key="smid" bg={'#eff6ff'} fg={'#1e40af'}>SMID {selected.smid}</Badge>);
    if (selected.lcn) badges.push(<Badge key="lcn" bg={'#f5f3ff'} fg={'#5b21b6'}>LCN {selected.lcn}</Badge>);

    var detailRows = [
      { key: 'supplier', label: 'Supplier', icon: 'building' },
      { key: 'contact_detail', label: 'Contact' },
      { key: 'phone_1', label: 'Phone 1', icon: 'phone' }, { key: 'phone_2', label: 'Phone 2', icon: 'phone' },
      { key: 'email_1', label: 'Email 1', icon: 'mail', type: 'mail' }, { key: 'email_2', label: 'Email 2', icon: 'mail', type: 'mail' },
      { key: 'fax', label: 'Fax' }, { key: 'geo_area_of_support', label: 'Geo Support' },
      { key: 'country', label: 'Country', icon: 'pin', type: 'country' },
      { key: 'support_website', label: 'Support Site', icon: 'globe', type: 'url' }, { key: 'address', label: 'Address', icon: 'pin' },
    ].filter(function (f) { return hasValue(selected[f.key]); });

    right = (
      <>
        <div style={S.dh}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={S.dt}>{selected.title || 'Untitled'}</div>
            <ActionBar canEdit={hasEditPermission} canAdd={hasEditPermission} canDelete={hasEditPermission} onEdit={startEdit} onAdd={startAdd} onDelete={remove}
              updated={selected.modified ? ('Updated ' + (function () { try { return new Date(selected.modified).toLocaleDateString(); } catch (e) { return String(selected.modified); } })() + (selected.modified_by ? ' by ' + selected.modified_by : '')) : ''} />
          </div>
          {badges.length ? <div style={S.dm}>{badges}</div> : null}
        </div>
        <div style={S.nw}>
          {detailRows.map(function (f) {
            var val = selected[f.key], rendered;
            if (f.type === 'mail') rendered = <a href={'mailto:' + val} style={{ color: C.primary, textDecoration: 'none' }}>{val}</a>;
            else if (f.type === 'url') rendered = <a href={normalizeUrl(val)} target="_blank" rel="noreferrer" style={{ color: C.primary, textDecoration: 'none' }}>{val}</a>;
            else if (f.type === 'country') rendered = displayCountry(val);
            else rendered = String(val);
            return <FieldRow key={f.key} label={f.label} icon={f.icon}>{rendered}</FieldRow>;
          })}
          {hasValue(selected.notes) ? (
            <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid ' + C.border }}>
              <div style={{ fontWeight: 600, fontSize: '12px', color: '#475569', marginBottom: '6px' }}>Notes</div>
              <NotesDisplay html={selected.notes} style={{ fontSize: '13px', lineHeight: '1.65' }} />
            </div>
          ) : null}
        </div>
      </>
    );
  } else {
    right = (
      <>
        <div style={S.dh}><div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={S.dt}>{panelMode === 'account' ? 'Account Contacts' : 'All Contacts'} <CategoryBadge category={category} /></span>
          <ActionBar canEdit={false} canAdd={hasEditPermission} canDelete={false} onAdd={startAdd} />
        </div></div>
        <div style={S.empty}>{serverRows.length === 0 ? (panelMode === 'account' ? 'No account contacts for the selected GCN/SMID/LCN/Country in this category.' : 'No general contacts in this category.') : 'Select a contact to view details.'}</div>
      </>
    );
  }
  return <div style={S.body}>{left}<div style={S.rp}>{right}</div></div>;
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
        <div style={{ padding: '16px', fontFamily: 'monospace', fontSize: '12px', background: '#fef2f2', color: '#991b1b', borderRadius: '8px', border: '1px solid #fecaca', height: '100%', overflowY: 'auto' }}>
          <div style={{ fontWeight: 700, marginBottom: '8px' }}>Supplier/Contact Manager Error</div>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{String(this.state.error)}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

// =============================================================================
// MAIN
// =============================================================================
function SupplierContactManager(props) {
  var data = props.data || {};
  var updateData = props.updateData;

  var runQ = function (name) {
    var fn = props.runQuery || props.runJsQuery || (props.actions && props.actions.runQuery);
    if (typeof fn === 'function') { try { fn(name); } catch (e) { console.error('[SC] runQuery error:', name, e); } }
    else console.warn('[SC] No runQuery prop. Keys:', Object.keys(props));
  };

  useEffect(function () { console.log('[SC props keys]', Object.keys(props)); console.log('[SC has runQuery]', typeof props.runQuery); }, []);

  // Stage an action, then trigger the consolidated dispatcher.
  var dispatch = function (entity, action, payload) {
    if (!updateData) { console.warn('[SC] updateData missing'); return; }
    updateData({ entity: entity, action: action, payload: payload, instanceId: data.instanceId || null, ts: Date.now() });
    setTimeout(function () { runQ('handle_supplier_contact_action'); }, 50);
  };

  // Category + account context (var_active_category should equal the active tab).
  var category = useMemo(function () {
    var v = data.category;
    return (v === undefined || v === null || String(v).trim() === '') ? null : String(v).trim();
  }, [data.category]);
  var context = useMemo(function () {
    return {
      country: data.country || '', selectedGcn: data.selectedGcn || '',
      selectedSmid: data.selectedSmid || '', selectedLcn: data.selectedLcn || '',
    };
  }, [data.country, data.selectedGcn, data.selectedSmid, data.selectedLcn]);

  // Re-run the server contact queries whenever scope changes (tab switch, new
  // account selection, refresh bump). They read the page variables directly.
  useEffect(function () {
    runQ('postgresql_get_account_supplier_contacts');
    runQ('postgresql_get_all_supplier_contacts');
  }, [data.category, data.country, data.selectedGcn, data.selectedSmid, data.selectedLcn, data._refresh]);

  var EDITOR_GROUPS = ['admin', 'builder', 'Content_Editor'];
  var userGroups = useMemo(function () {
    var g = data.userGroups;
    return Array.isArray(g) ? g : (typeof g === 'string' ? [g] : []);
  }, [data.userGroups]);
  var hasEditPermission = useMemo(function () { return userGroups.some(function (g) { return EDITOR_GROUPS.indexOf(g) >= 0; }); }, [userGroups]);

  var supplierOptions = useMemo(function () { return extractQueryData(data.supplierOptions); }, [data.supplierOptions]);
  var gcnOptions = useMemo(function () { return extractQueryData(data.gcnOptions); }, [data.gcnOptions]);
  var smidOptions = useMemo(function () { return extractQueryData(data.smidOptions); }, [data.smidOptions]);
  var lcnOptions = useMemo(function () { return extractQueryData(data.lcnOptions); }, [data.lcnOptions]);

  var supplierCount = useMemo(function () {
    var r = extractQueryData(data.accountSuppliers);
    return category ? r.filter(function (x) { return String(x.supplier_type || '') === category; }).length : r.length;
  }, [data.accountSuppliers, category]);
  var acctCount = useMemo(function () { return extractQueryData(data.accountContacts).filter(function (c) { return isTruthyBool(c.account_specific); }).length; }, [data.accountContacts]);
  var allCount = useMemo(function () { return extractQueryData(data.allContacts).length; }, [data.allContacts]);

  var [activeTab, setActiveTab] = useState('suppliers');
  var TABS = [
    { key: 'suppliers', label: 'Preferred Suppliers', icon: 'star', count: supplierCount },
    { key: 'account_contacts', label: 'Account Contacts', icon: 'building', count: acctCount },
    { key: 'all_contacts', label: 'All Contacts', icon: 'mail', count: allCount },
  ];

  var rootStyle = { display: 'flex', flexDirection: 'column', height: '100%', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif', fontSize: '13px', color: C.text, background: C.bg, overflow: 'hidden' };

  var panel;
  if (activeTab === 'suppliers') panel = <SupplierPanel data={data} category={category} hasEditPermission={hasEditPermission} supplierOptions={supplierOptions} dispatch={dispatch} />;
  else if (activeTab === 'account_contacts') panel = <ContactsPanel panelMode="account" data={data} category={category} context={context} hasEditPermission={hasEditPermission} supplierOptions={supplierOptions} gcnOptions={gcnOptions} smidOptions={smidOptions} lcnOptions={lcnOptions} dispatch={dispatch} />;
  else panel = <ContactsPanel panelMode="all" data={data} category={category} context={context} hasEditPermission={hasEditPermission} supplierOptions={supplierOptions} gcnOptions={gcnOptions} smidOptions={smidOptions} lcnOptions={lcnOptions} dispatch={dispatch} />;

  return (
    <div style={rootStyle}>
      <Tabs active={activeTab} onChange={setActiveTab} tabs={TABS} />
      {panel}
    </div>
  );
}

// =============================================================================
// CONNECT & RENDER
// =============================================================================
var Wrapped = function (props) { return <ErrorBoundary><SupplierContactManager {...props} /></ErrorBoundary>; };
var Connected = Tooljet.connectComponent(Wrapped);
ReactDOM.render(<Connected />, document.body);
