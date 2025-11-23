// assets/js/agent.js

const API_BASE = window.API_BASE ?? "";
const DEFAULT_TEMPLATE_ID = "age_over_18_and_resident_pt";
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const COUNTRY_REGEX = /^[A-Z]{2}$/;

const identities = [];
let activeIdentityId = null;

document.addEventListener("DOMContentLoaded", () => {
  // Grab DOM elements AFTER the DOM is ready
  const identityStatusEl = document.getElementById("identity-status");
  const identityOutputEl = document.getElementById("identity-output");
  const identitySelect = document.getElementById("identity-select");
  const btnCreateIdentity = document.getElementById("btn-create-identity");

  const birthdateInput = document.getElementById("birthdate");
  const countryInput = document.getElementById("country");
  const btnSaveAttrs = document.getElementById("btn-save-attrs");
  const attrsStatusEl = document.getElementById("attrs-status");
  const attrsOutputEl = document.getElementById("attrs-output");

  const btnGenerateProof = document.getElementById("btn-generate-proof");
  const proofStatusEl = document.getElementById("proof-status");
  const proofOutputEl = document.getElementById("proof-output");

  const identityExportEl = document.getElementById("identity-export");
  const proofExportEl = document.getElementById("proof-export");

  const btnCopyIdentity = document.getElementById("btn-copy-identity");
  const btnCopyProof = document.getElementById("btn-copy-proof");
  const btnDownloadIdentity = document.getElementById("btn-download-identity");
  const btnDownloadProof = document.getElementById("btn-download-proof");
  const btnOpenVerifier = document.getElementById("btn-open-verifier");

  // If something is missing, don’t crash the whole app
  if (
    !identityStatusEl ||
    !identityOutputEl ||
    !identitySelect ||
    !btnCreateIdentity ||
    !birthdateInput ||
    !countryInput ||
    !btnSaveAttrs ||
    !attrsStatusEl ||
    !attrsOutputEl ||
    !btnGenerateProof ||
    !proofStatusEl ||
    !proofOutputEl ||
    !identityExportEl ||
    !proofExportEl ||
    !btnCopyIdentity ||
    !btnCopyProof ||
    !btnDownloadIdentity ||
    !btnDownloadProof ||
    !btnOpenVerifier
  ) {
    console.error("[Agent] Missing one or more required DOM elements.");
    return;
  }

  // ==========================
  // Helpers: identity state
  // ==========================

  function getActiveIdentity() {
    return (
      identities.find((record) => record.identityId === activeIdentityId) ??
      null
    );
  }

  function ensureActiveIdentity() {
    if (activeIdentityId && getActiveIdentity()) {
      return;
    }
    activeIdentityId = identities.length ? identities[0].identityId : null;
  }

  function renderIdentitySelector() {
    identitySelect.innerHTML = "";
    if (!identities.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "No identities yet";
      identitySelect.appendChild(option);
      identitySelect.disabled = true;
      return;
    }

    identitySelect.disabled = false;
    identities.forEach((identity, index) => {
      const option = document.createElement("option");
      option.value = identity.identityId;
      const suffix = identity.identityId.slice(0, 8);
      option.textContent = `${index + 1}: ${suffix}...`;
      if (identity.identityId === activeIdentityId) {
        option.selected = true;
      }
      identitySelect.appendChild(option);
    });
  }

  function getIdentityExportPayload(identity) {
    if (!identity) return null;
    return {
      identityId: identity.identityId,
      commitment: identity.commitment,
      attributesRoot: identity.attributesRoot,
    };
  }

  function renderIdentityOutput() {
    const identity = getActiveIdentity();
    if (!identity) {
      identityOutputEl.textContent = "";
      identityExportEl.value = "";
      btnCopyIdentity.disabled = true;
      btnDownloadIdentity.disabled = true;
      return;
    }

    const payload = JSON.stringify(getIdentityExportPayload(identity), null, 2);
    identityOutputEl.textContent = payload;
    identityExportEl.value = payload;
    btnCopyIdentity.disabled = false;
    btnDownloadIdentity.disabled = false;
  }

  function renderProofOutput() {
    const identity = getActiveIdentity();
    if (!identity || !identity.lastProofBundle) {
      proofOutputEl.textContent = "";
      proofExportEl.value = "";
      btnCopyProof.disabled = true;
      btnDownloadProof.disabled = true;
      return;
    }
    const payload = JSON.stringify(identity.lastProofBundle, null, 2);
    proofOutputEl.textContent = payload;
    proofExportEl.value = payload;
    btnCopyProof.disabled = false;
    btnDownloadProof.disabled = false;
  }

  function syncAttributeInputs() {
    const identity = getActiveIdentity();
    const hasIdentity = Boolean(identity);
    birthdateInput.disabled = !hasIdentity;
    countryInput.disabled = !hasIdentity;

    if (!hasIdentity) {
      birthdateInput.value = "";
      countryInput.value = "";
      return;
    }

    birthdateInput.value = identity.attributes.birthdate ?? "";
    countryInput.value = identity.attributes.country ?? "";
  }

  function refreshUI() {
    ensureActiveIdentity();
    renderIdentitySelector();
    syncAttributeInputs();
    renderIdentityOutput();
    renderProofOutput();
    const hasIdentity = Boolean(getActiveIdentity());
    btnSaveAttrs.disabled = !hasIdentity;
    btnGenerateProof.disabled = !hasIdentity;
  }

  function setActiveIdentity(identityId) {
    if (identityId && identities.some((id) => id.identityId === identityId)) {
      activeIdentityId = identityId;
    } else {
      activeIdentityId = identities.length ? identities[0].identityId : null;
    }
    attrsStatusEl.textContent = "";
    attrsOutputEl.textContent = "";
    proofStatusEl.textContent = "";
    proofOutputEl.textContent = "";
    refreshUI();
  }

  // ==========================
  // Validation helpers
  // ==========================

  function calculateAge(birthDate, reference) {
    let age = reference.getUTCFullYear() - birthDate.getUTCFullYear();
    const monthDiff = reference.getUTCMonth() - birthDate.getUTCMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && reference.getUTCDate() < birthDate.getUTCDate())
    ) {
      age--;
    }
    return age;
  }

  function validateBirthdateInput(raw) {
    const trimmed = raw.trim();
    if (!trimmed) {
      return { ok: false, message: "Birthdate is required." };
    }
    if (!DATE_REGEX.test(trimmed)) {
      return { ok: false, message: "Birthdate must match YYYY-MM-DD." };
    }
    const [yearStr, monthStr, dayStr] = trimmed.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);
    const day = Number(dayStr);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() + 1 !== month ||
      parsed.getUTCDate() !== day
    ) {
      return { ok: false, message: "Birthdate must be a valid calendar date." };
    }
    const now = new Date();
    const todayUTC = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );
    if (parsed > todayUTC) {
      return { ok: false, message: "Birthdate cannot be in the future." };
    }
    const age = calculateAge(parsed, todayUTC);
    if (age > 150) {
      return { ok: false, message: "Birthdate must represent age under 150." };
    }
    return { ok: true, value: trimmed };
  }

  function validateCountryInput(raw) {
    const trimmed = raw.trim().toUpperCase();
    if (!trimmed) {
      return { ok: false, message: "Country is required." };
    }
    if (!COUNTRY_REGEX.test(trimmed)) {
      return {
        ok: false,
        message: "Country must be a 2-letter ISO code (e.g. PT).",
      };
    }
    return { ok: true, value: trimmed };
  }

  // ==========================
  // API calls
  // ==========================

  async function createIdentityRecord(statusMessage = "Creating identity...") {
    identityStatusEl.textContent = statusMessage;
    const res = await fetch(`${API_BASE}/identity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = data.error || "Unable to create identity.";
      identityStatusEl.textContent = message;
      throw new Error(message);
    }

    const identityRecord = {
      identityId: data.identityId,
      commitment: data.commitment,
      attributesRoot: data.attributesRoot ?? null,
      attributes: {
        birthdate: null,
        country: null,
      },
      lastProofBundle: null,
    };

    identities.push(identityRecord);
    setActiveIdentity(identityRecord.identityId);
    identityStatusEl.textContent = `Identity created: ${identityRecord.identityId}`;
  }

  async function requestProof(identityId, commitment) {
    proofStatusEl.textContent = "Requesting proof...";

    const res = await fetch(`${API_BASE}/proof`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateId: DEFAULT_TEMPLATE_ID,
        identityId,
        commitment,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = data.error || "Unable to generate proof.";
      proofStatusEl.textContent = message;
      throw new Error(message);
    }

    return data;
  }

  // ==========================
  // JSON copy / download helpers
  // ==========================

  async function copyJsonToClipboard(payload, statusEl) {
    try {
      const json = JSON.stringify(payload, null, 2);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(json);
      } else {
        // Fallback for older browsers
        const tmp = document.createElement("textarea");
        tmp.value = json;
        document.body.appendChild(tmp);
        tmp.select();
        document.execCommand("copy");
        tmp.remove();
      }
      if (statusEl) {
        statusEl.textContent = "JSON copied to clipboard.";
      }
    } catch (err) {
      console.error(err);
      if (statusEl) statusEl.textContent = "Failed to copy JSON.";
    }
  }

  function downloadJsonFile(payload, filename, statusEl) {
    try {
      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      if (statusEl) {
        statusEl.textContent = `Downloaded ${filename}`;
      }
    } catch (err) {
      console.error(err);
      if (statusEl) statusEl.textContent = "Failed to download JSON.";
    }
  }

  // ==========================
  // Event handlers
  // ==========================

  btnCreateIdentity.addEventListener("click", async () => {
    btnCreateIdentity.disabled = true;
    try {
      await createIdentityRecord("Creating identity...");
    } catch (err) {
      console.error(err);
      identityStatusEl.textContent =
        err instanceof Error ? err.message : "Error creating identity.";
    } finally {
      btnCreateIdentity.disabled = false;
    }
  });

  identitySelect.addEventListener("change", (event) => {
    const target = event.target;
    const value =
      target && typeof target.value === "string" ? target.value : null;
    setActiveIdentity(value);
  });

  btnSaveAttrs.addEventListener("click", async () => {
    const identity = getActiveIdentity();
    if (!identity) {
      attrsStatusEl.textContent = "Create or select an identity first.";
      return;
    }

    const birthdateValidation = validateBirthdateInput(birthdateInput.value);
    if (!birthdateValidation.ok) {
      attrsStatusEl.textContent = birthdateValidation.message;
      return;
    }

    const countryValidation = validateCountryInput(countryInput.value);
    if (!countryValidation.ok) {
      attrsStatusEl.textContent = countryValidation.message;
      return;
    }

    const birthdate = birthdateValidation.value;
    const country = countryValidation.value;
    birthdateInput.value = birthdate;
    countryInput.value = country;

    attrsStatusEl.textContent = "Saving attributes to Vault...";
    attrsOutputEl.textContent = "";

    try {
      const res = await fetch(`${API_BASE}/attributes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identityId: identity.identityId,
          birthdate,
          country,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        attrsStatusEl.textContent = `Error: ${data.error || "unknown"}`;
        return;
      }

      attrsStatusEl.textContent = "Attributes saved & commitment updated.";
      attrsOutputEl.textContent = JSON.stringify(data, null, 2);

      identity.commitment = data.commitment ?? identity.commitment;
      identity.attributesRoot = data.attributesRoot ?? identity.attributesRoot;
      identity.attributes = { birthdate, country };
      identity.lastProofBundle = null;
      proofStatusEl.textContent = "";
      renderIdentityOutput();
      renderProofOutput();
    } catch (err) {
      console.error(err);
      attrsStatusEl.textContent = "Network error.";
    }
  });

  btnGenerateProof.addEventListener("click", async () => {
    const identity = getActiveIdentity();
    if (!identity) {
      proofStatusEl.textContent = "Create or select an identity first.";
      return;
    }

    proofStatusEl.textContent = "Generating proof...";
    btnGenerateProof.disabled = true;

    try {
      const proof = await requestProof(
        identity.identityId,
        identity.commitment
      );
      identity.lastProofBundle = {
        identityId: identity.identityId,
        proof,
      };
      proofStatusEl.textContent = "Proof generated.";
      renderProofOutput();
    } catch (err) {
      console.error(err);
      proofStatusEl.textContent =
        err instanceof Error ? err.message : "Failed to generate proof.";
    } finally {
      btnGenerateProof.disabled = false;
    }
  });

  btnCopyIdentity.addEventListener("click", async () => {
    const identity = getActiveIdentity();
    if (!identity) return;
    const payload = getIdentityExportPayload(identity);
    if (!payload) return;
    await copyJsonToClipboard(payload, identityStatusEl);
  });

  btnCopyProof.addEventListener("click", async () => {
    const activeIdentity = getActiveIdentity();
    const proofBundle = activeIdentity ? activeIdentity.lastProofBundle : null;
    if (!proofBundle || !activeIdentity) return;
    await copyJsonToClipboard(proofBundle, proofStatusEl);
  });

  btnDownloadIdentity.addEventListener("click", () => {
    const identity = getActiveIdentity();
    if (!identity) return;
    const payload = getIdentityExportPayload(identity);
    if (!payload) return;
    downloadJsonFile(
      payload,
      `identity-${identity.identityId}.json`,
      identityStatusEl
    );
  });

  btnDownloadProof.addEventListener("click", () => {
    const activeIdentity = getActiveIdentity();
    const proofBundle = activeIdentity ? activeIdentity.lastProofBundle : null;
    if (!proofBundle || !activeIdentity) return;
    downloadJsonFile(
      proofBundle,
      `proof-${activeIdentity.identityId}.json`,
      proofStatusEl
    );
  });

  btnOpenVerifier.addEventListener("click", () => {
    window.open("/verifier", "_blank");
  });

  // Initial UI sync
  refreshUI();
});
