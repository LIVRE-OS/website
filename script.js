document.addEventListener("DOMContentLoaded", () => {
  const path = window.location.pathname.split("/").pop() || "index.html";
  const links = document.querySelectorAll(".nav a");
  links.forEach(link => {
    const href = link.getAttribute("href");
    if (href && href === path) {
      link.classList.add("active");
    }
  });
});
