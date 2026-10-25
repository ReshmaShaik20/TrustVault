import { useEffect, useRef, useState } from "react";
import { apiRequest , downloadDocument, viewDocument} from "./api";
import "./App.css";
const LEGAL = {
  terms: {
    title: "Terms and Conditions",
    sections: [
      ["1. Acceptance", "By creating a TrustVault account you agree to these terms. If you do not agree, please do not register."],
      ["2. Eligibility", "You must be at least 18 years old to create an account."],
      ["3. Your account", "You are responsible for keeping your password confidential and for all activity under your account. Tell us immediately if you suspect unauthorized access."],
      ["4. Account types and roles", "Viewer accounts can access documents shared with them. Document Owner and Administrator accounts require approval by an existing administrator, and approval may be refused or withdrawn at any time."],
      ["5. Your documents", "You keep ownership of the documents you upload. You confirm that you have the right to upload them and that they do not break the law or anyone else's rights."],
      ["6. Sharing and access", "Document owners decide who can read or edit their documents. Access can be revoked at any time, and revocation takes effect immediately."],
      ["7. Acceptable use", "You must not try to access documents you have not been given access to, bypass security controls, upload malware, or disrupt the service."],
      ["8. Audit logging", "TrustVault records security-relevant actions such as uploads, downloads, sharing, edits, deletions and refused attempts. These records cannot be edited or deleted by users."],
      ["9. Suspension", "We may suspend or remove accounts that break these terms or put other users or their data at risk."],
      ["10. Changes", "We may update these terms. Continued use of TrustVault after a change means you accept the updated terms."],
      ["11. Contact", "Questions about these terms: your-email@example.com"],
    ],
  },
  privacy: {
    title: "Privacy Policy",
    sections: [
      ["1. What we collect", "Username, full name, date of birth, email address, your password (stored only as a secure hash, never in plain text), the documents you upload and their details (name, category, dates), and audit records of your actions."],
      ["2. Why we collect it", "To create and secure your account, verify your age, let you store and share documents, and keep a tamper-evident record of access for security."],
      ["3. How your documents are protected", "Documents are stored privately on the server, outside public web folders. Every request is checked by the server to confirm you have permission."],
      ["4. Who can see your data", "Your documents are visible only to you and the users you share them with. Administrators can view audit records and account details needed to run the service, but not documents that were not shared with them."],
      ["5. Audit trail", "Security events are kept in an append-only log and are retained so that the integrity of the system can be verified."],
      ["6. Sharing with third parties", "We do not sell your data or share it with advertisers."],
      ["7. Retention and deletion", "Your documents stay until you delete them. You can ask for your account to be removed. Audit records may be kept for security and compliance."],
      ["8. Your rights", "You can ask to see, correct or delete your personal information by contacting us."],
      ["9. Security", "We use hashed passwords, token-based sign-in and server-side access checks. No system is perfectly secure, so please use a strong, unique password."],
      ["10. Contact", "Privacy questions: your-email@example.com"],
    ],
  },
};

