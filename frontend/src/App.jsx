import { useEffect, useRef, useState } from "react";
import { apiRequest } from "./api";
import "./App.css";
function App() {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(() => sessionStorage.getItem("trustvault_token"));
  const [user, setUser] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [shareDocumentId, setShareDocumentId] = useState(null);
  const [shareUsername, setShareUsername] = useState("");
  const [sharePermission, setSharePermission] = useState("read");
  const [sharing, setSharing] = useState(false);
  const [documentShares, setDocumentShares] = useState([]);
  const [sharesLoading, setSharesLoading] = useState(false);
  const [revokingUsername, setRevokingUsername] = useState("");
  useEffect(() => {
    if (!token) {
      setUser(null);
      return;
    }
    let cancelled = false;
    async function loadUser() {
      try {
        const currentUser = await apiRequest("/auth/me", {}, token);
        if (!cancelled) setUser(currentUser);
      } catch {
        if (!cancelled) {
          sessionStorage.removeItem("trustvault_token");
          setToken(null);
          setUser(null);
        }
      }
    }
    loadUser();
    return () => {
      cancelled = true;
    };
  }, [token]);
  useEffect(() => {
    if (!token || !user) return;
    let cancelled = false;
    async function loadDocuments() {
      setDocumentsLoading(true);
      try {
        const params = new URLSearchParams();
        if (search.trim()) params.set("name", search.trim());
        if (category.trim()) params.set("category", category.trim());
        const suffix = params.toString() ? `?${params.toString()}` : "";
        const result = await apiRequest(`/documents${suffix}`, {}, token);
        if (!cancelled) {
          setDocuments(Array.isArray(result) ? result : []);
          setMessage("");
        }
      } catch (error) {
        if (!cancelled) setMessage(`Could not load documents: ${error.message}`);
      } finally {
        if (!cancelled) setDocumentsLoading(false);
      }
    }
    loadDocuments();
    return () => {
      cancelled = true;
    };
  }, [token, user, search, category]);
  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setLoading(true);
    try {
      if (mode === "register") {
        await apiRequest("/auth/register", {
          method: "POST",
          body: JSON.stringify({ username, password }),
        });
      }
      const form = new URLSearchParams();
      form.set("username", username);
      form.set("password", password);
      const result = await apiRequest("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString(),
      });
      sessionStorage.setItem("trustvault_token", result.access_token);
      setToken(result.access_token);
      setPassword("");
    } catch (error) {
      setMessage(error.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }
  async function handleUpload(event) {
  const file = event.target.files?.[0];
  if (!file || !token) return;
  setMessage("");
  setUploading(true);
  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", "General");
    await apiRequest("/documents/upload", {
      method: "POST",
      body: formData,
    }, token);
    setMessage("Document uploaded successfully.");
    setSearch("");
    setCategory("");
    // Refresh the document list.
    const result = await apiRequest("/documents", {}, token);
    setDocuments(Array.isArray(result) ? result : []);
  } catch (error) {
    setMessage(`Upload failed: ${error.message}`);
  } finally {
    setUploading(false);
    event.target.value = "";
  }
  }
