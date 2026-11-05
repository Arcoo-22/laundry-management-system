// Sign-in and registration forms. Uses plain fetch (not api.js) because a wrong
// password is a normal 401 here and must not trigger the "session expired" redirect.
import "./ui.js";

const errorBox = document.getElementById("auth-error");
const submitBtn = document.getElementById("auth-submit");

const showError = (message) => {
  errorBox.textContent = message;
  errorBox.hidden = false;
};

async function post(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Something went wrong (${res.status}). Please try again.`);
  return data;
}

async function submit(url, body, busyLabel) {
  errorBox.hidden = true;
  const label = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = busyLabel;
  try {
    const data = await post(url, body);
    location.replace(data.redirect || "/");
  } catch (err) {
    showError(err.message);
    submitBtn.disabled = false;
    submitBtn.textContent = label;
  }
}

document.getElementById("form-login")?.addEventListener("submit", (e) => {
  e.preventDefault();
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  if (!email || !password) return showError("Enter your email and password.");
  submit("/api/auth/login", { email, password }, "Signing in…");
});

document.getElementById("form-register")?.addEventListener("submit", (e) => {
  e.preventDefault();
  const value = (id) => document.getElementById(id).value;
  const password = value("reg-password");

  if (password !== value("reg-confirm")) return showError("The two passwords don't match.");
  submit(
    "/api/auth/register",
    {
      full_name: value("reg-name").trim(),
      contact: value("reg-contact").trim(),
      email: value("reg-email").trim(),
      address: value("reg-address").trim(),
      password,
    },
    "Creating account…"
  );
});