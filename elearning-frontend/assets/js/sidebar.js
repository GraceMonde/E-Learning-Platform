async function loadSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    const res = await fetch('../components/sidebar.html');
    sidebar.innerHTML = await res.text();
    const path = window.location.pathname.split('/').pop();
    sidebar.querySelectorAll('.sidebar-nav a').forEach(link => {
        if (link.getAttribute('href') === path) {
            link.classList.add('active');
        }
    });
}

document.addEventListener('DOMContentLoaded', loadSidebar);
