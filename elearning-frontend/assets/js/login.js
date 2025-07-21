const loginForm = document.getElementById("login-form");
const loginBtn = document.getElementById("login-btn");
const loader = document.getElementById("loader");
const errorMsg = document.getElementById("error-msg");

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = e.target.email.value.trim();
  const password = e.target.password.value;

  // Reset UI
  errorMsg.textContent = '';
  loginBtn.disabled = true;
  loginBtn.classList.add('loading');
  loginBtn.textContent = "Logging in...";
  loader.style.display = "block";

  try {
    const response = await fetch("https://your-api-domain.com/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Login failed. Please try again.");
    }

    // Login success
    loginBtn.textContent = "Success!";
    loginBtn.classList.remove('loading');
    loginBtn.classList.add('success');

    // Redirect to dashboard or homepage
    setTimeout(() => {
      window.location.href = "dashboard.html";
    }, 1000);
  } catch (error) {
    errorMsg.textContent = error.message;
    loginBtn.disabled = false;
    loginBtn.classList.remove('loading', 'success');
    loginBtn.textContent = "Log In";
  } finally {
    loader.style.display = "none";
  }
});
