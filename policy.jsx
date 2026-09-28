/**
 * Policy Topic Manager - ToolJet Custom Component
 * Version: 10.4 Production (Logging Removed)
 *
 * Changes in 10.4:
 * - FIX: Use runQuery('set_policy_payload') to set page variable
 * - setVariable is NOT available in ToolJet custom components
 * - Requires creating a helper JS query called 'set_policy_payload'
 * - Increased timeout to 600ms before calling handler
 *
 * Changes in 10.2:
 * - Fixed child topic refresh by forcing new object references
 * - Added childDataVersion tracking to detect content changes
 * - Updated byParent mapping to create fresh object references
 * - Added data hash to child keys to force React re-render
 * - Auto-update selected topic when underlying data changes
 *
 * UNIVERSAL COMPONENT: Works for ALL policy segments (Air, Rail, Car, Hotel, etc.)
 * Configuration passed via data binding - no hardcoded segment info.
 */

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'https://esm.sh/react@18';
import ReactDOM from 'https://esm.sh/react-dom@18';

// =============================================================================
// DEFAULT SEGMENT CONFIG (fallback if not provided via data binding)
// =============================================================================

var DEFAULT_SEGMENT = {
  name: 'Policy',
  tableName: 'Policy',
  subtopicsTable: 'policy_subtopics',
  parentIdField: 'topic_idx',
  childIdField: 'subtopic_idx',
  parentRefField: 'root_topic_idx',
  color: '#6366f1'
};

// =============================================================================
// UTILITIES
// =============================================================================

function sanitizeInput(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim();
}

function validateTopicName(name) {
  if (!name || typeof name !== 'string') return { valid: false, error: 'Topic name is required' };
  var trimmed = name.trim();
  if (trimmed.length < 2) return { valid: false, error: 'Topic name must be at least 2 characters' };
  if (trimmed.length > 500) return { valid: false, error: 'Topic name must be less than 500 characters' };
  return { valid: true, error: null };
}

function generateOpId() {
  return 'op_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function parsePgArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    var trimmed = val.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      var inner = trimmed.slice(1, -1);
      if (!inner) return [];
      return inner.split(',').map(function(s) { return s.trim(); });
    }
    try {
      var parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed;
    } catch(e) {}
    return [val];
  }
  return [];
}

function extractQueryData(queryResult) {
  if (!queryResult) return [];
  if (queryResult === '') return [];
  if (typeof queryResult === 'string') return [];
  if (Array.isArray(queryResult)) return queryResult;
  if (queryResult.data && Array.isArray(queryResult.data)) return queryResult.data;
  if (queryResult.rawData && Array.isArray(queryResult.rawData)) return queryResult.rawData;
  if (typeof queryResult === 'object' && queryResult.id && !queryResult.isLoading) return [queryResult];
  return [];
}

function isQueryLoading(queryResult) {
  if (!queryResult) return false;
  if (typeof queryResult !== 'object') return false;
  return queryResult.isLoading === true;
}

function formatDate(d) {
  if (!d) return 'Never';
  try { return new Date(d).toLocaleString(); } catch(e) { return 'Invalid date'; }
}

