// assets/js/verifier.js

const BACKEND_URL = "http://localhost:4000";

const identityIdInput = document.getElementById("identity-id");
const proofJsonInput = document.getElementById("proof-json");
const btnVerify = document.getElementById("btn-verify");
const verifyStatusEl = document.getElementById("verify-status");
const verifyOutputEl = document.getElementById("verify-output");

btnVerify.addEventListener("click", async () => {
  verifyStatusEl.textContent = "";
  verifyOutputEl.textContent = "";

  const identityId = identityIdInput.value.trim();
  if (!identityId) {
    verifyStatusEl.textContent = "Please provide identityId.";
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(proofJsonInput.value);
  } catch (err) {
    verifyStatusEl.textContent = "Invalid JSON.";
    return;
  }

  if (!parsed || !parsed.proof) {
    verifyStatusEl.textContent = "Expected object with { identityId, proof }.";
    return;
  }

  verifyStatusEl.textContent = "Verifying...";

  try {
    const res = await fetch(`${BACKEND_URL}/proof/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identityId,
        proof: parsed.proof,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      verifyStatusEl.textContent = `Error: ${data.error || "unknown"}`;
      return;
    }

    verifyStatusEl.textContent = data.valid ? "Proof valid" : "Proof invalid";
    verifyOutputEl.textContent = JSON.stringify(data, null, 2);
  } catch (err) {
    console.error(err);
    verifyStatusEl.textContent = "Network error.";
  }
});
