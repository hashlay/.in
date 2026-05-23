import os

def replace_in_file(file_path, replacements, add_css=False):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    if add_css and 'font-awesome' not in content:
        content = content.replace('</head>', '  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">\n</head>')

    for k, v in replacements.items():
        content = content.replace(k, v)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

# Admin panel replacements
admin_replacements = {
    '<span class="nav-icon">📊</span>': '<i class="nav-icon fa-solid fa-chart-line"></i>',
    '<span class="nav-icon">🛒</span>': '<i class="nav-icon fa-solid fa-cart-shopping"></i>',
    '<span class="nav-icon">📱</span>': '<i class="nav-icon fa-brands fa-whatsapp"></i>',
    '<span class="nav-icon">📦</span>': '<i class="nav-icon fa-solid fa-box"></i>',
    '<span class="nav-icon">👥</span>': '<i class="nav-icon fa-solid fa-users"></i>',
    '<span class="nav-icon">⭐</span>': '<i class="nav-icon fa-solid fa-star"></i>',
    '<span class="nav-icon">🎯</span>': '<i class="nav-icon fa-solid fa-bullseye"></i>',
    '<span class="nav-icon">📈</span>': '<i class="nav-icon fa-solid fa-chart-pie"></i>',
    '<span class="nav-icon">❓</span>': '<i class="nav-icon fa-solid fa-circle-question"></i>',
    '<span class="nav-icon">🤖</span>': '<i class="nav-icon fa-solid fa-robot"></i>',
    '<span class="nav-icon">🔔</span>': '<i class="nav-icon fa-solid fa-bell"></i>',
    '<span class="nav-icon">✉️</span>': '<i class="nav-icon fa-solid fa-envelope"></i>',
    '<span class="nav-icon">📋</span>': '<i class="nav-icon fa-solid fa-clipboard-list"></i>',
    '<span class="nav-icon">⚙️</span>': '<i class="nav-icon fa-solid fa-gear"></i>',
    '<span class="nav-icon">👤</span>': '<i class="nav-icon fa-solid fa-user-shield"></i>',
    '<span class="nav-icon">🚪</span>': '<i class="nav-icon fa-solid fa-arrow-right-from-bracket"></i>',
    
    'title="Notifications"\n            style="position:relative;">🔔<span': 'title="Notifications"\n            style="position:relative;"><i class="fa-solid fa-bell"></i><span',
    'title="Notifications" style="position:relative;">🔔<span': 'title="Notifications" style="position:relative;"><i class="fa-solid fa-bell"></i><span',

    '<div class="stat-icon\">💰</div>': '<div class="stat-icon"><i class="fa-solid fa-wallet"></i></div>',
    '<div class="stat-icon\">🛒</div>': '<div class="stat-icon"><i class="fa-solid fa-cart-shopping"></i></div>',
    '<div class="stat-icon\">📦</div>': '<div class="stat-icon"><i class="fa-solid fa-box-open"></i></div>',
    '<div class="stat-icon\">👥</div>': '<div class="stat-icon"><i class="fa-solid fa-users"></i></div>',
    '<div class="stat-icon\">📊</div>': '<div class="stat-icon"><i class="fa-solid fa-chart-line"></i></div>',
    '<div class="stat-icon\">⏳</div>': '<div class="stat-icon"><i class="fa-solid fa-hourglass-half"></i></div>',
    '<div class="stat-icon\">✅</div>': '<div class="stat-icon"><i class="fa-solid fa-circle-check"></i></div>',
    
    '<span class="stat-btn-icon">🔄</span>': '<i class="stat-btn-icon fa-solid fa-rotate-right"></i>',
    '<span class="stat-btn-icon">⚠️</span>': '<i class="stat-btn-icon fa-solid fa-triangle-exclamation"></i>',
    
    '<div class="qa-icon">➕</div>': '<div class="qa-icon"><i class="fa-solid fa-plus"></i></div>',
    '<div class="qa-icon">🎟</div>': '<div class="qa-icon"><i class="fa-solid fa-ticket"></i></div>',
    '<div class="qa-icon">📣</div>': '<div class="qa-icon"><i class="fa-solid fa-bullhorn"></i></div>',
    '<div class="qa-icon">📋</div>': '<div class="qa-icon"><i class="fa-solid fa-clipboard-list"></i></div>',

    '<div class="section-hdr-title">📱 WHATSAPP ORDERS</div>': '<div class="section-hdr-title"><i class="fa-brands fa-whatsapp"></i> WHATSAPP ORDERS</div>',
    '<div class="section-hdr-title">📦 PRODUCTS</div>': '<div class="section-hdr-title"><i class="fa-solid fa-box"></i> PRODUCTS</div>',
    '<div class="section-hdr-title">👥 CUSTOMERS</div>': '<div class="section-hdr-title"><i class="fa-solid fa-users"></i> CUSTOMERS</div>',
    '<div class="section-hdr-title">⭐ REVIEWS</div>': '<div class="section-hdr-title"><i class="fa-solid fa-star"></i> REVIEWS</div>',
    '<div class="section-hdr-title">🎯 MARKETING</div>': '<div class="section-hdr-title"><i class="fa-solid fa-bullseye"></i> MARKETING</div>',
    '<div class="section-hdr-title">📈 ANALYTICS</div>': '<div class="section-hdr-title"><i class="fa-solid fa-chart-bar"></i> ANALYTICS</div>',
    '<div class="section-hdr-title">❓ FAQ MANAGER</div>': '<div class="section-hdr-title"><i class="fa-solid fa-circle-question"></i> FAQ MANAGER</div>',
    '<div class="section-hdr-title">🤖 AI CHATBOT</div>': '<div class="section-hdr-title"><i class="fa-solid fa-robot"></i> AI CHATBOT</div>',
    '<div class="section-hdr-title">🔔 NOTIFY LIST</div>': '<div class="section-hdr-title"><i class="fa-solid fa-bell"></i> NOTIFY LIST</div>',
    '<div class="section-hdr-title">✉️ MESSAGES</div>': '<div class="section-hdr-title"><i class="fa-solid fa-envelope"></i> MESSAGES</div>',
    '<div class="section-hdr-title">🔔 NOTIFICATIONS</div>': '<div class="section-hdr-title"><i class="fa-solid fa-bell"></i> NOTIFICATIONS</div>',
    '<div class="section-hdr-title">📋 ACTIVITY LOG</div>': '<div class="section-hdr-title"><i class="fa-solid fa-clipboard-list"></i> ACTIVITY LOG</div>',
    '<div class="section-hdr-title">⚙️ SETTINGS</div>': '<div class="section-hdr-title"><i class="fa-solid fa-gear"></i> SETTINGS</div>',
    '<div class="section-hdr-title">👤 ADMIN USERS</div>': '<div class="section-hdr-title"><i class="fa-solid fa-user-shield"></i> ADMIN USERS</div>',
    
    # Other places in admin where emojis are used:
    '📸 Scan Screenshot': '<i class="fa-solid fa-camera"></i> Scan Screenshot',
    '🤖 Extract Details': '<i class="fa-solid fa-robot"></i> Extract Details',
    '➕ Add Product': '<i class="fa-solid fa-plus"></i> Add Product',
    '📥 Export CSV': '<i class="fa-solid fa-download"></i> Export CSV',
    '📊 Export\n              Excel': '<i class="fa-solid fa-file-excel"></i> Export\n              Excel',
    '📊 Export Excel': '<i class="fa-solid fa-file-excel"></i> Export Excel',
}