function htmlToMarkdown(html) {
  if (!html || typeof html !== 'string') return html || '';
  if (!/<[a-z][\s\S]*>/i.test(html)) return html;
  try {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>\s*<p>/gi, '\n\n')
      .replace(/<h([1-6])[^>]*>(.*?)<\/h\1>/gi, function(m, l, t) { return '#'.repeat(parseInt(l)) + ' ' + t + '\n'; })
      .replace(/<(strong|b)[^>]*>(.*?)<\/\1>/gi, '**$2**')
      .replace(/<(em|i)[^>]*>(.*?)<\/\1>/gi, '*$2*')
      .replace(/<mark[^>]*>(.*?)<\/mark>/gi, '==$1==')
      .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
      .replace(/<a[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi, '[$2]($1)')
      .replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, function(m, c) { return c.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n') + '\n'; })
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
      .replace(/\n{3,}/g, '\n\n').trim();
  } catch (e) { return html; }
}

function renderMarkdown(text) {
  if (!text) return '';
  try {
    return text
      .replace(/^#### (.+)$/gm, '<h4 style="font-size:14px;font-weight:600;margin:16px 0 8px;color:#111827">$1</h4>')
      .replace(/^### (.+)$/gm, '<h3 style="font-size:15px;font-weight:600;margin:16px 0 8px;color:#111827">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 style="font-size:17px;font-weight:600;margin:20px 0 10px;color:#111827">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 style="font-size:20px;font-weight:700;margin:24px 0 12px;color:#111827">$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/==(.+?)==/g, '<mark style="background:#fef3c7;padding:2px 4px;border-radius:3px;">$1</mark>')
      .replace(/`([^`]+)`/g, '<code style="background:#f9fafb;padding:2px 6px;border-radius:4px;font-size:12px;">$1</code>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color:#4f46e5">$1</a>')
      .replace(/^- (.+)$/gm, '<li style="margin:4px 0;margin-left:20px;">$1</li>')
      .replace(/\n/g, '<br/>');
  } catch(e) { return text; }
}

function processTopics(topics) {
  if (!Array.isArray(topics)) return [];
  return topics.map(function(t) {
    return Object.assign({}, t, { detail: htmlToMarkdown(t.detail) });
  });
}

// =============================================================================
// ICONS
// =============================================================================

var Icons = {
  chevronRight: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>',
  chevronDown: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>',
  folder: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
  file: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
  plus: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  edit: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  clock: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  filePlus: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>',
  x: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  check: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
  search: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  bold: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>',
  italic: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>',
  link: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
  table: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>',
  list: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
  code: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
  type: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>',
  highlight: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/></svg>'
};

function Icon(name, color) {
  return React.createElement('span', {
    style: { display: 'inline-flex', color: color || 'currentColor' },
    dangerouslySetInnerHTML: { __html: Icons[name] || '' }
  });
}

// =============================================================================
// LOADING OVERLAY
// =============================================================================

function LoadingOverlay(props) {
  if (!props.isVisible) return null;
  
  var overlayStyle = {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    zIndex: 100, borderRadius: '8px', backdropFilter: 'blur(2px)'
  };
  
  var spinnerStyle = {
    width: '40px', height: '40px',
    border: '3px solid #e5e7eb', borderTop: '3px solid ' + (props.color || '#6366f1'),
    borderRadius: '50%', animation: 'spin 1s linear infinite'
  };
  
  return React.createElement('div', { style: overlayStyle },
    React.createElement('style', null, '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }'),
    React.createElement('div', { style: spinnerStyle }),
    React.createElement('div', { style: { marginTop: '16px', fontSize: '14px', fontWeight: '500', color: '#111827' } }, props.message || 'Loading...'),
    React.createElement('div', { style: { marginTop: '4px', fontSize: '12px', color: '#6b7280' } }, props.subMessage || 'Please wait')
  );
}

// =============================================================================
// TOOLBAR COMPONENT
// =============================================================================

function Toolbar(props) {
  var ref = props.textareaRef, val = props.value || '', onChange = props.onChange;
  
  function insert(before, after) {
    var ta = ref.current;
    if (!ta) return;
    var start = ta.selectionStart, end = ta.selectionEnd;
    var sel = val.substring(start, end) || 'text';
    var newVal = val.substring(0, start) + before + sel + (after || '') + val.substring(end);
    onChange(newVal);
    setTimeout(function() { ta.focus(); ta.setSelectionRange(start + before.length, start + before.length + sel.length); }, 10);
  }
  
  var toolbarStyle = { display: 'flex', flexWrap: 'wrap', gap: '2px', padding: '6px', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderBottom: 'none', borderRadius: '6px 6px 0 0' };
  var btnStyle = { padding: '6px 8px', fontSize: '12px', border: '1px solid #e5e7eb', backgroundColor: '#fff', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '28px', color: '#374151' };
  
  var btns = [
    { icon: 'bold', fn: function() { insert('**', '**'); } },
    { icon: 'italic', fn: function() { insert('*', '*'); } },
    { icon: 'highlight', fn: function() { insert('==', '=='); } },
    { icon: 'type', label: 'H1', fn: function() { insert('# '); } },
    { icon: 'type', label: 'H2', fn: function() { insert('## '); } },
    { icon: 'type', label: 'H3', fn: function() { insert('### '); } },
    { icon: 'table', fn: function() { insert('\n| Col 1 | Col 2 | Col 3 |\n| --- | --- | --- |\n| | | |\n'); } },
    { icon: 'link', fn: function() { var u = prompt('Link URL:'); if (u) insert('[', '](' + u + ')'); } },
    { icon: 'list', fn: function() { insert('- '); } },
    { icon: 'code', fn: function() { insert('`', '`'); } }
  ];
  
  return React.createElement('div', { style: toolbarStyle },
    btns.map(function(b, i) {
      return React.createElement('button', { key: i, type: 'button', style: btnStyle, onClick: b.fn, title: b.label || b.icon },
        b.label || Icon(b.icon)
      );
    })
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

function PolicyManager(props) {
  var data = props.data || {};
  var updateData = props.updateData;
  var runQuery = props.runQuery;
  var setVariable = props.setVariable;

  // =============================================================================
  // SEGMENT CONFIGURATION - From data binding or defaults
  // =============================================================================
  
  var segment = useMemo(function() {
    var s = data.segment || {};
    return {
      name: s.name || DEFAULT_SEGMENT.name,
      tableName: s.tableName || DEFAULT_SEGMENT.tableName,
      subtopicsTable: s.subtopicsTable || DEFAULT_SEGMENT.subtopicsTable,
      parentIdField: s.parentIdField || DEFAULT_SEGMENT.parentIdField,
      childIdField: s.childIdField || DEFAULT_SEGMENT.childIdField,
      parentRefField: s.parentRefField || DEFAULT_SEGMENT.parentRefField,
      color: s.color || DEFAULT_SEGMENT.color
    };
  }, [data.segment]);
  
  var instanceId = data.instanceId || 'policy_default';
  var refreshQueries = data.refreshQueries || [];
  
  var PARENT_ID = segment.parentIdField;
  var CHILD_ID = segment.childIdField;
  var PARENT_REF = segment.parentRefField;

  // =============================================================================
  // THEME (Dynamic based on segment color)
  // =============================================================================
  
  var C = useMemo(function() {
    return {
      primary: segment.color,
      primaryLight: segment.color + '15',
      primaryDark: segment.color,
      bg: '#ffffff',
      bgAlt: '#f9fafb',
      bgHover: '#f3f4f6',
      border: '#e5e7eb',
      text: '#374151',
      textDark: '#111827',
      textMuted: '#6b7280',
      danger: '#dc2626',
      dangerLight: '#fee2e2',
      dangerBorder: '#fecaca',
      smid: '#3b82f6',
      smidLight: '#eff6ff',
      lcn: '#8b5cf6',
      lcnLight: '#f5f3ff'
    };
  }, [segment.color]);

  // =============================================================================
  // LOADING STATE
  // =============================================================================
  
  var isDataLoading = useMemo(function() {
    var explicitLoading = data.travelerTypeLoading === true;
    var parentLoading = isQueryLoading(data.parentTopics);
    var childLoading = isQueryLoading(data.childTopics);
    var componentLoading = data.isLoading === true;
    return explicitLoading || parentLoading || childLoading || componentLoading;
  }, [data.travelerTypeLoading, data.parentTopics, data.childTopics, data.isLoading]);

  // =============================================================================
  // OPERATION TRACKING
  // =============================================================================
  
  var operationInProgress = useRef(false);
  var mountedRef = useRef(true);
  
  var internalLoadingState = useState(false);
  var internalLoading = internalLoadingState[0];
  var setInternalLoading = internalLoadingState[1];
  
  var showLoading = isDataLoading || internalLoading;
  
  useEffect(function() {
    mountedRef.current = true;
    return function() {
      mountedRef.current = false;
    };
  }, [segment.name, instanceId]);

  // =============================================================================
  // STATE
  // =============================================================================
  
  var refreshState = useState(0);
  var refreshCount = refreshState[0], setRefresh = refreshState[1];
  
  var selState = useState(null), sel = selState[0], setSel = selState[1];
  var typeState = useState(null), type = typeState[0], setType = typeState[1];
  var expState = useState({}), exp = expState[0], setExp = expState[1];
  var editState = useState(false), isEdit = editState[0], setEdit = editState[1];
  var editDataState = useState({ topic: '', detail: '' }), edit = editDataState[0], setEditData = editDataState[1];
  var addState = useState(false), adding = addState[0], setAdding = addState[1];
  var childState = useState(null), childParent = childState[0], setChildParent = childState[1];
  var nameState = useState(''), name = nameState[0], setName = nameState[1];
  var detailState = useState(''), detail = detailState[0], setDetail = detailState[1];
  var hoverState = useState(null), hover = hoverState[0], setHover = hoverState[1];
  var searchState = useState(''), searchQuery = searchState[0], setSearch = searchState[1];
  
  var typesState = useState([]), selTypes = typesState[0], setSelTypes = typesState[1];
  var smidState = useState([]), selSmids = smidState[0], setSelSmids = smidState[1];
  var lcnState = useState([]), selLcns = lcnState[0], setSelLcns = lcnState[1];
  
  var editRef = useRef(null), newRef = useRef(null);
  var lastRefreshRef = useRef(data._refresh);
  
  // =============================================================================
  // FIX 3: IMPROVED DATA EXTRACTION WITH MEMOIZATION
  // =============================================================================
  
  // Watch for external refresh trigger
  useEffect(function() {
    if (lastRefreshRef.current !== data._refresh) {
      clearSelection();
      setSearch('');
      setExp({});
      setRefresh(function(c) { return c + 1; });
      lastRefreshRef.current = data._refresh;
    }
  }, [data._refresh, segment.name]);
  
  // Debug logging for data flow
  useEffect(function() {
    var parentCount = extractQueryData(data.parentTopics).length;
    var childCount = extractQueryData(data.childTopics).length;
  }, [data.parentTopics, data.childTopics, data._refresh, refreshCount, segment.name]);
  
  // MEMOIZED data extraction - re-runs when data OR refresh changes
  var parentTopics = useMemo(function() {
    var extracted = extractQueryData(data.parentTopics);
    return processTopics(extracted);
  }, [data.parentTopics, data._refresh, refreshCount, segment.name]);
  
  var childTopics = useMemo(function() {
    var extracted = extractQueryData(data.childTopics);
    // Log first child for debugging
    if (extracted.length > 0) {
    }
    // Force new array reference by spreading
    var processed = processTopics(extracted);
    return processed.map(function(t) { return Object.assign({}, t); });
  }, [data.childTopics, data._refresh, refreshCount, segment.name]);
  
  // Track child data changes separately and update selected if needed
  var childDataRef = useRef(null);
  useEffect(function() {
    var childDataStr = JSON.stringify(childTopics.map(function(c) { return { id: c[CHILD_ID], topic: c.topic, detail: c.detail?.substring(0, 50) }; }));
    if (childDataRef.current !== null && childDataRef.current !== childDataStr) {
      
      // If a child is currently selected, update it with fresh data
      if (sel && type === 'child' && sel[CHILD_ID]) {
        var freshChild = childTopics.find(function(c) { return c[CHILD_ID] === sel[CHILD_ID]; });
        if (freshChild && JSON.stringify(freshChild) !== JSON.stringify(sel)) {
          setSel(freshChild);
        }
      }
      
      forceRefresh();
    }
    childDataRef.current = childDataStr;
  }, [childTopics, CHILD_ID, segment.name, sel, type]);
  
  // Also update selected parent if it changed
  useEffect(function() {
    if (sel && type === 'parent' && sel[PARENT_ID]) {
      var freshParent = parentTopics.find(function(p) { return p[PARENT_ID] === sel[PARENT_ID]; });
      if (freshParent && JSON.stringify(freshParent) !== JSON.stringify(sel)) {
        setSel(freshParent);
      }
    }
  }, [parentTopics, PARENT_ID, segment.name, sel, type]);

  // =============================================================================
  // UNIFIED ACTION DISPATCHER
  // =============================================================================
  
  function triggerDispatcher(queryName) {
    var fn = runQuery || props.runJsQuery || (props.actions && props.actions.runQuery);
    if (typeof fn === 'function') {
      try { fn(queryName); } catch (e) { console.error('[' + segment.name + '] Dispatcher error:', e); }
    } else {
      console.warn('[' + segment.name + '] No runQuery prop found');
    }
  }
  
  function executeAction(action, actionData) {
    if (operationInProgress.current) {
      alert('Please wait - another operation is in progress');
      return;
    }
    
    operationInProgress.current = true;
    setInternalLoading(true);
    
    var opId = generateOpId();
    
    // Build payload with segment info AND refreshQueries for the handler
    var payload = {
      action: action,
      segment: segment,
      instanceId: instanceId,
      refreshQueries: refreshQueries,  // Include refresh queries from data binding
      data: actionData,
      ts: Date.now(),
      opId: opId
    };
    
    
    // Set data for the handler to read
    if (updateData) {
      updateData({
        pendingAction: action,
        actionData: actionData,
        actionPayload: payload,
        selectedTopic: actionData,
        newTopic: actionData,
        isLoading: true
      });
    }
    
    // FIX v10.4: Use runQuery to call a helper that sets the page variable
    // since setVariable is not available in custom components
    var queryFn = runQuery || props.runJsQuery;
    if (queryFn) {
      try {
        queryFn('set_policy_payload', { payload: payload });
      } catch (e) {
        console.warn('[' + segment.name + '] [' + opId + '] set_policy_payload failed:', e.message);
      }
    } else {
      console.warn('[' + segment.name + '] [' + opId + '] No runQuery available!');
    }
    
    // Trigger the unified handler after variable propagates
    // Increased to 600ms to ensure set_policy_payload completes first
    setTimeout(function() {
      if (!mountedRef.current) {
        operationInProgress.current = false;
        setInternalLoading(false);
        return;
      }
      
      triggerDispatcher('handle_policy_action');
      
      // Extended cleanup timeout for ToolJet propagation
      setTimeout(function() {
        if (!mountedRef.current) return;
        
        operationInProgress.current = false;
        setInternalLoading(false);
        
        if (updateData) {
          updateData({
            pendingAction: null,
            actionData: null,
            actionPayload: null,
            selectedTopic: null,
            newTopic: null,
            isLoading: false,
            _cacheKey: Date.now()
          });
        }
        
        clearSelection();
        
        // Multiple refresh triggers
        forceRefresh();
        setTimeout(function() {
          if (mountedRef.current) forceRefresh();
        }, 300);
        setTimeout(function() {
          if (mountedRef.current) forceRefresh();
        }, 600);
        
      }, 2500);
      
    }, 600);  // Increased to 600ms for set_policy_payload to complete
  }
  
  // Permission check
  var EDITOR_GROUPS = ['admin', 'builder', 'Content_Editor'];
  var userGroups = useMemo(function() {
    var groups = data.userGroups;
    if (Array.isArray(groups)) return groups;
    if (typeof groups === 'string') return [groups];
    return [];
  }, [data.userGroups]);
  var canEdit = useMemo(function() {
    return userGroups.some(function(g) { return EDITOR_GROUPS.indexOf(g) >= 0; });
  }, [userGroups]);
  var currentUser = data.currentUser || 'User';
  
  // Options
  var availableTypes = useMemo(function() {
    var types = Array.isArray(data.travelerTypes) ? data.travelerTypes : [];
    return types.map(function(t) { return { id: String(t.id), title: t.title || t.name || ('Type ' + t.id) }; });
  }, [data.travelerTypes]);
  
  var typeMap = useMemo(function() {
    var m = {};
    availableTypes.forEach(function(t) { m[t.id] = t.title; });
    return m;
  }, [availableTypes]);
  
  var availableSmids = useMemo(function() {
    var smids = Array.isArray(data.smidOptions) ? data.smidOptions : [];
    return smids.map(function(s) { return { id: String(s.smid), title: s.title || s.smid, country: s.country_a2 || '' }; });
  }, [data.smidOptions]);
  
  var smidMap = useMemo(function() {
    var m = {};
    availableSmids.forEach(function(s) { m[s.id] = s.title; });
    return m;
  }, [availableSmids]);
  
  var availableLcns = useMemo(function() {
    var lcns = Array.isArray(data.lcnOptions) ? data.lcnOptions : [];
    return lcns.map(function(l) {
      var lcnId = l.lcn_number !== undefined ? String(l.lcn_number) : (l.lcn_name || '');
      return { id: lcnId, title: l.lcn_name || lcnId, smid: l.smid || '' };
    });
  }, [data.lcnOptions]);
  
  var lcnMap = useMemo(function() {
    var m = {};
    availableLcns.forEach(function(l) { m[l.id] = l.title; });
    return m;
  }, [availableLcns]);
  
  function getTitleById(id) { return typeMap[String(id)] || ('Type ' + id); }
  function getSmidTitle(id) { return smidMap[String(id)] || id; }
  function getLcnTitle(id) { return lcnMap[String(id)] || id; }
  
  function getTravelerTypeIds(topic) { return parsePgArray(topic.traveler_type_id); }
  function getSmidIds(topic) { return parsePgArray(topic.smid); }
  function getLcnIds(topic) { return parsePgArray(topic.lcn); }
  
  // Create a data version that changes whenever child content actually changes
  var childDataVersion = useMemo(function() {
    var hash = childTopics.reduce(function(acc, c) {
      return acc + (c[CHILD_ID] || '') + ':' + (c.topic || '').length + ':' + (c.detail || '').length + '|';
    }, '');
    return hash.length + '-' + refreshCount;
  }, [childTopics, CHILD_ID, refreshCount]);
  
  var byParent = useMemo(function() {
    var g = {};
    childTopics.forEach(function(c) {
      var k = c[PARENT_REF] || c.root_topic_id;
      if (!g[k]) g[k] = [];
      // Create new object reference for each child
      g[k].push(Object.assign({}, c));
    });
    return g;
  }, [childTopics, PARENT_REF, childDataVersion, segment.name]);
  
  function matchesSearch(topic) {
    if (!searchQuery.trim()) return true;
    var q = searchQuery.toLowerCase();
    return (topic.topic || '').toLowerCase().indexOf(q) !== -1 || (topic.detail || '').toLowerCase().indexOf(q) !== -1;
  }
  
  var filteredParents = useMemo(function() {
    if (!searchQuery.trim()) return parentTopics;
    return parentTopics.filter(function(p) {
      var pk = p[PARENT_ID] || p.id;
      return matchesSearch(p) || (byParent[pk] || []).some(matchesSearch);
    });
  }, [parentTopics, searchQuery, byParent, PARENT_ID, refreshCount]);
  
  function forceRefresh() { setRefresh(function(c) { return c + 1; }); }
  
  function clearSelection() {
    setSel(null);
    setType(null);
    setEdit(false);
    setSelTypes([]);
    setSelSmids([]);
    setSelLcns([]);
  }
  
  function getChildren(p) { return byParent[p[PARENT_ID]] || byParent[p.id] || []; }
  function toggle(id) { setExp(function(e) { var n = Object.assign({}, e); n[id] = !n[id]; return n; }); }
  function select(t, tp) { setSel(t); setType(tp); setEdit(false); if (updateData) updateData({ selectedTopic: t, selectedType: tp }); }
  
  function toggleType(id) { setSelTypes(function(p) { return p.indexOf(id) >= 0 ? p.filter(function(x) { return x !== id; }) : p.concat([id]); }); }
  function toggleSmid(id) { setSelSmids(function(p) { return p.indexOf(id) >= 0 ? p.filter(function(x) { return x !== id; }) : p.concat([id]); }); }
  function toggleLcn(id) { setSelLcns(function(p) { return p.indexOf(id) >= 0 ? p.filter(function(x) { return x !== id; }) : p.concat([id]); }); }
  
  function selectAllTypes() { setSelTypes(availableTypes.map(function(t) { return t.id; })); }
  function selectAllSmids() { setSelSmids(availableSmids.map(function(s) { return s.id; })); }
  function selectAllLcns() { setSelLcns(availableLcns.map(function(l) { return l.id; })); }
  function clearAllTypes() { setSelTypes([]); }
  function clearAllSmids() { setSelSmids([]); }
  function clearAllLcns() { setSelLcns([]); }
  
  function preselectCurrentSmidLcn() {
    if (data.selectedSmid) setSelSmids([String(data.selectedSmid)]);
    if (data.selectedLcn && data.selectedLcn !== 'EMPTY') setSelLcns([String(data.selectedLcn)]);
  }
  
  function startEdit() {
    setEditData({ topic: sel.topic, detail: sel.detail || '' });
    setSelTypes(getTravelerTypeIds(sel).map(String));
    setSelSmids(getSmidIds(sel).map(String));
    setSelLcns(getLcnIds(sel).map(String));
    setEdit(true);
  }
  
  // =============================================================================
  // CRUD OPERATIONS
  // =============================================================================
  
  function saveEdit() {
    var typeIds = selTypes.filter(Boolean);
    var typeTitles = typeIds.map(getTitleById);
    var smidIds = selSmids.filter(Boolean);
    var lcnIds = selLcns.filter(Boolean);
    
    var updatedTopic = Object.assign({}, sel, edit, {
      last_updated: new Date().toISOString(),
      updated_by: currentUser,
      traveler_type_id: '{' + typeIds.join(',') + '}',
      traveler_type: '{' + typeTitles.join(',') + '}',
      smid: '{' + smidIds.join(',') + '}',
      lcn: '{' + lcnIds.join(',') + '}'
    });
    
    setEdit(false);
    executeAction(type === 'parent' ? 'updateParent' : 'updateChild', updatedTopic);
  }
  
  function deleteTopic() {
    if (!sel || !confirm('Delete "' + (sel.topic || 'this topic') + '"?')) return;
    executeAction(type === 'parent' ? 'deleteParent' : 'deleteChild', sel);
  }
  
  function addParent() {
    var validation = validateTopicName(name);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }
    
    var typeIds = selTypes.filter(Boolean);
    var typeTitles = typeIds.map(getTitleById);
    var smidIds = selSmids.filter(Boolean);
    var lcnIds = selLcns.filter(Boolean);
    
    var newTopic = {
      topic: sanitizeInput(name),
      detail: sanitizeInput(detail),
      traveler_type_id: '{' + typeIds.join(',') + '}',
      traveler_type: '{' + typeTitles.join(',') + '}',
      smid: '{' + smidIds.join(',') + '}',
      lcn: '{' + lcnIds.join(',') + '}'
    };
    
    setAdding(false);
    setName('');
    setDetail('');
    setSelTypes([]);
    setSelSmids([]);
    setSelLcns([]);
    
    executeAction('addParent', newTopic);
  }
  
  function addChildTopic(parent) {
    var validation = validateTopicName(name);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }
    
    var typeIds = selTypes.filter(Boolean);
    var typeTitles = typeIds.map(getTitleById);
    var smidIds = selSmids.filter(Boolean);
    var lcnIds = selLcns.filter(Boolean);
    
    var newTopic = {
      topic: sanitizeInput(name),
      detail: sanitizeInput(detail),
      root_topic_id: parent.id,
      root_topic_name: parent.topic,
      traveler_type_id: '{' + typeIds.join(',') + '}',
      traveler_type: '{' + typeTitles.join(',') + '}',
      smid: '{' + smidIds.join(',') + '}',
      lcn: '{' + lcnIds.join(',') + '}'
    };
    newTopic[PARENT_REF] = parent[PARENT_ID];
    
    setChildParent(null);
    setName('');
    setDetail('');
    setSelTypes([]);
    setSelSmids([]);
    setSelLcns([]);
    setExp(function(e) { var n = Object.assign({}, e); n[parent[PARENT_ID] || parent.id] = true; return n; });
    
    executeAction('addChild', newTopic);
  }
  
  // =============================================================================
  // STYLES
  // =============================================================================
  
  var S = {
    wrapper: { width: '100%', height: '100%', minHeight: '400px', display: 'flex', flexDirection: 'column', position: 'relative' },
    container: { display: 'flex', flex: 1, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif', fontSize: '13px', color: C.text, backgroundColor: C.bg, border: '1px solid ' + C.border, borderRadius: '8px', overflow: 'hidden' },
    sidebar: { width: '280px', minWidth: '280px', borderRight: '1px solid ' + C.border, display: 'flex', flexDirection: 'column', backgroundColor: C.bgAlt },
    header: { padding: '12px 16px', borderBottom: '1px solid ' + C.border, display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.bg },
    title: { fontSize: '14px', fontWeight: '600', color: C.textDark, margin: 0 },
    search: { padding: '8px 12px', borderBottom: '1px solid ' + C.border, backgroundColor: C.bg },
    searchInput: { width: '100%', padding: '7px 10px 7px 32px', fontSize: '13px', border: '1px solid ' + C.border, borderRadius: '6px', outline: 'none', boxSizing: 'border-box', backgroundColor: C.bgAlt },
    searchWrap: { position: 'relative' },
    searchIcon: { position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: C.textMuted, pointerEvents: 'none' },
    tree: { flex: 1, overflow: 'auto', padding: '8px 0' },
    main: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
    contentHeader: { padding: '14px 20px', borderBottom: '1px solid ' + C.border, display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.bg },
    contentBody: { flex: 1, padding: '20px', overflow: 'auto' },
    empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: C.textMuted, textAlign: 'center', padding: '40px' },
    btn: { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', fontSize: '12px', fontWeight: '500', border: 'none', borderRadius: '6px', cursor: 'pointer' },
    btnPrimary: { backgroundColor: C.primary, color: '#fff' },
    btnSecondary: { backgroundColor: C.bgHover, color: C.text, border: '1px solid ' + C.border },
    btnDanger: { backgroundColor: C.dangerLight, color: C.danger, border: '1px solid ' + C.dangerBorder },
    input: { width: '100%', padding: '9px 12px', fontSize: '13px', border: '1px solid ' + C.border, borderRadius: '6px', outline: 'none', boxSizing: 'border-box' },
    textarea: { width: '100%', minHeight: '100px', padding: '10px 12px', fontSize: '13px', border: '1px solid ' + C.border, borderRadius: '0 0 6px 6px', borderTop: 'none', resize: 'vertical', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', lineHeight: '1.5' },
    badge: { display: 'inline-block', padding: '3px 10px', fontSize: '11px', fontWeight: '600', backgroundColor: C.primaryLight, color: C.primaryDark, borderRadius: '12px', marginLeft: '10px' },
    label: { fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', color: C.textMuted, marginBottom: '8px', display: 'block' },
    iconBtn: { width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', borderRadius: '4px', cursor: 'pointer', color: C.textMuted },
    revision: { display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 16px', backgroundColor: C.primaryLight, borderRadius: '8px', marginTop: '20px' },
    highlight: { backgroundColor: C.primary, color: '#fff', padding: '1px 2px', borderRadius: '2px' },
    noResults: { padding: '20px', textAlign: 'center', color: C.textMuted, fontSize: '13px' },
    tag: { display: 'inline-flex', alignItems: 'center', padding: '3px 8px', fontSize: '11px', fontWeight: '500', backgroundColor: C.bgAlt, color: C.text, borderRadius: '4px', marginRight: '6px', marginBottom: '6px', border: '1px solid ' + C.border },
    tagSmid: { backgroundColor: C.smidLight, color: C.smid, borderColor: C.smid + '40' },
    tagLcn: { backgroundColor: C.lcnLight, color: C.lcn, borderColor: C.lcn + '40' },
    tagContainer: { display: 'flex', flexWrap: 'wrap', marginTop: '8px' },
    tagCheckbox: { display: 'flex', alignItems: 'center', padding: '6px 10px', fontSize: '12px', backgroundColor: C.bg, border: '1px solid ' + C.border, borderRadius: '6px', marginRight: '8px', marginBottom: '8px', cursor: 'pointer' },
    tagCheckboxSelected: { backgroundColor: C.primaryLight, borderColor: C.primary },
    tagCheckboxSmid: { backgroundColor: C.smidLight, borderColor: C.smid },
    tagCheckboxLcn: { backgroundColor: C.lcnLight, borderColor: C.lcn },
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
    modal: { backgroundColor: C.bg, borderRadius: '12px', width: '90%', maxWidth: '700px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' },
    modalHeader: { padding: '16px 20px', borderBottom: '1px solid ' + C.border, display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    modalTitle: { fontSize: '16px', fontWeight: '600', color: C.textDark, margin: 0 },
    modalBody: { padding: '20px', overflowY: 'auto', flex: 1 },
    modalFooter: { padding: '16px 20px', borderTop: '1px solid ' + C.border, display: 'flex', justifyContent: 'flex-end', gap: '8px' },
    closeBtn: { width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', borderRadius: '6px', cursor: 'pointer', color: C.textMuted },
    selectorSection: { marginTop: '16px', marginBottom: '16px', padding: '12px', backgroundColor: C.bgAlt, borderRadius: '8px', border: '1px solid ' + C.border },
    selectorHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' },
    selectAllBtn: { fontSize: '11px', color: C.primary, cursor: 'pointer', textDecoration: 'underline', background: 'none', border: 'none', padding: 0 }
  };
  
  // =============================================================================
  // TAG/SELECTOR COMPONENTS
  // =============================================================================
  
  function TravelerTypeTags(topic) {
    var ids = getTravelerTypeIds(topic);
    if (!ids.length) return null;
    return React.createElement('div', { style: S.tagContainer },
      ids.map(function(id, i) { return React.createElement('span', { key: i, style: S.tag }, getTitleById(id)); })
    );
  }
  
  function SmidTags(topic) {
    var ids = getSmidIds(topic);
    if (!ids.length) return null;
    return React.createElement('div', { style: S.tagContainer },
      ids.map(function(id, i) { return React.createElement('span', { key: i, style: Object.assign({}, S.tag, S.tagSmid) }, getSmidTitle(id)); })
    );
  }
  
  function LcnTags(topic) {
    var ids = getLcnIds(topic);
    if (!ids.length) return null;
    return React.createElement('div', { style: S.tagContainer },
      ids.map(function(id, i) { return React.createElement('span', { key: i, style: Object.assign({}, S.tag, S.tagLcn) }, getLcnTitle(id)); })
    );
  }
  
  function TravelerTypeSelector() {
    if (!availableTypes.length) return null;
    return React.createElement('div', { style: S.selectorSection },
      React.createElement('div', { style: S.selectorHeader },
        React.createElement('label', { style: Object.assign({}, S.label, { marginBottom: 0 }) }, 'Traveler Types'),
        React.createElement('div', null,
          React.createElement('button', { type: 'button', style: S.selectAllBtn, onClick: selectAllTypes }, 'Select All'),
          React.createElement('span', { style: { margin: '0 6px', color: C.textMuted } }, '|'),
          React.createElement('button', { type: 'button', style: S.selectAllBtn, onClick: clearAllTypes }, 'Clear')
        )
      ),
      React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap' } },
        availableTypes.map(function(t) {
          var isSel = selTypes.indexOf(t.id) >= 0;
          return React.createElement('div', {
            key: t.id,
            style: Object.assign({}, S.tagCheckbox, isSel ? S.tagCheckboxSelected : {}),
            onClick: function() { toggleType(t.id); }
          },
            React.createElement('span', { style: { width: '14px', height: '14px', borderRadius: '3px', marginRight: '6px', border: '2px solid ' + (isSel ? C.primary : C.border), backgroundColor: isSel ? C.primary : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' } },
              isSel ? React.createElement('span', { style: { color: '#fff', fontSize: '10px' } }, '✓') : null
            ),
            t.title
          );
        })
      )
    );
  }
  
  function SmidSelector() {
    if (!availableSmids.length) return null;
    return React.createElement('div', { style: S.selectorSection },
      React.createElement('div', { style: S.selectorHeader },
        React.createElement('label', { style: Object.assign({}, S.label, { marginBottom: 0, color: C.smid }) }, 'SMID'),
        React.createElement('div', null,
          React.createElement('button', { type: 'button', style: Object.assign({}, S.selectAllBtn, { color: C.smid }), onClick: selectAllSmids }, 'Select All'),
          React.createElement('span', { style: { margin: '0 6px', color: C.textMuted } }, '|'),
          React.createElement('button', { type: 'button', style: Object.assign({}, S.selectAllBtn, { color: C.smid }), onClick: clearAllSmids }, 'Clear')
        )
      ),
      React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', maxHeight: '150px', overflowY: 'auto' } },
        availableSmids.map(function(s) {
          var isSel = selSmids.indexOf(s.id) >= 0;
          return React.createElement('div', {
            key: s.id,
            style: Object.assign({}, S.tagCheckbox, isSel ? S.tagCheckboxSmid : {}),
            onClick: function() { toggleSmid(s.id); }
          },
            React.createElement('span', { style: { width: '14px', height: '14px', borderRadius: '3px', marginRight: '6px', border: '2px solid ' + (isSel ? C.smid : C.border), backgroundColor: isSel ? C.smid : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' } },
              isSel ? React.createElement('span', { style: { color: '#fff', fontSize: '10px' } }, '✓') : null
            ),
            s.title,
            s.country ? React.createElement('span', { style: { marginLeft: '4px', fontSize: '10px', color: C.textMuted } }, '(' + s.country + ')') : null
          );
        })
      )
    );
  }
  
  function LcnSelector() {
    if (!availableLcns.length) return null;
    return React.createElement('div', { style: S.selectorSection },
      React.createElement('div', { style: S.selectorHeader },
        React.createElement('label', { style: Object.assign({}, S.label, { marginBottom: 0, color: C.lcn }) }, 'LCN'),
        React.createElement('div', null,
          React.createElement('button', { type: 'button', style: Object.assign({}, S.selectAllBtn, { color: C.lcn }), onClick: selectAllLcns }, 'Select All'),
          React.createElement('span', { style: { margin: '0 6px', color: C.textMuted } }, '|'),
          React.createElement('button', { type: 'button', style: Object.assign({}, S.selectAllBtn, { color: C.lcn }), onClick: clearAllLcns }, 'Clear')
        )
      ),
      React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', maxHeight: '150px', overflowY: 'auto' } },
        availableLcns.map(function(l) {
          var isSel = selLcns.indexOf(l.id) >= 0;
          return React.createElement('div', {
            key: l.id,
            style: Object.assign({}, S.tagCheckbox, isSel ? S.tagCheckboxLcn : {}),
            onClick: function() { toggleLcn(l.id); }
          },
            React.createElement('span', { style: { width: '14px', height: '14px', borderRadius: '3px', marginRight: '6px', border: '2px solid ' + (isSel ? C.lcn : C.border), backgroundColor: isSel ? C.lcn : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' } },
              isSel ? React.createElement('span', { style: { color: '#fff', fontSize: '10px' } }, '✓') : null
            ),
            l.title
          );
        })
      )
    );
  }
  
  function highlightText(text, query) {
    if (!query || !text) return text;
    var q = query.trim().toLowerCase();
    var idx = text.toLowerCase().indexOf(q);
    if (idx === -1) return text;
    return React.createElement('span', null,
      text.substring(0, idx),
      React.createElement('span', { style: S.highlight }, text.substring(idx, idx + q.length)),
      text.substring(idx + q.length)
    );
  }
  
  // =============================================================================
  // BUILD TREE
  // =============================================================================
  
  var tree = filteredParents.map(function(p) {
    var pk = p[PARENT_ID] || p.id;
    var ch = getChildren(p);
    var filteredCh = searchQuery.trim() ? ch.filter(matchesSearch) : ch;
    var isExp = exp[pk] || (searchQuery.trim() && filteredCh.length > 0);
    var isSel = sel && sel[PARENT_ID] === p[PARENT_ID] && type === 'parent';
    var isHov = hover === 'p-' + pk;
    
    var children = isExp ? filteredCh.map(function(c, idx) {
      var ck = c[CHILD_ID] || c.id;
      var cSel = sel && sel[CHILD_ID] === c[CHILD_ID] && type === 'child';
      var cHov = hover === 'c-' + ck;
      // Use a key that includes data hash to force re-render when content changes
      var childKey = ck + '-' + refreshCount + '-' + (c.topic || '').length + '-' + (c.detail || '').length;
      return React.createElement('div', {
        key: childKey,
        style: { display: 'flex', alignItems: 'center', padding: '8px 12px 8px 44px', cursor: 'pointer', borderLeft: '3px solid ' + (cSel ? C.primary : 'transparent'), backgroundColor: cSel ? C.primaryLight : (cHov ? C.bgHover : 'transparent') },
        onClick: function() { select(c, 'child'); },
        onMouseEnter: function() { setHover('c-' + ck); },
        onMouseLeave: function() { setHover(null); }
      },
        React.createElement('span', { style: { marginRight: '8px', color: C.textMuted } }, Icon('file')),
        React.createElement('span', { style: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, highlightText(c.topic, searchQuery))
      );
    }) : [];
    
    return React.createElement('div', { key: pk },
      React.createElement('div', {
        style: { display: 'flex', alignItems: 'center', padding: '8px 12px', cursor: 'pointer', borderLeft: '3px solid ' + (isSel ? C.primary : 'transparent'), backgroundColor: isSel ? C.primaryLight : (isHov ? C.bgHover : 'transparent') },
        onClick: function() { select(p, 'parent'); },
        onMouseEnter: function() { setHover('p-' + pk); },
        onMouseLeave: function() { setHover(null); }
      },
        React.createElement('span', { style: { width: '20px', cursor: ch.length ? 'pointer' : 'default', color: C.textMuted }, onClick: function(e) { e.stopPropagation(); if (ch.length) toggle(pk); } }, ch.length ? Icon(isExp ? 'chevronDown' : 'chevronRight') : null),
        React.createElement('span', { style: { marginRight: '8px', color: C.primary } }, Icon('folder')),
        React.createElement('span', { style: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: isSel ? '500' : '400' } }, highlightText(p.topic, searchQuery)),
        canEdit && isHov ? React.createElement('button', { style: S.iconBtn, onClick: function(e) { e.stopPropagation(); setChildParent(p); preselectCurrentSmidLcn(); setExp(function(pr) { var n = Object.assign({}, pr); n[pk] = true; return n; }); }, title: 'Add subtopic' }, Icon('filePlus', C.primary)) : null
      ),
      children
    );
  });
  
  var noResults = searchQuery.trim() && filteredParents.length === 0 ? React.createElement('div', { style: S.noResults }, 'No topics match "', searchQuery, '"') : null;
  
  // =============================================================================
  // MODALS
  // =============================================================================
  
  var addModal = adding ? React.createElement('div', { style: S.modalOverlay, onClick: function(e) { if (e.target === e.currentTarget) { setAdding(false); setName(''); setDetail(''); setSelTypes([]); setSelSmids([]); setSelLcns([]); } } },
    React.createElement('div', { style: S.modal },
      React.createElement('div', { style: S.modalHeader },
        React.createElement('h3', { style: S.modalTitle }, 'Add New Topic'),
        React.createElement('button', { style: S.closeBtn, onClick: function() { setAdding(false); setName(''); setDetail(''); setSelTypes([]); setSelSmids([]); setSelLcns([]); } }, Icon('x'))
      ),
      React.createElement('div', { style: S.modalBody },
        React.createElement('div', { style: { marginBottom: '16px' } },
          React.createElement('label', { style: S.label }, 'Topic Name'),
          React.createElement('input', { type: 'text', placeholder: 'Enter topic name', value: name, onChange: function(e) { setName(e.target.value); }, style: S.input })
        ),
        React.createElement('div', { style: { marginBottom: '16px' } },
          React.createElement('label', { style: S.label }, 'Detail'),
          React.createElement(Toolbar, { textareaRef: newRef, value: detail, onChange: setDetail }),
          React.createElement('textarea', { ref: newRef, placeholder: 'Enter detail (markdown supported)', value: detail, onChange: function(e) { setDetail(e.target.value); }, style: Object.assign({}, S.textarea, { minHeight: '120px' }) })
        ),
        TravelerTypeSelector(),
        SmidSelector(),
        LcnSelector()
      ),
      React.createElement('div', { style: S.modalFooter },
        React.createElement('button', { style: Object.assign({}, S.btn, S.btnSecondary), onClick: function() { setAdding(false); setName(''); setDetail(''); setSelTypes([]); setSelSmids([]); setSelLcns([]); } }, 'Cancel'),
        React.createElement('button', { style: Object.assign({}, S.btn, S.btnPrimary), onClick: addParent }, Icon('check'), ' Save Topic')
      )
    )
  ) : null;
  
  var addChildModal = childParent ? React.createElement('div', { style: S.modalOverlay, onClick: function(e) { if (e.target === e.currentTarget) { setChildParent(null); setName(''); setDetail(''); setSelTypes([]); setSelSmids([]); setSelLcns([]); } } },
    React.createElement('div', { style: S.modal },
      React.createElement('div', { style: S.modalHeader },
        React.createElement('h3', { style: S.modalTitle }, 'Add Subtopic'),
        React.createElement('button', { style: S.closeBtn, onClick: function() { setChildParent(null); setName(''); setDetail(''); setSelTypes([]); setSelSmids([]); setSelLcns([]); } }, Icon('x'))
      ),
      React.createElement('div', { style: S.modalBody },
        React.createElement('div', { style: { marginBottom: '16px', padding: '10px 12px', backgroundColor: C.primaryLight, borderRadius: '6px', fontSize: '13px' } },
          React.createElement('span', { style: { color: C.textMuted } }, 'Parent Topic: '),
          React.createElement('strong', { style: { color: C.primaryDark } }, childParent.topic)
        ),
        React.createElement('div', { style: { marginBottom: '16px' } },
          React.createElement('label', { style: S.label }, 'Subtopic Name'),
          React.createElement('input', { type: 'text', placeholder: 'Enter subtopic name', value: name, onChange: function(e) { setName(e.target.value); }, style: S.input })
        ),
        React.createElement('div', { style: { marginBottom: '16px' } },
          React.createElement('label', { style: S.label }, 'Detail'),
          React.createElement(Toolbar, { textareaRef: newRef, value: detail, onChange: setDetail }),
          React.createElement('textarea', { ref: newRef, placeholder: 'Enter detail (markdown supported)', value: detail, onChange: function(e) { setDetail(e.target.value); }, style: Object.assign({}, S.textarea, { minHeight: '120px' }) })
        ),
        TravelerTypeSelector(),
        SmidSelector(),
        LcnSelector()
      ),
      React.createElement('div', { style: S.modalFooter },
        React.createElement('button', { style: Object.assign({}, S.btn, S.btnSecondary), onClick: function() { setChildParent(null); setName(''); setDetail(''); setSelTypes([]); setSelSmids([]); setSelLcns([]); } }, 'Cancel'),
        React.createElement('button', { style: Object.assign({}, S.btn, S.btnPrimary), onClick: function() { addChildTopic(childParent); } }, Icon('check'), ' Save Subtopic')
      )
    )
  ) : null;
  
  // =============================================================================
  // MAIN CONTENT
  // =============================================================================
  
  var content;
  if (sel) {
    var header = React.createElement('div', { style: S.contentHeader },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center' } },
        React.createElement('span', { style: { fontSize: '16px', fontWeight: '600', color: C.textDark } }, isEdit ? 'Edit Topic' : sel.topic),
        React.createElement('span', { style: S.badge }, type === 'parent' ? 'Parent' : 'Subtopic')
      ),
      React.createElement('div', { style: { display: 'flex', gap: '8px' } },
        canEdit && !isEdit ? React.createElement('button', { style: Object.assign({}, S.btn, S.btnSecondary), onClick: startEdit }, Icon('edit'), ' Edit') : null,
        canEdit && !isEdit ? React.createElement('button', { style: Object.assign({}, S.btn, S.btnDanger), onClick: deleteTopic }, Icon('trash'), ' Delete') : null,
        isEdit ? React.createElement('button', { style: Object.assign({}, S.btn, S.btnSecondary), onClick: function() { setEdit(false); setSelTypes([]); setSelSmids([]); setSelLcns([]); } }, 'Cancel') : null,
        isEdit ? React.createElement('button', { style: Object.assign({}, S.btn, S.btnPrimary), onClick: saveEdit }, 'Save') : null
      )
    );
    
    var body = isEdit ? React.createElement('div', { style: S.contentBody },
      React.createElement('div', { style: { marginBottom: '20px' } },
        React.createElement('label', { style: S.label }, 'Topic Name'),
        React.createElement('input', { type: 'text', value: edit.topic, onChange: function(e) { setEditData(Object.assign({}, edit, { topic: e.target.value })); }, style: S.input })
      ),
      React.createElement('div', { style: { marginBottom: '20px' } },
        React.createElement('label', { style: S.label }, 'Detail'),
        React.createElement(Toolbar, { textareaRef: editRef, value: edit.detail, onChange: function(v) { setEditData(Object.assign({}, edit, { detail: v })); } }),
        React.createElement('textarea', { ref: editRef, value: edit.detail, onChange: function(e) { setEditData(Object.assign({}, edit, { detail: e.target.value })); }, style: Object.assign({}, S.textarea, { minHeight: '150px' }) })
      ),
      TravelerTypeSelector(),
      SmidSelector(),
      LcnSelector(),
      React.createElement('div', { style: { marginTop: '16px' } },
        React.createElement('label', { style: S.label }, 'Preview'),
        React.createElement('div', { style: { padding: '16px', backgroundColor: C.bgAlt, borderRadius: '8px', lineHeight: '1.6', border: '1px solid ' + C.border }, dangerouslySetInnerHTML: { __html: renderMarkdown(edit.detail) } })
      )
    ) : React.createElement('div', { style: S.contentBody },
      React.createElement('div', { style: { marginBottom: '20px' } },
        React.createElement('label', { style: S.label }, 'Detail'),
        sel.detail ? React.createElement('div', { style: { lineHeight: '1.7' }, dangerouslySetInnerHTML: { __html: renderMarkdown(sel.detail) } }) : React.createElement('p', { style: { color: C.textMuted, fontStyle: 'italic' } }, 'No detail')
      ),
      React.createElement('div', { style: S.revision },
        Icon('clock', C.primary),
        React.createElement('div', { style: { flex: 1 } },
          React.createElement('div', { style: { fontSize: '12px', color: C.textMuted } }, 'Last Updated'),
          React.createElement('div', { style: { fontSize: '13px', fontWeight: '500' } }, formatDate(sel.last_updated))
        ),
        React.createElement('div', { style: { borderLeft: '1px solid ' + C.primary + '40', paddingLeft: '16px' } },
          React.createElement('div', { style: { fontSize: '12px', color: C.textMuted } }, 'Updated By'),
          React.createElement('div', { style: { fontSize: '13px', fontWeight: '500' } }, sel.updated_by || 'Unknown')
        )
      ),
      (sel.traveler_type_id || sel.traveler_type) ? React.createElement('div', { style: { marginTop: '20px' } },
        React.createElement('label', { style: S.label }, 'Traveler Types'),
        TravelerTypeTags(sel)
      ) : null,
      sel.smid && sel.smid !== '{}' ? React.createElement('div', { style: { marginTop: '16px' } },
        React.createElement('label', { style: Object.assign({}, S.label, { color: C.smid }) }, 'SMID'),
        SmidTags(sel)
      ) : null,
      sel.lcn && sel.lcn !== '{}' ? React.createElement('div', { style: { marginTop: '16px' } },
        React.createElement('label', { style: Object.assign({}, S.label, { color: C.lcn }) }, 'LCN'),
        LcnTags(sel)
      ) : null,
      type === 'child' && sel.root_topic_name ? React.createElement('div', { style: { marginTop: '20px' } },
        React.createElement('label', { style: S.label }, 'Parent Topic'),
        React.createElement('span', { style: S.badge }, sel.root_topic_name)
      ) : null
    );
    
    content = React.createElement('div', { style: S.main }, header, body);
  } else {
    content = React.createElement('div', { style: S.main },
      React.createElement('div', { style: S.empty },
        React.createElement('span', { style: { marginBottom: '16px', opacity: 0.4 } }, Icon('folder', C.primary)),
        React.createElement('p', { style: { fontSize: '15px', margin: '0 0 6px' } }, 'Select a topic'),
        React.createElement('p', { style: { fontSize: '13px', margin: 0 } }, 'Choose from the list')
      )
    );
  }
  
  var loadingMessage = data.filterTravelerType
    ? 'Loading ' + segment.name + ' policies for ' + data.filterTravelerType + '...'
    : 'Loading ' + segment.name + ' policies...';
  
  // =============================================================================
  // RENDER
  // =============================================================================
  
  return React.createElement(React.Fragment, null,
    React.createElement('style', null, 'html,body{height:100%!important;margin:0!important;padding:0!important;overflow:hidden!important}body>div{height:100%!important}@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}'),
    React.createElement('div', { style: S.wrapper },
      React.createElement(LoadingOverlay, {
        isVisible: showLoading,
        message: loadingMessage,
        subMessage: 'Please wait while data is refreshed',
        color: segment.color
      }),
      React.createElement('div', { style: S.container },
        React.createElement('div', { style: S.sidebar },
          React.createElement('div', { style: S.header },
            React.createElement('h3', { style: S.title }, segment.name + ' Policy Topics'),
            canEdit ? React.createElement('button', { style: Object.assign({}, S.iconBtn, { backgroundColor: hover === 'add' ? C.primaryLight : 'transparent' }), onClick: function() { setAdding(true); preselectCurrentSmidLcn(); }, onMouseEnter: function() { setHover('add'); }, onMouseLeave: function() { setHover(null); }, title: 'Add topic' }, Icon('plus', C.primary)) : null
          ),
          React.createElement('div', { style: S.search },
            React.createElement('div', { style: S.searchWrap },
              React.createElement('span', { style: S.searchIcon }, Icon('search')),
              React.createElement('input', { type: 'text', placeholder: 'Search topics...', value: searchQuery, onChange: function(e) { setSearch(e.target.value); }, style: S.searchInput })
            )
          ),
          React.createElement('div', { style: S.tree }, noResults, tree)
        ),
        content
      )
    ),
    addModal,
    addChildModal
  );
}

// =============================================================================
// CONNECT & RENDER
// =============================================================================

var Connected = Tooljet.connectComponent(PolicyManager);
ReactDOM.render(React.createElement(Connected), document.body);
