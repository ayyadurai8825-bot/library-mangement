const registerForm = document.getElementById("registerForm");

if (registerForm) {
  let errorTimeout;

  document.querySelectorAll("[data-password-toggle]").forEach(function (toggle) {
    toggle.addEventListener("click", function () {
      const passwordInput = document.getElementById(toggle.dataset.passwordToggle);
      const isVisible = passwordInput.type === "text";
      passwordInput.type = isVisible ? "password" : "text";
      toggle.setAttribute("aria-pressed", String(!isVisible));
      toggle.setAttribute(
        "aria-label",
        `${isVisible ? "Show" : "Hide"} ${passwordInput.id === "confirmPassword" ? "confirm password" : "password"}`
      );
    });
  });

  registerForm.addEventListener("reset", function () {
    document.querySelectorAll("[data-password-toggle]").forEach(function (toggle) {
      const passwordInput = document.getElementById(toggle.dataset.passwordToggle);
      passwordInput.type = "password";
      toggle.setAttribute("aria-pressed", "false");
      toggle.setAttribute(
        "aria-label",
        `Show ${passwordInput.id === "confirmPassword" ? "confirm password" : "password"}`
      );
    });
  });

  function showErrors(errors) {
    clearTimeout(errorTimeout);
    errors.forEach(function (item) {
      item.element.textContent = item.message;
    });
    errorTimeout = setTimeout(function () {
      errors.forEach(function (item) {
        item.element.textContent = "";
      });
    }, 5000);
  }

  registerForm.addEventListener("submit", function (event) {
    event.preventDefault();
    clearTimeout(errorTimeout);

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim().toLowerCase();
    const phone = document.getElementById("phone").value.trim();
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;
    const successMessage = document.getElementById("successMessage");

    const nameError = document.getElementById("nameError");
    const emailError = document.getElementById("emailError");
    const phoneError = document.getElementById("phoneError");
    const passwordError = document.getElementById("passwordError");
    const confirmPasswordError = document.getElementById("confirmPasswordError");

    [nameError, emailError, phoneError, passwordError, confirmPasswordError]
      .forEach(function (error) {
        error.textContent = "";
      });
    successMessage.textContent = "";

    const namePattern = /^[A-Za-z ]+$/;
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const phonePattern = /^[0-9]{10}$/;

    const requiredErrors = [];
    [
      [name, nameError, "Full Name is required."],
      [email, emailError, "Email is required."],
      [phone, phoneError, "Phone number is required."],
      [password, passwordError, "Password is required."],
      [confirmPassword, confirmPasswordError, "Please confirm your password."]
    ].forEach(function (field) {
      if (!field[0].trim()) {
        requiredErrors.push({ element: field[1], message: field[2] });
      }
    });
    if (requiredErrors.length > 0) {
      showErrors(requiredErrors);
      return;
    }

    if (!namePattern.test(name)) {
      showErrors([{ element: nameError, message: "Full Name should contain only letters and spaces." }]);
      return;
    }

    if (!emailPattern.test(email)) {
      showErrors([{ element: emailError, message: "Please enter a valid email address." }]);
      return;
    }

    if (!phonePattern.test(phone)) {
      showErrors([{ element: phoneError, message: "Phone Number must contain exactly 10 digits." }]);
      return;
    }

    if (password.length < 6) {
      showErrors([{ element: passwordError, message: "Password must be at least 6 characters." }]);
      return;
    }

    if (password !== confirmPassword) {
      showErrors([{ element: confirmPasswordError, message: "Passwords do not match." }]);
      return;
    }

    let users;
    try {
      const savedUsers = localStorage.getItem("libraryUsers");
      users = savedUsers ? JSON.parse(savedUsers) : [];

      if (!Array.isArray(users)) {
        throw new Error("Saved user records are not a list.");
      }
    } catch (error) {
      console.error("Could not read registered users from local storage.", error);
      showErrors([{ element: emailError, message: "Unable to check existing accounts. Please try again." }]);
      return;
    }

    const emailAlreadyRegistered = users.some(function (user) {
      return user &&
        typeof user.email === "string" &&
        user.email.toLowerCase() === email;
    });

    if (emailAlreadyRegistered) {
      showErrors([{ element: emailError, message: "This email is already registered." }]);
      return;
    }

    const user = {
      name: name,
      email: email,
      phone: phone,
      password: password,
      createdAt: new Date().toISOString()
    };

    try {
      users.push(user);
      localStorage.setItem("libraryUsers", JSON.stringify(users));
      localStorage.removeItem("currentUser");
    } catch (error) {
      console.error("Could not save the new user to local storage.", error);
      successMessage.style.color = "red";
      successMessage.textContent = "Registration could not be saved. Check browser storage and try again.";
      errorTimeout = setTimeout(function () {
        successMessage.textContent = "";
      }, 2000);
      return;
    }

    successMessage.style.color = "green";
    successMessage.textContent = "Registration successful. Redirecting to login...";
    registerForm.reset();

    setTimeout(function () {
      window.location.href = "../loginpage/login.html";
    }, 1200);
  });
}
