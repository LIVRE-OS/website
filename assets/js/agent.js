// assets/js/agent.js

const BACKEND_URL = "http://localhost:4000";

let currentIdentityId = null;
let currentCommitment = null;

const identityStatusEl = document.getElementById("identity-status");
const identityOutputEl = document.getElementById("identity-output");
const btnCreateIdentity = document.getElementById("btn-create-identity");

const birthdateInput = document.getElementById("birthdate");
const countryInput = document.getElementById("country");
const btnSaveAttrs = document.getElementById("btn-save-attrs");
const attrsStatusEl = document.getElementById("attrs-status");
const attrsOutputEl = document.getElementById("attrs-output");

const btnGenerateProof = document.getElementById("btn-generate-proof");
const proofStatusEl = document.getElementById("proof-status");
const proofOutputEl = document.getElementById("proof-output");

btnCreateIdentity.addEventListener("click", async () => {
  identityStatusEl.textContent = "Creating identity...";
  identityOutputEl.textContent = "";

  try {
    const res = await fetch(`${BACKEND_URL}/identity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      identityStatusEl.textContent = "Error creating identity.";
      return;
    }

    const data = await res.json();
    currentIdentityId = data.identityId;
    currentCommitment = data.commitment;

    identityStatusEl.textContent = "Identity created.";
    identityOutputEl.textContent = JSON.stringify(data, null, 2);

    btnSaveAttrs.disabled = false;
    btnGenerateProof.disabled = false;
  } catch (err) {
    console.error(err);
    identityStatusEl.textContent = "Error creating identity (network).";
  }
});

btnSaveAttrs.addEventListener("click", async () => {
  if (!currentIdentityId) {
    attrsStatusEl.textContent = "Create an identity first.";
    return;
  }

  const birthdate = birthdateInput.value.trim();
  const country = countryInput.value.trim();

  if (!birthdate || !country) {
    attrsStatusEl.textContent = "Please fill birthdate and country.";
    return;
  }

  attrsStatusEl.textContent = "Saving attributes to Vault...";
  attrsOutputEl.textContent = "";

  try {
    const res = await fetch(`${BACKEND_URL}/vault/${currentIdentityId}/attributes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ birthdate, country }),
    });

    const data = await res.json();
    if (!res.ok) {
      attrsStatusEl.textContent = `Error: ${data.error || "unknown"}`;
      return;
    }

    attrsStatusEl.textContent = "Attributes saved & commitment updated.";
    attrsOutputEl.textContent = JSON.stringify(data, null, 2);

    currentCommitment = data.commitment;
    identityOutputEl.textContent = JSON.stringify(
      {
        identityId: data.identityId,
        commitment: data.commitment,
        attributesRoot: data.attributesRoot,
      },
      null,
      2
    );
  } catch (err) {
    console.error(err);
    attrsStatusEl.textContent = "Network error.";
  }
});

btnGenerateProof.addEventListener("click", async () => {
  if (!currentIdentityId || !currentCommitment) {
    proofStatusEl.textContent = "Create identity & set attributes first.";
    return;
  }

  proofStatusEl.textContent = "Requesting proof...";
  proofOutputEl.value = "";

  try {
    const res = await fetch(`${BACKEND_URL}/proof`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateId: "age_over_18_and_resident_pt",
        identityId: currentIdentityId,
        commitment: currentCommitment,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      proofStatusEl.textContent = `Error: ${data.error || "unable to generate proof"}`;
      return;
    }

    proofStatusEl.textContent = "Proof generated.";
    const bundle = {
      identityId: currentIdentityId,
      proof: data,
    };
    proofOutputEl.value = JSON.stringify(bundle, null, 2);
  } catch (err) {
    console.error(err);
    proofStatusEl.textContent = "Network error.";
  }
});
