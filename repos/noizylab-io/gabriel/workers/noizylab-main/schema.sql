-- ═══════════════════════════════════════════════════════════════════════════════
-- NOIZYLAB Master Database Schema
-- All tables for repairs, archive, knowledge lake, and search
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- REPAIRS TABLES
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    city TEXT,
    province TEXT DEFAULT 'ON',
    postal_code TEXT,
    preferred_contact TEXT DEFAULT 'email',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    total_repairs INTEGER DEFAULT 0,
    lifetime_value REAL DEFAULT 0,
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_id ON customers(customer_id);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);

CREATE TABLE IF NOT EXISTS repairs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id TEXT UNIQUE NOT NULL,
    customer_id TEXT,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT,
    device_type TEXT NOT NULL,
    device_model TEXT,
    serial_number TEXT,
    issue_description TEXT NOT NULL,
    diagnosis TEXT,
    repair_notes TEXT,
    parts_used TEXT,
    status TEXT DEFAULT 'intake',
    priority TEXT DEFAULT 'normal',
    price REAL DEFAULT 89.00,
    paid INTEGER DEFAULT 0,
    payment_method TEXT,
    payment_date DATETIME,
    technician TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
);

CREATE INDEX IF NOT EXISTS idx_repairs_ticket ON repairs(ticket_id);
CREATE INDEX IF NOT EXISTS idx_repairs_status ON repairs(status);
CREATE INDEX IF NOT EXISTS idx_repairs_created ON repairs(created_at);
CREATE INDEX IF NOT EXISTS idx_repairs_customer ON repairs(customer_id);
CREATE INDEX IF NOT EXISTS idx_repairs_customer_name ON repairs(customer_name);
CREATE INDEX IF NOT EXISTS idx_repairs_device ON repairs(device_type);

CREATE TABLE IF NOT EXISTS status_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id TEXT NOT NULL,
    old_status TEXT,
    new_status TEXT NOT NULL,
    changed_by TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES repairs(ticket_id)
);

CREATE INDEX IF NOT EXISTS idx_status_ticket ON status_history(ticket_id);

CREATE TABLE IF NOT EXISTS daily_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date DATE UNIQUE NOT NULL,
    repairs_completed INTEGER DEFAULT 0,
    revenue REAL DEFAULT 0,
    new_customers INTEGER DEFAULT 0,
    avg_repair_time_hours REAL,
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_metrics_date ON daily_metrics(date);

-- ─────────────────────────────────────────────────────────────────────────────
-- AQUARIUM ARCHIVE TABLES (34TB Creative Archive)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS archive_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    project TEXT,
    year INTEGER,
    category TEXT CHECK(category IN ('music', 'sfx', 'voice', 'video', 'samples', 'sessions', 'other')),
    format TEXT,
    size_bytes INTEGER,
    duration_seconds INTEGER,
    sample_rate INTEGER,
    bit_depth INTEGER,
    channels INTEGER,
    location TEXT,
    volume TEXT,
    checksum TEXT,
    metadata JSON,
    tags TEXT,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_verified DATETIME,
    last_accessed DATETIME
);

CREATE INDEX IF NOT EXISTS idx_archive_item_id ON archive_items(item_id);
CREATE INDEX IF NOT EXISTS idx_archive_title ON archive_items(title);
CREATE INDEX IF NOT EXISTS idx_archive_project ON archive_items(project);
CREATE INDEX IF NOT EXISTS idx_archive_year ON archive_items(year);
CREATE INDEX IF NOT EXISTS idx_archive_category ON archive_items(category);
CREATE INDEX IF NOT EXISTS idx_archive_format ON archive_items(format);

-- Full-text search on archive (if supported)
-- CREATE VIRTUAL TABLE IF NOT EXISTS archive_fts USING fts5(title, project, description, tags, content=archive_items, content_rowid=id);

-- ─────────────────────────────────────────────────────────────────────────────
-- KNOWLEDGE LAKE TABLES
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS knowledge (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('text', 'markdown', 'html', 'javascript', 'python', 'json', 'yaml', 'code', 'document', 'email', 'csv', 'log', 'conversation', 'prompt', 'completion', 'image', 'audio', 'video', 'event', 'webhook', 'metric')),
    source TEXT CHECK(source IN ('api', 'webhook', 'url', 'upload', 'stream', 'pipeline', 'agent', 'scraper', 'manual', 'system')),
    content TEXT,
    content_hash TEXT,
    tags TEXT,
    keywords TEXT,
    categories TEXT,
    metadata JSON,
    embedding TEXT,
    ai_summary TEXT,
    ai_sentiment TEXT,
    ai_classification TEXT,
    parent_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    accessed_at DATETIME,
    access_count INTEGER DEFAULT 0,
    FOREIGN KEY (parent_id) REFERENCES knowledge(id)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_title ON knowledge(title);
CREATE INDEX IF NOT EXISTS idx_knowledge_type ON knowledge(type);
CREATE INDEX IF NOT EXISTS idx_knowledge_source ON knowledge(source);
CREATE INDEX IF NOT EXISTS idx_knowledge_created ON knowledge(created_at);
CREATE INDEX IF NOT EXISTS idx_knowledge_updated ON knowledge(updated_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- AGENT MEMORY TABLES
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_memory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_name TEXT NOT NULL,
    memory_type TEXT CHECK(memory_type IN ('conversation', 'fact', 'preference', 'task', 'note')),
    key TEXT,
    value TEXT,
    context TEXT,
    importance INTEGER DEFAULT 5,
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agent_memory_agent ON agent_memory(agent_name);
CREATE INDEX IF NOT EXISTS idx_agent_memory_type ON agent_memory(memory_type);
CREATE INDEX IF NOT EXISTS idx_agent_memory_key ON agent_memory(key);

-- ─────────────────────────────────────────────────────────────────────────────
-- SEARCH HISTORY & ANALYTICS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS search_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query TEXT NOT NULL,
    search_type TEXT CHECK(search_type IN ('global', 'repairs', 'aquarium', 'knowledge', 'agents')),
    results_count INTEGER,
    sources TEXT,
    user_agent TEXT,
    ip_hash TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_search_query ON search_history(query);
CREATE INDEX IF NOT EXISTS idx_search_type ON search_history(search_type);
CREATE INDEX IF NOT EXISTS idx_search_created ON search_history(created_at);
