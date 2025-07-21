// Dynamically load header and footer components and handle mobile menu

async function loadComponent(selector, url) {
    const res = await fetch(url);
    const text = await res.text();
    document.querySelector(selector).innerHTML = text;
  }
  
  window.addEventListener('DOMContentLoaded', () => {
    // Load header
    loadComponent('#header', '../components/header.html').then(() => {
      // Hamburger menu functionality
      const menuBtn = document.getElementById('menu-btn');
      const navLinks = document.getElementById('nav-links');
      if (menuBtn && navLinks) {
        menuBtn.addEventListener('click', () => {
          navLinks.classList.toggle('show');
          menuBtn.classList.toggle('open');
        });
      }
    });
  
    // Load footer
    loadComponent('#footer', '../components/footer.html');
  });
  