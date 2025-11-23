// Mobile nav toggle + dropdown behavior + year stamp

document.addEventListener("DOMContentLoaded", () => {
  const navToggle = document.querySelector(".nav-toggle");
  const navLinks = document.querySelector(".nav-links");
  const dropdowns = document.querySelectorAll(".nav-dropdown");
  const yearEl = document.getElementById("year");

  if (yearEl) {
    yearEl.textContent = new Date().getFullYear().toString();
  }

  if (navToggle && navLinks) {
    navToggle.addEventListener("click", () => {
      navLinks.classList.toggle("open");
    });
  }

  dropdowns.forEach((dropdown) => {
    const btn = dropdown.querySelector(".nav-drop-btn");
    if (!btn) return;

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = dropdown.classList.contains("open");
      document
        .querySelectorAll(".nav-dropdown.open")
        .forEach((d) => d.classList.remove("open"));
      if (!isOpen) {
        dropdown.classList.add("open");
      }
    });
  });

  document.addEventListener("click", () => {
    document
      .querySelectorAll(".nav-dropdown.open")
      .forEach((d) => d.classList.remove("open"));
  });
});
