
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export async function apiRequest(path, options = {}, token = null) {
  const headers = {
    ...(options.body instanceof FormData
      ? {}
      : options.body
        ? { "Content-Type": "application/json" }
        : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      typeof data === "object" && data !== null
        ? data.detail || "Request failed"
        : data || "Request failed";

    throw new Error(message);
  }

  return data;
}

export async function downloadDocument(path, token, filename) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const contentType = response.headers.get("content-type") || "";
    let message = "Download failed.";

    if (contentType.includes("application/json")) {
      const data = await response.json();
      message = data.detail || message;
    }

    throw new Error(message);
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.URL.revokeObjectURL(url);
}

export async function viewDocument(path, token) {
  const previewWindow = window.open("about:blank", "_blank");

  if (!previewWindow) {
    throw new Error("Please allow pop-ups to view this document.");
  }

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.detail || "Unable to view document.");
    }

    const blob = await response.blob();
    const pdfBlob = new Blob([blob], {
      type: "application/pdf",
    });
    const fileUrl = URL.createObjectURL(pdfBlob);

    previewWindow.location.href = fileUrl;
  } catch (error) {
    previewWindow.close();
    throw error;
  }
}