function LegalModal({ type, onClose }) {
  if (!type) return null;
  const doc = LEGAL[type];
  return (
    <div className="legal-overlay" onClick={onClose}>
      <div
        className="legal-modal"
        role="dialog"
        aria-modal="true"
        aria-label={doc.title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="legal-header">
          <h2>{doc.title}</h2>
          <button type="button" className="legal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="legal-body">
          <p className="legal-date">Last updated: 24 October 2026</p>
          {doc.sections.map(([heading, text]) => (
            <section key={heading}>
              <h3>{heading}</h3>
              <p>{text}</p>
            </section>
          ))}
        </div>
        <div className="legal-footer">
          <button type="button" className="auth-submit legal-ok" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
function EyeIcon({ open }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {open ? (
        <>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
        </>
      ) : (
        <>
          <path d="M3 3l18 18" />
          <path d="M10.6 10.6a2 2 0 002.8 2.8" />
          <path d="M9.9 5.2A10.7 10.7 0 0112 5c5 0 8.5 4.5 9 7a9.8 9.8 0 01-2.1 3.4" />
          <path d="M6.2 6.2C3.9 7.7 2.4 10 2 12c.5 2.5 4 7 10 7 1.1 0 2.1-.2 3-.5" />
        </>
      )}
    </svg>
  );
}
function App() {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [accountType, setAccountType] = useState("viewer");
  const [legalModal, setLegalModal] = useState(null); // "terms" | "privacy" | null
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [token, setToken] = useState(() => sessionStorage.getItem("trustvault_token"));
  const [user, setUser] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [activeView, setActiveView] = useState("documents");
  const [auditEvents, setAuditEvents] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsError, setRequestsError] = useState("");
  const [auditError, setAuditError] = useState("");
  const [auditIntegrity, setAuditIntegrity] = useState(null);
  const [auditActionFilter, setAuditActionFilter] = useState("all");
  const [auditOutcomeFilter, setAuditOutcomeFilter] = useState("all");
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
  const [editingDocument, setEditingDocument] = useState(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [savingDocument, setSavingDocument] = useState(false);
  const [deletingDocumentId, setDeletingDocumentId] = useState(null);
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
  useEffect(() => {
  if (!token || !user || activeView !== "activity") {
    return;
  }

  if (user.role !== "admin") {
    setAuditEvents([]);
    setAuditIntegrity(null);
    setAuditError("The Activity Log is available to administrators only.");
    setAuditLoading(false);
    return;
  }

  let cancelled = false;

  async function loadAuditEvents() {
    setAuditLoading(true);
    setAuditError("");

    try {
      const [events, integrity] = await Promise.all([
        apiRequest("/admin/audit-events?limit=50&offset=0", {}, token),
        apiRequest("/admin/audit-verify", {}, token),
      ]);

      if (!cancelled) {
        setAuditEvents(Array.isArray(events) ? events : []);
        setAuditIntegrity(integrity);
      }
    } catch (error) {
      if (!cancelled) {
        setAuditEvents([]);
        setAuditIntegrity(null);
        setAuditError(
          `Could not load audit activity: ${error.message}`
        );
      }
    } finally {
      if (!cancelled) {
        setAuditLoading(false);
      }
    }
  }

  loadAuditEvents();

  return () => {
    cancelled = true;
  };
}, [token, user, activeView]);

useEffect(() => {
  if (!token || !user || activeView !== "requests") {
    return;
  }

  if (user.role !== "admin") {
    setPendingRequests([]);
    setRequestsError("Administrator access required.");
    return;
  }

  let cancelled = false;

  async function loadPendingRequests() {
    setRequestsLoading(true);
    setRequestsError("");

    try {
      const result = await apiRequest(
        "/admin/pending-requests",
        {},
        token
      );

      if (!cancelled) {
        setPendingRequests(Array.isArray(result) ? result : []);
      }
    } catch (error) {
      if (!cancelled) {
        setPendingRequests([]);
        setRequestsError(
          `Could not load pending requests: ${error.message}`
        );
      }
    } finally {
      if (!cancelled) {
        setRequestsLoading(false);
      }
    }
  }

  loadPendingRequests();

  return () => {
    cancelled = true;
  };
}, [token, user, activeView]);

const visibleDocuments =
  activeView === "shared"
    ? documents.filter((doc) => doc.owner_id !== user?.id)
    : documents;
  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    if (mode === "register") {
      if (!fullName.trim()) {
        setMessage("Please enter your full name.");
        return;
      }

      if (!dateOfBirth) {
        setMessage("Please enter your date of birth.");
        return;
      }

      const birthDate = new Date(`${dateOfBirth}T00:00:00`);
      const today = new Date();
      const minimumBirthDate = new Date();
      minimumBirthDate.setFullYear(today.getFullYear() - 18);

      if (birthDate > minimumBirthDate) {
        setMessage("You must be at least 18 years old to register.");
        return;
      }

      if (password !== confirmPassword) {
        setMessage("Passwords do not match.");
        return;
      }

      if (!acceptedTerms) {
        setMessage("Please accept the Terms and Conditions.");
        return;
      }
    }
    setLoading(true);
    try {
      if (mode === "register") {
        await apiRequest("/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
             username: username.trim(),
             email: email.trim().toLowerCase(),
             password,
             full_name: fullName.trim(),
             date_of_birth: dateOfBirth,
             requested_role: accountType, 
            }),
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
      setEmail("");
      setUsername("");
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
  async function handleEditDocument(event) {
    event.preventDefault();

    if (!editingDocument || !editName.trim() || !editCategory.trim()) {
      setMessage("Document name and category are required.");
      return;
    }

    setSavingDocument(true);
    setMessage("");

    try {
      await apiRequest(
        `/documents/${editingDocument.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: editName.trim(),
            category: editCategory.trim(),
          }),
        },
        token
      );

      setMessage("Document updated successfully.");
      setEditingDocument(null);

      const result = await apiRequest("/documents", {}, token);
      setDocuments(Array.isArray(result) ? result : []);
    } catch (error) {
      setMessage(`Update failed: ${error.message}`);
    } finally {
      setSavingDocument(false);
    }
  }
  async function handleDeleteDocument(doc) {
    const confirmed = window.confirm(
      `Permanently delete "${doc.name}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    setDeletingDocumentId(doc.id);
    setMessage("");

    try {
      await apiRequest(`/documents/${doc.id}`, {
        method: "DELETE",
      }, token);

      setDocuments((current) =>
        current.filter((item) => item.id !== doc.id)
      );

      if (shareDocumentId === doc.id) {
        setShareDocumentId(null);
      }

      if (editingDocument?.id === doc.id) {
        setEditingDocument(null);
      }

      setMessage("Document deleted successfully.");
    } catch (error) {
      setMessage(`Deletion failed: ${error.message}`);
    } finally {
      setDeletingDocumentId(null);
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
        <section className="auth-brand-panel">
          <div className="brand auth-brand">
            <div className="brand-icon auth-logo"><img
              src="/TrustVault_Logo.png"
              alt="TrustVault security logo"
              className="auth-logo-icon"
            /></div>
            <div>
              <h2>TrustVault</h2>
              <span>SECURE WORKSPACE</span>
            </div>
          </div>

          <div className="auth-brand-content">
            <p className="eyebrow">SECURITY YOU CAN TRUST</p>
            <h1>Your files.<br />Your control.</h1>
            <p className="auth-brand-description">
              Secure document sharing with complete privacy and an audit trail.
            </p>

            
            <div className="auth-features-row">
              <div className="auth-feature">
                <span className="auth-feature-icon">◇</span>
                <div>
                  <strong>Secure Storage</strong>
                  <p>Your data stays private</p>
                </div>
              </div>

              <div className="auth-feature">
                <span className="auth-feature-icon">♙</span>
                <div>
                  <strong>Controlled Access</strong>
                  <p>Share with trusted users</p>
                </div>
              </div>

              <div className="auth-feature">
                <span className="auth-feature-icon">✓</span>
                <div>
                  <strong>Audit Trail</strong>
                  <p>Track every action</p>
                </div>
              </div>
            </div>
          </div>
        </section>
        <div className="auth-card">
          <div className="brand-icon auth-logo"><img
            src="/TrustVault_Logo.png"
            alt="TrustVault security logo"
            className="auth-logo-icon"
          /></div>
          <h1>Loading your workspace</h1>
          <p>Verifying your session...</p>
        </div>
      </div>
    );
  }
  if (!token || !user) {
    return (
      <div className={`auth-page ${mode === "register" ? "is-register" : ""}`}>
        <section className="auth-brand-panel">
          <div className="brand auth-brand">
            <div className="brand-icon auth-logo">
              <img
                src="/TrustVault_Logo.png"
                alt="TrustVault security logo"
                className="auth-logo-icon"
              />
            </div>
            <div>
              <h2>TrustVault</h2>
              <span>SECURE WORKSPACE</span>
            </div>
          </div>

          <div className="auth-brand-content">
            <p className="eyebrow">SECURITY YOU CAN TRUST</p>
            <h1>Your files.<br />Your control.</h1>
            <p className="auth-brand-description">
              Secure document sharing with complete privacy and an audit trail.
            </p>
            <div className="auth-features-row">
              <div className="auth-feature">
                <span className="auth-feature-icon">◇</span>
                <div>
                  <strong>Secure Storage</strong>
                  <p>Your data stays private</p>
                </div>
              </div>

              <div className="auth-feature">
                <span className="auth-feature-icon">♙</span>
                <div>
                  <strong>Controlled Access</strong>
                  <p>Share with trusted users</p>
                </div>
              </div>

              <div className="auth-feature">
                <span className="auth-feature-icon">✓</span>
                <div>
                  <strong>Audit Trail</strong>
                  <p>Track every action</p>
                </div>
              </div>
            </div>
          </div>
        </section>
        <div className="auth-card">
          <div className="brand auth-brand">
            <div className="brand-icon auth-logo">
              <img
                src="/TrustVault_Logo.png"
                alt="TrustVault security logo"
                className="auth-logo-icon"
              /></div>
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
            <label htmlFor="username">
              {mode === "register" ? "Username" : "Username or Email"}
            </label>
            <input
              id="username"
              autoComplete="username"
              minLength={3}
              maxLength={100}
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder={
                mode === "register"
                  ? "Enter your username"
                  : "Enter your username or email"
              }
            />
            {mode === "register" && (
                <>
                  <div className="register-two-columns">
                    <div className="register-field">
                      <label htmlFor="fullName">Full name</label>
                      <input
                        id="fullName"
                        type="text"
                        autoComplete="name"
                        maxLength={100}
                        required
                        value={fullName}
                        onChange={(event) => setFullName(event.target.value)}
                        placeholder="Enter your full name"
                      />
                    </div>

                    <div className="register-field">
                      <label htmlFor="dateOfBirth">Date of birth</label>
                      <input
                        id="dateOfBirth"
                        type="date"
                        autoComplete="bday"
                        required
                        value={dateOfBirth}
                        onChange={(event) => setDateOfBirth(event.target.value)}
                      />
                    </div>
                  </div>
                <label htmlFor="email">Email address</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Enter your email address"
                />
                <label>Choose account type</label>
                <div className="account-type-options">
                  <label className="account-type-option">
                    <input
                      type="radio"
                      name="accountType"
                      value="viewer"
                      checked={accountType === "viewer"}
                      onChange={() => setAccountType("viewer")}
                    />
                    <span>
                      <strong>Viewer</strong>
                      <small>Access documents shared with you.</small>
                    </span>
                  </label>

                  <label className="account-type-option">
                    <input
                      type="radio"
                      name="accountType"
                      value="document_owner"
                      checked={accountType === "document_owner"}
                      onChange={() => setAccountType("document_owner")}
                    />
                    <span>
                      <strong>Document Owner</strong>
                      <small>Request permission to upload and manage documents.</small>
                    </span>
                  </label>
                </div>
              </>
            )}
            <label htmlFor="password">Password</label>
            <div className="password-input-wrapper">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                minLength={mode === "register" ? 8 : undefined}
                maxLength={128}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={mode === "register" ? "At least 8 characters" : "Enter your password"}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((previous) => !previous)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
              <EyeIcon open={showPassword} />
              </button>
            </div>
            {mode === "register" && (
              <>
                <label htmlFor="confirmPassword">Confirm password</label>
                <div className="password-input-wrapper">
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={128}
                    required
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Re-enter your password"
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() =>
                      setShowConfirmPassword((previous) => !previous)
                    }
                    aria-label={
                      showConfirmPassword
                        ? "Hide confirm password"
                        : "Show confirm password"
                    }
                  >
                    <EyeIcon open={showConfirmPassword} />
                  </button>
                </div>
              </>
            )}
            {mode === "register" && (
              <label className="terms-option">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(event) => setAcceptedTerms(event.target.checked)}
                />
                <span>
                  I agree to the{" "}
                  <button
                    type="button"
                    className="legal-link"
                    onClick={(e) => { e.preventDefault(); setLegalModal("terms"); }}
                  >
                    Terms and Conditions
                  </button>{" "}
                  and{" "}
                  <button
                    type="button"
                    className="legal-link"
                    onClick={(e) => { e.preventDefault(); setLegalModal("privacy"); }}
                  >
                    Privacy Policy
                  </button>.
                </span>
              </label>
            )}
            {message && (
              <p className="auth-message" role="alert">
                {message}
              </p>
            )}

            <button
              className="auth-submit"
              type="submit"
              disabled={loading}
            >
              {loading
                ? "Please wait..."
                : mode === "login"
                  ? "Sign in"
                  : "Create account"}
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
          <LegalModal type={legalModal} onClose={() => setLegalModal(null)} />
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
          <button
            className={`nav-item ${activeView === "documents" ? "active" : ""}`}
            onClick={() => {
              setActiveView("documents");
              setMessage("");
            }}
          >
            <span className="nav-icon">▤</span>
            Documents
          </button>

          <button
            className={`nav-item ${activeView === "shared" ? "active" : ""}`}
            onClick={() => {
              setActiveView("shared");
              setMessage("");
            }}
          >
            <span className="nav-icon">⇄</span>
            Shared with me
          </button>
          
          {user.role === "admin" && (
            <button
              className={`nav-item ${activeView === "requests" ? "active" : ""}`}
              onClick={() => {
                setActiveView("requests");
                setMessage("");
              }}
            >
              <span className="nav-icon">♙</span>
              Pending Requests
            </button>
          )}

          {user.role === "admin" && (
            <button
              className={`nav-item ${activeView === "activity" ? "active" : ""}`}
              onClick={() => {
                setActiveView("activity");
                setMessage("");
              }}
            >
              <span className="nav-icon">◷</span>
              Activity Log
            </button>
          )}
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
          <div className="welcome-row" style={{textAlign: "left",justifyContent: "flex-start",}}>
            <div>
              <p className="eyebrow">YOUR PRIVATE WORKSPACE</p>
              <h1>{activeView === "shared"
                ? "Shared with me"
                : activeView === "activity"
                  ? "Activity Log"
                  : activeView === "requests"
                    ? "Pending Requests"
                    : "Your documents"}
                </h1>
                <p>
                  {activeView === "shared"
                    ? "Documents other users have shared with you."
                    : activeView === "activity"
                      ? "Review security events and verify audit integrity."
                      : "Only documents you own or have been granted access to are listed."}
                </p>
            </div>
            <div className="secure-badge"><span>✓</span> Access-controlled</div>
          </div>
          
          {activeView === "requests" && user.role === "admin" && (
            <div className="documents-section">
              {requestsLoading ? (
                <p>Loading pending requests...</p>
              ) : requestsError ? (
                <p className="error-message">{requestsError}</p>
              ) : pendingRequests.length === 0 ? (
                <p>No pending Document Owner requests.</p>
              ) : (
                <div className="document-rows">
                  {pendingRequests.map((request) => (
                    <div className="document-row" key={request.id}>
                      <div>
                        <strong>{request.full_name || request.username}</strong>
                        <p>{request.email}</p>
                        <small>Requested role: Document Owner</small>
                      </div>
                      
                      
                      <div
                        className="request-actions"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "12px",
                          flexWrap: "wrap",
                        }}
                      >
                        <button
                          type="button"
                          className="auth-submit"
                          style={{ width: "110px", height: "40px", padding: "8px 12px",margin: 0, fontSize: "14px",
                            fontWeight: 600,fontFamily: "inherit",boxSizing: "border-box",}}
                          onClick={async () => {
                            try {
                              await apiRequest(
                                `/admin/pending-requests/${request.id}?decision=approve`,
                                { method: "PATCH" },
                                token
                              );
                              setPendingRequests((previous) =>
                                previous.filter((item) => item.id !== request.id)
                              );
                              setMessage("Document Owner request approved.");
                            } catch (error) {
                              setRequestsError(`Could not approve request: ${error.message}`);
                            }
                          }}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="secondary-button"
                          style={{ width: "110px", height: "40px", padding: "8px 12px",margin: 0,fontSize: "14px",fontWeight: 600,fontFamily: "inherit",boxSizing: "border-box",backgroundColor: "#dc2626",
                            color: "#ffffff",border: "1px solid #dc2626", }}
                          onClick={async () => {
                            try {
                              await apiRequest(
                                `/admin/pending-requests/${request.id}?decision=reject`,
                                { method: "PATCH" },
                                token
                              );
                              setPendingRequests((previous) =>
                                previous.filter((item) => item.id !== request.id)
                              );
                              setMessage("Document Owner request rejected.");
                            } catch (error) {
                              setRequestsError(`Could not reject request: ${error.message}`);
                            }
                          }}
                        >
                          Reject
                        </button>
                      </div>


                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeView === "documents" && (
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-heading"><span>Visible documents</span><span className="stat-icon purple">▤</span></div>
                <h2>{visibleDocuments.length}</h2>
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
          )}
          <section className="documents-panel">
            <div className="panel-header">
              {editingDocument && (
                <form
                  className="share-form"
                  onSubmit={handleEditDocument}
                >
                  <h3>Edit document details</h3>

                  <label htmlFor="edit-document-name">
                    Document name
                  </label>
                  <input
                    id="edit-document-name"
                    value={editName}
                    onChange={(event) =>
                      setEditName(event.target.value)
                    }
                    required
                    maxLength={255}
                  />

                  <label htmlFor="edit-document-category">
                    Category
                  </label>
                  <input
                    id="edit-document-category"
                    value={editCategory}
                    onChange={(event) =>
                      setEditCategory(event.target.value)
                    }
                    required
                    maxLength={100}
                  />

                  <div className="share-actions">
                    <button
                      className="primary-button"
                      type="submit"
                      disabled={savingDocument}
                    >
                      {savingDocument ? "Saving..." : "Save changes"}
                    </button>

                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => setEditingDocument(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

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
                        <div
                          className="shared-user-row"
                          key={share.username}
                        >
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
                              try {
                                await handleRevoke(
                                  shareDocumentId,
                                  share.username
                                );
                                await loadDocumentShares(shareDocumentId);
                              } finally {
                                setRevokingUsername("");
                              }
                            }}
                          >
                            {revokingUsername === share.username
                              ? "Revoking..."
                              : "Revoke"}
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
                <div>
                  {activeView === "documents" && (
                    <>
                      <h2>Document library</h2>
                      <p>Search documents available to your account.</p>
                    </>
                  )}
                  {activeView === "shared" && (
                    <>
                      <h2>Shared with me</h2>
                      <p>Documents other users have shared with your account.</p>
                    </>
                  )}
                  {activeView === "requests" && (
                    <>
                      <h2>Pending requests</h2>
                      <p>Users waiting for approval.</p>
                    </>
                  )}
                  {activeView === "activity" && (
                    <>
                      <h2>Activity Log</h2>
                      <p>Review security events and verify audit integrity.</p>
                    </>
                  )}
                </div>
                {(activeView === "documents" || activeView === "shared") && (
                  <button className="secondary-button" onClick={() => { setSearch(""); setCategory(""); }}>
                    Clear filters
                  </button>
                )}
              </div>
              
              {(activeView === "documents" || activeView === "shared") && (
                <>
                  <div className="table-header">
                    <span>DOCUMENT</span>
                    <span>CATEGORY</span>
                    <span>OWNER ID</span>
                    <span>CREATED</span>
                    <span>ACTIONS</span>
                  </div>

                  {documentsLoading ? (
                    <div className="empty-state">
                      <h3>Loading documents...</h3>
                    </div>
                  ) : visibleDocuments.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-icon">▤</div>
                      <h3>No documents found</h3>
                      <p>
                        Upload a document or ask its owner to share it with your account.
                      </p>
                    </div>
                  ) : (
                    <div className="document-rows">
                      {visibleDocuments.map((doc) => (
                        <div className="document-row" key={doc.id}>
                          <div className="document-name">
                            <span className="file-icon">▤</span>
                            <strong>{doc.name}</strong>
                          </div>

                          <span>{doc.category}</span>
                          <span>{doc.owner_id}</span>
                          <span>
                            {doc.created_at
                              ? new Date(doc.created_at).toLocaleDateString()
                              : "—"}
                          </span>

                          
                            <div className="document-actions">
                              <button
                                className="secondary-button"
                                type="button"
                                onClick={async () => {
                                  try {
                                    setMessage("");
                                    await downloadDocument(
                                      `/documents/${doc.id}/download`,
                                      token,
                                      doc.name
                                    );
                                    setMessage("Document downloaded successfully.");
                                  } catch (error) {
                                    setMessage(error.message || "Download failed.");
                                  }
                                }}
                              >
                                Download
                              </button>
                              
                              <button
                                className="secondary-button"
                                type="button"
                                onClick={async () => {
                                  try {
                                    setMessage("");
                                    await viewDocument(
                                      `/documents/${doc.id}/download`,
                                      token
                                    );
                                  } catch (error) {
                                    setMessage(error.message || "Unable to view document.");
                                  }
                                }}
                              >
                                View
                              </button>

                              {doc.owner_id === user.id && (
                                <>
                                <button
                                  className="secondary-button"
                                  type="button"
                                  onClick={async () => {
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
                                <button
                                  className="secondary-button"
                                  type="button"
                                  onClick={() => {
                                    setEditingDocument(doc);
                                    setEditName(doc.name);
                                    setEditCategory(doc.category);
                                    setMessage("");
                                  }}
                                >
                                  Edit
                                </button>
                                <button
                                  className="secondary-button"
                                  type="button"
                                  disabled={deletingDocumentId === doc.id}
                                  onClick={() => handleDeleteDocument(doc)}
                                >
                                  {deletingDocumentId === doc.id
                                    ? "Deleting..."
                                    : "Delete"}
                                </button>
                                </>
                              )}
                            </div>
                          
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
              {activeView === "activity" && (
                <div className="audit-panel">
                  {auditLoading ? (
                    <div className="empty-state">
                      <h3>Loading audit activity...</h3>
                    </div>
                  ) : auditError ? (
                    <div className="auth-message document-message" role="alert">
                      {auditError}
                    </div>
                  ) : (
                    <>
                      <div className={`audit-integrity ${auditIntegrity?.valid ? "valid" : "invalid"}`}>
                        <h3>Audit integrity</h3>
                        <p>
                          {auditIntegrity?.valid
                            ? "✓ " + auditIntegrity.message
                            : auditIntegrity?.message || "Integrity status unavailable"}
                        </p>
                      </div>

                      <h3>Recent security events</h3>

                      {auditEvents.length === 0 ? (
                        <div className="empty-state">
                          <h3>No audit events found</h3>
                          <p>Security events will appear here when recorded.</p>
                        </div>
                      ) : (
                        <div className="audit-event-list">
                          
                          <div className="audit-filters">
                            <label>
                              Filter by action
                              <select
                                value={auditActionFilter}
                                onChange={(e) => setAuditActionFilter(e.target.value)}
                              >
                                <option value="all">All actions</option>
                                <option value="document_upload">Upload</option>
                                <option value="document_download">Download</option>
                                <option value="document_share">Share</option>
                                <option value="document_update">Update</option>
                                <option value="document_delete">Delete</option>
                              </select>
                            </label>

                            <label>
                              Filter by outcome
                              <select
                                value={auditOutcomeFilter}
                                onChange={(e) => setAuditOutcomeFilter(e.target.value)}
                              >
                                <option value="all">All outcomes</option>
                                <option value="success">Success</option>
                                <option value="denied">Denied</option>
                              </select>
                            </label>
                          </div>

                          {auditEvents
                            .filter((event) =>
                              auditActionFilter === "all" ||
                              event.action === auditActionFilter
                            )
                            .filter((event) =>
                              auditOutcomeFilter === "all" ||
                              event.outcome === auditOutcomeFilter
                            )
                          .map((event) => (
                            <div className="audit-event-row" key={event.id}>
                              <strong>{event.action}</strong>
                              <span>Actor ID: {event.actor_id ?? "—"}</span>
                              <span>Document ID: {event.document_id ?? "—"}</span>
                              <span>Outcome: {event.outcome}</span>
                              <span>
                                Details:{" "}
                                  {event.details == null
                                    ? "—"
                                    : typeof event.details === "object"
                                      ? JSON.stringify(event.details)
                                      : String(event.details)}
                              </span>
                              <span>
                                Time:{" "}
                                {event.created_at
                                  ? new Date(event.created_at).toLocaleString()
                                  : "—"}
                              </span>
                              <details>
                                <summary>View integrity hashes</summary>
                                <p>Previous hash: {event.previous_hash || "—"}</p>
                                <p>Event hash: {event.event_hash || "—"}</p>
                              </details>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
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