async function loadDocumentShares(documentId) {
  setSharesLoading(true);
  try {
    const data = await apiRequest(
      `/documents/${documentId}/shares`,
      {},
      token
    );
    setDocumentShares(data);
  } catch (error) {
    setMessage(`Could not load sharing details: ${error.message}`);
    setDocumentShares([]);
  } finally {
    setSharesLoading(false);
  }
}
  async function handleShare(event) {
  event.preventDefault();
  if (!shareDocumentId || !shareUsername.trim()) {
    setMessage("Select a document and enter a username.");
    return;
  }
  setSharing(true);
  setMessage("");
  try {
    await apiRequest(
      `/documents/${shareDocumentId}/share`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: shareUsername.trim(),
          permission: sharePermission,
        }),
      },
      token
    );
    setMessage(`Access granted to ${shareUsername.trim()}.`);
    setShareDocumentId(null);
    setShareUsername("");
  } catch (error) {
    setMessage(`Sharing failed: ${error.message}`);
  } finally {
    setSharing(false);
  }
  }
  async function handleRevoke(documentId, recipientUsername) {
    const confirmed = window.confirm(
      `Revoke ${recipientUsername}'s access to this document?`
    );
    if (!confirmed) return;
    setMessage("");
    try {
      await apiRequest(
        `/documents/${documentId}/share/${encodeURIComponent(recipientUsername)}`,
        { method: "DELETE" },
        token
      );
      setMessage(`Access revoked for ${recipientUsername}.`);
    } catch (error) {
      setMessage(`Revocation failed: ${error.message}`);
    }
  }
  function handleLogout() {
    sessionStorage.removeItem("trustvault_token");
    setToken(null);
    setUser(null);
    setDocuments([]);
    setUsername("");
    setPassword("");
    setMessage("");
  }
  if (token && !user) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="brand-icon auth-logo">T</div>
          <h1>Loading your workspace</h1>
          <p>Verifying your session...</p>
        </div>
      </div>
    );
  }
  if (!token || !user) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="brand auth-brand">
            <div className="brand-icon">T</div>
            <div>
              <h2>TrustVault</h2>
              <span>SECURE WORKSPACE</span>
            </div>
          </div>
          <p className="eyebrow">YOUR FILES. YOUR CONTROL.</p>
          <h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1>
          <p className="auth-subtitle">
            {mode === "login"
              ? "Sign in to access your secure documents."
              : "Register to start using your private workspace."}
          </p>
          <form onSubmit={handleSubmit}>
            <label htmlFor="username">Username</label>
            <input
              id="username"
              autoComplete="username"
              minLength={3}
              maxLength={100}
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Enter your username"
            />
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={mode === "register" ? 12 : undefined}
              maxLength={128}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={mode === "register" ? "At least 12 characters" : "Enter your password"}
            />
            {message && <div className="auth-message" role="status">{message}</div>}
            <button className="primary-button auth-submit" disabled={loading}>
              {loading ? "Please wait..." : mode === "login" ? "Sign in securely" : "Create account"}
            </button>
          </form>
          <p className="auth-switch">
            {mode === "login" ? "New to TrustVault?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setMessage("");
              }}
            >
              {mode === "login" ? "Create account" : "Sign in"}
            </button>
          </p>
          <p className="auth-note">Access to documents is controlled by the server.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">T</div>
          <div>
            <h2>TrustVault</h2>
            <span>SECURE WORKSPACE</span>
          </div>
        </div>
        <button
          className="upload-button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}>
          <span>＋</span> {uploading ? "Uploading..." : "Upload document"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,.png,.jpg,.jpeg,.docx"
          hidden
          onChange={handleUpload}
        />
        <p className="menu-label">WORKSPACE</p>
        <nav>
          <button className="nav-item active"><span className="nav-icon">▤</span>Documents</button>
          <button className="nav-item" onClick={() => setMessage("Shared documents appear in the document list when access is granted.")}>
            <span className="nav-icon">⇄</span>Shared with me
          </button>
          <button className="nav-item" onClick={() => setMessage("The admin activity view will be connected next.")}>
            <span className="nav-icon">◷</span>Activity Log
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="security-indicator">
            <span className="status-dot" />
            <div><strong>Private storage</strong><p>Server access checks</p></div>
          </div>
          <p className="version">TRUSTVAULT · VERSION 0.1</p>
        </div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">Workspace <span>/</span> <strong>Documents</strong></div>
          <div className="user-profile">
            <div className="avatar">{user.username?.[0]?.toUpperCase() || "U"}</div>
            <div>
              <strong>{user.username}</strong>
              <p>{user.role || "user"}</p>
            </div>
            <button className="secondary-button" onClick={handleLogout}>Sign out</button>
          </div>
        </header>
        <section className="page-content">
          <div className="welcome-row">
            <div>
              <p className="eyebrow">YOUR PRIVATE WORKSPACE</p>
              <h1>Your documents</h1>
              <p className="subtitle">Only documents you own or have been granted access to are listed.</p>
            </div>
            <div className="secure-badge"><span>✓</span> Access-controlled</div>
          </div>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-heading"><span>Visible documents</span><span className="stat-icon purple">▤</span></div>
              <h2>{documents.length}</h2>
              <p>Matching documents in this view</p>
            </div>
            <div className="stat-card">
              <div className="stat-heading"><span>Account role</span><span className="stat-icon blue">♙</span></div>
              <h2>{user.role || "user"}</h2>
              <p>Role verified by the backend</p>
            </div>
            <div className="stat-card">
              <div className="stat-heading"><span>Session</span><span className="stat-icon green">✓</span></div>
              <h2 className="status-text">Authenticated</h2>
              <p>API requests include your token</p>
            </div>
          </div>
          <section className="documents-panel">
            <div className="panel-header">
            {shareDocumentId !== null && (
              <form className="share-form" onSubmit={handleShare}>
                <h3>Share document</h3>
                <label htmlFor="share-username">Recipient username</label>
                <input
                  id="share-username"
                  value={shareUsername}
                  onChange={(event) => setShareUsername(event.target.value)}
                  placeholder="Enter a registered username"
                  required
                />
                <label htmlFor="share-permission">Permission</label>
                <select
                  id="share-permission"
                  value={sharePermission}
                  onChange={(event) => setSharePermission(event.target.value)}
                >
                  <option value="read">Read and download</option>
                  <option value="edit">Edit permission</option>
                </select>
                <div className="shared-users">
                  <h4>People with access</h4>
                  {sharesLoading ? (
                    <p>Loading sharing details...</p>
                  ) : documentShares.length === 0 ? (
                    <p>No one else has access yet.</p>
                  ) : (
                    documentShares.map((share) => (
                      <div className="shared-user-row" key={share.username}>
                        <div>
                          <strong>{share.username}</strong>
                          <span>{share.permission}</span>
                        </div>
                        <button
                          className="secondary-button"
                          type="button"
                          disabled={revokingUsername === share.username}
                          onClick={async () => {
                            setRevokingUsername(share.username);
                            await handleRevoke(shareDocumentId, share.username);
                            await loadDocumentShares(shareDocumentId);
                            setRevokingUsername("");
                          }}
                        >
                          {revokingUsername === share.username ? "Revoking..." : "Revoke"}
                        </button>
                      </div>
                    ))
                  )}
                </div>
                <div className="share-actions">
                  <button className="primary-button" type="submit" disabled={sharing}>
                    {sharing ? "Sharing..." : "Grant access"}
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => setShareDocumentId(null)}
                  >
                    Cancel
                    </button>
                  </div>
                </form>
              )}
              <div><h2>Document library</h2><p>Search documents available to your account.</p></div>
              <button className="secondary-button" onClick={() => { setSearch(""); setCategory(""); }}>
                Clear filters
              </button>
            </div>
            <div className="filters-row">
              <div className="search-row">
                <span className="search-icon">⌕</span>
                <input
                  type="search"
                  placeholder="Search by document name..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <input
                className="category-filter"
                type="text"
                placeholder="Filter by category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              />
            </div>
            {message && <div className="auth-message document-message" role="status">{message}</div>}
            <div className="table-header">
              <span>DOCUMENT</span><span>CATEGORY</span><span>OWNER ID</span><span>CREATED</span><span>ACTIONS</span>
            </div>
            {documentsLoading ? (
              <div className="empty-state"><h3>Loading documents...</h3></div>
            ) : documents.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">▤</div>
                <h3>No documents found</h3>
                <p>Upload a document or ask its owner to share it with your account.</p>
              </div>
            ) : (
              <div className="document-rows">
                {documents.map((doc) => (
                  <div className="document-row" key={doc.id}>
                    <div className="document-name"><span className="file-icon">▤</span><strong>{doc.name}</strong></div>
                    <span>{doc.category}</span>
                    <span>{doc.owner_id}</span>
                    <span>{doc.created_at ? new Date(doc.created_at).toLocaleDateString() : "—"}</span>
                    <button className="secondary-button"
                      type="button"
                      onClick={async() => {
                        setShareDocumentId(doc.id);
                        setShareUsername("");
                        setSharePermission("read");
                        setDocumentShares([]);
                        setMessage("");
                        await loadDocumentShares(doc.id);
                      }}
                    >
                      Share
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
          <footer>
            <span>TrustVault · Secure document management</span>
            <span><span className="status-dot" /> Private storage architecture</span>
          </footer>
        </section>
      </main>
    </div>
  );
}
export default App;