replace_in_file('hashlay-admin.html', admin_replacements, True)

# Final.html replacements
final_replacements = {
    # Floating buttons
    '<button class="float-btn float-faq" onclick="openFaqPopup()" title="FAQ">\n      ❓': '<button class="float-btn float-faq" onclick="openFaqPopup()" title="FAQ">\n      <i class="fa-solid fa-question"></i>',
    '<button class="float-btn float-ai" onclick="toggleAiChat()" title="AI Assistant" id="ai-chat-toggle-btn">\n      🤖': '<button class="float-btn float-ai" onclick="toggleAiChat()" title="AI Assistant" id="ai-chat-toggle-btn">\n      <i class="fa-solid fa-robot"></i>',
    'title="WhatsApp">\n      💬': 'title="WhatsApp">\n      <i class="fa-brands fa-whatsapp"></i>',
    
    '<div class="chat-avatar">🤖</div>': '<div class="chat-avatar"><i class="fa-solid fa-robot"></i></div>',

    # In final.html contact section
    '<div class="contact-icon">📧</div>': '<div class="contact-icon"><i class="fa-solid fa-envelope"></i></div>',
    '<div class="contact-icon">📱</div>': '<div class="contact-icon"><i class="fa-solid fa-phone"></i></div>',
    '<div class="contact-icon">📍</div>': '<div class="contact-icon"><i class="fa-solid fa-location-dot"></i></div>',

    '<div class="notify-icon">🚗</div>': '<div class="notify-icon"><i class="fa-solid fa-car"></i></div>',
    
    'Notify Me 🔔': 'Notify Me <i class="fa-solid fa-bell"></i>',
    'Add to Cart 🛒': 'Add to Cart <i class="fa-solid fa-cart-shopping"></i>',

    # Payment Failure Box
    '<div class="pay-fail-icon">😔</div>': '<div class="pay-fail-icon"><i class="fa-solid fa-face-frown"></i></div>',

    # Success boxes
    '<div class="confirm-icon">🎉</div>': '<div class="confirm-icon"><i class="fa-solid fa-party-horn"></i></div>',
    '<div class="notify-success-icon">🎉</div>': '<div class="notify-success-icon"><i class="fa-solid fa-party-horn"></i></div>',

    # Navbar
    'aria-label="Cart">\n        🛒': 'aria-label="Cart">\n        <i class="fa-solid fa-cart-shopping"></i>',
    
    # Admin Modal
    '<h4>MANAGE PRODUCTS</h4>': '<h4><i class="fa-solid fa-box"></i> MANAGE PRODUCTS</h4>',
    '<h4>MANAGE ORDERS</h4>': '<h4><i class="fa-solid fa-cart-shopping"></i> MANAGE ORDERS</h4>',
    '<h4>MANAGE REVIEWS</h4>': '<h4><i class="fa-solid fa-star"></i> MANAGE REVIEWS</h4>',
    '<h4>REGISTERED USERS</h4>': '<h4><i class="fa-solid fa-users"></i> REGISTERED USERS</h4>',
    '<div class="admin-login-title">ADMIN LOGIN</div>': '<div class="admin-login-title"><i class="fa-solid fa-lock"></i> ADMIN LOGIN</div>',
    
    '<button class="admin-nav-item active" onclick="switchAdminTab(\'products\', this)">📦 Products</button>': '<button class="admin-nav-item active" onclick="switchAdminTab(\'products\', this)"><i class="fa-solid fa-box"></i> Products</button>',
    '<button class="admin-nav-item" onclick="switchAdminTab(\'orders\', this)">🛒 Orders</button>': '<button class="admin-nav-item" onclick="switchAdminTab(\'orders\', this)"><i class="fa-solid fa-cart-shopping"></i> Orders</button>',
    '<button class="admin-nav-item" onclick="switchAdminTab(\'reviews\', this)">⭐ Reviews</button>': '<button class="admin-nav-item" onclick="switchAdminTab(\'reviews\', this)"><i class="fa-solid fa-star"></i> Reviews</button>',
    '<button class="admin-nav-item" onclick="switchAdminTab(\'users\', this)">👤 Users</button>': '<button class="admin-nav-item" onclick="switchAdminTab(\'users\', this)"><i class="fa-solid fa-users"></i> Users</button>',
    '<button class="admin-nav-item" style="margin-top:auto;color:#ff6666;" onclick="adminLogout()">🚪\n              Logout</button>': '<button class="admin-nav-item" style="margin-top:auto;color:#ff6666;" onclick="adminLogout()"><i class="fa-solid fa-right-from-bracket"></i> Logout</button>',
}

replace_in_file('final.html', final_replacements, False)
print('Done!')
