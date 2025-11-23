// assets/js/verifier.js

const API_BASE = window.API_BASE ?? "http://localhost:4000";

const identityJsonInput = document.getElementById("identity-json");
const proofJsonInput = document.getElementById("proof-json");
const btnVerify = document.getElementById("verify-btn");
const verifyStatusEl = document.getElementById("verify-status");
const verifyResultEl = document.getElementById("verify-result");

btnVerify.addEventListener("click", async () => {
  verifyStatusEl.textContent = "";
  verifyResultEl.textContent = "";

  let identityPayload;
  try {
    identityPayload = JSON.parse(identityJsonInput.value);
  } catch (err) {
    verifyStatusEl.textContent = "Invalid identity JSON.";
    return;
  }

  if (!identityPayload || typeof identityPayload !== "object") {
    verifyStatusEl.textContent = "Identity JSON must be an object.";
    return;
  }

  let proofPayload;
  try {
    proofPayload = JSON.parse(proofJsonInput.value);
  } catch (err) {
    verifyStatusEl.textContent = "Invalid proof JSON.";
    return;
  }

  if (!proofPayload || typeof proofPayload !== "object") {
    verifyStatusEl.textContent = "Proof JSON must be an object.";
    return;
  }

  const derivedIdentityId =
    (typeof proofPayload.identityId === "string" && proofPayload.identityId) ||
    (typeof identityPayload.identityId === "string" &&
      identityPayload.identityId);
  if (!derivedIdentityId) {
    verifyStatusEl.textContent = "identityId missing from payloads.";
    return;
  }

  const proofBody =
    proofPayload.proof && typeof proofPayload.proof === "object"
      ? proofPayload.proof
      : proofPayload;

  btnVerify.disabled = true;
  verifyStatusEl.textContent = "Verifying...";

  try {
    const res = await fetch(`${API_BASE}/proof/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identityId: derivedIdentityId,
        proof: proofBody,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = data.error || "Verification failed.";
      verifyStatusEl.textContent = message;
      return;
    }

    verifyStatusEl.textContent = data.valid
      ? "Proof is valid ✅."
      : "Proof is invalid ❌";
    verifyResultEl.textContent = JSON.stringify(data, null, 2);
  } catch (err) {
    console.error(err);
    verifyStatusEl.textContent = "Network error.";
  } finally {
    btnVerify.disabled = false;
  }
});
