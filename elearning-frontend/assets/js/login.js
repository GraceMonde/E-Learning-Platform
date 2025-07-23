const loginForm = document.getElementById("login-form");
const loginBtn = document.getElementById("login-btn");
const loader = document.getElementById("loader");
const errorMsg = document.getElementById("error-msg");

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  // Get form values
  const email = e.target.email.value.trim();
  const password = e.target.password.value;

  // Reset UI states
  errorMsg.textContent = '';
  loginBtn.disabled = true;
  loginBtn.classList.add('loading');
  loginBtn.textContent = "Logging in...";
  loader.style.display = "block";

  try {
    // 1. Send login request to backend
    const response = await fetch("http://localhost:5000/api/auth/login", { // Use your actual backend endpoint!
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    // 2. Check for errors from server
    if (!response.ok) {
      throw new Error(data.message || "Login failed. Please try again.");
    }

    // 3. Save JWT token and user info to localStorage
    if (data.token) {
      localStorage.setItem("userToken", data.token);
      if (data.user) {
        localStorage.setItem("userInfo", JSON.stringify(data.user));
      }
    }

    // 4. UI feedback & redirect
    loginBtn.textContent = "Success!";
    loginBtn.classList.remove('loading');
    loginBtn.classList.add('success');
    setTimeout(() => {
      window.location.href = "dashboard.html";
    }, 800);

  } catch (error) {
    // 5. Show error message
    errorMsg.textContent = error.message;
    loginBtn.disabled = false;
    loginBtn.classList.remove('loading', 'success');
    loginBtn.textContent = "Log In";
  } finally {
    loader.style.display = "none";
  }
});
