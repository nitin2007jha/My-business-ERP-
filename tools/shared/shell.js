/* ============================================================
   APP SHELL — shared runtime for every standalone tool page.
   Include shell.css + shell.js, then call:

     AppShell.init({
       toolId:   'export',                 // matches an entry in AppShell.TOOLS
       title:    'Data Export',
       backTo:   '../../index.html',       // where the back-arrow goes
       navItems: [                         // this tool's OWN sections
         { id:'run',      label:'Export',  icon:AppShell.ICONS.download, onClick:()=>showRun() },
         { id:'schedule', label:'Schedule',icon:AppShell.ICONS.clock,    onClick:()=>showSchedule() },
         { id:'history',  label:'History', icon:AppShell.ICONS.history,  onClick:()=>showHistory() }
       ],
       actions: [                          // top-right icon buttons
         { icon:AppShell.ICONS.help, title:'Help', onClick:()=>alert('help') }
       ]
     });

   Page content goes inside <div id="shell-content-inner">...</div>,
   which AppShell expects to already exist in the page HTML.
   ============================================================ */
(function(){
  'use strict';

  // ---- registry of every tool in the suite (for the "More" sheet + sidebar) ----
  var TOOLS = [
    { id:'dashboard', label:'Home',        sub:'Main dashboard',        href:'../../index.html',              icon:'home',     core:true },
    { id:'records',   label:'Records',     sub:'Invoices & bills',      href:'../../index.html#records',      icon:'file',     core:true },
    { id:'inventory', label:'Inventory',   sub:'Stock & products',      href:'../../index.html#inventory',    icon:'box',      core:true },
    { id:'clients',   label:'Clients',     sub:'Customer directory',    href:'../../index.html#clients',      icon:'users',    core:true },
    { id:'export',    label:'Data Export', sub:'Backups & downloads',   href:'../data-export/index.html',     icon:'download', core:false },
    { id:'employees', label:'Employees',   sub:'Staff & permissions',   href:'../employees/index.html',       icon:'briefcase',core:false },
    { id:'ecommerce', label:'Website',     sub:'Storefront & orders',   href:'../ecommerce/index.html',       icon:'globe',    core:false },
    { id:'ca-portal', label:'CA Portal',   sub:'Accountant access',     href:'../ca-portal/index.html',       icon:'shield',   core:false }
  ];

  var ICONS = {
    home:'<path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V9.5Z"/>',
    file:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
    box:'<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
    users:'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    download:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    briefcase:'<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
    globe:'<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
    shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    more:'<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>',
    clock:'<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    history:'<path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><path d="M12 7v5l4 2"/>',
    help:'<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 2-3 4"/><line x1="12" y1="17" x2="12.01" y2="17"/>'
  };

  function svg(inner,w){ w=w||18; return '<svg width="'+w+'" height="'+w+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+inner+'</svg>'; }

  function isRealDesktop(){
    try{
      var fine = window.matchMedia && window.matchMedia('(pointer:fine)').matches;
      var hover = window.matchMedia && window.matchMedia('(hover:hover)').matches;
      var noTouch = !('ontouchstart' in window) && (navigator.maxTouchPoints||0) === 0;
      var wide = window.innerWidth >= 900;
      return !!(fine && hover && noTouch && wide);
    }catch(e){ return false; }
  }
  function applyDeviceClass(){
    document.body.classList.toggle('is-desktop-device', isRealDesktop());
  }

  function el(html){
    var d = document.createElement('div');
    d.innerHTML = html.trim();
    return d.firstChild;
  }

  var _cfg = null;

  function buildTopbar(cfg){
    var bar = el('<div id="shell-topbar"></div>');
    if(cfg.backTo){
      var back = el('<button id="shell-back-btn" title="Back">'+svg('<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',18)+'</button>');
      back.onclick = function(){ window.location.href = cfg.backTo; };
      bar.appendChild(back);
    } else {
      var ham = el('<button id="shell-hamburger" title="Menu">'+svg('<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>',18)+'</button>');
      ham.onclick = openMoreSheet;
      bar.appendChild(ham);
    }
    var title = el('<div id="shell-title"></div>');
    title.textContent = cfg.title || '';
    bar.appendChild(title);
    var actionsWrap = el('<div id="shell-actions"></div>');
    (cfg.actions||[]).forEach(function(a){
      var b = el('<button class="shell-icon-btn" title="'+(a.title||'')+'">'+svg(ICONS[a.icon]||ICONS.help,17)+'</button>');
      b.onclick = a.onClick||function(){};
      actionsWrap.appendChild(b);
    });
    bar.appendChild(actionsWrap);
    return bar;
  }

  function buildSidebar(cfg){
    var aside = el('<aside id="shell-sidebar"></aside>');
    aside.appendChild(el(
      '<div id="shell-sidebar-brand">'+
        '<div id="shell-sidebar-brand-icon">'+svg('<path d="M12 2C9 6 6 9 6 13a6 6 0 0 0 12 0c0-4-3-7-6-11Z"/>',15).replace('currentColor','#fff')+'</div>'+
        '<div id="shell-sidebar-brand-text">'+
          '<div id="shell-sidebar-brand-title">My Business</div>'+
          '<div id="shell-sidebar-brand-sub">Modular ERP</div>'+
        '</div>'+
      '</div>'
    ));
    var iconEl = aside.querySelector('#shell-sidebar-brand-icon svg');
    if(iconEl) iconEl.style.color = '#fff';

    var navWrap = el('<div id="shell-sidebar-nav"></div>');
    navWrap.appendChild(el('<div class="shell-nav-section">Core</div>'));
    TOOLS.filter(function(t){return t.core;}).forEach(function(t){ navWrap.appendChild(navLink(t,cfg)); });
    navWrap.appendChild(el('<div class="shell-nav-section">Tools</div>'));
    TOOLS.filter(function(t){return !t.core;}).forEach(function(t){ navWrap.appendChild(navLink(t,cfg)); });

    if(cfg.navItems && cfg.navItems.length){
      navWrap.appendChild(el('<div class="shell-nav-section">'+(cfg.title||'This tool')+'</div>'));
      cfg.navItems.forEach(function(it){
        var a = el('<button class="shell-nav-item" data-section="'+it.id+'">'+svg(ICONS[it.icon]||ICONS.help,17)+'<span>'+it.label+'</span></button>');
        a.onclick = function(){ setActiveSection(it.id); it.onClick&&it.onClick(); };
        navWrap.appendChild(a);
      });
    }
    aside.appendChild(navWrap);
    aside.appendChild(el('<div id="shell-sidebar-footer"></div>'));
    return aside;
  }

  function navLink(t,cfg){
    var a = el('<a class="shell-nav-item" href="'+t.href+'">'+svg(ICONS[t.icon]||ICONS.help,17)+'<span>'+t.label+'</span></a>');
    if(t.id === cfg.toolId) a.classList.add('active');
    return a;
  }

  function buildBottomNav(cfg){
    var nav = el('<nav id="shell-bottomnav"></nav>');
    var items = (cfg.navItems && cfg.navItems.length) ? cfg.navItems.slice(0,4) : [];
    items.forEach(function(it){
      var b = el('<button class="shell-bnav-item" data-section="'+it.id+'">'+
        '<span class="shell-bnav-dot"></span>'+svg(ICONS[it.icon]||ICONS.help,21)+
        '<span class="shell-bnav-label">'+it.label+'</span></button>');
      b.onclick = function(){ setActiveSection(it.id); it.onClick&&it.onClick(); };
      nav.appendChild(b);
    });
    var more = el('<button class="shell-bnav-item" data-section="__more">'+svg(ICONS.more,21)+'<span class="shell-bnav-label">More</span></button>');
    more.onclick = openMoreSheet;
    nav.appendChild(more);
    return nav;
  }

  function setActiveSection(id){
    document.querySelectorAll('.shell-bnav-item,#shell-sidebar-nav .shell-nav-item[data-section]').forEach(function(n){
      n.classList.toggle('active', n.getAttribute('data-section')===id);
    });
  }
  window.ShellSetActiveSection = setActiveSection;

  function buildMoreSheet(cfg){
    var overlay = el('<div id="shell-more-overlay"></div>');
    var sheet = el('<div id="shell-more-sheet"><div class="shell-more-handle"></div></div>');
    sheet.appendChild(el('<div class="shell-more-title">Switch to</div>'));
    TOOLS.forEach(function(t){
      if(t.id === cfg.toolId) return;
      var row = el(
        '<a class="shell-more-row" href="'+t.href+'">'+
          '<div class="shell-more-row-icon">'+svg(ICONS[t.icon]||ICONS.help,19)+'</div>'+
          '<div class="shell-more-row-text"><div class="shell-more-row-title">'+t.label+'</div><div class="shell-more-row-sub">'+t.sub+'</div></div>'+
        '</a>'
      );
      sheet.appendChild(row);
    });
    overlay.appendChild(sheet);
    overlay.onclick = function(e){ if(e.target===overlay) closeMoreSheet(); };
    return overlay;
  }
  function openMoreSheet(){ var o=document.getElementById('shell-more-overlay'); if(o) o.classList.add('open'); }
  function closeMoreSheet(){ var o=document.getElementById('shell-more-overlay'); if(o) o.classList.remove('open'); }
  window.ShellCloseMore = closeMoreSheet;

  function init(cfg){
    _cfg = cfg;
    applyDeviceClass();
    window.addEventListener('resize', applyDeviceClass);

    var root = document.getElementById('shell-root');
    if(!root){ console.error('AppShell: #shell-root not found in page HTML'); return; }

    root.insertBefore(buildSidebar(cfg), root.firstChild);

    var main = document.getElementById('shell-main');
    if(!main){ console.error('AppShell: #shell-main not found in page HTML'); return; }
    main.insertBefore(buildTopbar(cfg), main.firstChild);

    document.body.appendChild(buildBottomNav(cfg));
    document.body.appendChild(buildMoreSheet(cfg));

    if(cfg.navItems && cfg.navItems.length) setActiveSection(cfg.navItems[0].id);
    if(typeof lucide !== 'undefined') lucide.createIcons();
  }

  window.AppShell = { init: init, ICONS: ICONS, TOOLS: TOOLS, openMore: openMoreSheet, closeMore: closeMoreSheet };
})();
